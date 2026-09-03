from datetime import UTC, date, datetime
from pathlib import Path

from riascout_adv_data.official_db import OfficialArtifactRecord, OfficialDatabase
from riascout_adv_data.official_validation import build_official_coverage, validate_official_pipeline


def _database(tmp_path: Path) -> OfficialDatabase:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    database.record_artifact(
        OfficialArtifactRecord(
            artifact_id="history",
            dataset_key="history",
            dataset_kind="adv_part1",
            source_url="https://www.sec.gov/files/history.zip",
            observation_date=date(2024, 12, 31),
            retrieved_at=datetime(2026, 8, 26, tzinfo=UTC),
            sha256="history",
            payload_path="data/raw/history.zip",
            manifest_path="data/raw/history.manifest.json",
            byte_count=1,
        )
    )
    return database


def _insert_snapshot(database: OfficialDatabase, *, year: int, firm_crd: int, filing_id: str | None) -> None:
    with database.transaction() as connection:
        connection.execute(
            """
            INSERT INTO firm_snapshots (
                snapshot_year, snapshot_date, snapshot_status, as_of_collected_at,
                firm_crd, firm_name, selected_filing_id, source_artifact_id,
                source_dataset, is_sec_registered, is_era, is_state_registered,
                primary_registration_type, validation_status
            ) VALUES (?, ?, ?, ?, ?, 'Example', ?, 'history', 'adv_part1', TRUE, FALSE, NULL, 'SEC', 'valid')
            """,
            [
                year,
                date(year, 12, 31),
                "provisional" if year == 2026 else "year_end",
                datetime(2026, 8, 26, tzinfo=UTC),
                firm_crd,
                filing_id,
            ],
        )


def test_validation_detects_selected_filing_owned_by_another_firm(tmp_path: Path) -> None:
    database = _database(tmp_path)
    with database.transaction() as connection:
        connection.execute("INSERT INTO firms VALUES (1, DATE '2020-01-01', DATE '2020-01-01')")
        connection.execute("INSERT INTO firms VALUES (2, DATE '2020-01-01', DATE '2020-01-01')")
        connection.execute(
            """
            INSERT INTO filings VALUES (
                'F-OTHER', 2, TIMESTAMP '2020-01-01', NULL, 'Annual', '801-2',
                'SEC', 'history', 'base.csv', 2
            )
            """
        )
        connection.execute("INSERT INTO firm_names VALUES ('F-OTHER', 'Other', 'history', 'base.csv', 2)")
    _insert_snapshot(database, year=2020, firm_crd=1, filing_id="F-OTHER")

    result = validate_official_pipeline(database, years=[2020])

    assert "snapshot_child_filing_mismatch" in {failure.code for failure in result.failures}
    assert result.is_valid is False


def test_validation_detects_selected_filing_after_snapshot_date(tmp_path: Path) -> None:
    database = _database(tmp_path)
    with database.transaction() as connection:
        connection.execute("INSERT INTO firms VALUES (1, DATE '2021-01-01', DATE '2021-01-01')")
        connection.execute(
            """
            INSERT INTO filings VALUES (
                'F-FUTURE', 1, TIMESTAMP '2021-01-01', NULL, 'Annual', '801-1',
                'SEC', 'history', 'base.csv', 2
            )
            """
        )
        connection.execute("INSERT INTO firm_names VALUES ('F-FUTURE', 'Future', 'history', 'base.csv', 2)")
    _insert_snapshot(database, year=2020, firm_crd=1, filing_id="F-FUTURE")

    result = validate_official_pipeline(database, years=[2020])

    assert "selected_filing_after_snapshot" in {failure.code for failure in result.failures}


def test_validation_rejects_private_fund_children_without_parent_fact(tmp_path: Path) -> None:
    database = _database(tmp_path)
    with database.transaction() as connection:
        connection.execute("INSERT INTO firms VALUES (1, DATE '2020-01-01', DATE '2020-01-01')")
        connection.execute(
            """
            INSERT INTO filings VALUES (
                'F-FUND', 1, TIMESTAMP '2020-01-01', NULL, 'Annual', '801-1',
                'SEC', 'history', 'base.csv', 2
            )
            """
        )
        connection.execute(
            """
            INSERT INTO filing_private_fund_advisers VALUES (
                'F-FUND', 'PF-MISSING', 'REF-1', 'primary_adviser', 'row-1',
                'Adviser LLC', '801-1', 1, 'history', '7b1a17b.csv', 2
            )
            """
        )
    _insert_snapshot(database, year=2020, firm_crd=1, filing_id="F-FUND")

    result = validate_official_pipeline(database, years=[2020])

    assert "private_fund_orphan_child" in {failure.code for failure in result.failures}


def test_validation_rejects_invalid_private_fund_measurements_and_codes(tmp_path: Path) -> None:
    database = _database(tmp_path)
    with database.transaction() as connection:
        connection.execute("INSERT INTO firms VALUES (1, DATE '2020-01-01', DATE '2020-01-01')")
        connection.execute(
            """
            INSERT INTO filings VALUES (
                'F-FUND', 1, TIMESTAMP '2020-01-01', NULL, 'Annual', '801-1',
                'SEC', 'history', 'base.csv', 2
            )
            """
        )
        connection.execute(
            """
            INSERT INTO filing_private_funds (
                filing_id, private_fund_id, fund_reference, gross_asset_value,
                owned_by_non_us_pct, audit_opinion_status,
                artifact_id, source_member, source_row_number
            ) VALUES (
                'F-FUND', 'PF-1', 'REF-1', -1, 101, 'unexpected',
                'history', '7b1.csv', 2
            )
            """
        )
    _insert_snapshot(database, year=2020, firm_crd=1, filing_id="F-FUND")

    result = validate_official_pipeline(database, years=[2020])
    failure_codes = {failure.code for failure in result.failures}

    assert "private_fund_percentage_range" in failure_codes
    assert "private_fund_negative_measure" in failure_codes
    assert "private_fund_invalid_code" in failure_codes


def test_coverage_distinguishes_unavailable_from_false(tmp_path: Path) -> None:
    database = _database(tmp_path)
    _insert_snapshot(database, year=2020, firm_crd=1, filing_id=None)
    with database.transaction() as connection:
        connection.execute(
            "INSERT INTO snapshot_coverage VALUES (2020, 'FIRM', 'state_registration', 'unavailable', 1, 'No source')"
        )

    rows = build_official_coverage(database, years=[2020])

    assert rows[0].state_registration_coverage == "unavailable"
    assert rows[0].firm_snapshot_coverage == "confirmed"
    assert rows[0].is_state_registered_count == 0
    assert rows[0].state_unknown_count == 1


def test_coverage_returns_one_row_for_every_requested_year(tmp_path: Path) -> None:
    database = _database(tmp_path)
    rows = build_official_coverage(database, years=range(2020, 2027))

    assert [row.year for row in rows] == list(range(2020, 2027))
    assert all(row.firm_snapshot_coverage == "missing" for row in rows)


def test_validation_allows_an_explicit_unknown_country_placeholder(tmp_path: Path) -> None:
    database = _database(tmp_path)
    _insert_snapshot(database, year=2020, firm_crd=1, filing_id=None)
    with database.transaction() as connection:
        connection.execute(
            """
            UPDATE firm_snapshots
            SET principal_country_raw = 'Other',
                principal_country_code = NULL,
                principal_country_method = 'explicit_unknown',
                is_us_based = NULL,
                validation_status = 'warning_country_unknown'
            """
        )
        connection.execute(
            "INSERT INTO snapshot_coverage VALUES (2020, 'FIRM', 'firms', 'available', 1, 'Official source')"
        )
        connection.execute(
            "INSERT INTO snapshot_coverage VALUES (2020, 'FIRM', 'state_registration', 'unavailable', 1, 'No source')"
        )

    result = validate_official_pipeline(database, years=[2020])

    assert "unrecognized_nonempty_country" not in {failure.code for failure in result.failures}


def test_validation_requires_historical_era_coverage(tmp_path: Path) -> None:
    database = _database(tmp_path)
    _insert_snapshot(database, year=2020, firm_crd=1, filing_id=None)
    with database.transaction() as connection:
        connection.execute(
            "INSERT INTO snapshot_coverage VALUES (2020, 'FIRM', 'firms', 'available', 1, 'Official source')"
        )

    result = validate_official_pipeline(database, years=[2020])

    assert "missing_historical_era_coverage" in {failure.code for failure in result.failures}


def test_validation_separates_client_transform_failures_from_source_warnings(tmp_path: Path) -> None:
    database = _database(tmp_path)
    with database.transaction() as connection:
        connection.execute("INSERT INTO firms VALUES (149777, DATE '2025-03-31', DATE '2025-03-31')")
        connection.execute(
            """
            INSERT INTO filings VALUES (
                'F-QUALITY', 149777, TIMESTAMP '2025-03-31', NULL,
                'Annual Updating Amendment', '801-1', 'SEC', 'history', 'base.csv', 2
            )
            """
        )
        connection.execute(
            """
            INSERT INTO firm_metrics (
                filing_id, regulatory_aum, discretionary_aum, non_discretionary_aum,
                employee_count, advisory_employee_count,
                discretionary_account_count, non_discretionary_account_count,
                account_count, office_count, artifact_id, source_member,
                source_row_number
            ) VALUES (
                'F-QUALITY', 100, 60, 40, 5, 3, 1, 2, 4, 1,
                'history', 'base.csv', 2
            )
            """
        )
        connection.execute(
            """
            INSERT INTO filing_client_types VALUES
                ('F-QUALITY', 'Individuals', -1, FALSE, 40, 'history', 'base.csv', 2),
                ('F-QUALITY', 'High_Net_Worth_Individuals', 6, TRUE, 50,
                 'history', 'base.csv', 2)
            """
        )

    result = validate_official_pipeline(database, years=[2026])
    failures = {issue.code for issue in result.failures}
    warnings = {issue.code for issue in result.warnings}

    assert "negative_client_count" in failures
    assert "invalid_fewer_than_five_count" in failures
    assert "account_component_reconciliation" in warnings
    assert "client_aum_reconciliation" in warnings
    assert "client_count_missing_for_positive_aum" in warnings
