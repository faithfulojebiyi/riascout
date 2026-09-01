"""DuckDB persistence boundary for official Form ADV source data."""

from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime
from importlib import resources
from pathlib import Path

import duckdb
from duckdb import DuckDBPyConnection


@dataclass(frozen=True)
class OfficialArtifactRecord:
    """Database metadata for one immutable official source artifact."""

    artifact_id: str
    dataset_key: str
    dataset_kind: str
    source_url: str
    observation_date: date | None
    retrieved_at: datetime
    sha256: str
    payload_path: str
    manifest_path: str
    byte_count: int


class OfficialDatabase:
    """Install and transact against official-data tables in the project DuckDB file."""

    def __init__(self, path: Path) -> None:
        """Store the database path without opening a long-lived connection."""
        self._path = path
        path.parent.mkdir(parents=True, exist_ok=True)

    def install_schema(self) -> None:
        """Install the idempotent official-data schema alongside existing feasibility tables."""
        schema = resources.files("riascout_adv_data.sql").joinpath("official_schema.sql").read_text()
        with self.connection() as connection:
            connection.execute(schema)

    @contextmanager
    def connection(self) -> Iterator[DuckDBPyConnection]:
        """Yield a short-lived DuckDB connection and always close it."""
        try:
            connection = duckdb.connect(str(self._path))
        except duckdb.IOException as error:
            message = str(error)
            is_lock_error = "Conflicting lock" in message
            is_permission_error = "Cannot open file" in message and "Operation not permitted" in message
            if not (is_lock_error or is_permission_error):
                raise
            raise RuntimeError(
                f"Cannot open {self._path}. Close Cursor or another process holding {self._path}, then retry."
            ) from error
        try:
            yield connection
        finally:
            connection.close()

    @contextmanager
    def transaction(self) -> Iterator[DuckDBPyConnection]:
        """Yield a connection whose work commits atomically or rolls back on error."""
        with self.connection() as connection:
            connection.execute("BEGIN")
            try:
                yield connection
            except Exception:
                connection.execute("ROLLBACK")
                raise
            else:
                connection.execute("COMMIT")

    def table_names(self) -> set[str]:
        """Return table names in the main DuckDB catalog."""
        with self.connection() as connection:
            rows = connection.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
            ).fetchall()
        return {str(row[0]) for row in rows}

    def record_artifact(self, record: OfficialArtifactRecord) -> None:
        """Record one artifact idempotently, rejecting conflicting reuse of its identifier."""
        self.record_artifacts((record,))

    def record_artifacts(self, records: Iterable[OfficialArtifactRecord]) -> None:
        """Record a batch idempotently using one database transaction."""
        with self.transaction() as connection:
            for record in records:
                self._record_artifact(connection, record)

    @staticmethod
    def _record_artifact(connection: DuckDBPyConnection, record: OfficialArtifactRecord) -> None:
        values = (
            record.artifact_id,
            record.dataset_key,
            record.dataset_kind,
            record.source_url,
            record.observation_date,
            record.retrieved_at,
            record.sha256,
            record.payload_path,
            record.manifest_path,
            record.byte_count,
        )
        existing = connection.execute(
            "SELECT dataset_key, sha256, payload_path FROM source_artifacts WHERE artifact_id = ?",
            [record.artifact_id],
        ).fetchone()
        if existing is not None:
            expected = (record.dataset_key, record.sha256, record.payload_path)
            if tuple(existing) != expected:
                raise ValueError(f"Artifact ID {record.artifact_id!r} already refers to different source data")
            return
        connection.execute(
            """
            INSERT INTO source_artifacts (
                artifact_id, dataset_key, dataset_kind, source_url, observation_date,
                retrieved_at, sha256, payload_path, manifest_path, byte_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            values,
        )


__all__ = ["OfficialArtifactRecord", "OfficialDatabase"]
