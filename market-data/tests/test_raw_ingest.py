from datetime import UTC, date, datetime
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from openpyxl import Workbook

from riascout_adv_data.official_db import OfficialArtifactRecord, OfficialDatabase
from riascout_adv_data.raw_ingest import RawIngestError, RawIngestor, quote_ident


def _record_artifact(database: OfficialDatabase, path: Path, *, artifact_id: str, dataset_kind: str) -> None:
    database.record_artifact(
        OfficialArtifactRecord(
            artifact_id=artifact_id,
            dataset_key=artifact_id,
            dataset_kind=dataset_kind,
            source_url=f"https://www.sec.gov/files/{path.name}",
            observation_date=date(2025, 12, 31),
            retrieved_at=datetime(2026, 8, 26, tzinfo=UTC),
            sha256=artifact_id.rsplit(":", 1)[-1],
            payload_path=str(path),
            manifest_path=f"{path}.manifest.json",
            byte_count=path.stat().st_size,
        )
    )


def _csv_zip(path: Path, member_name: str, content: str) -> None:
    with ZipFile(path, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr(member_name, content)


def _xlsx_bytes(rows: list[list[object]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    for row in rows:
        sheet.append(row)
    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()


def test_raw_ingest_preserves_source_text_and_tracks_member(tmp_path: Path) -> None:
    path = tmp_path / "history.zip"
    _csv_zip(
        path,
        "IA_ADV_Base_A_sample.csv",
        'FilingID,1E1,1F1-Country,5F2c\nF-2020-1,361,UNITED STATES,"1,234.50"\n',
    )
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    _record_artifact(database, path, artifact_id="history:abc", dataset_kind="adv_part1")

    refs = RawIngestor(database).ingest_artifact("history:abc")

    base = next(ref for ref in refs if ref.member_name.startswith("IA_ADV_Base_A"))
    with database.connection() as connection:
        row = connection.execute(
            f'SELECT "FilingID", "1E1", "1F1-Country", "5F2c", _source_row_number FROM {quote_ident(base.table_name)}'
        ).fetchone()
    assert row == ("F-2020-1", "361", "UNITED STATES", "1,234.50", 1)
    assert base.row_count == 1


def test_raw_ingest_preserves_latin1_sec_source_text(tmp_path: Path) -> None:
    path = tmp_path / "history-latin1.zip"
    content = 'FilingID,Legal Name\nF-2011-1,"CIDADE DE DEUS PARTICIPAÇÕES"\n'.encode("latin-1")
    with ZipFile(path, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("IA_Schedule_D_10A_sample.csv", content)
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    _record_artifact(database, path, artifact_id="history:latin1", dataset_kind="adv_part1")

    (ref,) = RawIngestor(database).ingest_artifact("history:latin1")

    with database.connection() as connection:
        row = connection.execute(f'SELECT "Legal Name" FROM {quote_ident(ref.table_name)}').fetchone()
    assert row == ("CIDADE DE DEUS PARTICIPAÇÕES",)


def test_raw_ingest_transcodes_windows1252_punctuation_without_loss(tmp_path: Path) -> None:
    path = tmp_path / "history-windows1252.zip"
    content = 'FilingID,Description\nF-2011-1,"Advisor’s affiliate"\n'.encode("windows-1252")
    with ZipFile(path, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("IA_Schedule_D_10A_sample.csv", content)
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    _record_artifact(database, path, artifact_id="history:windows1252", dataset_kind="adv_part1")

    (ref,) = RawIngestor(database).ingest_artifact("history:windows1252")

    with database.connection() as connection:
        row = connection.execute(f'SELECT "Description" FROM {quote_ident(ref.table_name)}').fetchone()
    assert row == ("Advisor’s affiliate",)
    assert ref.source_encoding == "windows-1252"


def test_raw_ingest_keeps_pipe_inside_quoted_comma_separated_value(tmp_path: Path) -> None:
    path = tmp_path / "history-pipe.zip"
    _csv_zip(
        path,
        "IA_Schedule_D_7A_sample.csv",
        'FilingID,ReferenceID,Legal Name,Business Name\n906377,162210,"ENVESTNET ASSET MANAGEMENT, INC.","ENVESTNET | PMC"\n',
    )
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    _record_artifact(database, path, artifact_id="history:pipe", dataset_kind="adv_part1")

    (ref,) = RawIngestor(database).ingest_artifact("history:pipe")

    with database.connection() as connection:
        row = connection.execute(f'SELECT "Legal Name", "Business Name" FROM {quote_ident(ref.table_name)}').fetchone()
    assert row == ("ENVESTNET ASSET MANAGEMENT, INC.", "ENVESTNET | PMC")


def test_raw_ingest_preserves_and_quarantines_variable_width_rows(tmp_path: Path) -> None:
    path = tmp_path / "history-variable-width.zip"
    _csv_zip(
        path,
        "IA_Schedule_D_7A_sample.csv",
        "FilingID,ReferenceID,Legal Name\nF-1,10\nF-2,20,Expected Name,unexpected overflow\n",
    )
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    _record_artifact(database, path, artifact_id="history:width", dataset_kind="adv_part1")

    (ref,) = RawIngestor(database).ingest_artifact("history:width")

    with database.connection() as connection:
        rows = connection.execute(
            f"""
            SELECT "FilingID", "ReferenceID", "Legal Name", _source_row_number,
                   _source_column_count, _raw_values_json
            FROM {quote_ident(ref.table_name)} ORDER BY _source_row_number
            """
        ).fetchall()
        errors = connection.execute(
            """
            SELECT source_row_number, error_code, raw_values_json
            FROM raw_row_errors ORDER BY source_row_number
            """
        ).fetchall()
    assert rows[0][:5] == ("F-1", "10", None, 1, 2)
    assert rows[1][:5] == ("F-2", "20", "Expected Name", 2, 4)
    assert rows[0][5] is not None and rows[1][5] is not None
    assert [error[:2] for error in errors] == [
        (1, "source_column_count_mismatch"),
        (2, "source_column_count_mismatch"),
    ]
    assert "unexpected overflow" in str(errors[1][2])


def test_xlsx_ingest_discovers_header_after_title_rows(tmp_path: Path) -> None:
    path = tmp_path / "ria.xlsx"
    path.write_bytes(
        _xlsx_bytes(
            [
                ["SEC Registered Investment Advisers"],
                [],
                ["CRD Number", "Primary Business Name", "Main Office Country"],
                [361, "Example Adviser", "UNITED STATES"],
            ]
        )
    )
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    _record_artifact(database, path, artifact_id="ria:def", dataset_kind="ria_report")

    (ref,) = RawIngestor(database).ingest_artifact("ria:def")

    assert ref.header_row_number == 3
    with database.connection() as connection:
        row = connection.execute(
            f'SELECT "CRD Number", "Primary Business Name" FROM {quote_ident(ref.table_name)}'
        ).fetchone()
    assert row == ("361", "Example Adviser")


def test_raw_ingest_rejects_zip_path_traversal_without_inventory(tmp_path: Path) -> None:
    path = tmp_path / "unsafe.zip"
    _csv_zip(path, "../outside.csv", "FilingID,1E1\nF-1,361\n")
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    _record_artifact(database, path, artifact_id="unsafe:123", dataset_kind="adv_part1")

    with pytest.raises(RawIngestError, match="unsafe ZIP member"):
        RawIngestor(database).ingest_artifact("unsafe:123")

    with database.connection() as connection:
        inventory_count = connection.execute("SELECT count(*) FROM raw_table_inventory").fetchone()[0]
        status = connection.execute(
            "SELECT ingest_status FROM source_artifacts WHERE artifact_id = 'unsafe:123'"
        ).fetchone()[0]
    assert inventory_count == 0
    assert status == "downloaded"


def test_raw_ingest_rejects_required_member_with_no_rows(tmp_path: Path) -> None:
    path = tmp_path / "empty.zip"
    _csv_zip(path, "IA_ADV_Base_A_empty.csv", "FilingID,1E1\n")
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    _record_artifact(database, path, artifact_id="empty:123", dataset_kind="adv_part1")

    with pytest.raises(RawIngestError, match="no data rows"):
        RawIngestor(database).ingest_artifact("empty:123")


def test_raw_ingest_is_idempotent(tmp_path: Path) -> None:
    path = tmp_path / "history.zip"
    _csv_zip(path, "IA_ADV_Base_A_sample.csv", "FilingID,1E1\nF-1,361\n")
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    _record_artifact(database, path, artifact_id="history:repeat", dataset_kind="adv_part1")

    first = RawIngestor(database).ingest_artifact("history:repeat")
    second = RawIngestor(database).ingest_artifact("history:repeat")

    assert first == second
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM raw_table_inventory").fetchone()[0] == 1
