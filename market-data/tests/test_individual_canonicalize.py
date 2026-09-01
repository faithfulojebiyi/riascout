import json
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from duckdb import DuckDBPyConnection

from riascout_adv_data.individual_canonicalize import (
    TRANSFORMATION_VERSION,
    DownloadedIndividualCollection,
    IndividualCanonicalizer,
)
from riascout_adv_data.individual_download import download_individual_collection
from riascout_adv_data.individual_plan import (
    IndividualCollectionPlan,
    IndividualShard,
    write_individual_collection_plan,
)
from riascout_adv_data.official_db import OfficialDatabase
from riascout_adv_data.storage import ArtifactStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "individual" / "current-page.json"
STARTED_AT = datetime(2026, 8, 26, 12, tzinfo=UTC)


class FixturePageClient:
    def __init__(self, response: dict[str, Any]) -> None:
        filings = sorted(response["filings"], key=lambda item: item["Info"]["indvlPK"], reverse=True)
        self.response = {"total": dict(response["total"]), "filings": filings}

    def search_individuals(self, query: str, *, size: int = 10, offset: int = 0) -> dict[str, Any]:
        return {
            "total": dict(self.response["total"]),
            "filings": self.response["filings"][offset : offset + size],
        }


def _downloaded_collection(tmp_path: Path, *, page_size: int = 50) -> DownloadedIndividualCollection:
    response = json.loads(FIXTURE_PATH.read_text())
    plan = IndividualCollectionPlan(
        schema_version="individual-plan-v1",
        collection_id="collection-test",
        created_at=STARTED_AT,
        endpoint="https://api.sec-api.io/form-adv/individual",
        highest_crd=7_000_002,
        page_size=page_size,
        max_shard_records=9_500,
        probe_request_count=2,
        shards=(IndividualShard(low_crd=1, high_crd=7_000_002, expected_count=2),),
    )
    store = ArtifactStore(tmp_path / "data")
    plan_artifact = write_individual_collection_plan(store, plan, retrieved_at=STARTED_AT)
    download = download_individual_collection(
        client=FixturePageClient(response),
        plan=plan,
        store=store,
        started_at=STARTED_AT,
        sleep=lambda _: None,
        clock=lambda: STARTED_AT,
    )
    return DownloadedIndividualCollection(
        plan_path=plan_artifact.payload_path,
        completion_path=download.completion_artifact.payload_path,
        page_paths=tuple(page.payload_path for page in download.pages),
        collection_started_at=STARTED_AT,
        collection_completed_at=STARTED_AT,
    )


def test_publisher_loads_one_reconciled_collection_transactionally(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()

    result = IndividualCanonicalizer(database).publish(_downloaded_collection(tmp_path))

    assert result.published_individuals == 2
    assert result.quarantined_rows == 1
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM individual_observations").fetchone() == (2,)
        assert connection.execute("SELECT count(*) FROM individual_current_employments").fetchone() == (3,)
        assert connection.execute("SELECT count(*) FROM individual_registration_intervals").fetchone() == (4,)
        assert connection.execute("SELECT count(*) FROM individual_registration_locations").fetchone() == (3,)
        assert connection.execute("SELECT count(*) FROM source_artifacts").fetchone() == (1,)
        assert connection.execute(
            "SELECT status, transformation_version FROM individual_collection_runs"
        ).fetchone() == ("published", TRANSFORMATION_VERSION)


def test_publisher_rerun_is_idempotent(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    collection = _downloaded_collection(tmp_path)
    publisher = IndividualCanonicalizer(database)

    first = publisher.publish(collection)
    second = publisher.publish(collection)

    assert first.published_individuals == second.published_individuals == 2
    assert second.was_already_published is True
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM individual_observations").fetchone() == (2,)
        assert connection.execute("SELECT count(*) FROM raw_row_errors").fetchone() == (1,)


def test_new_transformation_version_rebuilds_a_published_collection(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    collection = _downloaded_collection(tmp_path)
    IndividualCanonicalizer(database, transformation_version="individual-v1").publish(collection)
    with database.connection() as connection:
        connection.execute(
            """
            UPDATE individual_disclosure_flags
            SET has_regulatory_action = NULL, has_criminal = NULL, has_bankruptcy = NULL,
                has_civil_judgment = NULL, has_bond = NULL, has_judgment = NULL,
                has_investigation = NULL, has_customer_complaint = NULL, has_termination = NULL
            WHERE individual_crd = 7000002
            """
        )

    result = IndividualCanonicalizer(database, transformation_version="individual-v2").publish(collection)

    assert result.was_already_published is False
    with database.connection() as connection:
        assert connection.execute(
            "SELECT status, transformation_version FROM individual_collection_runs"
        ).fetchone() == ("published", "individual-v2")
        assert connection.execute(
            """
            SELECT has_regulatory_action, has_criminal, has_bankruptcy,
                   has_civil_judgment, has_bond, has_judgment, has_investigation,
                   has_customer_complaint, has_termination
            FROM individual_disclosure_flags WHERE individual_crd = 7000002
            """
        ).fetchone() == (False, False, False, False, False, False, False, False, False)


def test_parser_exception_rolls_back_individual_rows_without_touching_firms(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    with database.connection() as connection:
        connection.execute("INSERT INTO firms VALUES (361, DATE '2020-01-01', DATE '2026-08-26')")

    def fail_parse(record: dict[str, Any], context: object) -> object:
        raise RuntimeError("simulated parser failure")

    monkeypatch.setattr("riascout_adv_data.individual_canonicalize.parse_individual_record", fail_parse)

    with pytest.raises(RuntimeError, match="simulated parser failure"):
        IndividualCanonicalizer(database).publish(_downloaded_collection(tmp_path))

    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM individual_observations").fetchone() == (0,)
        assert connection.execute("SELECT count(*) FROM firms WHERE firm_crd = 361").fetchone() == (1,)


def test_publisher_resumes_after_a_committed_page_without_republishing_it(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    collection = _downloaded_collection(tmp_path, page_size=1)
    publisher = IndividualCanonicalizer(database)
    original_publish = publisher._publish_individuals
    calls = 0

    def interrupt_on_second_page(*args: object, **kwargs: object) -> int:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("simulated interruption")
        return original_publish(*args, **kwargs)

    monkeypatch.setattr(publisher, "_publish_individuals", interrupt_on_second_page)

    with pytest.raises(RuntimeError, match="simulated interruption"):
        publisher.publish(collection)

    with database.connection() as connection:
        assert connection.execute(
            """
            SELECT status, retrieved_individual_count, completed_page_requests
            FROM individual_collection_runs
            """
        ).fetchone() == ("running", 1, 1)
        assert connection.execute("SELECT count(*) FROM individual_observations").fetchone() == (1,)
        assert connection.execute("SELECT count(*) FROM individuals").fetchone() == (0,)

    monkeypatch.setattr(publisher, "_publish_individuals", original_publish)
    result = publisher.publish(collection)

    assert result.published_individuals == 2
    assert result.was_already_published is False
    with database.connection() as connection:
        assert connection.execute(
            """
            SELECT status, retrieved_individual_count, completed_page_requests
            FROM individual_collection_runs
            """
        ).fetchone() == ("published", 2, 2)
        assert connection.execute("SELECT count(*) FROM individual_observations").fetchone() == (2,)
        assert connection.execute("SELECT count(*) FROM individuals").fetchone() == (2,)


def test_publisher_reuses_one_connection_for_all_page_transactions(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    collection = _downloaded_collection(tmp_path, page_size=1)
    original_connection = database.connection
    connection_count = 0

    @contextmanager
    def counted_connection() -> Iterator[DuckDBPyConnection]:
        nonlocal connection_count
        connection_count += 1
        with original_connection() as connection:
            yield connection

    monkeypatch.setattr(database, "connection", counted_connection)

    IndividualCanonicalizer(database).publish(collection)

    assert connection_count == 5
