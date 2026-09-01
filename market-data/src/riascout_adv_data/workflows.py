"""Application workflows shared by the CLI and tests."""

import csv
import json
import os
import time
from dataclasses import asdict
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from riascout_adv_data.api import SecApiClient
from riascout_adv_data.canonicalize import TRANSFORMATION_VERSION, HistoricalCanonicalizer
from riascout_adv_data.config import load_api_key
from riascout_adv_data.individual_canonicalize import (
    DownloadedIndividualCollection,
    IndividualCanonicalizationResult,
    IndividualCanonicalizer,
)
from riascout_adv_data.individual_download import IndividualDownloadResult, download_individual_collection
from riascout_adv_data.individual_plan import (
    build_individual_collection_plan,
    read_individual_collection_plan,
    write_individual_collection_plan,
)
from riascout_adv_data.individual_snapshots import IndividualSnapshotBuilder, IndividualSnapshotResult
from riascout_adv_data.individual_validation import (
    IndividualValidationResult,
    validate_individual_pipeline,
    write_individual_coverage_report,
)
from riascout_adv_data.monthly_reports import MonthlyReportPublisher
from riascout_adv_data.normalized_export import NormalizedExporter, NormalizedRelease
from riascout_adv_data.official_db import OfficialArtifactRecord, OfficialDatabase
from riascout_adv_data.official_download import OfficialDownloader
from riascout_adv_data.official_sources import (
    FORM_ADV_REPORTS_METADATA,
    REPORT_INDEX,
    OfficialSourceSpec,
    parse_form_adv_reports_metadata,
    parse_information_report_index,
)
from riascout_adv_data.official_validation import build_official_coverage
from riascout_adv_data.raw_ingest import RawIngestor
from riascout_adv_data.storage import ArtifactStore, StoredArtifact


def plan_individual_download(
    *,
    run_id: str,
    data_dir: Path,
    env_file: Path,
    created_at: datetime | None = None,
) -> StoredArtifact:
    """Build and preserve an exact request plan without downloading result pages."""
    timestamp = created_at or datetime.now(UTC)
    api_key = load_api_key(environment=os.environ, env_file=env_file)
    store = ArtifactStore(data_dir, secrets=[api_key])
    plan = build_individual_collection_plan(
        SecApiClient(api_key),
        collection_id=run_id,
        created_at=timestamp,
    )
    return write_individual_collection_plan(store, plan, retrieved_at=timestamp)


def download_individuals(
    *,
    plan_path: Path,
    data_dir: Path,
    env_file: Path,
    started_at: datetime | None = None,
) -> IndividualDownloadResult:
    """Execute exactly one immutable plan, retaining verified resumable pages."""
    plan = read_individual_collection_plan(plan_path)
    timestamp = started_at or datetime.now(UTC)
    api_key = load_api_key(environment=os.environ, env_file=env_file)
    return download_individual_collection(
        client=SecApiClient(api_key),
        plan=plan,
        store=ArtifactStore(data_dir, secrets=[api_key]),
        started_at=timestamp,
        sleep=time.sleep,
        inter_request_delay=0.1,
    )


def ingest_individuals(
    *,
    collection_id: str,
    data_dir: Path,
) -> IndividualCanonicalizationResult:
    """Discover and publish one completed immutable individual collection offline."""
    plan_path = _one_collection_artifact(data_dir, f"collection-{collection_id}-plan.json")
    completion_path = _one_collection_artifact(data_dir, f"collection-{collection_id}-completion.json")
    completion = _read_json_object(completion_path)
    pages = completion.get("pages")
    if not isinstance(pages, list):
        raise ValueError("individual completion artifact has no pages list")
    page_paths: list[Path] = []
    for page in pages:
        if not isinstance(page, dict) or not isinstance(page.get("payload_path"), str):
            raise ValueError("individual completion artifact contains an invalid page path")
        page_paths.append(_resolve_data_path(str(page["payload_path"]), data_dir))
    started_at = _completion_timestamp(completion, "collection_started_at")
    completed_at = _completion_timestamp(completion, "collection_completed_at")
    database = OfficialDatabase(data_dir / "analysis.duckdb")
    database.install_schema()
    return IndividualCanonicalizer(database).publish(
        DownloadedIndividualCollection(
            plan_path=plan_path,
            completion_path=completion_path,
            page_paths=tuple(page_paths),
            collection_started_at=started_at,
            collection_completed_at=completed_at,
        )
    )


def build_individual_snapshots(
    *,
    collection_id: str,
    years: range,
    data_dir: Path,
) -> IndividualSnapshotResult:
    """Build collection-versioned 2020–2026 individual snapshots offline."""
    database = OfficialDatabase(data_dir / "analysis.duckdb")
    database.install_schema()
    return IndividualSnapshotBuilder(database).rebuild(
        collection_id=collection_id,
        years=years,
        built_at=datetime.now(UTC),
    )


def validate_individuals(
    *,
    collection_id: str,
    years: range,
    data_dir: Path,
    report_dir: Path,
    secret_values: tuple[str, ...] = (),
) -> IndividualValidationResult:
    """Validate one collection and write its explicit coverage report offline."""
    database = OfficialDatabase(data_dir / "analysis.duckdb")
    database.install_schema()
    result = validate_individual_pipeline(
        database,
        collection_id=collection_id,
        years=years,
        credential_scan_paths=(data_dir, report_dir),
        secret_values=secret_values,
    )
    write_individual_coverage_report(
        database,
        collection_id=collection_id,
        years=years,
        output_dir=report_dir,
        run_id=collection_id,
        generated_at=datetime.now(UTC),
    )
    return result


def export_normalized_release(
    *,
    collection_id: str,
    release_id: str,
    years: range,
    data_dir: Path,
    generated_at: datetime | None = None,
) -> NormalizedRelease:
    """Validate then atomically export one internal normalized release offline."""
    database = OfficialDatabase(data_dir / "analysis.duckdb")
    database.install_schema()
    validation = validate_individual_pipeline(
        database,
        collection_id=collection_id,
        years=years,
        credential_scan_paths=(data_dir,),
    )
    if not validation.is_valid:
        codes = ", ".join(issue.code for issue in validation.failures)
        raise RuntimeError(f"normalized export blocked by validation failures: {codes}")
    return NormalizedExporter(database).export(
        collection_id=collection_id,
        years=years,
        release_id=release_id,
        output_root=data_dir / "normalized",
        generated_at=generated_at or datetime.now(UTC),
    )


def _one_collection_artifact(data_dir: Path, filename: str) -> Path:
    matches = tuple((data_dir / "raw" / "sec_api_individuals").glob(f"*/{filename}"))
    if len(matches) != 1:
        raise FileNotFoundError(
            f"expected exactly one {filename} under {data_dir / 'raw' / 'sec_api_individuals'}, found {len(matches)}"
        )
    return matches[0]


def _read_json_object(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"expected a JSON object at {path}")
    return payload


def _completion_timestamp(payload: dict[str, Any], key: str) -> datetime:
    value = payload.get(key)
    if not isinstance(value, str):
        raise ValueError(f"individual completion artifact has no {key}")
    timestamp = datetime.fromisoformat(value)
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        raise ValueError(f"individual completion {key} must include a timezone")
    return timestamp


def _resolve_data_path(value: str, data_dir: Path) -> Path:
    recorded = Path(value)
    candidate = recorded if recorded.is_absolute() else data_dir.parent / recorded
    resolved = candidate.resolve()
    root = data_dir.resolve()
    if not resolved.is_relative_to(root):
        raise ValueError("individual completion page path is outside the selected data directory")
    return candidate


def discover_official_report_sources(
    client: httpx.Client,
    *,
    store: ArtifactStore,
    user_agent: str,
    retrieved_at: datetime,
) -> tuple[OfficialSourceSpec, ...]:
    """Retrieve, preserve, and parse the live SEC RIA/ERA report index."""
    response = client.get(REPORT_INDEX, headers={"User-Agent": user_agent})
    response.raise_for_status()
    if urlparse(str(response.url)).hostname not in {"sec.gov", "www.sec.gov"}:
        raise ValueError(f"SEC report index redirected to an untrusted host: {response.url}")
    pending = store.create_pending_path(suffix=".html.part")
    try:
        pending.write_bytes(response.content)
        store.promote_download(
            source="sec_official",
            operation="report-index",
            pending_path=pending,
            suffix=".html",
            request_metadata={
                "method": "GET",
                "url": REPORT_INDEX,
                "final_url": str(response.url),
                "status_code": response.status_code,
                "content_type": response.headers.get("content-type", ""),
            },
            retrieved_at=retrieved_at,
        )
    except Exception:
        pending.unlink(missing_ok=True)
        raise
    return parse_information_report_index(response.text)


def discover_form_adv_filing_sources(
    client: httpx.Client,
    *,
    store: ArtifactStore,
    user_agent: str,
    retrieved_at: datetime,
    years: range | tuple[int, ...] | list[int],
) -> tuple[OfficialSourceSpec, ...]:
    """Retrieve and preserve the official IAPD monthly Part 1 and ADV-W catalog."""
    response = client.get(FORM_ADV_REPORTS_METADATA, headers={"User-Agent": user_agent})
    response.raise_for_status()
    if urlparse(str(response.url)).hostname != "reports.adviserinfo.sec.gov":
        raise ValueError(f"IAPD reports metadata redirected to an untrusted host: {response.url}")
    payload = response.json()
    if not isinstance(payload, dict):
        raise TypeError("IAPD reports metadata returned a non-object response")
    store.write_content_addressed_json(
        source="sec_official",
        operation="form-adv-reports-metadata",
        payload=payload,
        request_metadata={
            "method": "GET",
            "url": FORM_ADV_REPORTS_METADATA,
            "final_url": str(response.url),
            "status_code": response.status_code,
            "content_type": response.headers.get("content-type", ""),
        },
        retrieved_at=retrieved_at,
    )
    return parse_form_adv_reports_metadata(payload, years=years)


def select_complete_filing_history(
    specs: tuple[OfficialSourceSpec, ...],
) -> tuple[OfficialSourceSpec, ...]:
    """Require a Part 1 filing archive and ADV-W archive for every discovered month."""
    grouped: dict[date, dict[str, OfficialSourceSpec]] = {}
    for spec in specs:
        if spec.observation_date is None or spec.dataset_kind not in {"adv_part1", "advw"}:
            continue
        month = grouped.setdefault(spec.observation_date, {})
        if spec.dataset_kind in month:
            raise LookupError(f"Duplicate {spec.dataset_kind} archive for {spec.observation_date}")
        month[spec.dataset_kind] = spec
    incomplete = sorted(
        observation_date for observation_date, categories in grouped.items() if set(categories) != {"adv_part1", "advw"}
    )
    if incomplete:
        dates = ", ".join(value.isoformat() for value in incomplete)
        raise LookupError(f"Official filing history is incomplete for: {dates}")
    selected = [spec for categories in grouped.values() for spec in categories.values()]
    return tuple(sorted(selected, key=lambda spec: (spec.observation_date or date.min, spec.key)))


def select_monthly_sources(
    specs: tuple[OfficialSourceSpec, ...],
    *,
    year: int,
    month: int | None = None,
    latest: bool = False,
) -> tuple[OfficialSourceSpec, ...]:
    """Select an exact or latest complete RIA/ERA report pair."""
    grouped: dict[date, dict[str, OfficialSourceSpec]] = {}
    for spec in specs:
        if spec.observation_date is None or spec.observation_date.year != year:
            continue
        if month is not None and spec.observation_date.month != month:
            continue
        grouped.setdefault(spec.observation_date, {})[spec.dataset_kind] = spec
    paired = {
        report_date: categories
        for report_date, categories in grouped.items()
        if {"ria_report", "era_report"} <= categories.keys()
    }
    if not paired:
        label = f"{year}-{month:02d}" if month is not None else str(year)
        raise LookupError(f"No paired official RIA and ERA reports were found for {label}")
    selected_date = max(paired) if latest else min(paired)
    categories = paired[selected_date]
    return categories["ria_report"], categories["era_report"]


def download_official_sources(
    specs: tuple[OfficialSourceSpec, ...],
    *,
    client: httpx.Client,
    store: ArtifactStore,
    database: OfficialDatabase,
    user_agent: str,
    retrieved_at: datetime,
) -> tuple[str, ...]:
    """Download immutable official artifacts and register their provenance."""
    downloader = OfficialDownloader(client=client, store=store, user_agent=user_agent)
    artifact_ids: list[str] = []
    database.install_schema()
    for spec in specs:
        stored = downloader.download(spec, retrieved_at)
        artifact_id = f"sha256:{stored.sha256}"
        database.record_artifact(
            OfficialArtifactRecord(
                artifact_id=artifact_id,
                dataset_key=spec.key,
                dataset_kind=spec.dataset_kind,
                source_url=spec.url,
                observation_date=spec.observation_date,
                retrieved_at=retrieved_at,
                sha256=stored.sha256,
                payload_path=str(stored.payload_path),
                manifest_path=str(stored.manifest_path),
                byte_count=stored.payload_path.stat().st_size,
            )
        )
        artifact_ids.append(artifact_id)
    return tuple(artifact_ids)


def ingest_and_publish_official(database: OfficialDatabase) -> tuple[int, int]:
    """Ingest every registered artifact and publish historical/monthly canonical rows."""
    database.install_schema()
    with database.connection() as connection:
        rows = connection.execute(
            """
            SELECT artifact_id, dataset_kind FROM source_artifacts
            WHERE dataset_kind IN ('adv_part1', 'advw', 'ria_report', 'era_report')
            ORDER BY retrieved_at, artifact_id
            """
        ).fetchall()
    historical_ids: list[str] = []
    monthly_ids: list[str] = []
    ingestor = RawIngestor(database)
    for artifact_id_value, kind_value in rows:
        artifact_id = str(artifact_id_value)
        kind = str(kind_value)
        ingestor.ingest_artifact(artifact_id)
        if kind in {"adv_part1", "advw"}:
            historical_ids.append(artifact_id)
        else:
            monthly_ids.append(artifact_id)
    historical_count = 0
    monthly_count = 0
    pending_historical_ids = select_uncanonicalized_artifacts(database, tuple(historical_ids))
    if pending_historical_ids:
        historical_count = HistoricalCanonicalizer(database).publish(pending_historical_ids).published_filings
    if monthly_ids:
        monthly_count = MonthlyReportPublisher(database).publish(monthly_ids).published_observations
    return historical_count, monthly_count


def select_uncanonicalized_artifacts(
    database: OfficialDatabase,
    artifact_ids: tuple[str, ...],
) -> tuple[str, ...]:
    """Select artifacts not yet published with the current canonical transformation."""
    if not artifact_ids:
        return ()
    placeholders = ", ".join("?" for _ in artifact_ids)
    with database.connection() as connection:
        rows = connection.execute(
            f"""
            SELECT artifact_id FROM canonicalization_runs
            WHERE artifact_id IN ({placeholders})
              AND transformation_version = ?
              AND status = 'published'
            """,
            [*artifact_ids, TRANSFORMATION_VERSION],
        ).fetchall()
    published = {str(row[0]) for row in rows}
    return tuple(artifact_id for artifact_id in artifact_ids if artifact_id not in published)


def write_official_coverage_report(
    database: OfficialDatabase,
    *,
    years: range | list[int],
    output_dir: Path,
    run_id: str,
    generated_at: datetime,
) -> tuple[Path, Path]:
    """Write the official 2020–2026 firm coverage matrix as Markdown and CSV."""
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = build_official_coverage(database, years=years)
    markdown_path = output_dir / f"official-coverage-{run_id}.md"
    csv_path = output_dir / f"official-coverage-{run_id}.csv"
    lines = [
        "# Official Form ADV firm snapshot coverage",
        "",
        f"Generated: {generated_at.isoformat()}",
        "",
        "| Year | Status | Firms | RIA | ERA | U.S. | Non-U.S. | Country unknown | State registration coverage | Schedule D coverage |",
        "|---:|---|---:|---:|---:|---:|---:|---:|---|---|",
    ]
    for row in rows:
        lines.append(
            f"| {row.year} | {row.snapshot_status} | {row.firm_count} | {row.ria_count} | "
            f"{row.era_count} | {row.us_based_count} | {row.non_us_based_count} | "
            f"{row.country_unknown_count} | {row.state_registration_coverage} | "
            f"{row.schedule_d_coverage} |"
        )
    markdown_path.write_text("\n".join(lines) + "\n")
    with csv_path.open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(asdict(rows[0]).keys()))
        writer.writeheader()
        writer.writerows(asdict(row) for row in rows)
    return markdown_path, csv_path


__all__ = [
    "discover_form_adv_filing_sources",
    "discover_official_report_sources",
    "build_individual_snapshots",
    "download_individuals",
    "download_official_sources",
    "export_normalized_release",
    "ingest_individuals",
    "ingest_and_publish_official",
    "plan_individual_download",
    "select_complete_filing_history",
    "select_monthly_sources",
    "select_uncanonicalized_artifacts",
    "validate_individuals",
    "write_official_coverage_report",
]
