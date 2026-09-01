import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

import riascout_adv_data.individual_snapshots as individual_snapshots
from riascout_adv_data.individual_canonicalize import DownloadedIndividualCollection, IndividualCanonicalizer
from riascout_adv_data.individual_download import download_individual_collection
from riascout_adv_data.individual_plan import (
    IndividualCollectionPlan,
    IndividualShard,
    write_individual_collection_plan,
)
from riascout_adv_data.individual_snapshots import (
    CurrentRegistrationEvidence,
    IndividualSnapshotBuilder,
    current_evidence_active_on,
    interval_is_active,
)
from riascout_adv_data.official_db import OfficialDatabase
from riascout_adv_data.storage import ArtifactStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "individual" / "current-page.json"
COLLECTION_TIME = datetime(2026, 8, 26, 12, tzinfo=UTC)


class FixturePageClient:
    def __init__(self, response: dict[str, Any]) -> None:
        filings = sorted(response["filings"], key=lambda item: item["Info"]["indvlPK"], reverse=True)
        self.response = {"total": dict(response["total"]), "filings": filings}

    def search_individuals(self, query: str, *, size: int = 10, offset: int = 0) -> dict[str, Any]:
        return self.response


def _published_database(tmp_path: Path) -> OfficialDatabase:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    response = json.loads(FIXTURE_PATH.read_text())
    plan = IndividualCollectionPlan(
        schema_version="individual-plan-v1",
        collection_id="collection-test",
        created_at=COLLECTION_TIME,
        endpoint="https://api.sec-api.io/form-adv/individual",
        highest_crd=7_000_002,
        page_size=50,
        max_shard_records=9_500,
        probe_request_count=2,
        shards=(IndividualShard(1, 7_000_002, 2),),
    )
    store = ArtifactStore(tmp_path / "data")
    plan_artifact = write_individual_collection_plan(store, plan, retrieved_at=COLLECTION_TIME)
    downloaded = download_individual_collection(
        client=FixturePageClient(response),
        plan=plan,
        store=store,
        started_at=COLLECTION_TIME,
        sleep=lambda _: None,
        clock=lambda: COLLECTION_TIME,
    )
    IndividualCanonicalizer(database).publish(
        DownloadedIndividualCollection(
            plan_path=plan_artifact.payload_path,
            completion_path=downloaded.completion_artifact.payload_path,
            page_paths=tuple(page.payload_path for page in downloaded.pages),
            collection_started_at=COLLECTION_TIME,
            collection_completed_at=COLLECTION_TIME,
        )
    )
    with database.connection() as connection:
        connection.execute("INSERT INTO firms VALUES (800001, DATE '2020-01-01', DATE '2026-08-26')")
        connection.execute("INSERT INTO firms VALUES (800002, DATE '2020-01-01', DATE '2026-08-26')")
        for firm_crd, country_code, is_us in ((800001, "US", True), (800002, "CA", False)):
            connection.execute(
                """
                INSERT INTO firm_snapshots (
                    snapshot_year, snapshot_date, snapshot_status, as_of_collected_at,
                    firm_crd, source_artifact_id, source_dataset,
                    principal_country_code, principal_country_method,
                    country_source_date, country_carried_forward, is_us_based,
                    is_sec_registered, is_era, is_state_registered,
                    primary_registration_type, validation_status
                ) VALUES (2026, DATE '2026-08-26', 'provisional', ?, ?, 'synthetic-firm',
                          'synthetic', ?, 'synthetic', DATE '2026-08-26', FALSE, ?,
                          TRUE, FALSE, FALSE, 'SEC', 'valid')
                """,
                [COLLECTION_TIME, firm_crd, country_code, is_us],
            )
    return database


def test_registration_ending_on_snapshot_date_is_not_active() -> None:
    assert interval_is_active(date(2020, 1, 1), date(2021, 12, 31), date(2021, 12, 30)) is True
    assert interval_is_active(date(2020, 1, 1), date(2021, 12, 31), date(2021, 12, 31)) is False


def test_unknown_interval_start_cannot_prove_activity() -> None:
    assert interval_is_active(None, None, date(2025, 12, 31)) is None


def test_unknown_current_start_supports_only_collection_date() -> None:
    evidence = CurrentRegistrationEvidence(status="APPROVED", status_posted_date=None)

    assert current_evidence_active_on(evidence, date(2025, 12, 31), date(2026, 8, 26)) is None
    assert current_evidence_active_on(evidence, date(2026, 8, 26), date(2026, 8, 26)) is True


def test_builder_publishes_partial_backcasts_and_provisional_current_rows(tmp_path: Path) -> None:
    database = _published_database(tmp_path)

    result = IndividualSnapshotBuilder(database).rebuild(
        collection_id="collection-test",
        years=range(2020, 2027),
        built_at=COLLECTION_TIME,
    )

    assert result.snapshot_rows == 8
    assert result.relationship_rows == 13
    with database.connection() as connection:
        assert connection.execute(
            "SELECT count(*) FROM individual_year_snapshots WHERE snapshot_status = 'partial_current_index_backcast'"
        ).fetchone() == (6,)
        assert connection.execute(
            "SELECT count(*) FROM individual_year_snapshots WHERE snapshot_status = 'provisional_current_index'"
        ).fetchone() == (2,)
        assert connection.execute(
            """
            SELECT is_iar, active_registration_relationship_count, has_us_workplace, has_us_employer
            FROM individual_year_snapshots
            WHERE collection_id = 'collection-test' AND snapshot_year = 2026 AND individual_crd = 7000001
            """
        ).fetchone() == (True, 2, True, True)
        assert (
            connection.execute(
                """
            SELECT is_iar, has_us_workplace, has_us_employer
            FROM individual_year_snapshots
            WHERE collection_id = 'collection-test' AND snapshot_year = 2025 AND individual_crd = 7000002
            """
            ).fetchone()
            is None
        )
        assert connection.execute(
            """
            SELECT is_iar, has_us_workplace, has_us_employer
            FROM individual_year_snapshots
            WHERE collection_id = 'collection-test' AND snapshot_year = 2026 AND individual_crd = 7000002
            """
        ).fetchone() == (True, None, None)


def test_previous_registration_end_is_exclusive_in_relationship_table(tmp_path: Path) -> None:
    database = _published_database(tmp_path)
    IndividualSnapshotBuilder(database).rebuild(
        collection_id="collection-test",
        years=range(2020, 2027),
        built_at=COLLECTION_TIME,
    )

    with database.connection() as connection:
        assert connection.execute(
            """
            SELECT count(*) FROM individual_firm_year
            WHERE collection_id = 'collection-test' AND snapshot_year = 2022 AND firm_crd = 700010
            """
        ).fetchone() == (0,)
        assert connection.execute(
            """
            SELECT employer_firm_coverage FROM individual_firm_year
            WHERE collection_id = 'collection-test' AND snapshot_year = 2026
              AND individual_crd = 7000002 AND firm_crd = 899999
              AND relationship_kind = 'current_employment_observation'
            """
        ).fetchone() == ("not_in_firm_snapshot_universe",)


def test_relationship_rows_are_indexed_once_by_individual() -> None:
    first = ("first",)
    second = ("second",)
    third = ("third",)
    relationships = {
        (10, 100, "active_registration", "CA"): first,
        (20, 200, "active_registration", "NY"): second,
        (10, 300, "current_employment_observation", ""): third,
    }

    assert individual_snapshots._index_relationships_by_person(relationships) == {
        10: [first, third],
        20: [second],
    }


def test_builder_commits_each_complete_year_and_rerun_finishes_remaining_years(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database = _published_database(tmp_path)
    original_insert = individual_snapshots._executemany_if_rows
    calls = 0

    def fail_on_second_year(*args: object, **kwargs: object) -> None:
        nonlocal calls
        calls += 1
        if calls == 5:
            raise RuntimeError("simulated second-year failure")
        original_insert(*args, **kwargs)

    monkeypatch.setattr(individual_snapshots, "_executemany_if_rows", fail_on_second_year)

    with pytest.raises(RuntimeError, match="simulated second-year failure"):
        IndividualSnapshotBuilder(database).rebuild(
            collection_id="collection-test",
            years=(2020, 2021),
            built_at=COLLECTION_TIME,
        )

    with database.connection() as connection:
        assert (
            connection.execute("SELECT count(*) FROM individual_year_snapshots WHERE snapshot_year = 2020").fetchone()[
                0
            ]
            > 0
        )
        assert connection.execute(
            "SELECT count(*) FROM individual_year_snapshots WHERE snapshot_year = 2021"
        ).fetchone() == (0,)

    monkeypatch.setattr(individual_snapshots, "_executemany_if_rows", original_insert)
    result = IndividualSnapshotBuilder(database).rebuild(
        collection_id="collection-test",
        years=(2020, 2021),
        built_at=COLLECTION_TIME,
    )

    assert result.years == (2020, 2021)
    with database.connection() as connection:
        assert (
            connection.execute(
                "SELECT count(*) FROM individual_year_snapshots WHERE snapshot_year IN (2020, 2021)"
            ).fetchone()[0]
            > 1
        )


def test_snapshot_row_insert_uses_bulk_copy_without_python_parameters() -> None:
    class RecordingConnection:
        def __init__(self) -> None:
            self.calls: list[tuple[str, list[object] | None]] = []

        def execute(self, statement: str, parameters: list[object] | None = None) -> None:
            self.calls.append((statement, parameters))

    connection = RecordingConnection()
    rows = [(index, f"value-{index}") for index in range(1_200)]

    individual_snapshots._executemany_if_rows(
        connection,
        "INSERT INTO example VALUES (?, ?)",
        rows,
    )

    assert len(connection.calls) == 1
    assert connection.calls[0][0].startswith("COPY example FROM ")
    assert connection.calls[0][1] is None


def test_snapshot_bulk_copy_preserves_typed_and_csv_sensitive_values(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "bulk-copy.duckdb")
    observed_at = datetime(2026, 8, 26, 12, 34, 56, tzinfo=UTC)
    rows = [
        (1, 'comma, quote " and\nnewline', "", None, True, date(2026, 8, 26), observed_at),
        (2, "plain", "present", "not-null", False, date(2020, 12, 31), observed_at),
    ]

    with database.connection() as connection:
        connection.execute(
            """
            CREATE TABLE bulk_copy_example (
                row_id BIGINT,
                text_value VARCHAR,
                empty_value VARCHAR,
                optional_value VARCHAR,
                flag BOOLEAN,
                observed_date DATE,
                observed_at TIMESTAMPTZ
            )
            """
        )
        individual_snapshots._executemany_if_rows(
            connection,
            "INSERT INTO bulk_copy_example VALUES (?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        actual = connection.execute(
            """
            SELECT row_id, text_value, empty_value, optional_value, flag, observed_date,
                   epoch(observed_at)
            FROM bulk_copy_example ORDER BY row_id
            """
        ).fetchall()

    assert actual == [
        (1, 'comma, quote " and\nnewline', "", None, True, date(2026, 8, 26), observed_at.timestamp()),
        (2, "plain", "present", "not-null", False, date(2020, 12, 31), observed_at.timestamp()),
    ]
