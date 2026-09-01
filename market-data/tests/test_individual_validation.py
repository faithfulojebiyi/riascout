import json
from datetime import UTC, datetime
from pathlib import Path

from riascout_adv_data.individual_validation import (
    build_individual_coverage,
    scan_for_secrets,
    validate_individual_pipeline,
)
from riascout_adv_data.official_db import OfficialDatabase

COLLECTION_ID = "collection-test"
COLLECTION_TIME = datetime(2026, 8, 26, 12, tzinfo=UTC)


def _valid_database(tmp_path: Path) -> OfficialDatabase:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    with database.connection() as connection:
        connection.execute(
            """
            INSERT INTO individual_collection_runs VALUES (
                ?, 'sha256:plan', 'published', 100, 1, 1, 1, 1, ?, ?, 'individual-v1', NULL
            )
            """,
            [COLLECTION_ID, COLLECTION_TIME, COLLECTION_TIME],
        )
        connection.execute(
            "INSERT INTO individual_query_shards VALUES (?, 1, 100, 1, 1, 1, 'reconciled')",
            [COLLECTION_ID],
        )
        connection.execute("INSERT INTO individuals VALUES (50, ?, ?)", [COLLECTION_TIME, COLLECTION_TIME])
        connection.execute(
            "INSERT INTO individual_observations VALUES (?, 50, ?, 'sha256:page', 0, 'page')",
            [COLLECTION_ID, COLLECTION_TIME],
        )
        connection.execute(
            """
            INSERT INTO individual_names VALUES (
                ?, 50, 'TEST', NULL, 'ADVISER', NULL, TRUE, 'sha256:page', '$.filings[0].Info'
            )
            """,
            [COLLECTION_ID],
        )
        connection.execute(
            """
            INSERT INTO individual_current_employments VALUES (
                ?, 50, 0, 800001, 'TEST FIRM', NULL, NULL, 'NEW YORK', 'NY',
                'United States', 'US', NULL, 'in_firm_identity_universe',
                'sha256:page', '$.filings[0].CrntEmps.CrntEmp[0]'
            )
            """,
            [COLLECTION_ID],
        )
        connection.execute(
            """
            INSERT INTO individual_registration_intervals VALUES (
                'current:collection-test:50:0:0', ?, 50, 800001, 'TEST FIRM', 'NY', 'RA',
                'APPROVED', DATE '2022-10-20', NULL, 'day', 'unknown',
                'current_status_posted_date', 'source_current_open_ended',
                'current_registration', 'explicit_ra_category', 'sha256:page',
                '$.filings[0].CrntEmps.CrntEmp[0].CrntRgstns.CrntRgstn[0]'
            )
            """,
            [COLLECTION_ID],
        )
        connection.execute(
            """
            INSERT INTO individual_registration_locations VALUES (
                'location:current:collection-test:50:0:0:0', ?, 50,
                'current:collection-test:50:0:0', 0, 'current_branch', NULL, NULL,
                'NEW YORK', 'NY', 'United States', 'US', NULL, TRUE,
                'sha256:page', '$.filings[0].CrntEmps.CrntEmp[0].BrnchOfLocs.BrnchOfLoc[0]'
            )
            """,
            [COLLECTION_ID],
        )
        connection.execute(
            """
            INSERT INTO individual_disclosure_flags VALUES (
                ?, 50, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
                FALSE, NULL, 'sha256:page', '$.filings[0].DRPs'
            )
            """,
            [COLLECTION_ID],
        )
        connection.execute(
            """
            INSERT INTO individual_year_snapshots VALUES (
                ?, 2026, DATE '2026-08-26', 'provisional_current_index', 50,
                'TEST', NULL, 'ADVISER', NULL, TRUE, 'explicit_ra_category',
                1, 1, 1, TRUE, TRUE, TRUE, FALSE,
                'available_current_observation', 'valid', ?
            )
            """,
            [COLLECTION_ID, COLLECTION_TIME],
        )
        connection.execute(
            """
            INSERT INTO individual_firm_year VALUES (
                'relationship:test', ?, 2026, DATE '2026-08-26', 'provisional_current_index',
                50, 800001, 'active_registration', 'NY', 'NY', 'RA', 'APPROVED',
                'current:collection-test:50:0:0', DATE '2022-10-20', NULL, 'day',
                'unknown', 'explicit_ra_category', 'United States', 'US', TRUE,
                'US', TRUE, 'firm_snapshot_join', 'in_firm_snapshot_universe',
                'sha256:page', '$.filings[0].CrntEmps.CrntEmp[0].CrntRgstns.CrntRgstn[0]'
            )
            """,
            [COLLECTION_ID],
        )
        for field_name in (
            "name",
            "is_iar",
            "active_registration_relationship_count",
            "active_employer_firm_count",
            "active_jurisdiction_count",
            "has_us_workplace",
            "has_us_employer",
            "has_disclosure_summary",
        ):
            connection.execute(
                """
                INSERT INTO individual_snapshot_field_provenance VALUES (
                    ?, 2026, 50, ?, 'sha256:page', '$.filings[0]', DATE '2026-08-26',
                    'current:collection-test:50:0:0', 'synthetic'
                )
                """,
                [COLLECTION_ID, field_name],
            )
        for field_group, status in (
            ("population", "available_current_observation"),
            ("names", "available_current_observation"),
            ("current_employment", "available_current_observation"),
            ("registration_intervals", "available_interval_backcast"),
            ("employment_history", "month_precision_only"),
            ("workplace_geography", "available_interval_backcast"),
            ("exams", "available_current_observation"),
            ("designations", "available_current_observation"),
            ("disclosures", "available_current_observation"),
        ):
            connection.execute(
                "INSERT INTO individual_snapshot_coverage VALUES (?, 2026, ?, ?, 1, NULL)",
                [COLLECTION_ID, field_group, status],
            )
    return database


def test_valid_collection_passes_individual_acceptance_gates(tmp_path: Path) -> None:
    result = validate_individual_pipeline(
        _valid_database(tmp_path),
        collection_id=COLLECTION_ID,
        years=[2026],
    )

    assert result.is_valid is True
    assert not result.failures


def test_validation_detects_relationship_without_source_crd_link(tmp_path: Path) -> None:
    database = _valid_database(tmp_path)
    with database.connection() as connection:
        connection.execute("UPDATE individual_firm_year SET firm_crd = 899999")

    result = validate_individual_pipeline(database, collection_id=COLLECTION_ID, years=[2026])

    assert "relationship_without_source_crd" in {failure.code for failure in result.failures}


def test_validation_detects_wrong_2026_status_and_date(tmp_path: Path) -> None:
    database = _valid_database(tmp_path)
    with database.connection() as connection:
        connection.execute(
            """
            UPDATE individual_year_snapshots
            SET snapshot_status = 'year_end', snapshot_date = DATE '2026-12-31'
            """
        )

    result = validate_individual_pipeline(database, collection_id=COLLECTION_ID, years=[2026])

    codes = {failure.code for failure in result.failures}
    assert "unexpected_2026_snapshot" in codes


def test_validation_detects_exact_credential_value_without_printing_it(tmp_path: Path) -> None:
    database = _valid_database(tmp_path)
    report = tmp_path / "report.txt"
    report.write_text("retained credential super-secret-value")

    result = validate_individual_pipeline(
        database,
        collection_id=COLLECTION_ID,
        years=[2026],
        credential_scan_paths=[report],
        secret_values=("super-secret-value",),
    )

    issue = next(failure for failure in result.failures if failure.code == "credential_material_found")
    assert issue.count == 1
    assert "super-secret-value" not in issue.message


def test_secret_scan_ignores_binary_database_and_public_json_narrative(tmp_path: Path) -> None:
    (tmp_path / "analysis.duckdb").write_bytes(b"\x00authorization:\x00")
    (tmp_path / "page.json").write_text(json.dumps({"desc": "Public narrative says authorization: none"}))

    assert scan_for_secrets([tmp_path], ()) == ()


def test_secret_scan_detects_json_credential_field(tmp_path: Path) -> None:
    payload = tmp_path / "manifest.json"
    payload.write_text(json.dumps({"request": {"Authorization": "redacted"}}))

    matches = scan_for_secrets([payload], ())

    assert len(matches) == 1
    assert matches[0].location == str(payload)
    assert matches[0].match_kind == "credential-like field"


def test_secret_scan_detects_exact_secret_inside_json_narrative(tmp_path: Path) -> None:
    payload = tmp_path / "page.json"
    payload.write_text(json.dumps({"desc": "Public narrative contains super-secret-value"}))

    matches = scan_for_secrets([payload], ("super-secret-value",))

    assert len(matches) == 1
    assert matches[0].location == str(payload)
    assert matches[0].match_kind == "configured secret value"


def test_coverage_preserves_true_false_and_unknown_counts(tmp_path: Path) -> None:
    rows = build_individual_coverage(
        _valid_database(tmp_path),
        collection_id=COLLECTION_ID,
        years=[2025, 2026],
    )

    assert rows[0].year == 2025
    assert rows[0].individual_count == 0
    assert rows[1].iar_true_count == 1
    assert rows[1].us_workplace_true_count == 1
    assert rows[1].population_coverage == "available_current_observation"
