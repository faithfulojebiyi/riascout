from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import pytest

from riascout_adv_data.canonicalize import CanonicalMappingError, HistoricalCanonicalizer
from riascout_adv_data.official_db import OfficialArtifactRecord, OfficialDatabase
from riascout_adv_data.raw_ingest import RawIngestor


def _write_zip(path: Path, members: dict[str, str]) -> None:
    with ZipFile(path, "w", compression=ZIP_DEFLATED) as archive:
        for name, content in members.items():
            archive.writestr(name, content)


def _record_and_ingest(
    database: OfficialDatabase,
    path: Path,
    *,
    artifact_id: str,
    dataset_kind: str,
) -> None:
    database.record_artifact(
        OfficialArtifactRecord(
            artifact_id=artifact_id,
            dataset_key=artifact_id,
            dataset_kind=dataset_kind,
            source_url=f"https://www.sec.gov/files/{path.name}",
            observation_date=date(2024, 12, 31),
            retrieved_at=datetime(2026, 8, 26, tzinfo=UTC),
            sha256=artifact_id.rsplit(":", 1)[-1],
            payload_path=str(path),
            manifest_path=f"{path}.manifest.json",
            byte_count=path.stat().st_size,
        )
    )
    RawIngestor(database).ingest_artifact(artifact_id)


def _history_members() -> dict[str, str]:
    return {
        "IA_ADV_Base_A_sample.csv": (
            "FilingID,DateSubmitted,1E1,1D,1A,1F1-City,1F1-State,1F1-Country,5F2c,5A,5B1,5D1a,5D3a,5G1,5E1\n"
            "F-2020-OLD,03/31/2020 10:00:00 AM,361,801-1,Old Name,New York,NY,UNITED STATES,1000,10,8,10,500,Y,Y\n"
            "F-2020-LATEST,12/15/2020 11:00:00 AM,361,801-1,Latest Name,New York,NY,UNITED STATES,1200,12,9,12,700,Y,Y\n"
            "F-2020-WITHDRAW,01/10/2020,9001,801-9001,Leaving Adviser,Boston,MA,UNITED STATES,500,4,3,3,200,N,Y\n"
        ),
        "ERA_ADV_Base_sample.csv": (
            "FilingID,DateSubmitted,1E1,1D,1A,1F1-City,1F1-State,1F1-Country\n"
            "F-2020-ERA,06/30/2020,88001,802-99,Foreign ERA,George Town,,CAYMAN ISLANDS\n"
            "F-2022-ERA-FINAL,05/31/2022,88002,802-100,Finished ERA,Miami,FL,UNITED STATES\n"
            "F-2020-LATEST,12/15/2020,361,801-1,Latest Name,New York,NY,UNITED STATES\n"
        ),
        "ADV_Filing_Types_sample.csv": (
            "FilingID,FilingType\n"
            "F-2020-OLD,Annual Updating Amendment\n"
            "F-2020-LATEST,Other-than-Annual Amendment\n"
            "F-2020-ERA,ERA Annual Updating Amendment\n"
            "F-2020-WITHDRAW,Annual Updating Amendment\n"
            "F-2022-ERA-FINAL,ERA Final Report\n"
        ),
        "IA_Schedule_D_7B1_sample.csv": (
            "FilingID,Fund ID,ReferenceID,Fund Name,Fund Type,Gross Asset Value,Country,State\n"
            "F-2020-OLD,PF-OLD,REF-OLD,Old Fund,Hedge Fund,10,UNITED STATES,NY\n"
            "F-2020-LATEST,PF-LATEST,REF-LATEST,Latest Fund,Hedge Fund,20,CAYMAN ISLANDS,\n"
        ),
        "ERA_Schedule_D_7B1_sample.csv": (
            "FilingID,Fund ID,ReferenceID,Fund Name,Fund Type,Gross Asset Value,Country,State\n"
            "F-2020-ERA,ERA-PF-1,ERA-REF-1,ERA Fund,Venture Capital Fund,30,CAYMAN ISLANDS,\n"
            "F-2020-LATEST,ERA-DUPLICATE,ERA-DUP-REF,Wrong Cohort Fund,Hedge Fund,99,UNITED STATES,NY\n"
        ),
        "IA_Schedule_D_1F_sample.csv": (
            "FilingID,ReferenceID,City,State,Country,Number of Employees\n"
            "F-2020-LATEST,OFFICE-1,Chicago,IL,UNITED STATES,2\n"
        ),
        "IA_Schedule_D_5K1_sample.csv": ("FilingID,5K(1)(a)(i)EOY\nF-2020-LATEST,55.5\n"),
        "IA_Schedule_D_5K3_sample.csv": (
            "Filing ID,ReferenceID,Custodian Name,5K(3)(g),5K(3)(c) City,5K(3)(c) State,5K(3)(c) Country\n"
            "F-2020-LATEST,CUST-1,Example Custodian,100,Chicago,IL,UNITED STATES\n"
        ),
        "IA_Schedule_D_7B1A25_sample.csv": (
            "FilingID,ReferenceID,Legal Name of Custodian,Primary Business Name,City,State,Country\n"
            "F-2020-LATEST,REF-LATEST,Fund Custodian One,Fund Custodian One,New York,NY,UNITED STATES\n"
            "F-2020-LATEST,REF-LATEST,Fund Custodian Two,Fund Custodian Two,Boston,MA,UNITED STATES\n"
        ),
        "IA_Schedule_D_7A_sample.csv": (
            "FilingID,ReferenceID,Legal Name,Business Name,SEC Number,CRD Number,Relationship Types,State,Country\n"
            "F-2020-LATEST,AFF-1,Related Legal,Related Business,801-77,777,Control,NY,UNITED STATES\n"
        ),
        "ERA_Schedule_D_7A_sample.csv": (
            "FilingID,ReferenceID,Legal Name,Business Name,SEC Number or Other,CRD Number,Type,State,Country\n"
            "F-2020-ERA,ERA-AFF-1,ERA Related Legal,ERA Related Business,802-77,778,Control,,CAYMAN ISLANDS\n"
        ),
        "IA_Schedule_D_7A_CIK_sample.csv": ("FilingID,ReferenceID,CIK\nF-2020-LATEST,AFF-1,0000007777\n"),
    }


def _database_with_history(tmp_path: Path) -> OfficialDatabase:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    history = tmp_path / "history.zip"
    _write_zip(history, _history_members())
    _record_and_ingest(database, history, artifact_id="history:abc", dataset_kind="adv_part1")
    advw = tmp_path / "advw.zip"
    _write_zip(
        advw,
        {
            "ADVW_Base_sample.csv": (
                "FilingID,DateSubmitted,Effective Date,1E1,1D,Withdrawal Type\n"
                "W-2022-1,06/20/2022,06/30/2022,9001,801-9001,FULL\n"
            )
        },
    )
    _record_and_ingest(database, advw, artifact_id="advw:def", dataset_kind="advw")
    return database


def test_canonicalizer_expands_scientific_notation_before_duckdb_binding(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    history = tmp_path / "scientific.zip"
    _write_zip(
        history,
        {
            "IA_ADV_Base_A_scientific.csv": (
                "FilingID,DateSubmitted,1E1,1D,1A,5F2a,5F2b,5F2c,5D1a,5D3a\n"
                "F-SCI,03/31/2025,108069,801-57038,Scientific Adviser,"
                "1.10924E+11,2.3786E+10,1.3471E+11,1,1.02466E+13\n"
            ),
            "ADV_Filing_Types_scientific.csv": "FilingID,FilingType\nF-SCI,Annual Updating Amendment\n",
        },
    )
    _record_and_ingest(database, history, artifact_id="scientific:abc", dataset_kind="adv_part1")

    HistoricalCanonicalizer(database).publish(["scientific:abc"])

    with database.connection() as connection:
        metrics = connection.execute(
            """
            SELECT discretionary_aum, non_discretionary_aum, regulatory_aum
            FROM firm_metrics WHERE filing_id='F-SCI'
            """
        ).fetchone()
        client_aum = connection.execute(
            """
            SELECT regulatory_aum FROM filing_client_types
            WHERE filing_id='F-SCI' AND client_type='Individuals'
            """
        ).fetchone()
    assert metrics == (
        Decimal("110924000000.00"),
        Decimal("23786000000.00"),
        Decimal("134710000000.00"),
    )
    assert client_aum == (Decimal("10246600000000.00"),)


def test_canonicalizer_separates_accounts_and_preserves_client_evidence(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    source = tmp_path / "accounts-clients.zip"
    _write_zip(
        source,
        {
            "IA_ADV_Base_A_accounts_clients.csv": (
                "FilingID,DateSubmitted,1E1,1D,1A,5F2d,5F2e,5F2f,"
                "5D1i,5D2i,5D3i,5D1j,5D2j,5D3j,5D1k,5D2k,5D3k,"
                "5D1l,5D2l,5D3l,5D1m,5D2m,5D3m,5D1n,5D2n,5D3n\n"
                "F-CLIENTS,03/31/2025,149777,801-1,Mapping Adviser,10,20,30,"
                "2,N,200,3,N,300,4,Y,400,,Y,500,6,N,600,7,N,700\n"
            ),
            "ADV_Filing_Types_accounts_clients.csv": ("FilingID,FilingType\nF-CLIENTS,Annual Updating Amendment\n"),
        },
    )
    _record_and_ingest(database, source, artifact_id="accounts-clients:abc", dataset_kind="adv_part1")

    HistoricalCanonicalizer(database).publish(["accounts-clients:abc"])

    with database.connection() as connection:
        accounts = connection.execute(
            """
            SELECT discretionary_account_count, non_discretionary_account_count, account_count
            FROM firm_metrics WHERE filing_id = 'F-CLIENTS'
            """
        ).fetchone()
        clients = connection.execute(
            """
            SELECT client_type, client_count, fewer_than_five, regulatory_aum
            FROM filing_client_types WHERE filing_id = 'F-CLIENTS'
            ORDER BY client_type
            """
        ).fetchall()

    assert accounts == (10, 20, 30)
    assert clients == [
        ("Corporations_or_Other_Businesses", 6, False, Decimal("600.00")),
        ("Insurance_Companies", 4, True, Decimal("400.00")),
        ("Other", 7, False, Decimal("700.00")),
        ("Other_Investment_Advisers", 3, False, Decimal("300.00")),
        ("Sovereign_Wealth_Funds", None, True, Decimal("500.00")),
        ("State_or_Municipal_Governments", 2, False, Decimal("200.00")),
    ]


def test_reported_client_totals_are_range_native(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    source = tmp_path / "client-totals.zip"
    _write_zip(
        source,
        {
            "IA_ADV_Base_A_client_totals.csv": (
                "FilingID,DateSubmitted,1E1,1D,1A,5D1a,5D2a,5D3a,5D1b,5D2b,5D3b\n"
                "F-EXACT,03/31/2025,1001,801-1001,Exact,12,N,1200,0,N,0\n"
                "F-RANGE,03/31/2025,1002,801-1002,Range,12,N,1200,,Y,0\n"
                "F-ZERO,03/31/2025,1003,801-1003,Zero,0,N,0,0,N,0\n"
                "F-UNAVAILABLE,03/31/2025,1004,801-1004,Unavailable,,,100,,,0\n"
            ),
            "ADV_Filing_Types_client_totals.csv": (
                "FilingID,FilingType\n"
                "F-EXACT,Annual Updating Amendment\n"
                "F-RANGE,Annual Updating Amendment\n"
                "F-ZERO,Annual Updating Amendment\n"
                "F-UNAVAILABLE,Annual Updating Amendment\n"
            ),
        },
    )
    _record_and_ingest(database, source, artifact_id="client-totals:abc", dataset_kind="adv_part1")
    HistoricalCanonicalizer(database).publish(["client-totals:abc"])

    with database.connection() as connection:
        rows = connection.execute(
            """
            SELECT filing_id, reported_client_count_min,
                   reported_client_count_max, reported_client_count_quality
            FROM filing_reported_client_totals
            ORDER BY filing_id
            """
        ).fetchall()

    assert rows == [
        ("F-EXACT", 12, 12, "reported_number"),
        ("F-RANGE", 13, 16, "bounded_range"),
        ("F-UNAVAILABLE", None, None, "unavailable"),
        ("F-ZERO", 0, 0, "reported_number"),
    ]


def test_canonical_children_remain_keyed_to_their_own_filing(tmp_path: Path) -> None:
    database = _database_with_history(tmp_path)

    result = HistoricalCanonicalizer(database).publish(["history:abc", "advw:def"])

    with database.connection() as connection:
        rows = connection.execute(
            "SELECT filing_id, private_fund_id FROM filing_private_funds ORDER BY filing_id"
        ).fetchall()
    assert rows == [
        ("F-2020-ERA", "ERA-PF-1"),
        ("F-2020-LATEST", "PF-LATEST"),
        ("F-2020-OLD", "PF-OLD"),
    ]
    assert result.published_filings == 5


def test_canonical_sections_preserve_filing_id_for_every_child_type(tmp_path: Path) -> None:
    database = _database_with_history(tmp_path)

    HistoricalCanonicalizer(database).publish(["history:abc", "advw:def"])

    with database.connection() as connection:
        assert connection.execute(
            "SELECT client_count FROM filing_client_types WHERE filing_id='F-2020-LATEST' AND client_type='Individuals'"
        ).fetchone() == (12,)
        assert connection.execute(
            "SELECT service_type FROM filing_services WHERE filing_id='F-2020-LATEST'"
        ).fetchone() == ("Financial Planning Services",)
        assert connection.execute(
            "SELECT office_reference FROM filing_offices WHERE filing_id='F-2020-LATEST'"
        ).fetchone() == ("OFFICE-1",)
        assert connection.execute(
            "SELECT percentage FROM filing_asset_allocations WHERE filing_id='F-2020-LATEST'"
        ).fetchone() == (55.5,)
        assert connection.execute(
            """
            SELECT custodian_reference FROM filing_custodians
            WHERE filing_id='F-2020-LATEST' AND source_subtype='SMA'
            """
        ).fetchone() == ("CUST-1",)
        private_custodians = connection.execute(
            """
            SELECT private_fund_id, custodian_reference, custodian_name
            FROM filing_custodians
            WHERE filing_id='F-2020-LATEST' AND source_subtype='PRIVATE_FUND'
            ORDER BY source_row_number
            """
        ).fetchall()
        assert private_custodians == [
            ("PF-LATEST", "row-1", "Fund Custodian One"),
            ("PF-LATEST", "row-2", "Fund Custodian Two"),
        ]
        assert connection.execute(
            "SELECT affiliation_reference FROM filing_affiliations WHERE filing_id='F-2020-LATEST'"
        ).fetchone() == ("AFF-1",)
        assert connection.execute(
            "SELECT count(*) FROM filing_affiliations WHERE filing_id='F-2020-LATEST'"
        ).fetchone() == (1,)


def test_canonical_filing_category_uses_sec_number_prefix_and_keeps_foreign_firm(tmp_path: Path) -> None:
    database = _database_with_history(tmp_path)

    HistoricalCanonicalizer(database).publish(["history:abc", "advw:def"])

    with database.connection() as connection:
        filing = connection.execute(
            """
            SELECT f.registration_category, a.principal_country_raw
            FROM filings f JOIN firm_addresses a USING (filing_id)
            WHERE f.filing_id = 'F-2020-ERA'
            """
        ).fetchone()
    assert filing == ("ERA", "CAYMAN ISLANDS")

    with database.connection() as connection:
        affiliation = connection.execute(
            "SELECT affiliation_reference FROM filing_affiliations WHERE filing_id = 'F-2020-ERA'"
        ).fetchone()
    assert affiliation == ("ERA-AFF-1",)


def test_full_advw_creates_dated_sec_withdrawal_event(tmp_path: Path) -> None:
    database = _database_with_history(tmp_path)

    result = HistoricalCanonicalizer(database).publish(["history:abc", "advw:def"])

    with database.connection() as connection:
        event = connection.execute(
            """
            SELECT category, status, effective_date
            FROM registration_events
            WHERE firm_crd = 9001 AND status = 'WITHDRAWN'
            """
        ).fetchone()
    assert event == ("SEC", "WITHDRAWN", date(2022, 6, 30))
    assert result.quarantined_rows == 0


def test_era_final_report_creates_termination_event(tmp_path: Path) -> None:
    database = _database_with_history(tmp_path)

    HistoricalCanonicalizer(database).publish(["history:abc", "advw:def"])

    with database.connection() as connection:
        event = connection.execute(
            "SELECT category, status, effective_date FROM registration_events WHERE firm_crd = 88002"
        ).fetchone()
    assert event == ("ERA", "FINAL_REPORTED", date(2022, 5, 31))


def test_canonical_publication_is_idempotent(tmp_path: Path) -> None:
    database = _database_with_history(tmp_path)
    canonicalizer = HistoricalCanonicalizer(database)

    first = canonicalizer.publish(["history:abc", "advw:def"])
    second = canonicalizer.publish(["history:abc", "advw:def"])

    assert first == second
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM filings").fetchone()[0] == 5


def test_new_transformation_version_replaces_prior_artifact_publication(tmp_path: Path) -> None:
    database = _database_with_history(tmp_path)
    canonicalizer = HistoricalCanonicalizer(database)
    canonicalizer.publish(["history:abc", "advw:def"])
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM filing_fee_methods").fetchone()[0] == 3
    with database.transaction() as connection:
        connection.execute("UPDATE canonicalization_runs SET transformation_version = 'official-v1'")

    result = canonicalizer.publish(["history:abc", "advw:def"])

    assert result.published_filings == 5
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM filings").fetchone()[0] == 5
        assert connection.execute("SELECT count(*) FROM filing_fee_methods").fetchone()[0] == 3


def test_missing_required_base_column_rolls_back_without_replacing_valid_data(tmp_path: Path) -> None:
    database = _database_with_history(tmp_path)
    HistoricalCanonicalizer(database).publish(["history:abc", "advw:def"])
    malformed = tmp_path / "malformed.zip"
    _write_zip(malformed, {"IA_ADV_Base_A_bad.csv": "DateSubmitted,1E1\n01/01/2021,123\n"})
    _record_and_ingest(database, malformed, artifact_id="bad:ghi", dataset_kind="adv_part1")

    with pytest.raises(CanonicalMappingError, match="filing_id"):
        HistoricalCanonicalizer(database).publish(["bad:ghi"])

    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM filings").fetchone()[0] == 5


def test_canonicalizer_keeps_monthly_filing_versions_after_2024(tmp_path: Path) -> None:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    monthly = tmp_path / "monthly.zip"
    _write_zip(
        monthly,
        {
            "IA_ADV_Base_A_20250101_20250131.csv": (
                "FilingID,DateSubmitted,1E1,1D,1A,1F1-City,1F1-State,1F1-Country,5F2c\n"
                "F-2025-1,01/15/2025,361,801-1,Current Name,New York,NY,UNITED STATES,1500\n"
                "F-2025-2,02/11/2025 10:46,362,801-2,Second Name,Boston,MA,UNITED STATES,2500\n"
            ),
            "ERA_ADV_Base_20250101_20250131.csv": (
                "FilingID,DateSubmitted,1E1,1D,1A,1F1-City,1F1-State,1F1-Country\n"
                "F-2025-ERA,03/31/2025,88001,,ERA Without SEC Number,Miami,FL,UNITED STATES\n"
            ),
            "ADV_Filing_Types_20250101_20250131.csv": (
                "FilingID,FilingType\nF-2025-1,Other-than-Annual Amendment\nF-2025-2,Annual Updating Amendment\n"
            ),
            "IA_Schedule_D_7B1_20250101_20250131.csv": (
                "FilingID,Fund ID,ReferenceID,Fund Name,Fund Type,Gross Asset Value,Country,State\n"
                "F-2025-1,PF-2025,REF-2025,Current Fund,Hedge Fund,25,UNITED STATES,NY\n"
            ),
        },
    )
    _record_and_ingest(database, monthly, artifact_id="monthly:2025-01", dataset_kind="adv_part1")

    result = HistoricalCanonicalizer(database).publish(["monthly:2025-01"])

    assert result.published_filings == 3
    with database.connection() as connection:
        assert connection.execute(
            "SELECT filing_id, regulatory_aum FROM filings JOIN firm_metrics USING (filing_id) ORDER BY filing_id"
        ).fetchall() == [("F-2025-1", 1500), ("F-2025-2", 2500), ("F-2025-ERA", None)]
        assert connection.execute("SELECT filing_id, private_fund_id FROM filing_private_funds").fetchone() == (
            "F-2025-1",
            "PF-2025",
        )
        assert connection.execute(
            "SELECT registration_category, sec_number FROM filings WHERE filing_id='F-2025-ERA'"
        ).fetchone() == ("ERA", None)
