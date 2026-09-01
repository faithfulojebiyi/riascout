import csv
from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from riascout_adv_data.canonicalize import TRANSFORMATION_VERSION
from riascout_adv_data.official_db import OfficialDatabase
from riascout_adv_data.official_sources import OfficialSourceSpec
from riascout_adv_data.workflows import (
    select_complete_filing_history,
    select_uncanonicalized_artifacts,
    write_official_coverage_report,
)


def test_write_official_coverage_report_has_seven_year_rows(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()

    markdown_path, csv_path = write_official_coverage_report(
        database,
        years=range(2020, 2027),
        output_dir=tmp_path / "reports",
        run_id="official-run",
        generated_at=datetime(2026, 8, 26, tzinfo=UTC),
    )

    assert "State registration coverage" in markdown_path.read_text()
    with csv_path.open(newline="") as stream:
        rows = list(csv.DictReader(stream))
    assert len(rows) == 7
    assert rows[-1]["year"] == "2026"


def test_complete_filing_history_requires_part1_and_advw_for_each_month() -> None:
    specs = (
        OfficialSourceSpec(
            key="adv-filing-data-2025-01",
            url="https://reports.adviserinfo.sec.gov/part1.zip",
            dataset_kind="adv_part1",
            observation_date=date(2025, 1, 31),
            snapshot_status="historical_filings",
            expected_container="zip",
        ),
        OfficialSourceSpec(
            key="advw-2025-01",
            url="https://reports.adviserinfo.sec.gov/advw.zip",
            dataset_kind="advw",
            observation_date=date(2025, 1, 31),
            snapshot_status="historical_filings",
            expected_container="zip",
        ),
    )

    assert select_complete_filing_history(specs) == specs

    with pytest.raises(LookupError, match="incomplete"):
        select_complete_filing_history(specs[:1])


def test_incremental_publication_selects_only_artifacts_without_current_transformation(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    with database.transaction() as connection:
        for artifact_id in ("old", "new"):
            connection.execute(
                """
                INSERT INTO source_artifacts (
                    artifact_id, dataset_key, dataset_kind, source_url, observation_date,
                    retrieved_at, sha256, payload_path, manifest_path, byte_count
                ) VALUES (?, ?, 'adv_part1', ?, DATE '2025-01-31', ?, ?, ?, ?, 1)
                """,
                [
                    artifact_id,
                    artifact_id,
                    f"https://www.sec.gov/{artifact_id}.zip",
                    datetime(2026, 8, 28, tzinfo=UTC),
                    artifact_id,
                    f"/{artifact_id}.zip",
                    f"/{artifact_id}.manifest.json",
                ],
            )
        connection.execute(
            """
            INSERT INTO canonicalization_runs (
                artifact_id, transformation_version, status, started_at, completed_at, quarantined_rows
            ) VALUES ('old', ?, 'published', ?, ?, 0)
            """,
            [
                TRANSFORMATION_VERSION,
                datetime(2026, 8, 28, tzinfo=UTC),
                datetime(2026, 8, 28, tzinfo=UTC),
            ],
        )

    assert select_uncanonicalized_artifacts(database, ("old", "new")) == ("new",)
