"""Canonical publication of dated SEC RIA and ERA information reports."""

import json
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from duckdb import DuckDBPyConnection

from riascout_adv_data.field_mapping import ColumnMappingError, ColumnResolver
from riascout_adv_data.official_db import OfficialDatabase
from riascout_adv_data.raw_ingest import quote_ident

TRANSFORMATION_VERSION = "monthly-v1"

MONTHLY_FIELDS = {
    "firm_crd": ("CRD Number", "CRD #", "Organization CRD Number", "Organization CRD#"),
    "firm_name": ("Primary Business Name", "Legal Name", "Name"),
    "sec_number": ("SEC Number", "SEC File Number", "SEC#"),
    "principal_city": ("Main Office City", "1F1-City"),
    "principal_region": ("Main Office State", "1F1-State"),
    "principal_country": ("Main Office Country", "1F1-Country"),
    "principal_postal_code": ("Main Office Postal Code", "Main Office Zip", "1F3"),
    "filing_date": ("Filing Date", "Latest ADV Filing Date", "Date Submitted", "DateSubmitted"),
    "regulatory_aum": ("5F(2)(c)", "5F2c", "Regulatory Assets Under Management"),
    "employee_count": ("5A", "Total Number of Employees"),
    "advisory_employee_count": ("5B(1)", "5B1"),
}


class MonthlyReportError(ValueError):
    """Raised when a dated RIA/ERA report cannot be published safely."""


@dataclass(frozen=True)
class MonthlyPublicationResult:
    """Counts from one monthly-report publication."""

    published_observations: int
    unavailable_field_groups: tuple[str, ...]


@dataclass(frozen=True)
class _ReportTable:
    artifact_id: str
    dataset_kind: str
    observation_date: date
    member_name: str
    table_name: str
    columns: tuple[str, ...]


class MonthlyReportPublisher:
    """Publish official monthly RIA/ERA rows as dated observations."""

    def __init__(self, database: OfficialDatabase) -> None:
        """Initialize the publisher for one official database."""
        self._database = database

    def publish(self, artifact_ids: Sequence[str]) -> MonthlyPublicationResult:
        """Publish one or more monthly artifacts atomically and idempotently."""
        unique_ids = tuple(dict.fromkeys(artifact_ids))
        if not unique_ids:
            raise ValueError("artifact_ids must not be empty")
        if self._already_published(unique_ids):
            return self._result(unique_ids)

        unavailable: set[str] = set()
        published = 0
        with self._database.transaction() as connection:
            tables = self._tables(connection, unique_ids)
            if len(tables) != len(unique_ids):
                raise MonthlyReportError("Each monthly artifact must contain exactly one ingested data table")
            for table in tables:
                connection.execute(
                    """
                    INSERT INTO canonicalization_runs (
                        artifact_id, transformation_version, status, started_at, quarantined_rows
                    ) VALUES (?, ?, 'running', ?, 0)
                    ON CONFLICT (artifact_id, transformation_version) DO UPDATE SET
                        status='running', started_at=excluded.started_at,
                        completed_at=NULL, quarantined_rows=0, message=NULL
                    """,
                    [table.artifact_id, TRANSFORMATION_VERSION, datetime.now(UTC)],
                )
                published += self._publish_table(connection, table, unavailable)
                connection.execute(
                    """
                    UPDATE canonicalization_runs
                    SET status='published', completed_at=?
                    WHERE artifact_id=? AND transformation_version=?
                    """,
                    [datetime.now(UTC), table.artifact_id, TRANSFORMATION_VERSION],
                )
                connection.execute(
                    """
                    UPDATE source_artifacts
                    SET ingest_status='canonicalized', transformation_version=?
                    WHERE artifact_id=?
                    """,
                    [TRANSFORMATION_VERSION, table.artifact_id],
                )
        return MonthlyPublicationResult(published, tuple(sorted(unavailable)))

    def _publish_table(
        self,
        connection: DuckDBPyConnection,
        table: _ReportTable,
        unavailable: set[str],
    ) -> int:
        try:
            resolver = ColumnResolver(table.columns)
            crd_column = resolver.require("firm_crd", MONTHLY_FIELDS["firm_crd"])
            name_column = (
                resolver.optional("primary_business_name", ("Primary Business Name",))
                or resolver.optional("legal_name", ("Legal Name",))
                or resolver.require("firm_name", ("Name",))
            )
            optional = {
                field: resolver.optional(field, aliases)
                for field, aliases in MONTHLY_FIELDS.items()
                if field not in {"firm_crd", "firm_name"}
            }
        except ColumnMappingError as error:
            raise MonthlyReportError(f"{table.member_name}: {error}") from error

        category = "SEC" if table.dataset_kind == "ria_report" else "ERA"
        if table.dataset_kind not in {"ria_report", "era_report"}:
            raise MonthlyReportError(f"Artifact {table.artifact_id!r} is not a monthly RIA/ERA report")
        country_status = "available" if optional["principal_country"] is not None else "unavailable"
        if country_status == "unavailable":
            unavailable.add("principal_country")
        _upsert_coverage(connection, table.artifact_id, "principal_country", country_status)
        _upsert_coverage(connection, table.artifact_id, "schedule_d", "unavailable")
        unavailable.add("schedule_d")

        seen_crds: set[int] = set()
        published = 0
        for row in _iter_rows(connection, table.table_name):
            firm_crd = _integer(_text(row.get(crd_column)))
            firm_name = _text(row.get(name_column))
            if firm_crd is None or not firm_name:
                raise MonthlyReportError(
                    f"{table.member_name} row {_source_row(row)} has an invalid firm_crd or firm_name"
                )
            if firm_crd in seen_crds:
                raise MonthlyReportError(
                    f"Duplicate CRD {firm_crd} in {category} report dated {table.observation_date.isoformat()}"
                )
            seen_crds.add(firm_crd)
            source_row = _source_row(row)
            connection.execute(
                """
                INSERT INTO dated_firm_observations VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                """,
                [
                    table.observation_date,
                    firm_crd,
                    category,
                    firm_name,
                    _field(row, optional["sec_number"]),
                    _parse_date(_field(row, optional["filing_date"])),
                    _field(row, optional["principal_city"]),
                    _field(row, optional["principal_region"]),
                    _field(row, optional["principal_country"]),
                    _field(row, optional["principal_postal_code"]),
                    _decimal(_field(row, optional["regulatory_aum"])),
                    _integer(_field(row, optional["employee_count"])),
                    _integer(_field(row, optional["advisory_employee_count"])),
                    table.artifact_id,
                    table.member_name,
                    source_row,
                ],
            )
            connection.execute(
                """
                INSERT INTO firms VALUES (?, ?, ?)
                ON CONFLICT (firm_crd) DO UPDATE SET
                    first_seen_date=least(firms.first_seen_date, excluded.first_seen_date),
                    last_seen_date=greatest(firms.last_seen_date, excluded.last_seen_date)
                """,
                [firm_crd, table.observation_date, table.observation_date],
            )
            connection.execute(
                """
                INSERT INTO registration_events VALUES (?, ?, 'SEC', ?, 'ACTIVE', ?, NULL, NULL, ?, ?, ?)
                """,
                [
                    f"report:{table.artifact_id}:{firm_crd}:{category}",
                    firm_crd,
                    category,
                    table.observation_date,
                    table.artifact_id,
                    table.member_name,
                    source_row,
                ],
            )
            published += 1
        return published

    def _already_published(self, artifact_ids: tuple[str, ...]) -> bool:
        placeholders = ", ".join("?" for _ in artifact_ids)
        with self._database.connection() as connection:
            row = connection.execute(
                f"""
                SELECT count(*) FROM canonicalization_runs
                WHERE artifact_id IN ({placeholders})
                  AND transformation_version=? AND status='published'
                """,
                [*artifact_ids, TRANSFORMATION_VERSION],
            ).fetchone()
        return row is not None and int(row[0]) == len(artifact_ids)

    def _result(self, artifact_ids: tuple[str, ...]) -> MonthlyPublicationResult:
        placeholders = ", ".join("?" for _ in artifact_ids)
        with self._database.connection() as connection:
            count_row = connection.execute(
                f"SELECT count(*) FROM dated_firm_observations WHERE artifact_id IN ({placeholders})",
                list(artifact_ids),
            ).fetchone()
            unavailable_rows = connection.execute(
                f"""
                SELECT DISTINCT field_group FROM field_coverage
                WHERE artifact_id IN ({placeholders}) AND coverage_status='unavailable'
                ORDER BY field_group
                """,
                list(artifact_ids),
            ).fetchall()
        return MonthlyPublicationResult(
            published_observations=int(count_row[0]) if count_row else 0,
            unavailable_field_groups=tuple(str(row[0]) for row in unavailable_rows),
        )

    @staticmethod
    def _tables(connection: DuckDBPyConnection, artifact_ids: tuple[str, ...]) -> list[_ReportTable]:
        placeholders = ", ".join("?" for _ in artifact_ids)
        rows = connection.execute(
            f"""
            SELECT i.artifact_id, a.dataset_kind, a.observation_date,
                   i.member_name, i.raw_table_name, i.columns_json
            FROM raw_table_inventory i JOIN source_artifacts a USING (artifact_id)
            WHERE i.artifact_id IN ({placeholders})
            ORDER BY i.artifact_id, i.member_name
            """,
            list(artifact_ids),
        ).fetchall()
        tables: list[_ReportTable] = []
        for row in rows:
            if row[2] is None:
                raise MonthlyReportError(f"Monthly artifact {row[0]!r} has no observation date")
            tables.append(
                _ReportTable(
                    artifact_id=str(row[0]),
                    dataset_kind=str(row[1]),
                    observation_date=row[2],
                    member_name=str(row[3]),
                    table_name=str(row[4]),
                    columns=tuple(json.loads(str(row[5]))),
                )
            )
        return tables


def _upsert_coverage(
    connection: DuckDBPyConnection,
    artifact_id: str,
    field_group: str,
    coverage_status: str,
) -> None:
    connection.execute(
        """
        INSERT INTO field_coverage VALUES (?, ?, ?, NULL)
        ON CONFLICT (artifact_id, field_group) DO UPDATE SET coverage_status=excluded.coverage_status
        """,
        [artifact_id, field_group, coverage_status],
    )


def _iter_rows(connection: DuckDBPyConnection, table_name: str) -> Iterator[dict[str, Any]]:
    cursor = connection.cursor()
    cursor.execute(f"SELECT * FROM {quote_ident(table_name)}")
    columns = [str(description[0]) for description in cursor.description]
    while rows := cursor.fetchmany(1000):
        for row in rows:
            yield dict(zip(columns, row, strict=True))
    cursor.close()


def _field(row: dict[str, Any], column: str | None) -> str | None:
    return _text(row.get(column)) if column is not None else None


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _source_row(row: dict[str, Any]) -> int:
    value = _integer(_text(row.get("_source_row_number")))
    if value is None:
        raise MonthlyReportError("Raw monthly row is missing _source_row_number provenance")
    return value


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    for pattern in ("%m/%d/%Y", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value, pattern).date()
        except ValueError:
            continue
    return None


def _integer(value: str | None) -> int | None:
    parsed = _decimal(value)
    return int(parsed) if parsed is not None else None


def _decimal(value: str | None) -> Decimal | None:
    if not value:
        return None
    normalized = value.replace(",", "").replace("$", "").strip()
    try:
        parsed = Decimal(normalized)
    except InvalidOperation:
        return None
    return Decimal(format(parsed, "f"))


__all__ = ["MonthlyPublicationResult", "MonthlyReportError", "MonthlyReportPublisher"]
