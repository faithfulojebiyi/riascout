from dataclasses import replace
from datetime import UTC, date, datetime
from pathlib import Path

import duckdb
import pytest

from riascout_adv_data.official_db import OfficialArtifactRecord, OfficialDatabase


def test_connection_explains_conflicting_duckdb_lock(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    path = tmp_path / "analysis.duckdb"

    def locked(_: str) -> object:
        raise duckdb.IOException("Conflicting lock held by another process")

    monkeypatch.setattr("riascout_adv_data.official_db.duckdb.connect", locked)

    with (
        pytest.raises(
            RuntimeError,
            match=r"Close Cursor or another process holding .*analysis\.duckdb, then retry\.",
        ),
        OfficialDatabase(path).connection(),
    ):
        pass


def test_official_schema_installs_canonical_tables(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")

    database.install_schema()

    assert {
        "source_artifacts",
        "firms",
        "filings",
        "firm_snapshots",
        "individuals",
        "individual_collection_runs",
        "individual_registration_intervals",
        "individual_employment_intervals",
    } <= database.table_names()


def test_schema_installation_is_idempotent(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")

    database.install_schema()
    database.install_schema()

    assert "source_artifacts" in database.table_names()


def test_schema_installs_individual_pipeline_tables(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")

    database.install_schema()

    assert {
        "individual_collection_runs",
        "individual_query_shards",
        "individuals",
        "individual_observations",
        "individual_names",
        "individual_current_employments",
        "individual_current_registrations",
        "individual_registration_intervals",
        "individual_registration_locations",
        "individual_employment_intervals",
        "individual_exams",
        "individual_designations",
        "individual_disclosure_flags",
        "individual_year_snapshots",
        "individual_firm_year",
        "individual_snapshot_field_provenance",
        "individual_snapshot_coverage",
        "current_individual_year_snapshots",
        "current_individual_firm_year",
    } <= database.table_names()


def test_transaction_rolls_back_partial_publication(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()

    with pytest.raises(RuntimeError, match="stop"), database.transaction() as connection:
        connection.execute("INSERT INTO firms VALUES (361, DATE '2020-01-01', DATE '2020-01-01')")
        raise RuntimeError("stop")

    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM firms").fetchone()[0] == 0


def test_record_artifact_is_idempotent_by_artifact_id(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    record = OfficialArtifactRecord(
        artifact_id="sha256:abc",
        dataset_key="ria-2025-12-31",
        dataset_kind="ria_report",
        source_url="https://www.sec.gov/files/ria.zip",
        observation_date=date(2025, 12, 31),
        retrieved_at=datetime(2026, 8, 26, tzinfo=UTC),
        sha256="abc",
        payload_path="data/raw/ria.zip",
        manifest_path="data/raw/ria.manifest.json",
        byte_count=123,
    )

    database.record_artifact(record)
    database.record_artifact(record)

    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM source_artifacts").fetchone()[0] == 1


def test_record_artifacts_publishes_a_batch_idempotently(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    first = OfficialArtifactRecord(
        artifact_id="sha256:abc",
        dataset_key="individual:test:first",
        dataset_kind="sec_api_individual_current_page",
        source_url="https://api.sec-api.io/form-adv/individual",
        observation_date=date(2026, 8, 26),
        retrieved_at=datetime(2026, 8, 26, tzinfo=UTC),
        sha256="abc",
        payload_path="data/raw/first.json",
        manifest_path="data/raw/first.manifest.json",
        byte_count=123,
    )
    second = replace(
        first,
        artifact_id="sha256:def",
        dataset_key="individual:test:second",
        sha256="def",
        payload_path="data/raw/second.json",
        manifest_path="data/raw/second.manifest.json",
    )

    database.record_artifacts((first, second, first))

    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM source_artifacts").fetchone()[0] == 2
