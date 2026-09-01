from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from openpyxl import Workbook

from riascout_adv_data.monthly_reports import MonthlyReportError, MonthlyReportPublisher
from riascout_adv_data.official_db import OfficialArtifactRecord, OfficialDatabase
from riascout_adv_data.raw_ingest import RawIngestor


def _write_workbook(path: Path, headers: list[str], rows: list[list[object]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["Official SEC Investment Adviser Information Report"])
    sheet.append([])
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    workbook.save(path)


def _record_and_ingest(
    database: OfficialDatabase,
    path: Path,
    *,
    artifact_id: str,
    dataset_kind: str,
    observation_date: date,
) -> None:
    database.record_artifact(
        OfficialArtifactRecord(
            artifact_id=artifact_id,
            dataset_key=artifact_id,
            dataset_kind=dataset_kind,
            source_url=f"https://www.sec.gov/files/{path.name}",
            observation_date=observation_date,
            retrieved_at=datetime(2026, 8, 26, tzinfo=UTC),
            sha256=artifact_id.rsplit(":", 1)[-1],
            payload_path=str(path),
            manifest_path=f"{path}.manifest.json",
            byte_count=path.stat().st_size,
        )
    )
    RawIngestor(database).ingest_artifact(artifact_id)


def _database_with_monthly_reports(tmp_path: Path) -> OfficialDatabase:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    headers = [
        "CRD Number",
        "Primary Business Name",
        "SEC Number",
        "Filing Date",
        "Main Office City",
        "Main Office State",
        "Main Office Country",
        "5F(2)(c)",
    ]
    ria = tmp_path / "ria-2025-12.xlsx"
    _write_workbook(
        ria, headers, [[361, "Example RIA", "801-1", "12/15/2025", "New York", "NY", "UNITED STATES", 1500]]
    )
    _record_and_ingest(
        database,
        ria,
        artifact_id="ria-2025:abc",
        dataset_kind="ria_report",
        observation_date=date(2025, 12, 31),
    )
    era = tmp_path / "era-2025-12.xlsx"
    _write_workbook(
        era,
        headers,
        [[88001, "Foreign ERA", "802-99", "12/10/2025", "George Town", "", "CAYMAN ISLANDS", ""]],
    )
    _record_and_ingest(
        database,
        era,
        artifact_id="era-2025:def",
        dataset_kind="era_report",
        observation_date=date(2025, 12, 31),
    )
    return database


def test_monthly_report_expands_scientific_notation_before_duckdb_binding(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    path = tmp_path / "ria-scientific.xlsx"
    _write_workbook(
        path,
        ["CRD Number", "Primary Business Name", "SEC Number", "5F(2)(c)"],
        [[108069, "Scientific Adviser", "801-57038", "1.3471E+11"]],
    )
    _record_and_ingest(
        database,
        path,
        artifact_id="ria-scientific:abc",
        dataset_kind="ria_report",
        observation_date=date(2025, 3, 31),
    )

    MonthlyReportPublisher(database).publish(["ria-scientific:abc"])

    with database.connection() as connection:
        value = connection.execute("SELECT regulatory_aum FROM dated_firm_observations").fetchone()
    assert value == (Decimal("134710000000.00"),)


def test_monthly_category_comes_from_official_report_not_address(tmp_path: Path) -> None:
    database = _database_with_monthly_reports(tmp_path)

    result = MonthlyReportPublisher(database).publish(["ria-2025:abc", "era-2025:def"])

    with database.connection() as connection:
        rows = connection.execute(
            """
            SELECT firm_crd, category, principal_country_raw
            FROM dated_firm_observations
            WHERE report_date = DATE '2025-12-31'
            ORDER BY firm_crd
            """
        ).fetchall()
    assert rows == [(361, "SEC", "UNITED STATES"), (88001, "ERA", "CAYMAN ISLANDS")]
    assert result.published_observations == 2


def test_monthly_report_prefers_primary_business_name_and_maps_live_sec_headers(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    path = tmp_path / "ria-live-headers.csv"
    path.write_text(
        "Organization CRD#,Primary Business Name,Legal Name,SEC#,Latest ADV Filing Date\n"
        "361,Public-Facing Name,Legal Entity Name,801-1,08/01/2026\n"
    )
    _record_and_ingest(
        database,
        path,
        artifact_id="ria-live-headers:abc",
        dataset_kind="ria_report",
        observation_date=date(2026, 8, 3),
    )

    MonthlyReportPublisher(database).publish(["ria-live-headers:abc"])

    with database.connection() as connection:
        row = connection.execute(
            """
            SELECT firm_name, sec_number, filing_date
            FROM dated_firm_observations
            """
        ).fetchone()
    assert row == ("Public-Facing Name", "801-1", date(2026, 8, 1))


def test_monthly_report_without_country_publishes_null_and_unavailable_coverage(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    path = tmp_path / "ria-2026-08.xlsx"
    _write_workbook(path, ["CRD Number", "Primary Business Name", "SEC Number"], [[361, "Example RIA", "801-1"]])
    _record_and_ingest(
        database,
        path,
        artifact_id="ria-2026:abc",
        dataset_kind="ria_report",
        observation_date=date(2026, 8, 3),
    )

    MonthlyReportPublisher(database).publish(["ria-2026:abc"])

    with database.connection() as connection:
        country = connection.execute("SELECT principal_country_raw FROM dated_firm_observations").fetchone()[0]
        coverage = connection.execute(
            "SELECT coverage_status FROM field_coverage WHERE field_group = 'principal_country'"
        ).fetchone()[0]
    assert country is None
    assert coverage == "unavailable"


def test_monthly_report_missing_crd_rolls_back_prior_observations(tmp_path: Path) -> None:
    database = _database_with_monthly_reports(tmp_path)
    MonthlyReportPublisher(database).publish(["ria-2025:abc", "era-2025:def"])
    path = tmp_path / "bad.csv"
    path.write_text("Primary Business Name,SEC Number\nBroken,801-2\n")
    _record_and_ingest(
        database,
        path,
        artifact_id="bad-monthly:xyz",
        dataset_kind="ria_report",
        observation_date=date(2026, 8, 3),
    )

    with pytest.raises(MonthlyReportError, match="firm_crd"):
        MonthlyReportPublisher(database).publish(["bad-monthly:xyz"])

    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM dated_firm_observations").fetchone()[0] == 2


def test_monthly_report_rejects_duplicate_crd_in_same_category_and_date(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    path = tmp_path / "duplicate.xlsx"
    _write_workbook(
        path,
        ["CRD Number", "Primary Business Name"],
        [[361, "First"], [361, "Duplicate"]],
    )
    _record_and_ingest(
        database,
        path,
        artifact_id="duplicate:xyz",
        dataset_kind="ria_report",
        observation_date=date(2026, 8, 3),
    )

    with pytest.raises(MonthlyReportError, match="Duplicate CRD 361"):
        MonthlyReportPublisher(database).publish(["duplicate:xyz"])

    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM dated_firm_observations").fetchone()[0] == 0
