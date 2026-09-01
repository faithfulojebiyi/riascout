import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from riascout_adv_data.individual_plan import (
    IndividualCollectionPlan,
    IndividualPlanError,
    IndividualShard,
    build_individual_collection_plan,
    read_individual_collection_plan,
    write_individual_collection_plan,
)
from riascout_adv_data.storage import ArtifactStore


class FakeCountClient:
    """Exact SEC-API boundary fake for current-index count planning."""

    def __init__(
        self,
        *,
        highest_crd: int,
        total_individuals: int,
        counts: dict[tuple[int, int], tuple[int, str]],
    ) -> None:
        self.highest_crd = highest_crd
        self.total_individuals = total_individuals
        self.counts = counts
        self.calls: list[tuple[str, int, int]] = []

    def search_individuals(self, query: str, *, size: int = 10, offset: int = 0) -> dict[str, Any]:
        self.calls.append((query, size, offset))
        if query == "*":
            return {
                "total": {"value": self.total_individuals, "relation": "eq"},
                "filings": [{"Info": {"indvlPK": self.highest_crd}}],
            }
        prefix = "Info.indvlPK:["
        assert query.startswith(prefix) and query.endswith("]")
        low_text, high_text = query.removeprefix(prefix).removesuffix("]").split(" TO ")
        low, high = int(low_text), int(high_text)
        value, relation = self.counts[(low, high)]
        filings = [{"Info": {"indvlPK": high}}] if value else []
        return {"total": {"value": value, "relation": relation}, "filings": filings}


def test_capped_range_is_split_without_gap_or_overlap() -> None:
    client = FakeCountClient(
        highest_crd=100,
        total_individuals=85,
        counts={(1, 100): (10_000, "gte"), (1, 50): (40, "eq"), (51, 100): (45, "eq")},
    )

    plan = build_individual_collection_plan(
        client,
        collection_id="individual-current-20260826",
        created_at=datetime(2026, 8, 26, tzinfo=UTC),
        max_shard_records=9_500,
        page_size=50,
    )

    assert plan.shards == (
        IndividualShard(low_crd=1, high_crd=50, expected_count=40),
        IndividualShard(low_crd=51, high_crd=100, expected_count=45),
    )
    assert plan.expected_individual_count == 85
    assert plan.expected_page_requests == 2
    assert plan.probe_request_count == 4


def test_exact_zero_count_shard_is_retained_without_page_cost() -> None:
    client = FakeCountClient(
        highest_crd=10,
        total_individuals=5,
        counts={(1, 10): (10_000, "gte"), (1, 5): (0, "eq"), (6, 10): (5, "eq")},
    )

    plan = build_individual_collection_plan(
        client,
        collection_id="individual-current-20260826",
        created_at=datetime(2026, 8, 26, tzinfo=UTC),
        max_shard_records=9_500,
        page_size=50,
    )

    assert plan.shards == (
        IndividualShard(low_crd=1, high_crd=5, expected_count=0),
        IndividualShard(low_crd=6, high_crd=10, expected_count=5),
    )
    assert plan.expected_individual_count == 5
    assert plan.expected_page_requests == 1


def test_plan_round_trip_preserves_exact_fields(tmp_path: Path) -> None:
    plan = IndividualCollectionPlan(
        schema_version="individual-plan-v1",
        collection_id="individual-current-20260826",
        created_at=datetime(2026, 8, 26, tzinfo=UTC),
        endpoint="https://api.sec-api.io/form-adv/individual",
        highest_crd=100,
        page_size=50,
        max_shard_records=9_500,
        probe_request_count=4,
        shards=(
            IndividualShard(low_crd=1, high_crd=50, expected_count=40),
            IndividualShard(low_crd=51, high_crd=100, expected_count=45),
        ),
    )

    stored = write_individual_collection_plan(
        ArtifactStore(tmp_path),
        plan,
        retrieved_at=datetime(2026, 8, 26, tzinfo=UTC),
    )

    assert stored.payload_path.name == "collection-individual-current-20260826-plan.json"
    assert read_individual_collection_plan(stored.payload_path) == plan
    assert "Authorization" not in stored.manifest_path.read_text()


def test_capped_single_crd_range_is_rejected() -> None:
    client = FakeCountClient(
        highest_crd=1,
        total_individuals=10_000,
        counts={(1, 1): (10_000, "gte")},
    )

    with pytest.raises(IndividualPlanError, match="single CRD"):
        build_individual_collection_plan(
            client,
            collection_id="individual-current-20260826",
            created_at=datetime(2026, 8, 26, tzinfo=UTC),
        )


def test_reader_rejects_non_sec_api_endpoint(tmp_path: Path) -> None:
    path = tmp_path / "plan.json"
    path.write_text(
        json.dumps(
            {
                "schema_version": "individual-plan-v1",
                "collection_id": "individual-current-20260826",
                "created_at": "2026-08-26T00:00:00+00:00",
                "endpoint": "https://example.com/form-adv/individual",
                "highest_crd": 1,
                "page_size": 50,
                "max_shard_records": 9500,
                "probe_request_count": 2,
                "shards": [{"low_crd": 1, "high_crd": 1, "expected_count": 1}],
            }
        )
    )

    with pytest.raises(IndividualPlanError, match="api.sec-api.io"):
        read_individual_collection_plan(path)
