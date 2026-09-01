"""Adaptive collection planning for the current SEC-API individual index."""

import json
import math
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlsplit

from riascout_adv_data.storage import ArtifactStore, StoredArtifact

PLAN_SCHEMA_VERSION = "individual-plan-v1"
INDIVIDUAL_ENDPOINT = "https://api.sec-api.io/form-adv/individual"
_COLLECTION_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


class IndividualPlanError(ValueError):
    """The source response or saved plan cannot define a safe collection."""


class IndividualSearchClient(Protocol):
    """Current individual search boundary used by the planner."""

    def search_individuals(
        self,
        query: str,
        *,
        size: int = 10,
        offset: int = 0,
    ) -> dict[str, Any]: ...


@dataclass(frozen=True, order=True)
class IndividualShard:
    """One inclusive CRD range with an exact expected record count."""

    low_crd: int
    high_crd: int
    expected_count: int


@dataclass(frozen=True)
class IndividualCollectionPlan:
    """Immutable request estimate and complete CRD-space partition."""

    schema_version: str
    collection_id: str
    created_at: datetime
    endpoint: str
    highest_crd: int
    page_size: int
    max_shard_records: int
    probe_request_count: int
    shards: tuple[IndividualShard, ...]

    def __post_init__(self) -> None:
        _validate_plan(self)

    @property
    def expected_individual_count(self) -> int:
        """Return the exact sum of accepted shard counts."""
        return sum(shard.expected_count for shard in self.shards)

    @property
    def expected_page_requests(self) -> int:
        """Return the exact page-request count at the configured page size."""
        return sum(math.ceil(shard.expected_count / self.page_size) for shard in self.shards)

    def to_dict(self) -> dict[str, Any]:
        """Return the stable JSON representation used by raw artifact storage."""
        return {
            "schema_version": self.schema_version,
            "collection_id": self.collection_id,
            "created_at": self.created_at.isoformat(),
            "endpoint": self.endpoint,
            "highest_crd": self.highest_crd,
            "page_size": self.page_size,
            "max_shard_records": self.max_shard_records,
            "probe_request_count": self.probe_request_count,
            "expected_individual_count": self.expected_individual_count,
            "expected_page_requests": self.expected_page_requests,
            "shards": [
                {
                    "low_crd": shard.low_crd,
                    "high_crd": shard.high_crd,
                    "expected_count": shard.expected_count,
                }
                for shard in self.shards
            ],
        }


def build_individual_collection_plan(
    client: IndividualSearchClient,
    *,
    collection_id: str,
    created_at: datetime,
    max_shard_records: int = 9_500,
    page_size: int = 50,
) -> IndividualCollectionPlan:
    """Probe and partition the current individual index below its result cap."""
    if not 1 <= max_shard_records < 10_000:
        raise IndividualPlanError("max_shard_records must be between 1 and 9999")
    if not 1 <= page_size <= 50:
        raise IndividualPlanError("page_size must be between 1 and 50")

    first_response = client.search_individuals("*", size=1, offset=0)
    highest_crd = _read_highest_crd(first_response)
    broad_total = _read_total(first_response)
    probe_request_count = 1
    accepted: list[IndividualShard] = []
    pending = [(1, highest_crd)]

    while pending:
        low_crd, high_crd = pending.pop()
        response = client.search_individuals(
            f"Info.indvlPK:[{low_crd} TO {high_crd}]",
            size=1,
            offset=0,
        )
        probe_request_count += 1
        count, relation = _read_total(response)
        if relation == "eq" and count <= max_shard_records:
            accepted.append(IndividualShard(low_crd, high_crd, count))
            continue
        if low_crd == high_crd:
            raise IndividualPlanError(f"single CRD range {low_crd} is capped or contains more than one current record")
        midpoint = (low_crd + high_crd) // 2
        pending.append((midpoint + 1, high_crd))
        pending.append((low_crd, midpoint))

    accepted.sort(key=lambda shard: shard.low_crd)
    plan = IndividualCollectionPlan(
        schema_version=PLAN_SCHEMA_VERSION,
        collection_id=collection_id,
        created_at=created_at,
        endpoint=INDIVIDUAL_ENDPOINT,
        highest_crd=highest_crd,
        page_size=page_size,
        max_shard_records=max_shard_records,
        probe_request_count=probe_request_count,
        shards=tuple(accepted),
    )
    broad_count, broad_relation = broad_total
    if broad_relation == "eq" and plan.expected_individual_count != broad_count:
        raise IndividualPlanError("exact broad count does not equal the sum of exact accepted shard counts")
    return plan


def write_individual_collection_plan(
    store: ArtifactStore,
    plan: IndividualCollectionPlan,
    *,
    retrieved_at: datetime,
) -> StoredArtifact:
    """Write a credential-safe immutable collection-plan artifact."""
    return store.write_json(
        source="sec_api_individuals",
        operation=f"collection-{plan.collection_id}-plan",
        payload=plan.to_dict(),
        request_metadata={
            "method": "POST",
            "url": plan.endpoint,
            "purpose": "current individual CRD-range count planning",
        },
        retrieved_at=retrieved_at,
    )


def read_individual_collection_plan(path: Path) -> IndividualCollectionPlan:
    """Read and validate an immutable collection plan from JSON."""
    try:
        payload = json.loads(path.read_text())
    except (OSError, ValueError) as error:
        raise IndividualPlanError(f"cannot read individual collection plan: {path}") from error
    if not isinstance(payload, dict):
        raise IndividualPlanError("individual collection plan must be a JSON object")
    try:
        raw_shards = payload["shards"]
        if not isinstance(raw_shards, list):
            raise TypeError("shards must be a list")
        shards = tuple(
            IndividualShard(
                low_crd=_require_int(item, "low_crd"),
                high_crd=_require_int(item, "high_crd"),
                expected_count=_require_int(item, "expected_count"),
            )
            for item in raw_shards
            if isinstance(item, dict)
        )
        if len(shards) != len(raw_shards):
            raise TypeError("every shard must be an object")
        created_at = datetime.fromisoformat(_require_str(payload, "created_at"))
        plan = IndividualCollectionPlan(
            schema_version=_require_str(payload, "schema_version"),
            collection_id=_require_str(payload, "collection_id"),
            created_at=created_at,
            endpoint=_require_str(payload, "endpoint"),
            highest_crd=_require_int(payload, "highest_crd"),
            page_size=_require_int(payload, "page_size"),
            max_shard_records=_require_int(payload, "max_shard_records"),
            probe_request_count=_require_int(payload, "probe_request_count"),
            shards=shards,
        )
    except (KeyError, TypeError, ValueError) as error:
        if isinstance(error, IndividualPlanError):
            raise
        raise IndividualPlanError("individual collection plan has invalid fields") from error

    expected_count = payload.get("expected_individual_count")
    if expected_count is not None and expected_count != plan.expected_individual_count:
        raise IndividualPlanError("saved expected individual count does not match its shards")
    expected_pages = payload.get("expected_page_requests")
    if expected_pages is not None and expected_pages != plan.expected_page_requests:
        raise IndividualPlanError("saved expected page requests do not match its shards")
    return plan


def _read_highest_crd(response: dict[str, Any]) -> int:
    filings = response.get("filings")
    if not isinstance(filings, list) or not filings or not isinstance(filings[0], dict):
        raise IndividualPlanError("highest-CRD response has no filing")
    info = filings[0].get("Info")
    if not isinstance(info, dict):
        raise IndividualPlanError("highest-CRD filing has no Info object")
    crd = info.get("indvlPK")
    if isinstance(crd, bool) or not isinstance(crd, int) or crd <= 0:
        raise IndividualPlanError("highest individual CRD must be a positive integer")
    return crd


def _read_total(response: dict[str, Any]) -> tuple[int, str]:
    if not isinstance(response, dict):
        raise IndividualPlanError("SEC-API count response must be an object")
    total = response.get("total")
    if not isinstance(total, dict):
        raise IndividualPlanError("SEC-API count response has no total object")
    value = total.get("value")
    relation = total.get("relation")
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise IndividualPlanError("SEC-API total value must be a nonnegative integer")
    if not isinstance(relation, str) or not relation:
        raise IndividualPlanError("SEC-API total relation must be a nonempty string")
    return value, relation


def _validate_plan(plan: IndividualCollectionPlan) -> None:
    if plan.schema_version != PLAN_SCHEMA_VERSION:
        raise IndividualPlanError(f"unsupported individual plan schema: {plan.schema_version}")
    if not _COLLECTION_ID_PATTERN.fullmatch(plan.collection_id):
        raise IndividualPlanError("collection_id contains unsafe characters")
    if plan.created_at.tzinfo is None or plan.created_at.utcoffset() is None:
        raise IndividualPlanError("created_at must include a timezone")
    endpoint = urlsplit(plan.endpoint)
    if endpoint.scheme != "https" or endpoint.hostname != "api.sec-api.io":
        raise IndividualPlanError("endpoint must use HTTPS on api.sec-api.io")
    if endpoint.path != "/form-adv/individual" or endpoint.query or endpoint.fragment:
        raise IndividualPlanError("endpoint must be the credential-free individual search URL")
    if plan.highest_crd <= 0:
        raise IndividualPlanError("highest_crd must be positive")
    if not 1 <= plan.page_size <= 50:
        raise IndividualPlanError("page_size must be between 1 and 50")
    if not 1 <= plan.max_shard_records < 10_000:
        raise IndividualPlanError("max_shard_records must be between 1 and 9999")
    if plan.probe_request_count < 2:
        raise IndividualPlanError("probe_request_count must include discovery and range probes")
    if not plan.shards:
        raise IndividualPlanError("plan must contain at least one shard")

    expected_low = 1
    for shard in plan.shards:
        if shard.low_crd != expected_low:
            raise IndividualPlanError("individual plan shards contain a gap, overlap, or duplicate")
        if shard.high_crd < shard.low_crd:
            raise IndividualPlanError("individual plan shard bounds are reversed")
        if shard.expected_count < 0 or shard.expected_count > plan.max_shard_records:
            raise IndividualPlanError("individual plan shard count is invalid")
        expected_low = shard.high_crd + 1
    if expected_low != plan.highest_crd + 1:
        raise IndividualPlanError("individual plan shards do not reach highest_crd")


def _require_int(value: dict[str, Any], key: str) -> int:
    item: object = value[key]
    if isinstance(item, bool) or not isinstance(item, int):
        raise TypeError(f"{key} must be an integer")
    return item


def _require_str(value: dict[str, Any], key: str) -> str:
    item: object = value[key]
    if not isinstance(item, str):
        raise TypeError(f"{key} must be a string")
    return item


__all__ = [
    "INDIVIDUAL_ENDPOINT",
    "PLAN_SCHEMA_VERSION",
    "IndividualCollectionPlan",
    "IndividualPlanError",
    "IndividualSearchClient",
    "IndividualShard",
    "build_individual_collection_plan",
    "read_individual_collection_plan",
    "write_individual_collection_plan",
]
