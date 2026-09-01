"""Acceptance validation and coverage reporting for individual/IAR snapshots."""

import csv
import json
import re
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

from duckdb import DuckDBPyConnection

from riascout_adv_data.official_db import OfficialDatabase
from riascout_adv_data.official_validation import validate_official_pipeline

CREDENTIAL_PATTERN = re.compile(
    r"(?:authorization|api[_-]?key|sec_api_key)\s*(?:=|:)",
    flags=re.IGNORECASE,
)
_CREDENTIAL_FIELD_NAMES = frozenset({"authorization", "api_key", "apikey", "sec_api_key", "token"})
_BINARY_ANALYTICAL_SUFFIXES = frozenset({".duckdb", ".parquet", ".wal"})
REQUIRED_PROVENANCE_FIELDS = frozenset(
    {
        "name",
        "is_iar",
        "active_registration_relationship_count",
        "active_employer_firm_count",
        "active_jurisdiction_count",
        "has_us_workplace",
        "has_us_employer",
        "has_disclosure_summary",
    }
)
REQUIRED_COVERAGE_GROUPS = frozenset(
    {
        "population",
        "names",
        "current_employment",
        "registration_intervals",
        "employment_history",
        "workplace_geography",
        "exams",
        "designations",
        "disclosures",
    }
)


@dataclass(frozen=True)
class IndividualValidationIssue:
    """One credential-safe actionable individual-pipeline finding."""

    code: str
    message: str
    count: int


@dataclass(frozen=True)
class IndividualValidationResult:
    """Acceptance failures and explicitly non-blocking limitations."""

    failures: tuple[IndividualValidationIssue, ...]
    warnings: tuple[IndividualValidationIssue, ...]

    @property
    def is_valid(self) -> bool:
        """Return whether all acceptance-blocking invariants passed."""
        return not self.failures


@dataclass(frozen=True)
class IndividualCoverageRow:
    """One year of nullable, filter-ready individual/IAR coverage counts."""

    year: int
    snapshot_status: str
    individual_count: int
    iar_true_count: int
    iar_false_count: int
    iar_unknown_count: int
    active_firm_relationship_count: int
    current_employment_relationship_count: int
    us_workplace_true_count: int
    us_workplace_false_count: int
    us_workplace_unknown_count: int
    us_employer_true_count: int
    us_employer_false_count: int
    us_employer_unknown_count: int
    unmatched_employer_firm_count: int
    population_coverage: str
    registration_coverage: str
    employment_history_coverage: str
    geography_coverage: str
    qualification_coverage: str
    disclosure_coverage: str


@dataclass(frozen=True)
class SecretMatch:
    """A credential finding that never contains the matched secret."""

    location: str
    match_kind: str


def validate_individual_pipeline(
    database: OfficialDatabase,
    *,
    collection_id: str,
    years: Sequence[int],
    credential_scan_paths: Sequence[Path] = (),
    secret_values: tuple[str, ...] = (),
) -> IndividualValidationResult:
    """Run collection, canonical, snapshot, provenance, firm, and credential gates."""
    requested = tuple(sorted(set(years)))
    if not requested:
        raise ValueError("years must not be empty")
    failures: list[IndividualValidationIssue] = []
    warnings: list[IndividualValidationIssue] = []
    with database.connection() as connection:
        run = connection.execute(
            """
            SELECT status, expected_individual_count, retrieved_individual_count,
                   expected_page_requests, completed_page_requests,
                   CAST(collection_completed_at AS DATE)
            FROM individual_collection_runs WHERE collection_id = ?
            """,
            [collection_id],
        ).fetchone()
        if run is None:
            failures.append(
                IndividualValidationIssue("missing_collection", "The requested individual collection is absent.", 1)
            )
            return IndividualValidationResult(tuple(failures), tuple(warnings))
        if run[0] != "published":
            failures.append(
                IndividualValidationIssue(
                    "collection_not_published",
                    "The requested individual collection is not in published status.",
                    1,
                )
            )
        if int(run[1]) != int(run[2]):
            failures.append(
                IndividualValidationIssue(
                    "collection_count_mismatch",
                    "Planned and retrieved individual counts differ.",
                    abs(int(run[1]) - int(run[2])),
                )
            )
        observation_count = _scalar_count(
            connection,
            "SELECT count(*) FROM individual_observations WHERE collection_id = ?",
            [collection_id],
        )
        if observation_count != int(run[1]):
            failures.append(
                IndividualValidationIssue(
                    "canonical_count_mismatch",
                    "Canonical observations do not equal the planned collection count.",
                    abs(observation_count - int(run[1])),
                )
            )
        if int(run[3]) != int(run[4]):
            failures.append(
                IndividualValidationIssue(
                    "page_count_mismatch",
                    "Planned and completed page-request counts differ.",
                    abs(int(run[3]) - int(run[4])),
                )
            )
        _append_count_issue(
            connection,
            failures,
            code="shard_reconciliation_mismatch",
            message="At least one CRD shard does not match its planned count.",
            query="""
                SELECT count(*) FROM individual_query_shards
                WHERE collection_id = ? AND (
                    expected_count <> retrieved_count OR reconciliation_status <> 'reconciled'
                )
            """,
            parameters=[collection_id],
        )
        _append_count_issue(
            connection,
            failures,
            code="observation_outside_shard",
            message="A canonical individual CRD is outside every planned shard.",
            query="""
                SELECT count(*) FROM individual_observations observations
                WHERE observations.collection_id = ? AND NOT EXISTS (
                    SELECT 1 FROM individual_query_shards shards
                    WHERE shards.collection_id = observations.collection_id
                      AND observations.individual_crd BETWEEN shards.low_crd AND shards.high_crd
                )
            """,
            parameters=[collection_id],
        )
        _append_count_issue(
            connection,
            failures,
            code="relationship_outside_interval",
            message="An annual registration relationship is outside its supporting half-open interval.",
            query="""
                SELECT count(*)
                FROM individual_firm_year relationships
                JOIN individual_registration_intervals intervals
                  ON intervals.collection_id = relationships.collection_id
                 AND intervals.interval_id = relationships.source_interval_id
                WHERE relationships.collection_id = ?
                  AND relationships.relationship_kind = 'active_registration'
                  AND (
                    (intervals.start_method = 'current_collection_observation_only'
                     AND relationships.snapshot_date <> ?)
                    OR
                    (intervals.start_method <> 'current_collection_observation_only' AND (
                        intervals.start_date IS NULL
                        OR relationships.snapshot_date < intervals.start_date
                        OR (intervals.end_date IS NOT NULL
                            AND relationships.snapshot_date >= intervals.end_date)
                    ))
                  )
            """,
            parameters=[collection_id, run[5]],
        )
        _append_count_issue(
            connection,
            failures,
            code="relationship_without_source_crd",
            message="An individual-firm relationship lacks a matching source-supplied firm CRD.",
            query="""
                SELECT count(*) FROM individual_firm_year relationships
                WHERE relationships.collection_id = ? AND (
                    (relationships.relationship_kind = 'active_registration' AND NOT EXISTS (
                        SELECT 1 FROM individual_registration_intervals intervals
                        WHERE intervals.collection_id = relationships.collection_id
                          AND intervals.interval_id = relationships.source_interval_id
                          AND intervals.individual_crd = relationships.individual_crd
                          AND intervals.employer_firm_crd = relationships.firm_crd
                    ))
                    OR
                    (relationships.relationship_kind = 'current_employment_observation' AND NOT EXISTS (
                        SELECT 1 FROM individual_current_employments employment
                        WHERE employment.collection_id = relationships.collection_id
                          AND employment.individual_crd = relationships.individual_crd
                          AND employment.employer_firm_crd = relationships.firm_crd
                    ))
                )
            """,
            parameters=[collection_id],
        )

        for year in requested:
            snapshot_count = _scalar_count(
                connection,
                "SELECT count(*) FROM individual_year_snapshots WHERE collection_id = ? AND snapshot_year = ?",
                [collection_id, year],
            )
            if snapshot_count == 0:
                failures.append(
                    IndividualValidationIssue(
                        "missing_individual_snapshot_year",
                        f"No individual snapshots were published for {year}.",
                        1,
                    )
                )
                continue
            if year <= 2025:
                wrong = _scalar_count(
                    connection,
                    """
                    SELECT count(*) FROM individual_year_snapshots
                    WHERE collection_id = ? AND snapshot_year = ? AND (
                        snapshot_status <> 'partial_current_index_backcast'
                        OR population_coverage_status <> 'partial_current_population'
                        OR snapshot_date <> make_date(?, 12, 31)
                    )
                    """,
                    [collection_id, year, year],
                )
                if wrong:
                    failures.append(
                        IndividualValidationIssue(
                            "unexpected_historical_snapshot_label",
                            f"Historical individual snapshots for {year} are not labelled as partial backcasts.",
                            wrong,
                        )
                    )
            else:
                wrong = _scalar_count(
                    connection,
                    """
                    SELECT count(*) FROM individual_year_snapshots
                    WHERE collection_id = ? AND snapshot_year = 2026 AND (
                        snapshot_status <> 'provisional_current_index'
                        OR population_coverage_status <> 'available_current_observation'
                        OR snapshot_date <> ?
                    )
                    """,
                    [collection_id, run[5]],
                )
                if wrong:
                    failures.append(
                        IndividualValidationIssue(
                            "unexpected_2026_snapshot",
                            "The 2026 individual snapshot is not the provisional collection-date observation.",
                            wrong,
                        )
                    )
            provenance_missing = _scalar_count(
                connection,
                """
                SELECT count(*) FROM individual_year_snapshots snapshots
                WHERE snapshots.collection_id = ? AND snapshots.snapshot_year = ?
                  AND ? > (
                      SELECT count(DISTINCT provenance.field_name)
                      FROM individual_snapshot_field_provenance provenance
                      WHERE provenance.collection_id = snapshots.collection_id
                        AND provenance.snapshot_year = snapshots.snapshot_year
                        AND provenance.individual_crd = snapshots.individual_crd
                        AND provenance.field_name IN (
                            'name', 'is_iar', 'active_registration_relationship_count',
                            'active_employer_firm_count', 'active_jurisdiction_count',
                            'has_us_workplace', 'has_us_employer', 'has_disclosure_summary'
                        )
                  )
                """,
                [collection_id, year, len(REQUIRED_PROVENANCE_FIELDS)],
            )
            if provenance_missing:
                failures.append(
                    IndividualValidationIssue(
                        "missing_snapshot_provenance",
                        f"Important annual fields lack provenance for {year}.",
                        provenance_missing,
                    )
                )
            coverage_count = _scalar_count(
                connection,
                """
                SELECT count(DISTINCT field_group) FROM individual_snapshot_coverage
                WHERE collection_id = ? AND snapshot_year = ?
                """,
                [collection_id, year],
            )
            if coverage_count < len(REQUIRED_COVERAGE_GROUPS):
                failures.append(
                    IndividualValidationIssue(
                        "missing_snapshot_coverage",
                        f"Required field-group coverage is incomplete for {year}.",
                        len(REQUIRED_COVERAGE_GROUPS) - coverage_count,
                    )
                )

        unmatched = _scalar_count(
            connection,
            """
            SELECT count(*) FROM individual_firm_year
            WHERE collection_id = ? AND employer_firm_coverage = 'not_in_firm_snapshot_universe'
            """,
            [collection_id],
        )
        if unmatched:
            warnings.append(
                IndividualValidationIssue(
                    "state_or_unmatched_firm_crd",
                    "Source-supplied employer CRDs are absent from the SEC/ERA firm snapshot universe.",
                    unmatched,
                )
            )

        firm_coverage_years = _scalar_count(
            connection,
            """
            SELECT count(DISTINCT snapshot_year) FROM snapshot_coverage
            WHERE entity_category = 'FIRM' AND field_group = 'firms'
              AND snapshot_year IN (SELECT unnest(?))
            """,
            [list(requested)],
        )
        database_credential_values = [
            str(value)
            for row in connection.execute("SELECT source_url, manifest_path FROM source_artifacts").fetchall()
            for value in row
            if value is not None
        ]

    if firm_coverage_years == len(requested):
        firm_result = validate_official_pipeline(database, years=requested)
        failures.extend(
            IndividualValidationIssue(
                f"firm_pipeline:{issue.code}",
                issue.message,
                issue.count,
            )
            for issue in firm_result.failures
        )
        warnings.extend(
            IndividualValidationIssue(
                f"firm_pipeline:{issue.code}",
                issue.message,
                issue.count,
            )
            for issue in firm_result.warnings
        )
    else:
        warnings.append(
            IndividualValidationIssue(
                "firm_pipeline_not_evaluated",
                "Complete firm snapshot coverage was not present for every requested year.",
                len(requested) - firm_coverage_years,
            )
        )

    credential_matches = list(scan_for_secrets(credential_scan_paths, secret_values))
    for value in database_credential_values:
        if CREDENTIAL_PATTERN.search(value) or any(secret and secret in value for secret in secret_values):
            credential_matches.append(SecretMatch("database provenance", "credential material"))
    if credential_matches:
        failures.append(
            IndividualValidationIssue(
                "credential_material_found",
                "Credential material appears in retained provenance, manifests, or reports.",
                len(credential_matches),
            )
        )
    return IndividualValidationResult(tuple(failures), tuple(warnings))


def build_individual_coverage(
    database: OfficialDatabase,
    *,
    collection_id: str,
    years: Sequence[int],
) -> list[IndividualCoverageRow]:
    """Summarize nullable annual person and relationship coverage."""
    rows: list[IndividualCoverageRow] = []
    with database.connection() as connection:
        for year in sorted(set(years)):
            aggregate = connection.execute(
                """
                SELECT count(*),
                       count(*) FILTER (WHERE is_iar IS TRUE),
                       count(*) FILTER (WHERE is_iar IS FALSE),
                       count(*) FILTER (WHERE is_iar IS NULL),
                       count(*) FILTER (WHERE has_us_workplace IS TRUE),
                       count(*) FILTER (WHERE has_us_workplace IS FALSE),
                       count(*) FILTER (WHERE has_us_workplace IS NULL),
                       count(*) FILTER (WHERE has_us_employer IS TRUE),
                       count(*) FILTER (WHERE has_us_employer IS FALSE),
                       count(*) FILTER (WHERE has_us_employer IS NULL),
                       count(DISTINCT snapshot_status), min(snapshot_status)
                FROM individual_year_snapshots
                WHERE collection_id = ? AND snapshot_year = ?
                """,
                [collection_id, year],
            ).fetchone()
            assert aggregate is not None
            count = int(aggregate[0])
            status = "missing" if count == 0 else str(aggregate[11])
            if int(aggregate[10]) > 1:
                status = "mixed"
            relationship_count = _scalar_count(
                connection,
                """
                SELECT count(*) FROM individual_firm_year
                WHERE collection_id = ? AND snapshot_year = ?
                  AND relationship_kind = 'active_registration'
                """,
                [collection_id, year],
            )
            employment_count = _scalar_count(
                connection,
                """
                SELECT count(*) FROM individual_firm_year
                WHERE collection_id = ? AND snapshot_year = ?
                  AND relationship_kind = 'current_employment_observation'
                """,
                [collection_id, year],
            )
            unmatched = _scalar_count(
                connection,
                """
                SELECT count(DISTINCT firm_crd) FROM individual_firm_year
                WHERE collection_id = ? AND snapshot_year = ?
                  AND employer_firm_coverage = 'not_in_firm_snapshot_universe'
                """,
                [collection_id, year],
            )
            exam_status = _coverage_status(connection, collection_id, year, "exams")
            designation_status = _coverage_status(connection, collection_id, year, "designations")
            rows.append(
                IndividualCoverageRow(
                    year=year,
                    snapshot_status=status,
                    individual_count=count,
                    iar_true_count=int(aggregate[1]),
                    iar_false_count=int(aggregate[2]),
                    iar_unknown_count=int(aggregate[3]),
                    active_firm_relationship_count=relationship_count,
                    current_employment_relationship_count=employment_count,
                    us_workplace_true_count=int(aggregate[4]),
                    us_workplace_false_count=int(aggregate[5]),
                    us_workplace_unknown_count=int(aggregate[6]),
                    us_employer_true_count=int(aggregate[7]),
                    us_employer_false_count=int(aggregate[8]),
                    us_employer_unknown_count=int(aggregate[9]),
                    unmatched_employer_firm_count=unmatched,
                    population_coverage=_coverage_status(connection, collection_id, year, "population"),
                    registration_coverage=_coverage_status(connection, collection_id, year, "registration_intervals"),
                    employment_history_coverage=_coverage_status(connection, collection_id, year, "employment_history"),
                    geography_coverage=_coverage_status(connection, collection_id, year, "workplace_geography"),
                    qualification_coverage=(exam_status if exam_status == designation_status else "mixed"),
                    disclosure_coverage=_coverage_status(connection, collection_id, year, "disclosures"),
                )
            )
    return rows


def write_individual_coverage_report(
    database: OfficialDatabase,
    *,
    collection_id: str,
    years: Sequence[int],
    output_dir: Path,
    run_id: str,
    generated_at: datetime,
) -> tuple[Path, Path]:
    """Write current-index partial individual coverage as Markdown and CSV."""
    rows = build_individual_coverage(database, collection_id=collection_id, years=years)
    output_dir.mkdir(parents=True, exist_ok=True)
    markdown_path = output_dir / f"individual-coverage-{run_id}.md"
    csv_path = output_dir / f"individual-coverage-{run_id}.csv"
    lines = [
        "# Current-index individual/IAR partial historical coverage",
        "",
        f"Generated: {generated_at.isoformat()}",
        f"Collection: {collection_id}",
        "",
        "| Year | Status | Individuals | IAR true | IAR false | IAR unknown | Active firm relationships | Current employment relationships | U.S. workplace true | U.S. employer true | Unmatched firm CRDs | Population coverage |",
        "|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ]
    for row in rows:
        lines.append(
            f"| {row.year} | {row.snapshot_status} | {row.individual_count} | "
            f"{row.iar_true_count} | {row.iar_false_count} | {row.iar_unknown_count} | "
            f"{row.active_firm_relationship_count} | {row.current_employment_relationship_count} | "
            f"{row.us_workplace_true_count} | {row.us_employer_true_count} | "
            f"{row.unmatched_employer_firm_count} | {row.population_coverage} |"
        )
    markdown_path.write_text("\n".join(lines) + "\n")
    with csv_path.open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(asdict(rows[0]).keys()))
        writer.writeheader()
        writer.writerows(asdict(row) for row in rows)
    return markdown_path, csv_path


def scan_for_secrets(paths: Sequence[Path], secret_values: Sequence[str]) -> tuple[SecretMatch, ...]:
    """Return credential-safe findings without exposing any matched value."""
    matches: list[SecretMatch] = []
    for path in paths:
        candidates = [path] if path.is_file() else [item for item in path.rglob("*") if item.is_file()]
        for candidate in candidates:
            if candidate.name == ".env.local" or candidate.suffix.lower() in _BINARY_ANALYTICAL_SUFFIXES:
                continue
            try:
                content = candidate.read_text(errors="ignore")
            except OSError:
                continue
            if any(secret and secret in content for secret in secret_values):
                matches.append(SecretMatch(str(candidate), "configured secret value"))
                continue
            if candidate.suffix.lower() == ".json":
                try:
                    payload = json.loads(content)
                except json.JSONDecodeError:
                    has_credential_field = CREDENTIAL_PATTERN.search(content) is not None
                else:
                    has_credential_field = _json_has_credential_field(payload)
            else:
                has_credential_field = CREDENTIAL_PATTERN.search(content) is not None
            if has_credential_field:
                matches.append(SecretMatch(str(candidate), "credential-like field"))
    return tuple(matches)


def _json_has_credential_field(value: object) -> bool:
    if isinstance(value, dict):
        for key, child in value.items():
            normalized_key = str(key).strip().lower().replace("-", "_")
            if normalized_key in _CREDENTIAL_FIELD_NAMES or _json_has_credential_field(child):
                return True
        return False
    if isinstance(value, list):
        return any(_json_has_credential_field(item) for item in value)
    return False


def _append_count_issue(
    connection: DuckDBPyConnection,
    issues: list[IndividualValidationIssue],
    *,
    code: str,
    message: str,
    query: str,
    parameters: list[object],
) -> None:
    count = _scalar_count(connection, query, parameters)
    if count:
        issues.append(IndividualValidationIssue(code, message, count))


def _scalar_count(
    connection: DuckDBPyConnection,
    query: str,
    parameters: list[object],
) -> int:
    row = connection.execute(query, parameters).fetchone()
    return int(row[0]) if row else 0


def _coverage_status(
    connection: DuckDBPyConnection,
    collection_id: str,
    year: int,
    field_group: str,
) -> str:
    row = connection.execute(
        """
        SELECT coverage_status FROM individual_snapshot_coverage
        WHERE collection_id = ? AND snapshot_year = ? AND field_group = ?
        """,
        [collection_id, year, field_group],
    ).fetchone()
    return str(row[0]) if row else "unavailable"


__all__ = [
    "IndividualCoverageRow",
    "IndividualValidationIssue",
    "IndividualValidationResult",
    "SecretMatch",
    "build_individual_coverage",
    "scan_for_secrets",
    "validate_individual_pipeline",
    "write_individual_coverage_report",
]
