from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from riascout_adv_data.individual_download import IndividualCollectionDriftError, download_individual_collection
from riascout_adv_data.individual_plan import IndividualCollectionPlan, IndividualShard
from riascout_adv_data.storage import ArtifactStore

STARTED_AT = datetime(2026, 8, 26, 12, tzinfo=UTC)
TWO_PAGE_PLAN = IndividualCollectionPlan(
    schema_version="individual-plan-v1",
    collection_id="collection-test",
    created_at=STARTED_AT,
    endpoint="https://api.sec-api.io/form-adv/individual",
    highest_crd=100,
    page_size=50,
    max_shard_records=9_500,
    probe_request_count=2,
    shards=(IndividualShard(low_crd=1, high_crd=100, expected_count=75),),
)


def _record(crd: int) -> dict[str, Any]:
    return {
        "Info": {"indvlPK": crd, "firstNm": f"Person {crd}", "lastNm": "Example"},
        "CrntEmps": {"CrntEmp": []},
        "PrevRgstns": {"PrevRgstn": []},
        "EmpHss": {"EmpHs": []},
        "Exms": {"Exm": []},
        "Dsgntns": {"Dsgntn": []},
        "DRPs": {},
    }


PAGES = {
    0: {"total": {"value": 75, "relation": "eq"}, "filings": [_record(crd) for crd in range(100, 50, -1)]},
    50: {"total": {"value": 75, "relation": "eq"}, "filings": [_record(crd) for crd in range(50, 25, -1)]},
}


class FakePageClient:
    def __init__(self, pages: dict[int, dict[str, Any]]) -> None:
        self.pages = pages
        self.calls: list[tuple[str, int, int]] = []

    def search_individuals(self, query: str, *, size: int = 10, offset: int = 0) -> dict[str, Any]:
        self.calls.append((query, size, offset))
        return self.pages[offset]


class InterruptAfterOnePage:
    def __init__(self, pages: dict[int, dict[str, Any]]) -> None:
        self.pages = pages
        self.call_count = 0

    def search_individuals(self, query: str, *, size: int = 10, offset: int = 0) -> dict[str, Any]:
        self.call_count += 1
        if self.call_count == 2:
            raise RuntimeError("simulated interruption")
        return self.pages[offset]


def test_download_saves_each_page_with_safe_request_metadata(tmp_path: Path) -> None:
    result = download_individual_collection(
        client=FakePageClient(PAGES),
        plan=TWO_PAGE_PLAN,
        store=ArtifactStore(tmp_path, secrets=["super-secret"]),
        started_at=STARTED_AT,
        sleep=lambda _: None,
        clock=lambda: STARTED_AT,
    )

    assert result.retrieved_individual_count == 75
    assert result.completed_page_requests == 2
    assert all(item.sha256 in item.payload_path.name for item in result.pages)
    assert all("token=" not in item.manifest_path.read_text() for item in result.pages)
    assert all("super-secret" not in item.manifest_path.read_text() for item in result.pages)
    assert result.completion_artifact.payload_path.name == "collection-collection-test-completion.json"


def test_interrupted_download_resumes_from_verified_existing_page(tmp_path: Path) -> None:
    store = ArtifactStore(tmp_path)
    with pytest.raises(RuntimeError, match="simulated interruption"):
        download_individual_collection(
            client=InterruptAfterOnePage(PAGES),
            plan=TWO_PAGE_PLAN,
            store=store,
            started_at=STARTED_AT,
            sleep=lambda _: None,
            clock=lambda: STARTED_AT,
        )

    client = FakePageClient(PAGES)
    resumed = download_individual_collection(
        client=client,
        plan=TWO_PAGE_PLAN,
        store=store,
        started_at=STARTED_AT,
        sleep=lambda _: None,
        clock=lambda: STARTED_AT,
    )

    assert resumed.skipped_verified_pages == 1
    assert resumed.completed_page_requests == 2
    assert [call[2] for call in client.calls] == [50]


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda response: response["filings"].__setitem__(-1, _record(101)), "outside shard"),
        (lambda response: response["total"].update(value=74), "planned count"),
    ],
)
def test_download_rejects_source_drift(
    tmp_path: Path,
    mutate: Callable[[dict[str, Any]], None],
    message: str,
) -> None:
    changed_pages = {
        offset: {"total": dict(page["total"]), "filings": list(page["filings"])} for offset, page in PAGES.items()
    }
    mutate(changed_pages[0])

    with pytest.raises(IndividualCollectionDriftError, match=message):
        download_individual_collection(
            client=FakePageClient(changed_pages),
            plan=TWO_PAGE_PLAN,
            store=ArtifactStore(tmp_path),
            started_at=STARTED_AT,
            sleep=lambda _: None,
            clock=lambda: STARTED_AT,
        )

    completion = tmp_path / "raw" / "sec_api_individuals" / "2026-08-26" / "collection-collection-test-completion.json"
    assert not completion.exists()
    assert not list(completion.parent.glob("*page-*.json"))
