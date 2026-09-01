"""Resumable immutable downloads for a planned current-individual collection."""

import hashlib
import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from riascout_adv_data.individual_plan import IndividualCollectionPlan, IndividualSearchClient, IndividualShard
from riascout_adv_data.storage import ArtifactStore, StoredArtifact


class IndividualCollectionDriftError(RuntimeError):
    """The live source no longer reconciles with the immutable collection plan."""


@dataclass(frozen=True)
class IndividualPageArtifact:
    """Validated metadata and paths for one retained individual page."""

    shard: IndividualShard
    page_number: int
    offset: int
    returned_count: int
    first_crd: int
    last_crd: int
    payload_path: Path
    manifest_path: Path
    sha256: str
    retrieved_at: datetime


@dataclass(frozen=True)
class IndividualDownloadResult:
    """A fully reconciled current-index collection download."""

    collection_id: str
    retrieved_individual_count: int
    completed_page_requests: int
    skipped_verified_pages: int
    pages: tuple[IndividualPageArtifact, ...]
    completion_artifact: StoredArtifact


def download_individual_collection(
    *,
    client: IndividualSearchClient,
    plan: IndividualCollectionPlan,
    store: ArtifactStore,
    started_at: datetime,
    sleep: Callable[[float], None],
    clock: Callable[[], datetime] | None = None,
    inter_request_delay: float = 0.0,
) -> IndividualDownloadResult:
    """Execute one saved plan, resuming only from verified page artifacts."""
    if started_at.tzinfo is None or started_at.utcoffset() is None:
        raise ValueError("started_at must include a timezone")
    if inter_request_delay < 0:
        raise ValueError("inter_request_delay must not be negative")
    now = clock or (lambda: datetime.now(UTC))
    pages: list[IndividualPageArtifact] = []
    seen_crds: set[int] = set()
    skipped_verified_pages = 0

    for shard in plan.shards:
        shard_offset = 0
        page_number = 1
        previous_last_crd: int | None = None
        while shard_offset < shard.expected_count:
            operation = _page_operation(plan.collection_id, shard, page_number)
            existing_paths = store.find_content_addressed_json(
                source="sec_api_individuals",
                operation=operation,
                retrieved_at=started_at,
            )
            if len(existing_paths) > 1:
                raise IndividualCollectionDriftError(
                    f"multiple immutable responses exist for range {shard.low_crd}-{shard.high_crd} page {page_number}"
                )
            requested_size = min(plan.page_size, shard.expected_count - shard_offset)
            stored: StoredArtifact
            if existing_paths:
                stored = store.verify_json_artifact(existing_paths[0])
                response = _read_payload(stored.payload_path)
                retrieved_at = _read_retrieved_at(stored.manifest_path)
                _validate_stored_request(stored.manifest_path, shard, shard_offset, requested_size)
                skipped_verified_pages += 1
            else:
                response = client.search_individuals(
                    f"Info.indvlPK:[{shard.low_crd} TO {shard.high_crd}]",
                    size=requested_size,
                    offset=shard_offset,
                )
                retrieved_at = now()
                _validate_retrieved_at(retrieved_at)

            crds = _validate_page_response(
                response,
                shard=shard,
                offset=shard_offset,
                requested_size=requested_size,
                seen_crds=seen_crds,
                previous_last_crd=previous_last_crd,
            )
            if not existing_paths:
                stored = _store_page(
                    store=store,
                    plan=plan,
                    shard=shard,
                    page_number=page_number,
                    offset=shard_offset,
                    requested_size=requested_size,
                    response=response,
                    retrieved_at=retrieved_at,
                )
            pages.append(
                IndividualPageArtifact(
                    shard=shard,
                    page_number=page_number,
                    offset=shard_offset,
                    returned_count=len(crds),
                    first_crd=crds[0],
                    last_crd=crds[-1],
                    payload_path=stored.payload_path,
                    manifest_path=stored.manifest_path,
                    sha256=stored.sha256,
                    retrieved_at=retrieved_at,
                )
            )
            seen_crds.update(crds)
            shard_offset += len(crds)
            previous_last_crd = crds[-1]
            page_number += 1
            if shard_offset < shard.expected_count and not existing_paths and inter_request_delay:
                sleep(inter_request_delay)

        if shard_offset != shard.expected_count:
            raise IndividualCollectionDriftError(
                f"range {shard.low_crd}-{shard.high_crd} retrieved {shard_offset}, planned count {shard.expected_count}"
            )

    if len(seen_crds) != plan.expected_individual_count:
        raise IndividualCollectionDriftError(
            f"collection retrieved {len(seen_crds)}, planned count {plan.expected_individual_count}"
        )

    completed_at = now()
    _validate_retrieved_at(completed_at)
    completion = store.write_json(
        source="sec_api_individuals",
        operation=f"collection-{plan.collection_id}-completion",
        payload={
            "schema_version": "individual-completion-v1",
            "collection_id": plan.collection_id,
            "status": "downloaded",
            "plan_sha256": _plan_digest(plan),
            "collection_started_at": started_at.isoformat(),
            "collection_completed_at": completed_at.isoformat(),
            "planned_individual_count": plan.expected_individual_count,
            "retrieved_individual_count": len(seen_crds),
            "planned_page_requests": plan.expected_page_requests,
            "completed_page_requests": len(pages),
            "duplicate_individual_count": 0,
            "pages": [
                {
                    "low_crd": page.shard.low_crd,
                    "high_crd": page.shard.high_crd,
                    "page_number": page.page_number,
                    "offset": page.offset,
                    "returned_count": page.returned_count,
                    "payload_path": str(page.payload_path),
                    "manifest_path": str(page.manifest_path),
                    "sha256": page.sha256,
                }
                for page in pages
            ],
        },
        request_metadata={
            "purpose": "reconciled current individual collection completion",
            "collection_id": plan.collection_id,
        },
        retrieved_at=completed_at,
    )
    return IndividualDownloadResult(
        collection_id=plan.collection_id,
        retrieved_individual_count=len(seen_crds),
        completed_page_requests=len(pages),
        skipped_verified_pages=skipped_verified_pages,
        pages=tuple(pages),
        completion_artifact=completion,
    )


def _store_page(
    *,
    store: ArtifactStore,
    plan: IndividualCollectionPlan,
    shard: IndividualShard,
    page_number: int,
    offset: int,
    requested_size: int,
    response: dict[str, Any],
    retrieved_at: datetime,
) -> StoredArtifact:
    operation = _page_operation(plan.collection_id, shard, page_number)
    return store.write_content_addressed_json(
        source="sec_api_individuals",
        operation=operation,
        payload=response,
        request_metadata={
            "method": "POST",
            "url": plan.endpoint,
            "query": f"Info.indvlPK:[{shard.low_crd} TO {shard.high_crd}]",
            "offset": offset,
            "size": requested_size,
            "low_crd": shard.low_crd,
            "high_crd": shard.high_crd,
            "expected_range_count": shard.expected_count,
        },
        retrieved_at=retrieved_at,
    )


def _validate_page_response(
    response: dict[str, Any],
    *,
    shard: IndividualShard,
    offset: int,
    requested_size: int,
    seen_crds: set[int],
    previous_last_crd: int | None,
) -> list[int]:
    if not isinstance(response, dict):
        raise IndividualCollectionDriftError("individual page response must be an object")
    total = response.get("total")
    if not isinstance(total, dict):
        raise IndividualCollectionDriftError("individual page response has no total object")
    total_value = total.get("value")
    total_relation = total.get("relation")
    if total_relation != "eq" or total_value != shard.expected_count:
        raise IndividualCollectionDriftError(
            f"range {shard.low_crd}-{shard.high_crd} no longer matches planned count {shard.expected_count}"
        )
    filings = response.get("filings")
    if not isinstance(filings, list):
        raise IndividualCollectionDriftError("individual page filings must be a list")
    if not filings:
        raise IndividualCollectionDriftError(f"individual page at offset {offset} returned no records")
    if len(filings) > requested_size:
        raise IndividualCollectionDriftError("individual page returned more records than requested")

    crds: list[int] = []
    for record in filings:
        if not isinstance(record, dict) or not isinstance(record.get("Info"), dict):
            raise IndividualCollectionDriftError("individual page contains a malformed filing")
        crd: object = record["Info"].get("indvlPK")
        if isinstance(crd, bool) or not isinstance(crd, int) or crd <= 0:
            raise IndividualCollectionDriftError("individual page contains an invalid CRD")
        if not shard.low_crd <= crd <= shard.high_crd:
            raise IndividualCollectionDriftError(
                f"individual CRD {crd} is outside shard {shard.low_crd}-{shard.high_crd}"
            )
        if crd in seen_crds or crd in crds:
            raise IndividualCollectionDriftError(f"duplicate individual CRD {crd} across pages or shards")
        crds.append(crd)
    if any(left <= right for left, right in zip(crds, crds[1:], strict=False)):
        raise IndividualCollectionDriftError("individual page CRDs are not strictly descending")
    if previous_last_crd is not None and crds[0] >= previous_last_crd:
        raise IndividualCollectionDriftError("individual CRD sort order changed across pages")
    return crds


def _validate_stored_request(
    manifest_path: Path,
    shard: IndividualShard,
    offset: int,
    requested_size: int,
) -> None:
    manifest = _read_payload(manifest_path)
    request = manifest.get("request")
    expected = {
        "query": f"Info.indvlPK:[{shard.low_crd} TO {shard.high_crd}]",
        "offset": offset,
        "size": requested_size,
        "low_crd": shard.low_crd,
        "high_crd": shard.high_crd,
        "expected_range_count": shard.expected_count,
    }
    if not isinstance(request, dict) or any(request.get(key) != value for key, value in expected.items()):
        raise IndividualCollectionDriftError(f"stored page request metadata does not match offset {offset}")


def _read_payload(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise IndividualCollectionDriftError(f"cannot read retained JSON artifact {path}") from error
    if not isinstance(payload, dict):
        raise IndividualCollectionDriftError(f"retained JSON artifact is not an object: {path}")
    return payload


def _read_retrieved_at(manifest_path: Path) -> datetime:
    manifest = _read_payload(manifest_path)
    raw_value = manifest.get("retrieved_at")
    if not isinstance(raw_value, str):
        raise IndividualCollectionDriftError("retained page manifest has no retrieval timestamp")
    try:
        retrieved_at = datetime.fromisoformat(raw_value)
    except ValueError as error:
        raise IndividualCollectionDriftError("retained page manifest has an invalid retrieval timestamp") from error
    _validate_retrieved_at(retrieved_at)
    return retrieved_at


def _validate_retrieved_at(value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("page timestamps must include a timezone")


def _page_operation(collection_id: str, shard: IndividualShard, page_number: int) -> str:
    return f"collection-{collection_id}-range-{shard.low_crd}-{shard.high_crd}-page-{page_number:05d}"


def _plan_digest(plan: IndividualCollectionPlan) -> str:
    encoded = (json.dumps(plan.to_dict(), sort_keys=True, separators=(",", ":")) + "\n").encode()
    return hashlib.sha256(encoded).hexdigest()


__all__ = [
    "IndividualCollectionDriftError",
    "IndividualDownloadResult",
    "IndividualPageArtifact",
    "download_individual_collection",
]
