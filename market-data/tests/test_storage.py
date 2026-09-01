import json
import stat
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from riascout_adv_data.storage import ArtifactStore


def _valid_zip() -> bytes:
    stream = BytesIO()
    with ZipFile(stream, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("IA_ADV_Base_A_sample.csv", "FilingID,1E1\nF-1,361\n")
    return stream.getvalue()


def test_artifact_store_writes_raw_payload_and_secret_safe_manifest(tmp_path: Path) -> None:
    store = ArtifactStore(tmp_path, secrets=["super-secret"])
    retrieved_at = datetime(2026, 8, 26, 9, 30, tzinfo=UTC)

    artifact = store.write_json(
        source="sec_api",
        operation="firm-current",
        payload={"total": {"value": 1}, "filings": [{"id": 361}]},
        request_metadata={
            "url": "https://api.sec-api.io/form-adv/firm",
            "headers": {"Authorization": "super-secret"},
            "diagnostic": "credential super-secret must be redacted",
        },
        retrieved_at=retrieved_at,
    )

    assert artifact.payload_path.name == "firm-current.json"
    assert artifact.manifest_path.name == "firm-current.manifest.json"
    assert artifact.payload_path.parent == tmp_path / "raw" / "sec_api" / "2026-08-26"
    assert len(artifact.sha256) == 64
    assert json.loads(artifact.payload_path.read_text())["filings"][0]["id"] == 361
    manifest_text = artifact.manifest_path.read_text()
    assert "super-secret" not in manifest_text
    assert "[REDACTED]" in manifest_text


def test_artifact_store_refuses_to_overwrite_existing_artifact(tmp_path: Path) -> None:
    store = ArtifactStore(tmp_path)
    retrieved_at = datetime(2026, 8, 26, tzinfo=UTC)
    arguments = {
        "source": "sec_api",
        "operation": "firm-current",
        "payload": {"filings": []},
        "request_metadata": {"url": "https://api.sec-api.io/form-adv/firm"},
        "retrieved_at": retrieved_at,
    }

    store.write_json(**arguments)

    try:
        store.write_json(**arguments)
    except FileExistsError:
        pass
    else:
        raise AssertionError("an immutable artifact must not be overwritten")


def test_artifact_store_preserves_vendor_file_bytes_immutably(tmp_path: Path) -> None:
    source = tmp_path / "vendor-sample.jsonl"
    source.write_bytes(b'{"crd": 361}\n')
    store = ArtifactStore(tmp_path / "evidence")

    artifact = store.copy_file(
        source="vendor_sample",
        operation="sample-run-0001",
        input_path=source,
        retrieved_at=datetime(2026, 8, 26, tzinfo=UTC),
    )

    assert artifact.payload_path.name == "sample-run-0001.jsonl"
    assert artifact.payload_path.read_bytes() == source.read_bytes()
    assert stat.S_IMODE(artifact.payload_path.stat().st_mode) == 0o444
    assert json.loads(artifact.manifest_path.read_text())["request"]["original_name"] == source.name


def test_promote_download_names_file_by_digest_and_is_idempotent(tmp_path: Path) -> None:
    pending = tmp_path / "source.zip.part"
    pending.write_bytes(_valid_zip())
    store = ArtifactStore(tmp_path / "data")
    retrieved_at = datetime(2026, 8, 26, tzinfo=UTC)

    first = store.promote_download(
        source="sec_official",
        operation="ria-2025-12",
        pending_path=pending,
        suffix=".zip",
        request_metadata={"url": "https://www.sec.gov/files/ria.zip"},
        retrieved_at=retrieved_at,
    )
    duplicate = tmp_path / "duplicate.zip.part"
    duplicate.write_bytes(_valid_zip())
    second = store.promote_download(
        source="sec_official",
        operation="ria-2025-12",
        pending_path=duplicate,
        suffix=".zip",
        request_metadata={"url": "https://www.sec.gov/files/ria.zip"},
        retrieved_at=retrieved_at,
    )

    assert first == second
    assert first.sha256 in first.payload_path.name
    assert not duplicate.exists()
    assert stat.S_IMODE(first.payload_path.stat().st_mode) == 0o444


def test_content_addressed_json_can_be_verified_without_modification(tmp_path: Path) -> None:
    store = ArtifactStore(tmp_path)
    artifact = store.write_content_addressed_json(
        source="sec_api_individuals",
        operation="collection-test-range-1-100-page-00001",
        payload={"total": {"value": 1, "relation": "eq"}, "filings": [{"Info": {"indvlPK": 100}}]},
        request_metadata={"url": "https://api.sec-api.io/form-adv/individual"},
        retrieved_at=datetime(2026, 8, 26, tzinfo=UTC),
    )

    assert artifact.sha256 in artifact.payload_path.name
    assert store.verify_json_artifact(artifact.payload_path) == artifact
    assert stat.S_IMODE(artifact.payload_path.stat().st_mode) == 0o444


def test_json_verifier_rejects_changed_payload(tmp_path: Path) -> None:
    store = ArtifactStore(tmp_path)
    artifact = store.write_content_addressed_json(
        source="sec_api_individuals",
        operation="collection-test-range-1-100-page-00001",
        payload={"total": {"value": 0, "relation": "eq"}, "filings": []},
        request_metadata={"url": "https://api.sec-api.io/form-adv/individual"},
        retrieved_at=datetime(2026, 8, 26, tzinfo=UTC),
    )
    artifact.payload_path.chmod(0o644)
    artifact.payload_path.write_text('{"filings": [{"Info": {"indvlPK": 99}}]}\n')

    try:
        store.verify_json_artifact(artifact.payload_path)
    except ValueError as error:
        assert "digest" in str(error)
    else:
        raise AssertionError("changed immutable JSON must not verify")
