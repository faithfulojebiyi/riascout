"""Invariant validation and coverage summaries for official firm snapshots."""

import re
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from duckdb import DuckDBPyConnection

from riascout_adv_data.official_db import OfficialDatabase

CREDENTIAL_PATTERN = re.compile(
    r"(?:authorization|api[_-]?key|sec_api_key)\s*(?:=|:)",
    flags=re.IGNORECASE,
)


@dataclass(frozen=True)
class ValidationIssue:
    """One actionable validation finding."""

    code: str
    message: str
    count: int


@dataclass(frozen=True)
class OfficialValidationResult:
    """Failures and expected limitations from an official pipeline validation."""

    failures: tuple[ValidationIssue, ...]
    warnings: tuple[ValidationIssue, ...]

    @property
    def is_valid(self) -> bool:
        """Return whether no acceptance-blocking invariant failed."""
        return not self.failures


@dataclass(frozen=True)
class OfficialCoverageRow:
    """One year's filter-ready firm snapshot coverage."""

    year: int
    snapshot_status: str
    firm_snapshot_coverage: str
    firm_count: int
    ria_count: int
    era_count: int
    us_based_count: int
    non_us_based_count: int
    country_unknown_count: int
    is_state_registered_count: int
    state_unknown_count: int
    state_registration_coverage: str
    schedule_d_coverage: str


def validate_official_pipeline(
    database: OfficialDatabase,
    *,
    years: Sequence[int],
    scan_paths: Sequence[Path] = (),
) -> OfficialValidationResult:
    """Check point-in-time, filing-key, coverage, and credential-safety invariants."""
    requested = tuple(sorted(set(years)))
    if not requested:
        raise ValueError("years must not be empty")
    failures: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []
    with database.connection() as connection:
        _append_count_issue(
            connection,
            failures,
            code="duplicate_firm_year_snapshot",
            message="More than one snapshot exists for a firm and year.",
            query="""
                SELECT count(*) FROM (
                    SELECT snapshot_year, firm_crd FROM firm_snapshots
                    GROUP BY snapshot_year, firm_crd HAVING count(*) > 1
                ) duplicate_rows
            """,
        )
        _append_count_issue(
            connection,
            failures,
            code="selected_filing_after_snapshot",
            message="A selected filing is dated after its snapshot.",
            query="""
                SELECT count(*)
                FROM firm_snapshots s JOIN filings f ON f.filing_id = s.selected_filing_id
                WHERE coalesce(f.effective_date, cast(f.submitted_at AS DATE)) > s.snapshot_date
                   OR cast(f.submitted_at AS DATE) > s.snapshot_date
            """,
        )
        _append_count_issue(
            connection,
            failures,
            code="snapshot_child_filing_mismatch",
            message="A selected filing or filing-keyed child does not belong to the snapshot firm.",
            query=_filing_mismatch_query(),
        )
        _append_count_issue(
            connection,
            failures,
            code="private_fund_duplicate_reference",
            message="A filing-local private-fund ReferenceID maps to more than one SEC Fund ID.",
            query="""
                SELECT count(*) FROM (
                    SELECT filing_id, fund_reference FROM filing_private_funds
                    GROUP BY filing_id, fund_reference HAVING count(DISTINCT private_fund_id) > 1
                ) duplicate_references
            """,
        )
        _append_count_issue(
            connection,
            failures,
            code="private_fund_orphan_child",
            message="A private-fund child record does not match a filing-level private-fund fact.",
            query=_private_fund_orphan_query(),
        )
        _append_count_issue(
            connection,
            failures,
            code="private_fund_child_id_mismatch",
            message="A private-fund child resolves its ReferenceID to the wrong SEC Fund ID.",
            query=_private_fund_child_id_mismatch_query(),
        )
        _append_count_issue(
            connection,
            failures,
            code="private_fund_percentage_range",
            message="A private-fund percentage is outside the inclusive 0-100 range.",
            query=_private_fund_percentage_range_query(),
        )
        _append_count_issue(
            connection,
            failures,
            code="private_fund_negative_measure",
            message="A private-fund money or count measure is negative.",
            query="""
                SELECT count(*) FROM filing_private_funds
                WHERE gross_asset_value < 0 OR minimum_investment < 0 OR beneficial_owner_count < 0
            """,
        )
        _append_count_issue(
            connection,
            failures,
            code="private_fund_invalid_code",
            message="A private-fund role or audit status is outside the modeled source vocabulary.",
            query=_private_fund_invalid_code_query(),
        )
        _append_count_issue(
            connection,
            failures,
            code="unrecognized_nonempty_country",
            message="A nonempty source country could not be normalized.",
            query="""
                SELECT count(*) FROM firm_snapshots
                WHERE principal_country_raw IS NOT NULL
                  AND trim(principal_country_raw) <> ''
                  AND principal_country_code IS NULL
                  AND principal_country_method NOT IN (
                      'explicit_unknown', 'carried_forward_explicit_unknown'
                  )
            """,
        )
        _append_count_issue(
            connection,
            failures,
            code="unexpected_2026_status",
            message="Every 2026 snapshot must be provisional.",
            query="""
                SELECT count(*) FROM firm_snapshots
                WHERE snapshot_year = 2026 AND snapshot_status <> 'provisional'
            """,
        )
        _append_count_issue(
            connection,
            failures,
            code="negative_client_count",
            message="An Item 5.D client count is negative.",
            query="SELECT count(*) FROM filing_client_types WHERE client_count < 0",
        )
        _append_count_issue(
            connection,
            failures,
            code="invalid_fewer_than_five_count",
            message="An Item 5.D fewer-than-five response carries a count greater than four.",
            query="""
                SELECT count(*) FROM filing_client_types
                WHERE fewer_than_five IS TRUE AND client_count > 4
            """,
        )
        _append_count_issue(
            connection,
            failures,
            code="inverted_reported_client_bound",
            message="A derived reported-client minimum exceeds its maximum.",
            query="""
                SELECT count(*) FROM filing_reported_client_totals
                WHERE reported_client_count_min > reported_client_count_max
            """,
        )
        _append_count_issue(
            connection,
            warnings,
            code="account_component_reconciliation",
            message="Source-reported discretionary and non-discretionary accounts do not sum to total accounts.",
            query="""
                SELECT count(*) FROM firm_metrics
                WHERE discretionary_account_count IS NOT NULL
                  AND non_discretionary_account_count IS NOT NULL
                  AND account_count IS NOT NULL
                  AND discretionary_account_count + non_discretionary_account_count <> account_count
            """,
        )
        _append_count_issue(
            connection,
            warnings,
            code="client_aum_reconciliation",
            message="Source-reported client-type AUM does not sum to total regulatory AUM.",
            query="""
                SELECT count(*)
                FROM firm_metrics m
                JOIN (
                    SELECT filing_id, sum(regulatory_aum) AS client_type_aum
                    FROM filing_client_types
                    GROUP BY filing_id
                ) c USING (filing_id)
                WHERE m.regulatory_aum IS NOT NULL
                  AND c.client_type_aum IS NOT NULL
                  AND c.client_type_aum <> m.regulatory_aum
            """,
        )
        _append_count_issue(
            connection,
            warnings,
            code="client_count_missing_for_positive_aum",
            message="Positive client-type AUM has no numeric or fewer-than-five client evidence.",
            query="""
                SELECT count(*) FROM filing_client_types
                WHERE regulatory_aum > 0
                  AND coalesce(client_count, 0) <= 0
                  AND fewer_than_five IS NOT TRUE
            """,
        )
        for year in requested:
            snapshot_count = _scalar_count(
                connection,
                "SELECT count(*) FROM firm_snapshots WHERE snapshot_year = ?",
                [year],
            )
            if snapshot_count == 0:
                failures.append(
                    ValidationIssue("missing_snapshot_year", f"No firm snapshots were published for {year}.", 1)
                )
                continue
            coverage_count = _scalar_count(
                connection,
                """
                SELECT count(*) FROM snapshot_coverage
                WHERE snapshot_year = ? AND entity_category = 'FIRM'
                  AND field_group = 'firms' AND coverage_status = 'available'
                """,
                [year],
            )
            if coverage_count == 0:
                failures.append(
                    ValidationIssue(
                        "required_field_coverage_loss",
                        f"Firm coverage was not confirmed for {year}.",
                        1,
                    )
                )
            if year <= 2024:
                for column, code, label in (
                    ("is_sec_registered", "missing_historical_sec_coverage", "SEC-registered"),
                    ("is_era", "missing_historical_era_coverage", "ERA"),
                ):
                    category_count = _scalar_count(
                        connection,
                        f"SELECT count(*) FROM firm_snapshots WHERE snapshot_year = ? AND {column}",
                        [year],
                    )
                    if category_count == 0:
                        failures.append(
                            ValidationIssue(
                                code,
                                f"No {label} firms were published for historical year {year}.",
                                1,
                            )
                        )
            if year in {2025, 2026} and not _has_paired_monthly_categories(connection, year):
                failures.append(
                    ValidationIssue(
                        "missing_paired_monthly_categories",
                        f"Snapshots for {year} do not have paired RIA and ERA source reports.",
                        1,
                    )
                )
            state_coverage = connection.execute(
                """
                SELECT coverage_status FROM snapshot_coverage
                WHERE snapshot_year = ? AND entity_category = 'FIRM'
                  AND field_group = 'state_registration'
                """,
                [year],
            ).fetchone()
            if state_coverage is None or str(state_coverage[0]) == "unavailable":
                warnings.append(
                    ValidationIssue(
                        "state_history_unavailable",
                        f"Date-specific state registration history is unavailable for {year}.",
                        snapshot_count,
                    )
                )

        credential_rows = connection.execute("SELECT source_url, manifest_path FROM source_artifacts").fetchall()
    credential_count = sum(
        1 for row in credential_rows for value in row if value is not None and CREDENTIAL_PATTERN.search(str(value))
    )
    credential_count += _credential_file_count(scan_paths)
    if credential_count:
        failures.append(
            ValidationIssue(
                "credential_material_found",
                "Credential-like material appears in a stored URL, manifest, or report.",
                credential_count,
            )
        )
    return OfficialValidationResult(tuple(failures), tuple(warnings))


def build_official_coverage(
    database: OfficialDatabase,
    *,
    years: Sequence[int],
) -> list[OfficialCoverageRow]:
    """Summarize published coverage without turning unavailable fields into false values."""
    requested = tuple(sorted(set(years)))
    rows: list[OfficialCoverageRow] = []
    with database.connection() as connection:
        for year in requested:
            aggregate = connection.execute(
                """
                SELECT count(*),
                       count(*) FILTER (WHERE is_sec_registered IS TRUE),
                       count(*) FILTER (WHERE is_era IS TRUE),
                       count(*) FILTER (WHERE is_us_based IS TRUE),
                       count(*) FILTER (WHERE is_us_based IS FALSE),
                       count(*) FILTER (WHERE is_us_based IS NULL),
                       count(*) FILTER (WHERE is_state_registered IS TRUE),
                       count(*) FILTER (WHERE is_state_registered IS NULL),
                       count(DISTINCT snapshot_status), min(snapshot_status)
                FROM firm_snapshots WHERE snapshot_year = ?
                """,
                [year],
            ).fetchone()
            assert aggregate is not None
            firm_count = int(aggregate[0])
            status = "missing" if firm_count == 0 else str(aggregate[9])
            if int(aggregate[8]) > 1:
                status = "mixed"
            rows.append(
                OfficialCoverageRow(
                    year=year,
                    snapshot_status=status,
                    firm_snapshot_coverage="confirmed" if firm_count else "missing",
                    firm_count=firm_count,
                    ria_count=int(aggregate[1]),
                    era_count=int(aggregate[2]),
                    us_based_count=int(aggregate[3]),
                    non_us_based_count=int(aggregate[4]),
                    country_unknown_count=int(aggregate[5]),
                    is_state_registered_count=int(aggregate[6]),
                    state_unknown_count=int(aggregate[7]),
                    state_registration_coverage=_coverage_status(connection, year, "state_registration"),
                    schedule_d_coverage=_coverage_status(connection, year, "schedule_d"),
                )
            )
    return rows


def _append_count_issue(
    connection: DuckDBPyConnection,
    issues: list[ValidationIssue],
    *,
    code: str,
    message: str,
    query: str,
) -> None:
    count = _scalar_count(connection, query)
    if count:
        issues.append(ValidationIssue(code, message, count))


def _scalar_count(
    connection: DuckDBPyConnection,
    query: str,
    parameters: list[object] | None = None,
) -> int:
    row = connection.execute(query, parameters or []).fetchone()
    return int(row[0]) if row else 0


def _filing_mismatch_query() -> str:
    child_views = (
        "firm_snapshot_client_types",
        "firm_snapshot_services",
        "firm_snapshot_offices",
        "firm_snapshot_asset_allocations",
        "firm_snapshot_custodians",
        "firm_snapshot_private_funds",
        "firm_snapshot_affiliations",
    )
    view_checks = " UNION ALL ".join(
        f"""
        SELECT v.snapshot_year, v.firm_crd
        FROM {view} v JOIN filings f ON f.filing_id = v.filing_id
        WHERE f.firm_crd <> v.firm_crd
        """
        for view in child_views
    )
    return f"""
        SELECT count(*) FROM (
            SELECT s.snapshot_year, s.firm_crd
            FROM firm_snapshots s JOIN filings f ON f.filing_id = s.selected_filing_id
            WHERE f.firm_crd <> s.firm_crd
            UNION ALL {view_checks}
        ) mismatches
    """


def _private_fund_orphan_query() -> str:
    child_tables = (
        "filing_private_fund_related_funds",
        "filing_private_fund_managers",
        "filing_private_fund_foreign_authorities",
        "filing_private_fund_advisers",
        "filing_private_fund_form_d",
        "filing_private_fund_service_providers",
        "filing_private_fund_provider_websites",
    )
    checks = " UNION ALL ".join(
        f"""
        SELECT c.filing_id, c.private_fund_id
        FROM {table} c
        LEFT JOIN filing_private_funds p
          ON p.filing_id = c.filing_id
         AND p.private_fund_id = c.private_fund_id
         AND p.fund_reference = c.fund_reference
        WHERE p.filing_id IS NULL
        """
        for table in child_tables
    )
    return f"SELECT count(*) FROM ({checks}) orphan_rows"


def _private_fund_child_id_mismatch_query() -> str:
    child_tables = (
        "filing_private_fund_related_funds",
        "filing_private_fund_managers",
        "filing_private_fund_foreign_authorities",
        "filing_private_fund_advisers",
        "filing_private_fund_form_d",
        "filing_private_fund_service_providers",
        "filing_private_fund_provider_websites",
    )
    checks = " UNION ALL ".join(
        f"""
        SELECT c.filing_id, c.private_fund_id
        FROM {table} c
        JOIN filing_private_funds p
          ON p.filing_id = c.filing_id AND p.fund_reference = c.fund_reference
        WHERE p.private_fund_id <> c.private_fund_id
        """
        for table in child_tables
    )
    return f"SELECT count(*) FROM ({checks}) mismatches"


def _private_fund_percentage_range_query() -> str:
    columns = (
        "owned_by_adviser_related_pct",
        "owned_by_funds_pct",
        "owned_by_non_us_pct",
        "clients_invested_pct",
        "externally_valued_assets_pct",
    )
    predicate = " OR ".join(f"{column} < 0 OR {column} > 100" for column in columns)
    return f"SELECT count(*) FROM filing_private_funds WHERE {predicate}"


def _private_fund_invalid_code_query() -> str:
    return """
        SELECT count(*) FROM (
            SELECT filing_id FROM filing_private_funds
            WHERE audit_opinion_status IS NOT NULL
              AND audit_opinion_status NOT IN (
                  'unqualified', 'not_unqualified', 'report_not_yet_received'
              )
            UNION ALL
            SELECT filing_id FROM filing_private_fund_related_funds
            WHERE relation_role NOT IN ('feeder_fund')
            UNION ALL
            SELECT filing_id FROM filing_private_fund_managers
            WHERE manager_role NOT IN (
                'fund_partner_or_manager', 'fund_filing_or_relying_adviser',
                'master_fund_partner_or_manager', 'master_fund_filing_or_relying_adviser'
            )
            UNION ALL
            SELECT filing_id FROM filing_private_fund_foreign_authorities
            WHERE authority_role NOT IN ('fund', 'master_fund')
            UNION ALL
            SELECT filing_id FROM filing_private_fund_advisers
            WHERE adviser_role NOT IN ('primary_adviser', 'other_adviser')
            UNION ALL
            SELECT filing_id FROM filing_private_fund_service_providers
            WHERE provider_role NOT IN ('auditor', 'prime_broker', 'custodian', 'administrator', 'marketer')
               OR (
                   provider_role <> 'administrator'
                   AND (sends_statements IS NOT NULL OR statement_sender IS NOT NULL)
               )
        ) invalid_codes
    """


def _has_paired_monthly_categories(connection: DuckDBPyConnection, year: int) -> bool:
    row = connection.execute(
        """
        SELECT source_observation_date
        FROM firm_snapshots
        WHERE snapshot_year = ? AND source_observation_date IS NOT NULL
        GROUP BY source_observation_date
        ORDER BY source_observation_date DESC
        LIMIT 1
        """,
        [year],
    ).fetchone()
    if row is None:
        return False
    categories = {
        str(item[0])
        for item in connection.execute(
            """
            SELECT DISTINCT category FROM dated_firm_observations
            WHERE report_date = ? AND category IN ('SEC', 'ERA')
            """,
            [row[0]],
        ).fetchall()
    }
    return categories == {"SEC", "ERA"}


def _coverage_status(connection: DuckDBPyConnection, year: int, field_group: str) -> str:
    row = connection.execute(
        """
        SELECT coverage_status FROM snapshot_coverage
        WHERE snapshot_year = ? AND entity_category = 'FIRM' AND field_group = ?
        """,
        [year, field_group],
    ).fetchone()
    return str(row[0]) if row else "unavailable"


def _credential_file_count(paths: Sequence[Path]) -> int:
    count = 0
    for path in paths:
        candidates = [path] if path.is_file() else [item for item in path.rglob("*") if item.is_file()]
        for candidate in candidates:
            try:
                content = candidate.read_text(errors="ignore")
            except OSError:
                continue
            if CREDENTIAL_PATTERN.search(content):
                count += 1
    return count


__all__ = [
    "OfficialCoverageRow",
    "OfficialValidationResult",
    "ValidationIssue",
    "build_official_coverage",
    "validate_official_pipeline",
]
