"""Command-line interface for RIAScout SEC/IAPD market data."""

import argparse
import os
import re
from datetime import UTC, datetime
from pathlib import Path

import httpx

from riascout_adv_data.config import load_sec_user_agent
from riascout_adv_data.individual_plan import read_individual_collection_plan
from riascout_adv_data.official_db import OfficialDatabase
from riascout_adv_data.official_sources import fixed_historical_sources, parse_information_report_index
from riascout_adv_data.official_validation import validate_official_pipeline
from riascout_adv_data.snapshots import FirmSnapshotBuilder
from riascout_adv_data.storage import ArtifactStore
from riascout_adv_data.workflows import (
    build_individual_snapshots,
    discover_form_adv_filing_sources,
    discover_official_report_sources,
    download_individuals,
    download_official_sources,
    export_normalized_release,
    ingest_and_publish_official,
    ingest_individuals,
    plan_individual_download,
    select_complete_filing_history,
    select_monthly_sources,
    validate_individuals,
    write_official_coverage_report,
)


def main(argv: list[str] | None = None) -> int:
    """Run the requested RIAScout SEC/IAPD market-data command."""
    parser = _build_parser()
    arguments = parser.parse_args(argv)
    if arguments.command == "list-official":
        return _list_official(arguments)
    if arguments.command == "download-official":
        return _download_official(arguments)
    if arguments.command == "ingest-official":
        return _ingest_official(arguments)
    if arguments.command == "build-snapshots":
        return _build_snapshots(arguments)
    if arguments.command == "validate-snapshots":
        return _validate_snapshots(arguments)
    if arguments.command == "report-official":
        return _report_official(arguments)
    if arguments.command == "plan-individual-download":
        return _plan_individual_download(arguments)
    if arguments.command == "download-individuals":
        return _download_individuals(arguments)
    if arguments.command == "ingest-individuals":
        return _ingest_individuals(arguments)
    if arguments.command == "build-individual-snapshots":
        return _build_individual_snapshots(arguments)
    if arguments.command == "validate-individuals":
        return _validate_individuals(arguments)
    if arguments.command == "export-normalized":
        return _export_normalized(arguments)
    parser.error("a command is required")
    return 2


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Acquire and publish RIAScout SEC/IAPD market data.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    official_list = subparsers.add_parser("list-official", help="List discovered official RIA/ERA reports.")
    official_list.add_argument("--year", type=int)
    official_list.add_argument("--month", type=int, choices=range(1, 13))
    official_list.add_argument("--index-file", type=Path)
    official_list.add_argument("--env-file", type=Path, default=Path(".env.local"))
    _add_data_arguments(official_list)

    download = subparsers.add_parser("download-official", help="Download immutable official SEC artifacts.")
    download.add_argument("--historical", action="store_true")
    download.add_argument("--filing-history", action="store_true")
    download.add_argument("--years", type=_year_range, default=[2025, 2026])
    download.add_argument("--year", type=int)
    download.add_argument("--month", type=int, choices=range(1, 13))
    download.add_argument("--latest-2026", action="store_true")
    download.add_argument("--env-file", type=Path, default=Path(".env.local"))
    _add_data_arguments(download)

    ingest = subparsers.add_parser("ingest-official", help="Ingest and canonicalize downloaded official data.")
    _add_data_arguments(ingest)

    build = subparsers.add_parser("build-snapshots", help="Build point-in-time official firm snapshots.")
    build.add_argument("--years", type=_year_range, default=list(range(2020, 2027)))
    _add_data_arguments(build)

    validate_snapshots = subparsers.add_parser("validate-snapshots", help="Validate official snapshot invariants.")
    validate_snapshots.add_argument("--years", type=_year_range, default=list(range(2020, 2027)))
    _add_data_arguments(validate_snapshots)

    official_report = subparsers.add_parser("report-official", help="Write official coverage reports.")
    official_report.add_argument("--years", type=_year_range, default=list(range(2020, 2027)))
    _add_data_arguments(official_report)

    individual_plan = subparsers.add_parser(
        "plan-individual-download", help="Plan a bounded current-individual collection."
    )
    individual_plan.add_argument("--run-id", required=True, type=_safe_run_id)
    individual_plan.add_argument("--data-dir", type=Path, default=Path("data"))
    individual_plan.add_argument("--env-file", type=Path, default=Path(".env.local"))

    individual_download = subparsers.add_parser(
        "download-individuals", help="Download all pages from an approved individual plan."
    )
    individual_download.add_argument("--plan", required=True, type=Path)
    individual_download.add_argument("--data-dir", type=Path, default=Path("data"))
    individual_download.add_argument("--env-file", type=Path, default=Path(".env.local"))

    individual_ingest = subparsers.add_parser("ingest-individuals", help="Publish a completed individual collection.")
    individual_ingest.add_argument("--collection-id", required=True, type=_safe_run_id)
    individual_ingest.add_argument("--data-dir", type=Path, default=Path("data"))

    individual_build = subparsers.add_parser(
        "build-individual-snapshots", help="Build partial annual individual snapshots."
    )
    individual_build.add_argument("--collection-id", required=True, type=_safe_run_id)
    individual_build.add_argument("--years", type=_year_range, default=list(range(2020, 2027)))
    individual_build.add_argument("--data-dir", type=Path, default=Path("data"))

    individual_validate = subparsers.add_parser(
        "validate-individuals", help="Validate an individual collection and snapshots."
    )
    individual_validate.add_argument("--collection-id", required=True, type=_safe_run_id)
    individual_validate.add_argument("--years", type=_year_range, default=list(range(2020, 2027)))
    individual_validate.add_argument("--data-dir", type=Path, default=Path("data"))
    individual_validate.add_argument("--report-dir", type=Path, default=Path("reports"))

    normalized_export = subparsers.add_parser(
        "export-normalized", help="Export a validated internal normalized release."
    )
    normalized_export.add_argument("--collection-id", required=True, type=_safe_run_id)
    normalized_export.add_argument("--release-id", required=True, type=_safe_run_id)
    normalized_export.add_argument("--years", type=_year_range, default=list(range(2020, 2027)))
    normalized_export.add_argument("--data-dir", type=Path, default=Path("data"))
    return parser


def _add_data_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--report-dir", type=Path, default=Path("reports"))
    parser.add_argument("--run-id", type=_safe_run_id, default=None)


def _list_official(arguments: argparse.Namespace) -> int:
    if arguments.index_file is not None:
        specs = parse_information_report_index(arguments.index_file.read_text())
    else:
        user_agent = load_sec_user_agent(environment=os.environ, env_file=arguments.env_file)
        with httpx.Client(follow_redirects=True, timeout=45.0) as client:
            specs = discover_official_report_sources(
                client,
                store=ArtifactStore(arguments.data_dir),
                user_agent=user_agent,
                retrieved_at=datetime.now(UTC),
            )
    filtered = tuple(
        spec
        for spec in specs
        if (arguments.year is None or (spec.observation_date and spec.observation_date.year == arguments.year))
        and (arguments.month is None or (spec.observation_date and spec.observation_date.month == arguments.month))
    )
    for spec in filtered:
        print(f"{spec.key}\t{spec.dataset_kind}\t{spec.observation_date}\t{spec.url}")
    return 0


def _download_official(arguments: argparse.Namespace) -> int:
    selections = (
        int(arguments.historical)
        + int(arguments.filing_history)
        + int(arguments.latest_2026)
        + int(arguments.year is not None)
    )
    if selections != 1:
        raise ValueError("Choose exactly one of --historical, --filing-history, --year/--month, or --latest-2026")
    if arguments.year is not None and arguments.month is None:
        raise ValueError("--year requires --month")
    user_agent = load_sec_user_agent(environment=os.environ, env_file=arguments.env_file)
    now = datetime.now(UTC)
    store = ArtifactStore(arguments.data_dir)
    database = OfficialDatabase(arguments.data_dir / "analysis.duckdb")
    with httpx.Client(follow_redirects=True, timeout=120.0) as client:
        if arguments.historical:
            specs = fixed_historical_sources()
        elif arguments.filing_history:
            specs = select_complete_filing_history(
                discover_form_adv_filing_sources(
                    client,
                    store=store,
                    user_agent=user_agent,
                    retrieved_at=now,
                    years=arguments.years,
                )
            )
        else:
            discovered = discover_official_report_sources(
                client,
                store=store,
                user_agent=user_agent,
                retrieved_at=now,
            )
            specs = select_monthly_sources(
                discovered,
                year=2026 if arguments.latest_2026 else arguments.year,
                month=None if arguments.latest_2026 else arguments.month,
                latest=arguments.latest_2026,
            )
        artifact_ids = download_official_sources(
            specs,
            client=client,
            store=store,
            database=database,
            user_agent=user_agent,
            retrieved_at=now,
        )
    print(f"Registered {len(artifact_ids)} immutable official artifacts.")
    return 0


def _ingest_official(arguments: argparse.Namespace) -> int:
    database = OfficialDatabase(arguments.data_dir / "analysis.duckdb")
    historical_count, monthly_count = ingest_and_publish_official(database)
    print(f"Published {historical_count} historical filings and {monthly_count} monthly observations.")
    return 0


def _build_snapshots(arguments: argparse.Namespace) -> int:
    database = OfficialDatabase(arguments.data_dir / "analysis.duckdb")
    database.install_schema()
    result = FirmSnapshotBuilder(database).rebuild(arguments.years, datetime.now(UTC))
    print(f"Published {result.snapshot_count} firm snapshots for {result.years[0]}–{result.years[-1]}.")
    return 0


def _validate_snapshots(arguments: argparse.Namespace) -> int:
    database = OfficialDatabase(arguments.data_dir / "analysis.duckdb")
    database.install_schema()
    scan_paths = [*arguments.data_dir.glob("raw/**/*.manifest.json"), arguments.report_dir]
    result = validate_official_pipeline(database, years=arguments.years, scan_paths=scan_paths)
    for issue in result.failures:
        print(f"FAIL {issue.code}: {issue.message} ({issue.count})")
    for issue in result.warnings:
        print(f"WARN {issue.code}: {issue.message} ({issue.count})")
    return 0 if result.is_valid else 1


def _report_official(arguments: argparse.Namespace) -> int:
    now = datetime.now(UTC)
    run_id = arguments.run_id or _timestamp_id(now)
    database = OfficialDatabase(arguments.data_dir / "analysis.duckdb")
    database.install_schema()
    markdown_path, csv_path = write_official_coverage_report(
        database,
        years=arguments.years,
        output_dir=arguments.report_dir,
        run_id=run_id,
        generated_at=now,
    )
    print(markdown_path)
    print(csv_path)
    return 0


def _plan_individual_download(arguments: argparse.Namespace) -> int:
    artifact = plan_individual_download(
        run_id=arguments.run_id,
        data_dir=arguments.data_dir,
        env_file=arguments.env_file,
    )
    plan = read_individual_collection_plan(artifact.payload_path)
    total_requests = plan.probe_request_count + plan.expected_page_requests
    print(f"Plan: {artifact.payload_path}")
    print(f"Expected individuals: {plan.expected_individual_count}")
    print(f"Shards: {len(plan.shards)}")
    print(f"Probe requests: {plan.probe_request_count}")
    print(f"Page requests: {plan.expected_page_requests}")
    print(f"Total estimated requests: {total_requests}")
    print("No individual pages were downloaded.")
    return 0


def _download_individuals(arguments: argparse.Namespace) -> int:
    result = download_individuals(
        plan_path=arguments.plan,
        data_dir=arguments.data_dir,
        env_file=arguments.env_file,
    )
    print(f"Collection: {result.collection_id}")
    print(f"Individuals: {result.retrieved_individual_count}")
    print(f"Pages: {result.completed_page_requests}")
    print(f"Verified pages reused: {result.skipped_verified_pages}")
    return 0


def _ingest_individuals(arguments: argparse.Namespace) -> int:
    result = ingest_individuals(
        collection_id=arguments.collection_id,
        data_dir=arguments.data_dir,
    )
    print(f"Published individuals: {result.published_individuals}")
    print(f"Quarantined rows: {result.quarantined_rows}")
    print(f"Registered page artifacts: {result.registered_page_artifacts}")
    return 0


def _build_individual_snapshots(arguments: argparse.Namespace) -> int:
    years = range(arguments.years[0], arguments.years[-1] + 1)
    result = build_individual_snapshots(
        collection_id=arguments.collection_id,
        years=years,
        data_dir=arguments.data_dir,
    )
    print(
        f"Published {result.snapshot_rows} individual snapshots and "
        f"{result.relationship_rows} individual-firm relationships."
    )
    return 0


def _validate_individuals(arguments: argparse.Namespace) -> int:
    years = range(arguments.years[0], arguments.years[-1] + 1)
    result = validate_individuals(
        collection_id=arguments.collection_id,
        years=years,
        data_dir=arguments.data_dir,
        report_dir=arguments.report_dir,
    )
    for issue in result.failures:
        print(f"FAIL {issue.code}: {issue.message} ({issue.count})")
    for issue in result.warnings:
        print(f"WARN {issue.code}: {issue.message} ({issue.count})")
    return 0 if result.is_valid else 1


def _export_normalized(arguments: argparse.Namespace) -> int:
    years = range(arguments.years[0], arguments.years[-1] + 1)
    result = export_normalized_release(
        collection_id=arguments.collection_id,
        release_id=arguments.release_id,
        years=years,
        data_dir=arguments.data_dir,
    )
    print(result.path)
    return 0


def _timestamp_id(value: datetime) -> str:
    return value.strftime("%Y%m%dT%H%M%SZ")


def _safe_run_id(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}", value):
        raise argparse.ArgumentTypeError("run ID may contain only letters, numbers, dot, underscore, and hyphen")
    return value


def _year_range(value: str) -> list[int]:
    match = re.fullmatch(r"(20\d{2})(?::(20\d{2}))?", value)
    if match is None:
        raise argparse.ArgumentTypeError("years must be one year or an inclusive range such as 2020:2026")
    start = int(match.group(1))
    end = int(match.group(2) or start)
    if start > end or start < 2020 or end > 2026:
        raise argparse.ArgumentTypeError("years must be an ascending range within 2020–2026")
    return list(range(start, end + 1))


__all__ = ["main"]
