"""Streaming downloads for official SEC Form ADV artifacts."""

import time
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
from zipfile import BadZipFile, ZipFile

import httpx

from riascout_adv_data.official_sources import OfficialSourceSpec
from riascout_adv_data.storage import ArtifactStore, StoredArtifact

TRANSIENT_STATUS_CODES = frozenset({429, 500, 502, 503, 504})


class ArtifactValidationError(ValueError):
    """Raised when an HTTP response is not the expected SEC data artifact."""


class OfficialDownloader:
    """Download and validate official SEC artifacts without buffering them in memory."""

    def __init__(
        self,
        *,
        client: httpx.Client,
        store: ArtifactStore,
        user_agent: str,
        sleep: Callable[[float], None] = time.sleep,
        max_attempts: int = 3,
    ) -> None:
        """Initialize a downloader with an identified HTTP client and artifact store."""
        if not user_agent.strip():
            raise ValueError("user_agent must not be empty")
        if max_attempts < 1:
            raise ValueError("max_attempts must be at least one")
        self._client = client
        self._store = store
        self._user_agent = user_agent
        self._sleep = sleep
        self._max_attempts = max_attempts

    def download(self, spec: OfficialSourceSpec, retrieved_at: datetime) -> StoredArtifact:
        """Download one source with bounded retries and archive validation."""
        for attempt in range(1, self._max_attempts + 1):
            try:
                result = self._download_once(spec, retrieved_at)
            except httpx.TransportError:
                if attempt == self._max_attempts:
                    raise
            else:
                if isinstance(result, StoredArtifact):
                    return result
                if attempt == self._max_attempts:
                    result.raise_for_status()
            self._sleep(0.25 * attempt)
        raise RuntimeError("unreachable retry state")

    def _download_once(
        self,
        spec: OfficialSourceSpec,
        retrieved_at: datetime,
    ) -> StoredArtifact | httpx.Response:
        with self._client.stream("GET", spec.url, headers={"User-Agent": self._user_agent}) as response:
            if response.status_code in TRANSIENT_STATUS_CODES:
                return response
            response.raise_for_status()
            if urlparse(str(response.url)).hostname not in {
                "sec.gov",
                "www.sec.gov",
                "reports.adviserinfo.sec.gov",
            }:
                raise ArtifactValidationError(f"SEC download redirected to an untrusted host: {response.url}")
            content_type = response.headers.get("content-type", "").lower()
            if "html" in content_type:
                raise ArtifactValidationError("SEC download returned an HTML response instead of a data artifact")

            suffix = ".zip" if spec.expected_container == "zip" else ".xlsx"
            pending_path = self._store.create_pending_path()
            try:
                with pending_path.open("wb") as stream:
                    for chunk in response.iter_bytes():
                        stream.write(chunk)
                members = _validate_archive(pending_path, expected_container=spec.expected_container)
                return self._store.promote_download(
                    source="sec_official",
                    operation=spec.key,
                    pending_path=pending_path,
                    suffix=suffix,
                    request_metadata={
                        "method": "GET",
                        "url": spec.url,
                        "final_url": str(response.url),
                        "status_code": response.status_code,
                        "content_type": content_type,
                        "archive_members": members,
                    },
                    retrieved_at=retrieved_at,
                )
            except Exception:
                pending_path.unlink(missing_ok=True)
                raise


def _validate_archive(path: Path, *, expected_container: str) -> list[str]:
    with path.open("rb") as stream:
        magic = stream.read(2)
    if magic != b"PK":
        raise ArtifactValidationError("Downloaded artifact does not have ZIP/XLSX magic bytes")
    try:
        with ZipFile(path) as archive:
            corrupt_member = archive.testzip()
            if corrupt_member is not None:
                raise ArtifactValidationError(f"Downloaded ZIP contains a corrupt member: {corrupt_member}")
            members = archive.namelist()
    except BadZipFile as error:
        raise ArtifactValidationError("Downloaded artifact is not a valid ZIP/XLSX archive") from error
    if expected_container == "xlsx":
        required = {"[Content_Types].xml", "xl/workbook.xml"}
        if not required.issubset(members):
            raise ArtifactValidationError("Downloaded XLSX is missing required workbook members")
    elif not any(name.lower().endswith((".csv", ".xlsx")) for name in members):
        raise ArtifactValidationError("Downloaded ZIP contains no CSV or XLSX data member")
    return members


__all__ = ["ArtifactValidationError", "OfficialDownloader"]
