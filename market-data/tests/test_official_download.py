from datetime import UTC, date, datetime
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import httpx
import pytest

from riascout_adv_data.official_download import ArtifactValidationError, OfficialDownloader
from riascout_adv_data.official_sources import OfficialSourceSpec
from riascout_adv_data.storage import ArtifactStore


def _valid_zip() -> bytes:
    stream = BytesIO()
    with ZipFile(stream, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("IA_ADV_Base_A_sample.csv", "FilingID,1E1\nF-1,361\n")
    return stream.getvalue()


HISTORICAL_SPEC = OfficialSourceSpec(
    key="adv-part1-part1",
    url="https://www.sec.gov/files/adv-part1.zip",
    dataset_kind="adv_part1",
    observation_date=date(2024, 12, 31),
    snapshot_status="historical_filings",
    expected_container="zip",
)

IAPD_FILING_SPEC = OfficialSourceSpec(
    key="adv-filing-data-2025-01",
    url=("https://reports.adviserinfo.sec.gov/reports/foia/advFilingData/2025/ADV_Filing_Data_20250101_20250131.zip"),
    dataset_kind="adv_part1",
    observation_date=date(2025, 1, 31),
    snapshot_status="historical_filings",
    expected_container="zip",
)


def test_downloader_sends_identity_streams_and_validates_zip(tmp_path: Path) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.headers.get("user-agent") != "Asset research contact@example.com":
            return httpx.Response(403, request=request)
        return httpx.Response(
            200,
            headers={"content-type": "application/zip"},
            content=_valid_zip(),
            request=request,
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        artifact = OfficialDownloader(
            client=client,
            store=ArtifactStore(tmp_path),
            user_agent="Asset research contact@example.com",
            sleep=lambda _: None,
        ).download(HISTORICAL_SPEC, datetime(2026, 8, 26, tzinfo=UTC))

    assert artifact.payload_path.read_bytes() == _valid_zip()


def test_downloader_rejects_sec_html_error_page(tmp_path: Path) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            text="Access denied",
            request=request,
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        downloader = OfficialDownloader(
            client=client,
            store=ArtifactStore(tmp_path),
            user_agent="Asset research contact@example.com",
            sleep=lambda _: None,
        )
        with pytest.raises(ArtifactValidationError, match="HTML"):
            downloader.download(HISTORICAL_SPEC, datetime(2026, 8, 26, tzinfo=UTC))


def test_downloader_retries_transient_status_only(tmp_path: Path) -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            return httpx.Response(503, request=request)
        return httpx.Response(200, content=_valid_zip(), request=request)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        OfficialDownloader(
            client=client,
            store=ArtifactStore(tmp_path),
            user_agent="Asset research contact@example.com",
            sleep=lambda _: None,
        ).download(HISTORICAL_SPEC, datetime(2026, 8, 26, tzinfo=UTC))

    assert attempts == 3


def test_downloader_does_not_retry_access_denied(tmp_path: Path) -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(403, request=request)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        downloader = OfficialDownloader(
            client=client,
            store=ArtifactStore(tmp_path),
            user_agent="Asset research contact@example.com",
            sleep=lambda _: None,
        )
        with pytest.raises(httpx.HTTPStatusError):
            downloader.download(HISTORICAL_SPEC, datetime(2026, 8, 26, tzinfo=UTC))

    assert attempts == 1


def test_downloader_accepts_official_iapd_reports_host(tmp_path: Path) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "application/zip"},
            content=_valid_zip(),
            request=request,
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        artifact = OfficialDownloader(
            client=client,
            store=ArtifactStore(tmp_path),
            user_agent="Asset research contact@example.com",
            sleep=lambda _: None,
        ).download(IAPD_FILING_SPEC, datetime(2026, 8, 28, tzinfo=UTC))

    assert artifact.payload_path.read_bytes() == _valid_zip()
