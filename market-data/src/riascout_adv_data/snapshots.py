"""Point-in-time snapshot helpers."""

import calendar
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from duckdb import DuckDBPyConnection

from riascout_adv_data.geography import derive_us_based, normalize_country, normalize_us_state
from riascout_adv_data.official_db import OfficialDatabase
from riascout_adv_data.registration import RegistrationEvent, RegistrationStatus, derive_registration_status


class SnapshotBuildError(RuntimeError):
    """Raised when the requested point-in-time snapshot cannot be built safely."""


@dataclass(frozen=True)
class SnapshotBuildResult:
    """Counts produced by one atomic snapshot rebuild."""

    years: tuple[int, ...]
    snapshot_count: int


@dataclass(frozen=True)
class _SnapshotSource:
    year: int
    snapshot_date: date
    snapshot_status: str
    firm_crd: int
    firm_name: str | None
    sec_number: str | None
    filing_id: str | None
    filing_date: date | None
    observation_date: date | None
    artifact_id: str
    dataset_kind: str
    country_raw: str | None
    region_raw: str | None
    regulatory_aum: Any
    employee_count: int | None
    advisory_employee_count: int | None


@dataclass(frozen=True)
class _CountrySource:
    raw: str | None
    code: str | None
    source_date: date | None
    artifact_id: str
    method: str
    carried_forward: bool


class FirmSnapshotBuilder:
    """Build reproducible 2020–2026 firm snapshots from official source tables."""

    def __init__(self, database: OfficialDatabase) -> None:
        """Initialize the builder for one official-data database."""
        self._database = database

    def rebuild(
        self,
        years: Sequence[int],
        as_of_collected_at: datetime,
    ) -> SnapshotBuildResult:
        """Replace requested snapshot years atomically from point-in-time source facts."""
        requested = tuple(sorted(set(years)))
        if not requested:
            raise ValueError("years must not be empty")
        if any(year < 2020 or year > 2026 for year in requested):
            raise ValueError("snapshot years must be between 2020 and 2026")
        if as_of_collected_at.tzinfo is None:
            raise ValueError("as_of_collected_at must be timezone-aware")

        with self._database.transaction() as connection:
            self._delete_years(connection, requested)
            for year in requested:
                sources = (
                    self._historical_sources(connection, year)
                    if year <= 2024
                    else self._monthly_sources(connection, year, as_of_collected_at.date())
                )
                if not sources:
                    raise SnapshotBuildError(f"No official firm observations are available for {year}")
                for source in sources:
                    self._publish_source(connection, source, as_of_collected_at)
                self._publish_coverage(connection, year, len(sources))

            placeholders = ", ".join("?" for _ in requested)
            row = connection.execute(
                f"SELECT count(*) FROM firm_snapshots WHERE snapshot_year IN ({placeholders})",
                list(requested),
            ).fetchone()
        return SnapshotBuildResult(requested, int(row[0]) if row else 0)

    @staticmethod
    def _delete_years(connection: DuckDBPyConnection, years: tuple[int, ...]) -> None:
        placeholders = ", ".join("?" for _ in years)
        for table in (
            "firm_snapshot_registration_types",
            "firm_snapshot_field_provenance",
            "snapshot_coverage",
            "firm_snapshots",
        ):
            connection.execute(
                f"DELETE FROM {table} WHERE snapshot_year IN ({placeholders})",
                list(years),
            )

    @staticmethod
    def _historical_sources(connection: DuckDBPyConnection, year: int) -> list[_SnapshotSource]:
        snapshot_date = date(year, 12, 31)
        rows = connection.execute(
            """
            WITH ranked AS (
                SELECT
                    f.firm_crd, n.firm_name, f.sec_number, f.filing_id,
                    coalesce(f.effective_date, cast(f.submitted_at AS DATE)) AS filing_date,
                    f.artifact_id, a.dataset_kind, d.principal_country_raw,
                    d.principal_region_raw, m.regulatory_aum, m.employee_count,
                    m.advisory_employee_count,
                    row_number() OVER (
                        PARTITION BY f.firm_crd
                        ORDER BY coalesce(f.effective_date, cast(f.submitted_at AS DATE)) DESC,
                                 f.submitted_at DESC, f.filing_id DESC
                    ) AS version_rank
                FROM filings f
                JOIN firm_names n USING (filing_id)
                JOIN source_artifacts a ON a.artifact_id = f.artifact_id
                LEFT JOIN firm_addresses d USING (filing_id)
                LEFT JOIN firm_metrics m USING (filing_id)
                WHERE cast(f.submitted_at AS DATE) <= ?
                  AND coalesce(f.effective_date, cast(f.submitted_at AS DATE)) <= ?
            )
            SELECT firm_crd, firm_name, sec_number, filing_id, filing_date,
                   artifact_id, dataset_kind, principal_country_raw,
                   principal_region_raw, regulatory_aum, employee_count,
                   advisory_employee_count
            FROM ranked WHERE version_rank = 1
            ORDER BY firm_crd
            """,
            [snapshot_date, snapshot_date],
        ).fetchall()
        return [
            _SnapshotSource(
                year=year,
                snapshot_date=snapshot_date,
                snapshot_status="year_end",
                firm_crd=int(row[0]),
                firm_name=row[1],
                sec_number=row[2],
                filing_id=str(row[3]),
                filing_date=row[4],
                observation_date=None,
                artifact_id=str(row[5]),
                dataset_kind=str(row[6]),
                country_raw=row[7],
                region_raw=row[8],
                regulatory_aum=row[9],
                employee_count=row[10],
                advisory_employee_count=row[11],
            )
            for row in rows
        ]

    def _monthly_sources(
        self,
        connection: DuckDBPyConnection,
        year: int,
        collected_on: date,
    ) -> list[_SnapshotSource]:
        report_date = self._paired_report_date(connection, year, collected_on)
        rows = connection.execute(
            """
            SELECT o.firm_crd, o.firm_name, o.sec_number, o.filing_date,
                   o.artifact_id, a.dataset_kind, o.principal_country_raw,
                   o.principal_region_raw, o.regulatory_aum, o.employee_count,
                   o.advisory_employee_count
            FROM dated_firm_observations o
            JOIN source_artifacts a USING (artifact_id)
            WHERE o.report_date = ? AND o.category IN ('SEC', 'ERA')
            ORDER BY o.firm_crd
            """,
            [report_date],
        ).fetchall()
        crds = [int(row[0]) for row in rows]
        if len(crds) != len(set(crds)):
            raise SnapshotBuildError(f"A firm appears in both RIA and ERA reports dated {report_date.isoformat()}")
        status = "provisional" if year == 2026 else "year_end"
        return [
            _SnapshotSource(
                year=year,
                snapshot_date=report_date,
                snapshot_status=status,
                firm_crd=int(row[0]),
                firm_name=row[1],
                sec_number=row[2],
                filing_id=None,
                filing_date=row[3],
                observation_date=report_date,
                artifact_id=str(row[4]),
                dataset_kind=str(row[5]),
                country_raw=row[6],
                region_raw=row[7],
                regulatory_aum=row[8],
                employee_count=row[9],
                advisory_employee_count=row[10],
            )
            for row in rows
        ]

    @staticmethod
    def _paired_report_date(
        connection: DuckDBPyConnection,
        year: int,
        collected_on: date,
    ) -> date:
        if year == 2025:
            candidate = date(2025, 12, 31)
            categories = {
                str(row[0])
                for row in connection.execute(
                    """
                    SELECT DISTINCT category FROM dated_firm_observations
                    WHERE report_date = ? AND category IN ('SEC', 'ERA')
                    """,
                    [candidate],
                ).fetchall()
            }
            if categories != {"SEC", "ERA"}:
                raise SnapshotBuildError("2025 snapshots require both RIA and ERA reports dated 2025-12-31")
            return candidate

        row = connection.execute(
            """
            SELECT report_date
            FROM dated_firm_observations
            WHERE year(report_date) = 2026 AND report_date <= ?
              AND category IN ('SEC', 'ERA')
            GROUP BY report_date
            HAVING count(DISTINCT category) = 2
            ORDER BY report_date DESC
            LIMIT 1
            """,
            [collected_on],
        ).fetchone()
        if row is None:
            raise SnapshotBuildError("2026 snapshots require RIA and ERA reports on the same date")
        report_date = row[0]
        if not isinstance(report_date, date):
            raise SnapshotBuildError("The paired 2026 report date is invalid")
        return report_date

    def _publish_source(
        self,
        connection: DuckDBPyConnection,
        source: _SnapshotSource,
        collected_at: datetime,
    ) -> None:
        country = self._country_source(connection, source)
        registration = self._registration_status(connection, source.firm_crd, source.snapshot_date)
        principal_state = normalize_us_state(source.region_raw, country_code=country.code)
        validation_status = "valid" if country.code is not None else "warning_country_unknown"
        connection.execute(
            """
            INSERT INTO firm_snapshots (
                snapshot_year, snapshot_date, snapshot_status, as_of_collected_at,
                firm_crd, firm_name, sec_number, selected_filing_id,
                selected_filing_date, source_observation_date, source_artifact_id,
                source_dataset, principal_country_raw, principal_country_code,
                principal_region_raw, principal_state, principal_country_method,
                country_source_date, country_carried_forward, is_us_based,
                is_sec_registered, is_era, is_state_registered,
                primary_registration_type, regulatory_aum, employee_count,
                advisory_employee_count, validation_status
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?
            )
            """,
            [
                source.year,
                source.snapshot_date,
                source.snapshot_status,
                collected_at,
                source.firm_crd,
                source.firm_name,
                source.sec_number,
                source.filing_id,
                source.filing_date,
                source.observation_date,
                source.artifact_id,
                source.dataset_kind,
                country.raw,
                country.code,
                source.region_raw,
                principal_state,
                country.method,
                country.source_date,
                country.carried_forward,
                derive_us_based(country.code),
                registration.is_sec_registered,
                registration.is_era,
                registration.is_state_registered,
                registration.primary_registration_type,
                source.regulatory_aum,
                source.employee_count,
                source.advisory_employee_count,
                validation_status,
            ],
        )
        for registration_type in registration.registration_types:
            connection.execute(
                "INSERT INTO firm_snapshot_registration_types VALUES (?, ?, ?)",
                [source.year, source.firm_crd, registration_type],
            )
        self._publish_provenance(connection, source, country)

    @staticmethod
    def _registration_status(
        connection: DuckDBPyConnection,
        firm_crd: int,
        snapshot_date: date,
    ) -> RegistrationStatus:
        rows = connection.execute(
            """
            SELECT category, status, effective_date
            FROM registration_events
            WHERE firm_crd = ? AND effective_date <= ?
            ORDER BY effective_date, event_id
            """,
            [firm_crd, snapshot_date],
        ).fetchall()
        events = [RegistrationEvent(str(row[0]), str(row[1]), row[2]) for row in rows]
        return derive_registration_status(
            as_of=snapshot_date,
            observations=[],
            events=events,
            state_coverage=False,
            sec_era_coverage=True,
        )

    @staticmethod
    def _country_source(
        connection: DuckDBPyConnection,
        source: _SnapshotSource,
    ) -> _CountrySource:
        explicit = normalize_country(source.country_raw)
        if explicit.raw is not None:
            if explicit.recognized:
                method = "normalized_explicit" if explicit.code is not None else "explicit_unknown"
            else:
                method = "unrecognized_explicit"
            return _CountrySource(
                raw=explicit.raw,
                code=explicit.code,
                source_date=source.observation_date or source.filing_date or source.snapshot_date,
                artifact_id=source.artifact_id,
                method=method,
                carried_forward=False,
            )

        row = connection.execute(
            """
            SELECT country_raw, source_date, artifact_id
            FROM (
                SELECT d.principal_country_raw AS country_raw,
                       coalesce(f.effective_date, cast(f.submitted_at AS DATE)) AS source_date,
                       d.artifact_id
                FROM firm_addresses d JOIN filings f USING (filing_id)
                WHERE f.firm_crd = ?
                  AND coalesce(f.effective_date, cast(f.submitted_at AS DATE)) <= ?
                  AND d.principal_country_raw IS NOT NULL
                  AND trim(d.principal_country_raw) <> ''
                UNION ALL
                SELECT principal_country_raw, report_date, artifact_id
                FROM dated_firm_observations
                WHERE firm_crd = ? AND report_date <= ?
                  AND principal_country_raw IS NOT NULL
                  AND trim(principal_country_raw) <> ''
            ) history
            ORDER BY source_date DESC, artifact_id DESC
            LIMIT 1
            """,
            [source.firm_crd, source.snapshot_date, source.firm_crd, source.snapshot_date],
        ).fetchone()
        if row is None:
            return _CountrySource(None, None, None, source.artifact_id, "missing", False)
        normalized = normalize_country(str(row[0]))
        if normalized.recognized:
            method = "carried_forward" if normalized.code is not None else "carried_forward_explicit_unknown"
        else:
            method = "carried_forward_unrecognized"
        return _CountrySource(
            raw=normalized.raw,
            code=normalized.code,
            source_date=row[1],
            artifact_id=str(row[2]),
            method=method,
            carried_forward=True,
        )

    @staticmethod
    def _publish_provenance(
        connection: DuckDBPyConnection,
        source: _SnapshotSource,
        country: _CountrySource,
    ) -> None:
        source_date = source.observation_date or source.filing_date
        records = (
            ("firm_name", source.artifact_id, source_date, "firm_name", "selected_source_row"),
            (
                "principal_country_code",
                country.artifact_id,
                country.source_date,
                "principal_country_raw",
                country.method,
            ),
            (
                "registration_status",
                source.artifact_id,
                source.snapshot_date,
                "registration_events",
                "latest_event_on_or_before_snapshot",
            ),
        )
        for field_name, artifact_id, date_value, source_field, method in records:
            connection.execute(
                "INSERT INTO firm_snapshot_field_provenance VALUES (?, ?, ?, ?, ?, ?, ?)",
                [
                    source.year,
                    source.firm_crd,
                    field_name,
                    artifact_id,
                    date_value,
                    source_field,
                    method,
                ],
            )

    @staticmethod
    def _publish_coverage(connection: DuckDBPyConnection, year: int, count: int) -> None:
        rows = (
            ("firms", "available", count, "Official point-in-time firm observations"),
            ("state_registration", "unavailable", count, "No date-specific state-firm source"),
            (
                "schedule_d",
                "available" if year <= 2024 else "unavailable",
                count,
                "Joined only through the selected filing version" if year <= 2024 else "Not present in monthly reports",
            ),
        )
        for field_group, status, record_count, message in rows:
            connection.execute(
                "INSERT INTO snapshot_coverage VALUES (?, 'FIRM', ?, ?, ?, ?)",
                [year, field_group, status, record_count, message],
            )


def select_firm_snapshot(filings: list[dict[str, Any]], as_of: date) -> dict[str, Any] | None:
    """Select the latest firm filing not later than an as-of date."""
    eligible: list[tuple[date, dict[str, Any]]] = []
    for filing in filings:
        filing_dates = filing.get("Filing")
        if not isinstance(filing_dates, list):
            continue
        parsed_dates = [
            parsed
            for item in filing_dates
            if isinstance(item, dict) and isinstance(item.get("Dt"), str)
            if (parsed := _parse_iso_date(item["Dt"])) is not None
        ]
        if parsed_dates:
            latest_document_date = max(parsed_dates)
            if latest_document_date <= as_of:
                eligible.append((latest_document_date, filing))
    if not eligible:
        return None
    return max(eligible, key=lambda candidate: candidate[0])[1]


def interval_active(start: str | None, end: str | None, as_of: date) -> bool:
    """Return whether a month-precision interval contains an as-of date."""
    start_date = _parse_month_start(start)
    if start_date is None:
        return False
    end_date = _parse_month_end(end) if end else date.max
    return start_date <= as_of <= end_date


def _parse_iso_date(value: str) -> date | None:
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _parse_month_start(value: str | None) -> date | None:
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%m/%Y")
    except ValueError:
        return None
    return date(parsed.year, parsed.month, 1)


def _parse_month_end(value: str) -> date:
    parsed = datetime.strptime(value, "%m/%Y")
    return date(parsed.year, parsed.month, calendar.monthrange(parsed.year, parsed.month)[1])


__all__ = [
    "FirmSnapshotBuilder",
    "SnapshotBuildError",
    "SnapshotBuildResult",
    "interval_active",
    "select_firm_snapshot",
]
