"""Atomic versioned Parquet releases for normalized firm and individual data."""

import hashlib
import json
import os
import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from duckdb import DuckDBPyConnection

from riascout_adv_data.official_db import OfficialDatabase

_RELEASE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


@dataclass(frozen=True)
class NormalizedRelease:
    """Path and verified manifest for an atomically promoted release."""

    release_id: str
    path: Path
    manifest: dict[str, Any]


class NormalizedExporter:
    """Export a collection without exposing raw payloads or credentials."""

    def __init__(
        self,
        database: OfficialDatabase,
        *,
        fail_after_file_count: int | None = None,
    ) -> None:
        if fail_after_file_count is not None and fail_after_file_count < 1:
            raise ValueError("fail_after_file_count must be positive")
        self._database = database
        self._fail_after_file_count = fail_after_file_count

    def export(
        self,
        *,
        collection_id: str,
        years: range | list[int] | tuple[int, ...],
        release_id: str,
        output_root: Path,
        generated_at: datetime,
    ) -> NormalizedRelease:
        """Write, verify, and atomically promote one internal Parquet release."""
        if not _RELEASE_ID_PATTERN.fullmatch(release_id):
            raise ValueError("release_id contains unsafe characters")
        if generated_at.tzinfo is None or generated_at.utcoffset() is None:
            raise ValueError("generated_at must include a timezone")
        requested_years = tuple(sorted(set(years)))
        if not requested_years:
            raise ValueError("years must not be empty")
        final_path = output_root / release_id
        staging_path = output_root / ".staging" / release_id
        if final_path.exists():
            raise FileExistsError(f"normalized release already exists: {final_path}")
        if staging_path.exists():
            raise FileExistsError(f"normalized staging release already exists: {staging_path}")
        staging_path.mkdir(parents=True)

        try:
            with self._database.connection() as connection:
                run = connection.execute(
                    """
                    SELECT status, CAST(collection_started_at AS VARCHAR),
                           CAST(collection_completed_at AS VARCHAR), transformation_version
                    FROM individual_collection_runs WHERE collection_id = ?
                    """,
                    [collection_id],
                ).fetchone()
                if run is None or run[0] != "published":
                    raise ValueError(f"individual collection {collection_id!r} is not published")
                files: list[dict[str, Any]] = []
                file_count = 0
                for relative_path, query, parameters in _base_exports(collection_id):
                    file_count = self._write_parquet(
                        connection,
                        staging_path,
                        relative_path,
                        query,
                        parameters,
                        files,
                        file_count,
                    )
                for year in requested_years:
                    for relative_path, query, parameters in _year_exports(collection_id, year):
                        file_count = self._write_parquet(
                            connection,
                            staging_path,
                            relative_path,
                            query,
                            parameters,
                            files,
                            file_count,
                        )

                population_coverage = {
                    str(year): _population_coverage(connection, collection_id, year) for year in requested_years
                }
                source_artifact_count = _scalar_count(
                    connection,
                    """
                    SELECT count(DISTINCT artifact_id) FROM individual_observations
                    WHERE collection_id = ?
                    """,
                    [collection_id],
                )
                manifest: dict[str, Any] = {
                    "release_version": "normalized-release-v1",
                    "schema_version": "individual-normalized-v1",
                    "release_id": release_id,
                    "collection_id": collection_id,
                    "collection_started_at": str(run[1]),
                    "collection_completed_at": str(run[2]),
                    "transformation_version": str(run[3]),
                    "years": list(requested_years),
                    "population_coverage": population_coverage,
                    "source_artifact_count": source_artifact_count,
                    "files": files,
                    "known_limitations": [
                        "2020-2025 individual populations are partial current-index backcasts.",
                        "2026 is a provisional observation as of the collection completion date.",
                        "SEC-API current individual records may lag official IAPD; a five-record official "
                        "check on 2026-08-28 found one stale current-registration record.",
                        "Employment-history organizations are not name-matched to firms.",
                    ],
                    "distribution_scope": "internal",
                    "generated_at": generated_at.isoformat(),
                }
                (staging_path / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
                _verify_files(connection, staging_path, files)
            final_path.parent.mkdir(parents=True, exist_ok=True)
            os.replace(staging_path, final_path)
        except Exception:
            shutil.rmtree(staging_path, ignore_errors=True)
            raise
        return NormalizedRelease(release_id=release_id, path=final_path, manifest=manifest)

    def _write_parquet(
        self,
        connection: DuckDBPyConnection,
        staging_path: Path,
        relative_path: Path,
        query: str,
        parameters: list[object],
        files: list[dict[str, Any]],
        file_count: int,
    ) -> int:
        destination = staging_path / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination_sql = str(destination).replace("'", "''")
        connection.execute(
            f"COPY ({query}) TO '{destination_sql}' (FORMAT PARQUET, COMPRESSION ZSTD)",
            parameters,
        )
        row_count = _scalar_count(connection, "SELECT count(*) FROM read_parquet(?)", [str(destination)])
        files.append(
            {
                "path": relative_path.as_posix(),
                "row_count": row_count,
                "sha256": _sha256(destination),
                "bytes": destination.stat().st_size,
            }
        )
        completed_count = file_count + 1
        if self._fail_after_file_count == completed_count:
            raise RuntimeError("simulated export failure")
        return completed_count


def _base_exports(collection_id: str) -> list[tuple[Path, str, list[object]]]:
    exports: list[tuple[Path, str, list[object]]] = [
        (Path("firms.parquet"), "SELECT * FROM firms ORDER BY firm_crd", []),
        (
            Path("firm_metrics.parquet"),
            "SELECT * FROM firm_metrics ORDER BY filing_id",
            [],
        ),
        (
            Path("filing_client_types.parquet"),
            "SELECT * FROM filing_client_types ORDER BY filing_id, client_type",
            [],
        ),
        (
            Path("filing_reported_client_totals.parquet"),
            "SELECT * FROM filing_reported_client_totals ORDER BY filing_id",
            [],
        ),
        (
            Path("individuals.parquet"),
            """
            SELECT identities.individual_crd, identities.first_seen_at, identities.last_seen_at,
                   names.first_name, names.middle_name, names.last_name, names.suffix_name,
                   names.active_agent_registration
            FROM individuals identities
            JOIN individual_names names USING (individual_crd)
            WHERE names.collection_id = ? ORDER BY identities.individual_crd
            """,
            [collection_id],
        ),
    ]
    for filename, table in (
        ("individual_registration_intervals.parquet", "individual_registration_intervals"),
        ("individual_registration_locations.parquet", "individual_registration_locations"),
        ("individual_employment_intervals.parquet", "individual_employment_intervals"),
        ("individual_exams.parquet", "individual_exams"),
        ("individual_designations.parquet", "individual_designations"),
        ("individual_disclosure_flags.parquet", "individual_disclosure_flags"),
    ):
        exports.append((Path(filename), f"SELECT * FROM {table} WHERE collection_id = ?", [collection_id]))
    return exports


def _year_exports(collection_id: str, year: int) -> list[tuple[Path, str, list[object]]]:
    return [
        (
            Path("firm_year_snapshots") / f"snapshot_year={year}" / "part-00000.parquet",
            "SELECT * FROM firm_snapshots WHERE snapshot_year = ? ORDER BY firm_crd",
            [year],
        ),
        (
            Path("individual_year_snapshots") / f"snapshot_year={year}" / "part-00000.parquet",
            """
            SELECT * FROM individual_year_snapshots
            WHERE collection_id = ? AND snapshot_year = ? ORDER BY individual_crd
            """,
            [collection_id, year],
        ),
        (
            Path("individual_firm_year") / f"snapshot_year={year}" / "part-00000.parquet",
            """
            SELECT * FROM individual_firm_year
            WHERE collection_id = ? AND snapshot_year = ? ORDER BY individual_crd, firm_crd
            """,
            [collection_id, year],
        ),
    ]


def _population_coverage(connection: DuckDBPyConnection, collection_id: str, year: int) -> str:
    row = connection.execute(
        """
        SELECT coverage_status FROM individual_snapshot_coverage
        WHERE collection_id = ? AND snapshot_year = ? AND field_group = 'population'
        """,
        [collection_id, year],
    ).fetchone()
    return str(row[0]) if row else "unavailable"


def _verify_files(connection: DuckDBPyConnection, staging_path: Path, files: list[dict[str, Any]]) -> None:
    for item in files:
        path = staging_path / str(item["path"])
        if _sha256(path) != item["sha256"]:
            raise RuntimeError(f"Parquet digest verification failed for {item['path']}")
        row_count = _scalar_count(connection, "SELECT count(*) FROM read_parquet(?)", [str(path)])
        if row_count != item["row_count"]:
            raise RuntimeError(f"Parquet row-count verification failed for {item['path']}")


def _scalar_count(connection: DuckDBPyConnection, query: str, parameters: list[object]) -> int:
    row = connection.execute(query, parameters).fetchone()
    return int(row[0]) if row else 0


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


__all__ = ["NormalizedExporter", "NormalizedRelease"]
