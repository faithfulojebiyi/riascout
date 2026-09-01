import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import duckdb
import pytest

from riascout_adv_data.individual_download import download_individual_collection
from riascout_adv_data.individual_plan import (
    build_individual_collection_plan,
    write_individual_collection_plan,
)
from riascout_adv_data.individual_validation import scan_for_secrets
from riascout_adv_data.official_db import OfficialDatabase
from riascout_adv_data.storage import ArtifactStore
from riascout_adv_data.workflows import (
    build_individual_snapshots,
    export_normalized_release,
    ingest_individuals,
    validate_individuals,
)

COLLECTION_TIME = datetime(2026, 8, 26, 12, tzinfo=UTC)
FIXTURE_PATH = Path(__file__).parent / "fixtures" / "individual" / "current-page.json"


class FakeCountClient:
    """Return an exact two-person count to the adaptive planner."""

    def search_individuals(
        self,
        query: str,
        *,
        size: int = 10,
        offset: int = 0,
    ) -> dict[str, Any]:
        response = json.loads(FIXTURE_PATH.read_text())
        highest = max(response["filings"], key=lambda record: record["Info"]["indvlPK"])
        return {
            "total": {"value": 2, "relation": "eq"},
            "filings": [highest],
        }


class FakePageClient:
    """Return two deterministic one-record pages in descending CRD order."""

    def __init__(self) -> None:
        response = json.loads(FIXTURE_PATH.read_text())
        self._records = sorted(
            response["filings"],
            key=lambda record: record["Info"]["indvlPK"],
            reverse=True,
        )

    def search_individuals(
        self,
        query: str,
        *,
        size: int = 10,
        offset: int = 0,
    ) -> dict[str, Any]:
        return {
            "total": {"value": 2, "relation": "eq"},
            "filings": self._records[offset : offset + size],
        }


def test_two_page_collection_reaches_verified_normalized_release(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.chdir(tmp_path)
    data_dir = Path("data")
    report_dir = Path("reports")
    store = ArtifactStore(data_dir, secrets=["super-secret"])
    plan = build_individual_collection_plan(
        FakeCountClient(),
        collection_id="collection-test",
        created_at=COLLECTION_TIME,
        page_size=1,
    )
    plan_artifact = write_individual_collection_plan(store, plan, retrieved_at=COLLECTION_TIME)
    downloaded = download_individual_collection(
        client=FakePageClient(),
        plan=plan,
        store=store,
        started_at=COLLECTION_TIME,
        sleep=lambda _: None,
        clock=lambda: COLLECTION_TIME,
    )

    assert plan_artifact.payload_path.is_file()
    assert downloaded.completed_page_requests == 2
    ingestion = ingest_individuals(collection_id="collection-test", data_dir=data_dir)
    snapshots = build_individual_snapshots(
        collection_id="collection-test",
        years=range(2020, 2027),
        data_dir=data_dir,
    )
    validation = validate_individuals(
        collection_id="collection-test",
        years=range(2020, 2027),
        data_dir=data_dir,
        report_dir=report_dir,
        secret_values=("super-secret",),
    )
    release = export_normalized_release(
        collection_id="collection-test",
        release_id="normalized-test",
        years=range(2020, 2027),
        data_dir=data_dir,
        generated_at=COLLECTION_TIME,
    )

    assert ingestion.published_individuals == 2
    assert snapshots.years == tuple(range(2020, 2027))
    assert validation.is_valid
    database = OfficialDatabase(data_dir / "analysis.duckdb")
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM individuals").fetchone() == (2,)
        assert connection.execute(
            "SELECT list(DISTINCT snapshot_year ORDER BY snapshot_year) "
            "FROM individual_year_snapshots WHERE collection_id = ?",
            ["collection-test"],
        ).fetchone() == ([2020, 2021, 2022, 2023, 2024, 2025, 2026],)

    manifest = json.loads((release.path / "manifest.json").read_text())
    assert manifest["population_coverage"]["2020"] == "partial_current_population"
    assert manifest["distribution_scope"] == "internal"
    assert duckdb.connect().execute(
        "SELECT count(*) FROM read_parquet(?)",
        [str(release.path / "individuals.parquet")],
    ).fetchone() == (2,)
    assert scan_for_secrets((data_dir, report_dir), ("super-secret",)) == ()
