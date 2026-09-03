import json
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


def _database_with_complete_private_fund(tmp_path: Path) -> OfficialDatabase:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    source = tmp_path / "private-fund.zip"
    _write_zip(
        source,
        {
            "IA_ADV_Base_A_fund.csv": (
                "FilingID,DateSubmitted,1E1,1D,1A\nF-FUND,03/31/2025,12345,801-12345,Complete Fund Adviser\n"
            ),
            "ADV_Filing_Types_fund.csv": "FilingID,FilingType\nF-FUND,Annual Updating Amendment\n",
            "IA_Schedule_D_7B1_fund.csv": (
                "FilingID,Fund Name,Fund ID,ReferenceID,State,Country,3(c)(1) Exclusion,"
                "3(c)(7) Exclusion,Master Fund,Feeder Fund,Master Fund Name,Master Fund ID,"
                "Fund of Funds,Fund Invested Self or Related,Fund Invested in Securities,Fund Type,"
                "Fund Type Other,Gross Asset Value,Minimum Investment,Owners,%Owned You or Related,"
                "%Owned Funds,Sales Limited,%Owned Non-US,Subadviser,Other IAs Advise,Clients Solicited,"
                "Percentage Invested,Exempt from Registration,Annual Audit,GAAP,FS Distributed,"
                "Unqualified Opinion,Prime Brokers,Custodians,Administrator,% Assets Valued,Marketing\n"
                "F-FUND,Example Alpha Fund,PF-SEC-1,REF-1,NY,UNITED STATES,Y,N,Y,Y,"
                "Example Master Fund,PF-MASTER,Y,Y,N,Hedge Fund,Digital Assets,1234567.89,250000,42,"
                "12.5,7.25,Y,33.3,N,Y,Y,18.75,Y,Y,Y,Y,Y,Y,Y,Y,66.5,Y\n"
            ),
            "IA_Schedule_D_7B1A3a_fund.csv": (
                'FilingID,ReferenceID,"Name of Partner, etc."\nF-FUND,REF-1,Example GP LLC\n'
            ),
            "IA_Schedule_D_7B1A3b_fund.csv": (
                "FilingID,ReferenceID,Filing/Relying Adviser\nF-FUND,REF-1,Complete Fund Adviser\n"
            ),
            "IA_Schedule_D_7B1A5_fund.csv": ("FilingID,ReferenceID,Foreign Regulatory Authority\nF-FUND,REF-1,FCA\n"),
            "IA_Schedule_D_7B1A6b_fund.csv": (
                "FilingID,ReferenceID,Private Fund Name,Fund ID\nF-FUND,REF-1,Example Feeder Fund,PF-FEEDER\n"
            ),
            "IA_Schedule_D_7B1A7d1_fund.csv": (
                'FilingID,ReferenceID,SubreferenceID,"Name of General Partner, etc."\n'
                "F-FUND,REF-1,MASTER-GP-1,Master GP LLC\n"
                "F-FUND,REF-1,MASTER-GP-1,Master Manager LLC\n"
            ),
            "IA_Schedule_D_7B1A7d2_fund.csv": (
                "FilingID,ReferenceID,SubreferenceID,Filing/Relying Adviser\n"
                "F-FUND,REF-1,MASTER-ADV-1,Master Adviser LLC\n"
            ),
            "IA_Schedule_D_7B1A7f_fund.csv": (
                "FilingID,ReferenceID,SubreferenceID,Foreign Regulatory Authority\nF-FUND,REF-1,MASTER-AUTH-1,CIMA\n"
            ),
            "IA_Schedule_D_7B1A17b_fund.csv": (
                "FilingID,ReferenceID,Name of Adviser,SEC File Number,CRD Number\n"
                "F-FUND,REF-1,Primary Adviser LLC,801-111,111\n"
            ),
            "IA_Schedule_D_7B1A18b_fund.csv": (
                "FilingID,ReferenceID,Name of Adviser,SEC File Number,CRD Number\n"
                "F-FUND,REF-1,Other Adviser LLC,801-222,222\n"
            ),
            "IA_Schedule_D_7B1A22_fund.csv": ("FilingID,ReferenceID,Form D File Number\nF-FUND,REF-1,021-123456\n"),
            "IA_Schedule_D_7B1A23_fund.csv": (
                "FilingID,ReferenceID,Name of Auditing Firm,City,State,Country,Independent,"
                "PCAOB Registered,PCAOB Number,PCAOB Inspected\n"
                "F-FUND,REF-1,Audit LLP,New York,NY,UNITED STATES,Y,Y,9999,N\n"
            ),
            "IA_Schedule_D_7B1A24_fund.csv": (
                "FilingID,ReferenceID,Name of Prime Broker,SEC Number,CRD Number,City,State,Country,Custodian\n"
                "F-FUND,REF-1,Prime Broker LLC,8-123,333,New York,NY,UNITED STATES,Y\n"
            ),
            "IA_Schedule_D_7B1A25_fund.csv": (
                "FilingID,ReferenceID,Legal Name of Custodian,Primary Business Name,City,State,Country,"
                "Related Person,SEC Number,Legal Entity Identifier\n"
                "F-FUND,REF-1,Custodian Bank NA,Custodian Bank,New York,NY,UNITED STATES,N,8-456,LEI123\n"
            ),
            "IA_Schedule_D_7B1A26_fund.csv": (
                "FilingID,ReferenceID,Name of Administrator,City,State,Country,Related Person,Statements,"
                "Who Sends Statements\n"
                "F-FUND,REF-1,Admin LLC,Boston,MA,UNITED STATES,N,Y,Administrator\n"
            ),
            "IA_Schedule_D_7B1A28_fund.csv": (
                "FilingID,ReferenceID,SubreferenceID,Related Person,Name of Marketer,SEC Number,CRD Number,"
                "City,State,Country,Websites\n"
                "F-FUND,REF-1,MARKETER-1,Y,Marketer LLC,8-789,444,Chicago,IL,UNITED STATES,Y\n"
            ),
            "IA_Schedule_D_7B1A28_websites_fund.csv": (
                "FilingID,ReferenceID,SubreferenceID,Website Address\n"
                "F-FUND,REF-1,MARKETER-1,https://example.com/fund\n"
                "F-FUND,REF-1,MARKETER-1,https://example.com/fund/strategy\n"
            ),
        },
    )
    database.record_artifact(
        OfficialArtifactRecord(
            artifact_id="private-fund:abc",
            dataset_key="private-fund",
            dataset_kind="adv_part1",
            source_url="https://www.sec.gov/files/private-fund.zip",
            observation_date=date(2025, 3, 31),
            retrieved_at=datetime(2026, 9, 3, tzinfo=UTC),
            sha256="abc",
            payload_path=str(source),
            manifest_path=f"{source}.manifest.json",
            byte_count=source.stat().st_size,
        )
    )
    RawIngestor(database).ingest_artifact("private-fund:abc")
    return database


def test_private_fund_main_preserves_complete_questionnaire(tmp_path: Path) -> None:
    database = _database_with_complete_private_fund(tmp_path)

    HistoricalCanonicalizer(database).publish(["private-fund:abc"])

    with database.connection() as connection:
        row = connection.execute(
            """
            SELECT fund_reference, private_fund_name, private_fund_type, private_fund_type_other,
                   exclusion_3c1, exclusion_3c7, is_master_fund, is_feeder_fund,
                   master_fund_name, master_fund_id, is_fund_of_funds,
                   adviser_or_related_invested, invested_in_registered_investment_companies,
                   gross_asset_value, minimum_investment, beneficial_owner_count,
                   owned_by_adviser_related_pct, owned_by_funds_pct,
                   sales_limited_to_qualified_clients, owned_by_non_us_pct, is_subadviser,
                   has_other_advisers, clients_solicited, clients_invested_pct,
                   relied_on_regulation_d, annual_audit, financial_statements_gaap,
                   financial_statements_distributed, audit_opinion_status, uses_prime_brokers,
                   uses_custodians, uses_administrator, externally_valued_assets_pct, uses_marketers
            FROM filing_private_funds
            WHERE filing_id = 'F-FUND' AND private_fund_id = 'PF-SEC-1'
            """
        ).fetchone()
        identity = connection.execute(
            "SELECT first_seen_date, last_seen_date FROM private_funds WHERE private_fund_id = 'PF-SEC-1'"
        ).fetchone()

    assert row == (
        "REF-1",
        "Example Alpha Fund",
        "Hedge Fund",
        "Digital Assets",
        True,
        False,
        True,
        True,
        "Example Master Fund",
        "PF-MASTER",
        True,
        True,
        False,
        Decimal("1234567.89"),
        Decimal("250000.00"),
        42,
        Decimal("12.50000000"),
        Decimal("7.25000000"),
        True,
        Decimal("33.30000000"),
        False,
        True,
        True,
        Decimal("18.75000000"),
        True,
        True,
        True,
        True,
        "unqualified",
        True,
        True,
        True,
        Decimal("66.50000000"),
        True,
    )
    assert identity == (date(2025, 3, 31), date(2025, 3, 31))


def test_private_fund_children_resolve_to_sec_fund_id(tmp_path: Path) -> None:
    database = _database_with_complete_private_fund(tmp_path)

    HistoricalCanonicalizer(database).publish(["private-fund:abc"])

    with database.connection() as connection:
        assert connection.execute(
            "SELECT relation_role, related_private_fund_name, related_private_fund_id "
            "FROM filing_private_fund_related_funds"
        ).fetchone() == ("feeder_fund", "Example Feeder Fund", "PF-FEEDER")
        assert connection.execute(
            "SELECT manager_role, manager_name "
            "FROM filing_private_fund_managers ORDER BY manager_role, source_row_number"
        ).fetchall() == [
            ("fund_filing_or_relying_adviser", "Complete Fund Adviser"),
            ("fund_partner_or_manager", "Example GP LLC"),
            ("master_fund_filing_or_relying_adviser", "Master Adviser LLC"),
            ("master_fund_partner_or_manager", "Master GP LLC"),
            ("master_fund_partner_or_manager", "Master Manager LLC"),
        ]
        assert connection.execute(
            "SELECT authority_role, authority_name FROM filing_private_fund_foreign_authorities ORDER BY authority_role"
        ).fetchall() == [("fund", "FCA"), ("master_fund", "CIMA")]
        assert connection.execute(
            "SELECT adviser_role, adviser_name, sec_file_number, crd_number "
            "FROM filing_private_fund_advisers ORDER BY adviser_role"
        ).fetchall() == [
            ("other_adviser", "Other Adviser LLC", "801-222", 222),
            ("primary_adviser", "Primary Adviser LLC", "801-111", 111),
        ]
        assert connection.execute("SELECT form_d_file_number FROM filing_private_fund_form_d").fetchone() == (
            "021-123456",
        )
        providers = connection.execute(
            """
            SELECT provider_role, legal_name, business_name, sec_number, crd_number,
                   pcaob_number, lei, related_person, independent, pcaob_registered,
                   pcaob_inspected, acts_as_custodian, sends_statements, statement_sender,
                   has_websites
            FROM filing_private_fund_service_providers
            ORDER BY provider_role
            """
        ).fetchall()
        websites = connection.execute(
            "SELECT provider_reference, website_address FROM filing_private_fund_provider_websites "
            "ORDER BY website_address"
        ).fetchall()
        child_fund_ids = connection.execute(
            """
            SELECT private_fund_id FROM filing_private_fund_service_providers
            UNION ALL SELECT private_fund_id FROM filing_private_fund_advisers
            UNION ALL SELECT private_fund_id FROM filing_private_fund_related_funds
            """
        ).fetchall()

    assert {row[0] for row in providers} == {"administrator", "auditor", "custodian", "marketer", "prime_broker"}
    assert all(private_fund_id == "PF-SEC-1" for (private_fund_id,) in child_fund_ids)
    assert websites == [
        ("MARKETER-1", "https://example.com/fund"),
        ("MARKETER-1", "https://example.com/fund/strategy"),
    ]


def test_private_fund_child_key_disambiguates_reused_sec_subreference(tmp_path: Path) -> None:
    database = _database_with_complete_private_fund(tmp_path)

    HistoricalCanonicalizer(database).publish(["private-fund:abc"])

    with database.connection() as connection:
        managers = connection.execute(
            """
            SELECT source_record_key, manager_name
            FROM filing_private_fund_managers
            WHERE manager_role = 'master_fund_partner_or_manager'
            ORDER BY source_row_number
            """
        ).fetchall()

    assert managers == [
        ("MASTER-GP-1:row-1", "Master GP LLC"),
        ("MASTER-GP-1:row-2", "Master Manager LLC"),
    ]


def test_private_fund_source_contract_rejects_unmapped_columns(tmp_path: Path) -> None:
    database = _database_with_complete_private_fund(tmp_path)
    with database.transaction() as connection:
        raw_table, columns_json = connection.execute(
            "SELECT raw_table_name, columns_json FROM raw_table_inventory WHERE lower(member_name) LIKE '%7b1_fund.csv'"
        ).fetchone()
        connection.execute(f'ALTER TABLE "{raw_table}" ADD COLUMN "Unexpected SEC Field" VARCHAR')
        columns = json.loads(columns_json)
        connection.execute(
            "UPDATE raw_table_inventory SET columns_json = ? WHERE raw_table_name = ?",
            [json.dumps([*columns, "Unexpected SEC Field"]), raw_table],
        )

    with pytest.raises(CanonicalMappingError, match="Unexpected SEC Field"):
        HistoricalCanonicalizer(database).publish(["private-fund:abc"])


def test_private_fund_main_preserves_zero_false_and_unknown(tmp_path: Path) -> None:
    database = _database_with_complete_private_fund(tmp_path)
    with database.transaction() as connection:
        raw_table = connection.execute(
            "SELECT raw_table_name FROM raw_table_inventory WHERE lower(member_name) LIKE '%7b1_fund.csv'"
        ).fetchone()[0]
        connection.execute(
            f"""
            UPDATE "{raw_table}"
            SET "Minimum Investment" = '0', "Owners" = '0',
                "%Owned Funds" = NULL, "Subadviser" = 'N'
            """
        )

    HistoricalCanonicalizer(database).publish(["private-fund:abc"])

    with database.connection() as connection:
        row = connection.execute(
            """
            SELECT minimum_investment, beneficial_owner_count,
                   owned_by_funds_pct, is_subadviser
            FROM filing_private_funds WHERE filing_id = 'F-FUND'
            """
        ).fetchone()
    assert row == (Decimal("0.00"), 0, None, False)
