import json
from datetime import UTC, datetime
from pathlib import Path

import duckdb
import pytest
from test_individual_validation import COLLECTION_ID, _valid_database

from riascout_adv_data.normalized_export import NormalizedExporter

GENERATED_AT = datetime(2026, 8, 26, 13, tzinfo=UTC)


def test_export_writes_queryable_partitioned_parquet_and_manifest(tmp_path: Path) -> None:
    database = _valid_database(tmp_path)

    release = NormalizedExporter(database).export(
        collection_id=COLLECTION_ID,
        years=[2026],
        release_id="normalized-test",
        output_root=tmp_path / "published",
        generated_at=GENERATED_AT,
    )

    assert release.path.name == "normalized-test"
    manifest = json.loads((release.path / "manifest.json").read_text())
    assert manifest["distribution_scope"] == "internal"
    assert manifest["collection_id"] == COLLECTION_ID
    assert manifest["population_coverage"]["2026"] == "available_current_observation"
    assert any("may lag official IAPD" in limitation for limitation in manifest["known_limitations"])
    with duckdb.connect() as connection:
        assert connection.execute(
            "SELECT count(*) FROM read_parquet(?)",
            [str(release.path / "individuals.parquet")],
        ).fetchone() == (1,)
        assert connection.execute(
            "SELECT count(*) FROM read_parquet(?)",
            [str(release.path / "individual_year_snapshots" / "snapshot_year=2026" / "part-00000.parquet")],
        ).fetchone() == (1,)


def test_failed_export_leaves_previous_release_untouched(tmp_path: Path) -> None:
    database = _valid_database(tmp_path)
    output_root = tmp_path / "published"
    previous = output_root / "normalized-previous" / "marker.txt"
    previous.parent.mkdir(parents=True)
    previous.write_text("previous valid release\n")
    exporter = NormalizedExporter(database, fail_after_file_count=1)

    with pytest.raises(RuntimeError, match="simulated export failure"):
        exporter.export(
            collection_id=COLLECTION_ID,
            years=[2026],
            release_id="normalized-test",
            output_root=output_root,
            generated_at=GENERATED_AT,
        )

    assert previous.read_text() == "previous valid release\n"
    assert not (output_root / "normalized-test").exists()
    assert not (output_root / ".staging" / "normalized-test").exists()
