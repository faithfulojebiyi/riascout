"""Immutable raw-artifact storage."""

import hashlib
import json
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class StoredArtifact:
    """Paths and digest for a persisted source response."""

    payload_path: Path
    manifest_path: Path
    sha256: str


class ArtifactStore:
    """Write immutable source responses with provenance manifests."""

    def __init__(self, root: Path, *, secrets: list[str] | None = None) -> None:
        self._root = root
        self._secrets = [secret for secret in secrets or [] if secret]

    def write_json(
        self,
        *,
        source: str,
        operation: str,
        payload: dict[str, Any],
        request_metadata: dict[str, Any],
        retrieved_at: datetime,
    ) -> StoredArtifact:
        """Persist JSON payload and a credential-safe manifest without overwrites."""
        payload_bytes = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
        return self._write_artifact(
            source=source,
            operation=operation,
            payload_bytes=payload_bytes,
            suffix=".json",
            request_metadata=request_metadata,
            retrieved_at=retrieved_at,
        )

    def write_content_addressed_json(
        self,
        *,
        source: str,
        operation: str,
        payload: dict[str, Any],
        request_metadata: dict[str, Any],
        retrieved_at: datetime,
    ) -> StoredArtifact:
        """Persist JSON under a digest-bearing immutable filename."""
        payload_bytes = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
        digest = hashlib.sha256(payload_bytes).hexdigest()
        destination = self._root / "raw" / source / retrieved_at.date().isoformat()
        destination.mkdir(parents=True, exist_ok=True)
        payload_path = destination / f"{operation}-{digest}.json"
        manifest_path = destination / f"{operation}-{digest}.manifest.json"

        if payload_path.exists() or manifest_path.exists():
            return self.verify_json_artifact(payload_path)

        manifest = {
            "source": source,
            "operation": operation,
            "retrieved_at": retrieved_at.isoformat(),
            "sha256": digest,
            "bytes": len(payload_bytes),
            "request": self._redact(request_metadata),
        }
        manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")
        self._write_exclusive(payload_path, payload_bytes)
        try:
            self._write_exclusive(manifest_path, manifest_bytes)
        except Exception:
            payload_path.unlink(missing_ok=True)
            raise
        return StoredArtifact(payload_path=payload_path, manifest_path=manifest_path, sha256=digest)

    def verify_json_artifact(self, payload_path: Path) -> StoredArtifact:
        """Verify an existing JSON artifact and paired manifest without modifying either file."""
        if not payload_path.is_file():
            raise FileNotFoundError(payload_path)
        manifest_path = payload_path.with_name(f"{payload_path.stem}.manifest.json")
        if not manifest_path.is_file():
            raise FileNotFoundError(manifest_path)

        payload_bytes = payload_path.read_bytes()
        digest = hashlib.sha256(payload_bytes).hexdigest()
        try:
            payload = json.loads(payload_bytes)
            manifest = json.loads(manifest_path.read_text())
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError(f"invalid JSON artifact at {payload_path}") from error
        if not isinstance(payload, dict) or not isinstance(manifest, dict):
            raise ValueError(f"JSON artifact and manifest must be objects at {payload_path}")
        if manifest.get("sha256") != digest:
            raise ValueError(f"JSON artifact digest mismatch at {payload_path}")
        if manifest.get("bytes") != len(payload_bytes):
            raise ValueError(f"JSON artifact byte-count mismatch at {payload_path}")
        return StoredArtifact(payload_path=payload_path, manifest_path=manifest_path, sha256=digest)

    def find_content_addressed_json(
        self,
        *,
        source: str,
        operation: str,
        retrieved_at: datetime,
    ) -> tuple[Path, ...]:
        """List immutable payloads for one logical operation on a collection date."""
        directory = self._root / "raw" / source / retrieved_at.date().isoformat()
        if not directory.is_dir():
            return ()
        return tuple(
            sorted(path for path in directory.glob(f"{operation}-*.json") if not path.name.endswith(".manifest.json"))
        )

    def copy_file(
        self,
        *,
        source: str,
        operation: str,
        input_path: Path,
        retrieved_at: datetime,
    ) -> StoredArtifact:
        """Preserve an input file byte-for-byte with an immutable manifest."""
        if not input_path.is_file():
            raise FileNotFoundError(input_path)
        suffix = "".join(input_path.suffixes) or ".bin"
        return self._write_artifact(
            source=source,
            operation=operation,
            payload_bytes=input_path.read_bytes(),
            suffix=suffix,
            request_metadata={
                "original_name": input_path.name,
                "original_path": str(input_path.resolve()),
            },
            retrieved_at=retrieved_at,
        )

    def create_pending_path(self, *, suffix: str = ".part") -> Path:
        """Create an empty private staging file for a streamed download."""
        staging_directory = self._root / ".staging"
        staging_directory.mkdir(parents=True, exist_ok=True)
        descriptor, raw_path = tempfile.mkstemp(prefix="download-", suffix=suffix, dir=staging_directory)
        os.close(descriptor)
        return Path(raw_path)

    def promote_download(
        self,
        *,
        source: str,
        operation: str,
        pending_path: Path,
        suffix: str,
        request_metadata: dict[str, Any],
        retrieved_at: datetime,
    ) -> StoredArtifact:
        """Atomically promote a streamed file into digest-addressed immutable storage."""
        if not pending_path.is_file():
            raise FileNotFoundError(pending_path)
        digest, byte_count = self._digest_file(pending_path)
        destination = self._root / "raw" / source / retrieved_at.date().isoformat()
        destination.mkdir(parents=True, exist_ok=True)
        payload_path = destination / f"{operation}-{digest}{suffix}"
        manifest_path = destination / f"{operation}-{digest}.manifest.json"

        if payload_path.exists() or manifest_path.exists():
            if not payload_path.is_file() or not manifest_path.is_file():
                raise FileExistsError(f"Incomplete existing artifact at {payload_path}")
            existing_digest, _ = self._digest_file(payload_path)
            manifest = json.loads(manifest_path.read_text())
            if existing_digest != digest or manifest.get("sha256") != digest:
                raise FileExistsError(f"Existing artifact digest mismatch at {payload_path}")
            pending_path.unlink()
            return StoredArtifact(payload_path=payload_path, manifest_path=manifest_path, sha256=digest)

        manifest = {
            "source": source,
            "operation": operation,
            "retrieved_at": retrieved_at.isoformat(),
            "sha256": digest,
            "bytes": byte_count,
            "request": self._redact(request_metadata),
        }
        manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")
        os.replace(pending_path, payload_path)
        payload_path.chmod(0o444)
        try:
            self._write_exclusive(manifest_path, manifest_bytes)
        except Exception:
            payload_path.unlink(missing_ok=True)
            raise
        return StoredArtifact(payload_path=payload_path, manifest_path=manifest_path, sha256=digest)

    def _write_artifact(
        self,
        *,
        source: str,
        operation: str,
        payload_bytes: bytes,
        suffix: str,
        request_metadata: dict[str, Any],
        retrieved_at: datetime,
    ) -> StoredArtifact:
        destination = self._root / "raw" / source / retrieved_at.date().isoformat()
        destination.mkdir(parents=True, exist_ok=True)
        payload_path = destination / f"{operation}{suffix}"
        manifest_path = destination / f"{operation}.manifest.json"

        digest = hashlib.sha256(payload_bytes).hexdigest()
        manifest = {
            "source": source,
            "operation": operation,
            "retrieved_at": retrieved_at.isoformat(),
            "sha256": digest,
            "bytes": len(payload_bytes),
            "request": self._redact(request_metadata),
        }
        manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")

        self._write_exclusive(payload_path, payload_bytes)
        try:
            self._write_exclusive(manifest_path, manifest_bytes)
        except Exception:
            payload_path.unlink(missing_ok=True)
            raise
        return StoredArtifact(payload_path=payload_path, manifest_path=manifest_path, sha256=digest)

    def _redact(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: "[REDACTED]"
                if key.lower() in {"authorization", "token", "api_key", "apikey"}
                else self._redact(item)
                for key, item in value.items()
            }
        if isinstance(value, list):
            return [self._redact(item) for item in value]
        if isinstance(value, str):
            result = value
            for secret in self._secrets:
                result = result.replace(secret, "[REDACTED]")
            return result
        return value

    @staticmethod
    def _write_exclusive(path: Path, content: bytes) -> None:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o444)
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(content)

    @staticmethod
    def _digest_file(path: Path) -> tuple[str, int]:
        digest = hashlib.sha256()
        byte_count = 0
        with path.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
                byte_count += len(chunk)
        return digest.hexdigest(), byte_count


__all__ = ["ArtifactStore", "StoredArtifact"]
