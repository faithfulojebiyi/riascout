"""Collection-versioned annual snapshots for current-index individuals."""

import csv
import re
import tempfile
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from duckdb import DuckDBPyConnection

from riascout_adv_data.individual_records import current_status_activity
from riascout_adv_data.official_db import OfficialDatabase


@dataclass(frozen=True)
class CurrentRegistrationEvidence:
    """Minimum current-status evidence needed for conservative activity."""

    status: str | None
    status_posted_date: date | None


@dataclass(frozen=True)
class IndividualSnapshotResult:
    """Counts produced by one atomic collection snapshot rebuild."""

    collection_id: str
    years: tuple[int, ...]
    snapshot_rows: int
    relationship_rows: int
    provenance_rows: int
    coverage_rows: int


@dataclass(frozen=True)
class _Person:
    individual_crd: int
    first_name: str | None
    middle_name: str | None
    last_name: str | None
    suffix_name: str | None
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class _Interval:
    interval_id: str
    individual_crd: int
    employer_firm_crd: int | None
    jurisdiction: str | None
    registration_category: str | None
    status: str | None
    start_date: date | None
    end_date: date | None
    start_precision: str
    end_precision: str
    start_method: str
    interval_source: str
    iar_evidence_method: str | None
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class _Employment:
    individual_crd: int
    employer_firm_crd: int | None
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class _LocationEvidence:
    country_raw: str | None
    country_code: str | None
    is_us_workplace: bool | None


@dataclass(frozen=True)
class _FirmGeography:
    country_code: str | None
    is_us_based: bool | None


@dataclass(frozen=True)
class _DisclosureEvidence:
    has_summary: bool | None
    artifact_id: str
    source_json_path: str


def interval_is_active(start_date: date | None, end_date: date | None, snapshot_date: date) -> bool | None:
    """Apply half-open interval semantics without inventing an unknown start."""
    if start_date is None:
        return None
    return start_date <= snapshot_date and (end_date is None or snapshot_date < end_date)


def current_evidence_active_on(
    evidence: CurrentRegistrationEvidence,
    snapshot_date: date,
    collection_date: date,
) -> bool | None:
    """Use a status-posted date conservatively and limit missing dates to collection day."""
    status_activity = current_status_activity(evidence.status)
    if status_activity is not True:
        return status_activity
    if evidence.status_posted_date is None:
        return True if snapshot_date == collection_date else None
    return evidence.status_posted_date <= snapshot_date


class IndividualSnapshotBuilder:
    """Atomically rebuild annual individual and individual-firm tables."""

    def __init__(self, database: OfficialDatabase) -> None:
        self._database = database

    def rebuild(
        self,
        *,
        collection_id: str,
        years: Sequence[int],
        built_at: datetime,
    ) -> IndividualSnapshotResult:
        """Build partial 2020–2025 backcasts and the provisional 2026 observation."""
        if built_at.tzinfo is None or built_at.utcoffset() is None:
            raise ValueError("built_at must include a timezone")
        normalized_years = tuple(sorted(set(years)))
        if not normalized_years or any(year < 2020 or year > 2026 for year in normalized_years):
            raise ValueError("years must contain values from 2020 through 2026")

        total_snapshot_rows = 0
        total_relationship_rows = 0
        total_provenance_rows = 0
        total_coverage_rows = 0
        with self._database.connection() as connection:
            run = connection.execute(
                """
                SELECT status, CAST(collection_completed_at AS VARCHAR)
                FROM individual_collection_runs WHERE collection_id = ?
                """,
                [collection_id],
            ).fetchone()
            if run is None or run[0] != "published" or not isinstance(run[1], str):
                raise ValueError(f"collection {collection_id!r} is not published")
            collection_completed_at = datetime.fromisoformat(run[1])
            collection_date = collection_completed_at.date()
            people = _load_people(connection, collection_id)
            intervals = _load_intervals(connection, collection_id)
            employments = _load_current_employments(connection, collection_id)
            locations = _load_locations(connection, collection_id)
            disclosures = _load_disclosures(connection, collection_id)
            firm_geography = _load_firm_geography(connection, normalized_years)

            for year in normalized_years:
                snapshot_rows: list[tuple[Any, ...]] = []
                provenance_rows: list[tuple[Any, ...]] = []
                snapshot_date = collection_date if year == 2026 else date(year, 12, 31)
                snapshot_status = "provisional_current_index" if year == 2026 else "partial_current_index_backcast"
                yearly_relationships: dict[tuple[int, int, str, str], tuple[Any, ...]] = {}
                active_by_person: dict[int, list[_Interval]] = {}
                for interval in intervals:
                    activity = _interval_activity(interval, snapshot_date, collection_date)
                    if activity is not True:
                        continue
                    active_by_person.setdefault(interval.individual_crd, []).append(interval)
                    if interval.employer_firm_crd is None:
                        continue
                    row = _registration_relationship_row(
                        collection_id=collection_id,
                        year=year,
                        snapshot_date=snapshot_date,
                        snapshot_status=snapshot_status,
                        interval=interval,
                        locations=locations.get(interval.interval_id, ()),
                        firm_geography=firm_geography.get((year, interval.employer_firm_crd)),
                    )
                    key = (
                        interval.individual_crd,
                        interval.employer_firm_crd,
                        "active_registration",
                        _jurisdiction_key(interval.jurisdiction),
                    )
                    yearly_relationships.setdefault(key, row)

                if year == 2026:
                    for employment in employments:
                        if employment.employer_firm_crd is None:
                            continue
                        row = _employment_relationship_row(
                            collection_id=collection_id,
                            year=year,
                            snapshot_date=snapshot_date,
                            snapshot_status=snapshot_status,
                            employment=employment,
                            firm_geography=firm_geography.get((year, employment.employer_firm_crd)),
                        )
                        key = (
                            employment.individual_crd,
                            employment.employer_firm_crd,
                            "current_employment_observation",
                            "",
                        )
                        yearly_relationships.setdefault(key, row)

                relationship_rows = list(yearly_relationships.values())
                relationships_by_person = _index_relationships_by_person(yearly_relationships)
                included_people = {
                    individual_crd for individual_crd in people if individual_crd in active_by_person or year == 2026
                }
                for individual_crd in sorted(included_people):
                    person = people[individual_crd]
                    active = active_by_person.get(individual_crd, [])
                    person_relationships = relationships_by_person.get(individual_crd, [])
                    active_firms = {
                        interval.employer_firm_crd for interval in active if interval.employer_firm_crd is not None
                    }
                    active_jurisdictions = {
                        _jurisdiction_key(interval.jurisdiction)
                        for interval in active
                        if _jurisdiction_key(interval.jurisdiction)
                    }
                    iar_methods = sorted(
                        {
                            interval.iar_evidence_method
                            for interval in active
                            if interval.iar_evidence_method is not None
                        }
                    )
                    workplace_values = [row[20] for row in person_relationships]
                    employer_values = [row[22] for row in person_relationships]
                    disclosure = disclosures.get(individual_crd)
                    snapshot_rows.append(
                        (
                            collection_id,
                            year,
                            snapshot_date,
                            snapshot_status,
                            individual_crd,
                            person.first_name,
                            person.middle_name,
                            person.last_name,
                            person.suffix_name,
                            True if iar_methods else None,
                            ";".join(iar_methods) if iar_methods else None,
                            len(active),
                            len(active_firms),
                            len(active_jurisdictions),
                            year == 2026,
                            _aggregate_nullable_boolean(workplace_values),
                            _aggregate_nullable_boolean(employer_values),
                            disclosure.has_summary if disclosure is not None else None,
                            "available_current_observation" if year == 2026 else "partial_current_population",
                            "valid",
                            built_at,
                        )
                    )
                    provenance_rows.extend(
                        _snapshot_provenance_rows(
                            collection_id=collection_id,
                            year=year,
                            person=person,
                            active=active,
                            disclosure=disclosure,
                            collection_date=collection_date,
                        )
                    )
                coverage_rows = _coverage_rows(
                    collection_id=collection_id,
                    year=year,
                    person_count=len(included_people),
                )
                with _connection_transaction(connection):
                    for table in (
                        "individual_snapshot_field_provenance",
                        "individual_snapshot_coverage",
                        "individual_firm_year",
                        "individual_year_snapshots",
                    ):
                        connection.execute(
                            f"DELETE FROM {table} WHERE collection_id = ? AND snapshot_year = ?",
                            [collection_id, year],
                        )
                    _executemany_if_rows(
                        connection,
                        "INSERT INTO individual_year_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        snapshot_rows,
                    )
                    _executemany_if_rows(
                        connection,
                        """
                        INSERT INTO individual_firm_year VALUES (
                            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                        )
                        """,
                        relationship_rows,
                    )
                    _executemany_if_rows(
                        connection,
                        "INSERT INTO individual_snapshot_field_provenance VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        provenance_rows,
                    )
                    _executemany_if_rows(
                        connection,
                        "INSERT INTO individual_snapshot_coverage VALUES (?, ?, ?, ?, ?, ?)",
                        coverage_rows,
                    )
                total_snapshot_rows += len(snapshot_rows)
                total_relationship_rows += len(relationship_rows)
                total_provenance_rows += len(provenance_rows)
                total_coverage_rows += len(coverage_rows)

        return IndividualSnapshotResult(
            collection_id=collection_id,
            years=normalized_years,
            snapshot_rows=total_snapshot_rows,
            relationship_rows=total_relationship_rows,
            provenance_rows=total_provenance_rows,
            coverage_rows=total_coverage_rows,
        )


def _index_relationships_by_person(
    relationships: dict[tuple[int, int, str, str], tuple[Any, ...]],
) -> dict[int, list[tuple[Any, ...]]]:
    """Index deduplicated relationship rows once for linear person lookups."""
    indexed: dict[int, list[tuple[Any, ...]]] = {}
    for key, row in relationships.items():
        indexed.setdefault(key[0], []).append(row)
    return indexed


@contextmanager
def _connection_transaction(connection: DuckDBPyConnection) -> Iterator[None]:
    """Commit or roll back one complete snapshot year on a reused connection."""
    connection.execute("BEGIN")
    try:
        yield
    except BaseException:
        connection.execute("ROLLBACK")
        raise
    else:
        connection.execute("COMMIT")


def _interval_activity(interval: _Interval, snapshot_date: date, collection_date: date) -> bool | None:
    if interval.start_method == "current_collection_observation_only":
        return True if snapshot_date == collection_date else None
    return interval_is_active(interval.start_date, interval.end_date, snapshot_date)


def _registration_relationship_row(
    *,
    collection_id: str,
    year: int,
    snapshot_date: date,
    snapshot_status: str,
    interval: _Interval,
    locations: tuple[_LocationEvidence, ...],
    firm_geography: _FirmGeography | None,
) -> tuple[Any, ...]:
    assert interval.employer_firm_crd is not None
    jurisdiction_key = _jurisdiction_key(interval.jurisdiction)
    country_codes = sorted({item.country_code for item in locations if item.country_code is not None})
    country_raw_values = sorted({item.country_raw for item in locations if item.country_raw is not None})
    return (
        f"relationship:{collection_id}:{year}:{interval.individual_crd}:{interval.employer_firm_crd}:"
        f"active_registration:{jurisdiction_key or 'NONE'}",
        collection_id,
        year,
        snapshot_date,
        snapshot_status,
        interval.individual_crd,
        interval.employer_firm_crd,
        "active_registration",
        interval.jurisdiction,
        jurisdiction_key,
        interval.registration_category,
        interval.status,
        interval.interval_id,
        interval.start_date,
        interval.end_date,
        interval.start_precision,
        interval.end_precision,
        interval.iar_evidence_method,
        country_raw_values[0] if len(country_raw_values) == 1 else None,
        country_codes[0] if len(country_codes) == 1 else None,
        _aggregate_nullable_boolean([item.is_us_workplace for item in locations]),
        firm_geography.country_code if firm_geography is not None else None,
        firm_geography.is_us_based if firm_geography is not None else None,
        "firm_snapshot_join" if firm_geography is not None else None,
        "in_firm_snapshot_universe" if firm_geography is not None else "not_in_firm_snapshot_universe",
        interval.artifact_id,
        interval.source_json_path,
    )


def _employment_relationship_row(
    *,
    collection_id: str,
    year: int,
    snapshot_date: date,
    snapshot_status: str,
    employment: _Employment,
    firm_geography: _FirmGeography | None,
) -> tuple[Any, ...]:
    assert employment.employer_firm_crd is not None
    return (
        f"relationship:{collection_id}:{year}:{employment.individual_crd}:{employment.employer_firm_crd}:"
        "current_employment_observation:NONE",
        collection_id,
        year,
        snapshot_date,
        snapshot_status,
        employment.individual_crd,
        employment.employer_firm_crd,
        "current_employment_observation",
        None,
        "",
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        firm_geography.country_code if firm_geography is not None else None,
        firm_geography.is_us_based if firm_geography is not None else None,
        "firm_snapshot_join" if firm_geography is not None else None,
        "in_firm_snapshot_universe" if firm_geography is not None else "not_in_firm_snapshot_universe",
        employment.artifact_id,
        employment.source_json_path,
    )


def _snapshot_provenance_rows(
    *,
    collection_id: str,
    year: int,
    person: _Person,
    active: list[_Interval],
    disclosure: _DisclosureEvidence | None,
    collection_date: date,
) -> list[tuple[Any, ...]]:
    interval = sorted(active, key=lambda item: item.interval_id)[0] if active else None
    derived_artifact = interval.artifact_id if interval is not None else person.artifact_id
    derived_path = interval.source_json_path if interval is not None else person.source_json_path
    source_date = interval.start_date if interval is not None else collection_date
    interval_id = interval.interval_id if interval is not None else None
    rows: list[tuple[Any, ...]] = [
        (
            collection_id,
            year,
            person.individual_crd,
            "name",
            person.artifact_id,
            person.source_json_path,
            collection_date,
            None,
            "current_observation",
        )
    ]
    for field_name in (
        "is_iar",
        "active_registration_relationship_count",
        "active_employer_firm_count",
        "active_jurisdiction_count",
        "has_us_workplace",
        "has_us_employer",
    ):
        rows.append(
            (
                collection_id,
                year,
                person.individual_crd,
                field_name,
                derived_artifact,
                derived_path,
                source_date,
                interval_id,
                "interval_and_firm_snapshot_derivation",
            )
        )
    disclosure_artifact = disclosure.artifact_id if disclosure is not None else person.artifact_id
    disclosure_path = disclosure.source_json_path if disclosure is not None else person.source_json_path
    rows.append(
        (
            collection_id,
            year,
            person.individual_crd,
            "has_disclosure_summary",
            disclosure_artifact,
            disclosure_path,
            collection_date,
            None,
            "current_disclosure_summary",
        )
    )
    return rows


def _coverage_rows(*, collection_id: str, year: int, person_count: int) -> list[tuple[Any, ...]]:
    statuses = {
        "population": "available_current_observation" if year == 2026 else "partial_current_population",
        "names": "available_current_observation",
        "current_employment": "available_current_observation" if year == 2026 else "not_applicable",
        "registration_intervals": "available_interval_backcast",
        "employment_history": "month_precision_only",
        "workplace_geography": "available_interval_backcast",
        "exams": "available_current_observation",
        "designations": "available_current_observation",
        "disclosures": "available_current_observation",
    }
    return [(collection_id, year, field_group, status, person_count, None) for field_group, status in statuses.items()]


def _load_people(connection: DuckDBPyConnection, collection_id: str) -> dict[int, _Person]:
    rows = connection.execute(
        """
        SELECT n.individual_crd, n.first_name, n.middle_name, n.last_name, n.suffix_name,
               n.artifact_id, n.source_json_path
        FROM individual_names n WHERE n.collection_id = ?
        """,
        [collection_id],
    ).fetchall()
    return {
        int(row[0]): _Person(
            individual_crd=int(row[0]),
            first_name=_optional_str(row[1]),
            middle_name=_optional_str(row[2]),
            last_name=_optional_str(row[3]),
            suffix_name=_optional_str(row[4]),
            artifact_id=str(row[5]),
            source_json_path=str(row[6]),
        )
        for row in rows
    }


def _load_intervals(connection: DuckDBPyConnection, collection_id: str) -> list[_Interval]:
    rows = connection.execute(
        """
        SELECT interval_id, individual_crd, employer_firm_crd, jurisdiction,
               registration_category, status, start_date, end_date, start_precision,
               end_precision, start_method, interval_source, iar_evidence_method,
               artifact_id, source_json_path
        FROM individual_registration_intervals WHERE collection_id = ?
        ORDER BY individual_crd, interval_id
        """,
        [collection_id],
    ).fetchall()
    return [
        _Interval(
            interval_id=str(row[0]),
            individual_crd=int(row[1]),
            employer_firm_crd=int(row[2]) if row[2] is not None else None,
            jurisdiction=_optional_str(row[3]),
            registration_category=_optional_str(row[4]),
            status=_optional_str(row[5]),
            start_date=row[6] if isinstance(row[6], date) else None,
            end_date=row[7] if isinstance(row[7], date) else None,
            start_precision=str(row[8]),
            end_precision=str(row[9]),
            start_method=str(row[10]),
            interval_source=str(row[11]),
            iar_evidence_method=_optional_str(row[12]),
            artifact_id=str(row[13]),
            source_json_path=str(row[14]),
        )
        for row in rows
    ]


def _load_current_employments(connection: DuckDBPyConnection, collection_id: str) -> list[_Employment]:
    rows = connection.execute(
        """
        SELECT individual_crd, employer_firm_crd, artifact_id, source_json_path
        FROM individual_current_employments WHERE collection_id = ?
        ORDER BY individual_crd, employment_sequence
        """,
        [collection_id],
    ).fetchall()
    return [
        _Employment(
            individual_crd=int(row[0]),
            employer_firm_crd=int(row[1]) if row[1] is not None else None,
            artifact_id=str(row[2]),
            source_json_path=str(row[3]),
        )
        for row in rows
    ]


def _load_locations(
    connection: DuckDBPyConnection,
    collection_id: str,
) -> dict[str, tuple[_LocationEvidence, ...]]:
    rows = connection.execute(
        """
        SELECT interval_id, country_raw, country_code, is_us_workplace
        FROM individual_registration_locations WHERE collection_id = ?
        ORDER BY interval_id, location_sequence
        """,
        [collection_id],
    ).fetchall()
    grouped: dict[str, list[_LocationEvidence]] = {}
    for row in rows:
        grouped.setdefault(str(row[0]), []).append(
            _LocationEvidence(
                country_raw=_optional_str(row[1]),
                country_code=_optional_str(row[2]),
                is_us_workplace=row[3] if isinstance(row[3], bool) else None,
            )
        )
    return {key: tuple(value) for key, value in grouped.items()}


def _load_firm_geography(
    connection: DuckDBPyConnection,
    years: tuple[int, ...],
) -> dict[tuple[int, int], _FirmGeography]:
    placeholders = ", ".join("?" for _ in years)
    rows = connection.execute(
        f"SELECT snapshot_year, firm_crd, principal_country_code, is_us_based "
        f"FROM firm_snapshots WHERE snapshot_year IN ({placeholders})",
        list(years),
    ).fetchall()
    return {
        (int(row[0]), int(row[1])): _FirmGeography(
            country_code=_optional_str(row[2]),
            is_us_based=row[3] if isinstance(row[3], bool) else None,
        )
        for row in rows
    }


def _load_disclosures(
    connection: DuckDBPyConnection,
    collection_id: str,
) -> dict[int, _DisclosureEvidence]:
    rows = connection.execute(
        """
        SELECT individual_crd, has_regulatory_action, has_criminal, has_bankruptcy,
               has_civil_judgment, has_bond, has_judgment, has_investigation,
               has_customer_complaint, has_termination, has_other,
               artifact_id, source_json_path
        FROM individual_disclosure_flags WHERE collection_id = ?
        """,
        [collection_id],
    ).fetchall()
    result: dict[int, _DisclosureEvidence] = {}
    for row in rows:
        flags = [value if isinstance(value, bool) else None for value in row[1:11]]
        result[int(row[0])] = _DisclosureEvidence(
            has_summary=_aggregate_nullable_boolean(flags),
            artifact_id=str(row[11]),
            source_json_path=str(row[12]),
        )
    return result


def _aggregate_nullable_boolean(values: Sequence[object]) -> bool | None:
    known = [value for value in values if isinstance(value, bool)]
    if any(known):
        return True
    if known:
        return False
    return None


def _jurisdiction_key(value: str | None) -> str:
    return value.strip().upper() if value else ""


def _optional_str(value: object) -> str | None:
    return str(value) if value is not None else None


def _executemany_if_rows(
    connection: DuckDBPyConnection,
    statement: str,
    rows: list[tuple[Any, ...]],
) -> None:
    if not rows:
        return
    match = re.fullmatch(
        r"\s*INSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)\s+VALUES\s*\(([\s?,]+)\)\s*",
        statement,
        flags=re.IGNORECASE,
    )
    if match is None:
        raise ValueError("snapshot insert statement must be a positional INSERT INTO ... VALUES template")
    table_name = match.group(1)
    column_count = len(rows[0])
    if column_count == 0 or any(len(row) != column_count for row in rows):
        raise ValueError("snapshot insert rows must have one consistent non-zero width")
    if match.group(2).count("?") != column_count:
        raise ValueError("snapshot insert template width does not match row width")

    null_marker = "__RIASCOUT_ADV_DATA_COPY_NULL_7e149f0b__"
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            prefix="riascout-adv-data-snapshot-",
            suffix=".csv",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            writer = csv.writer(temporary_file, lineterminator="\n")
            for row in rows:
                if any(value is not None and str(value) == null_marker for value in row):
                    raise ValueError("snapshot insert value conflicts with the bulk-copy null marker")
                serialized = [null_marker if value is None else str(value) for value in row]
                writer.writerow(serialized)

        escaped_path = str(temporary_path).replace("'", "''")
        connection.execute(
            f"COPY {table_name} FROM '{escaped_path}' "
            f"(FORMAT CSV, AUTO_DETECT FALSE, HEADER FALSE, DELIMITER ',', "
            f"NULL '{null_marker}', QUOTE '\"', ESCAPE '\"')"
        )
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


__all__ = [
    "CurrentRegistrationEvidence",
    "IndividualSnapshotBuilder",
    "IndividualSnapshotResult",
    "current_evidence_active_on",
    "interval_is_active",
]
