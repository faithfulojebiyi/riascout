from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from riascout_adv_data.official_db import OfficialArtifactRecord, OfficialDatabase
from riascout_adv_data.snapshots import FirmSnapshotBuilder, SnapshotBuildError

COLLECTED_AT = datetime(2026, 8, 26, 12, 0, tzinfo=UTC)


def _database(tmp_path: Path) -> OfficialDatabase:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    return database


def _record_artifact(
    database: OfficialDatabase,
    artifact_id: str,
    dataset_kind: str,
    observation_date: date | None,
) -> None:
    database.record_artifact(
        OfficialArtifactRecord(
            artifact_id=artifact_id,
            dataset_key=artifact_id,
            dataset_kind=dataset_kind,
            source_url=f"https://www.sec.gov/files/{artifact_id}.zip",
            observation_date=observation_date,
            retrieved_at=COLLECTED_AT,
            sha256=artifact_id,
            payload_path=f"data/raw/{artifact_id}.zip",
            manifest_path=f"data/raw/{artifact_id}.manifest.json",
            byte_count=1,
        )
    )


def _insert_historical_filing(
    database: OfficialDatabase,
    *,
    filing_id: str,
    firm_crd: int,
    submitted: datetime,
    firm_name: str,
    country: str = "UNITED STATES",
    region: str = "NY",
    category: str = "SEC",
    artifact_id: str = "history",
) -> None:
    with database.transaction() as connection:
        connection.execute(
            "INSERT INTO firms VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            [firm_crd, submitted.date(), submitted.date()],
        )
        connection.execute(
            """
            INSERT INTO filings VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'base.csv', 2)
            """,
            [filing_id, firm_crd, submitted, "Other-than-Annual Amendment", "801-1", category, artifact_id],
        )
        connection.execute(
            "INSERT INTO firm_names VALUES (?, ?, ?, 'base.csv', 2)",
            [filing_id, firm_name, artifact_id],
        )
        connection.execute(
            """
            INSERT INTO firm_addresses (
                filing_id, principal_city, principal_region_raw, principal_country_raw,
                artifact_id, source_member, source_row_number
            ) VALUES (?, 'New York', ?, ?, ?, 'base.csv', 2)
            """,
            [filing_id, region, country, artifact_id],
        )
        connection.execute(
            """
            INSERT INTO firm_metrics (
                filing_id, regulatory_aum, employee_count, advisory_employee_count,
                artifact_id, source_member, source_row_number
            ) VALUES (?, 1200, 12, 9, ?, 'base.csv', 2)
            """,
            [filing_id, artifact_id],
        )
        connection.execute(
            """
            INSERT INTO registration_events VALUES (
                ?, ?, 'SEC', ?, 'ACTIVE', ?, ?, NULL, ?, 'base.csv', 2
            ) ON CONFLICT DO NOTHING
            """,
            [f"event:{filing_id}", firm_crd, category, submitted.date(), filing_id, artifact_id],
        )


def _insert_monthly_observation(
    database: OfficialDatabase,
    *,
    report_date: date,
    firm_crd: int,
    category: str,
    artifact_id: str,
    firm_name: str,
    country: str | None,
) -> None:
    with database.transaction() as connection:
        connection.execute(
            "INSERT INTO firms VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            [firm_crd, report_date, report_date],
        )
        connection.execute(
            """
            INSERT INTO dated_firm_observations (
                report_date, firm_crd, category, firm_name, sec_number, filing_date,
                principal_city, principal_region_raw, principal_country_raw,
                regulatory_aum, employee_count, advisory_employee_count,
                artifact_id, source_member, source_row_number
            ) VALUES (?, ?, ?, ?, ?, ?, 'New York', 'NY', ?, 2000, 15, 11, ?, 'report.xlsx', 2)
            """,
            [report_date, firm_crd, category, firm_name, "801-1", report_date, country, artifact_id],
        )
        connection.execute(
            """
            INSERT INTO registration_events VALUES (
                ?, ?, 'SEC', ?, 'ACTIVE', ?, NULL, NULL, ?, 'report.xlsx', 2
            ) ON CONFLICT DO NOTHING
            """,
            [f"report:{artifact_id}:{firm_crd}", firm_crd, category, report_date, artifact_id],
        )


def test_historical_snapshot_selects_latest_filing_and_exact_child_version(tmp_path: Path) -> None:
    database = _database(tmp_path)
    _record_artifact(database, "history", "adv_part1", date(2024, 12, 31))
    _insert_historical_filing(
        database,
        filing_id="F-2020-ANNUAL",
        firm_crd=361,
        submitted=datetime(2020, 3, 31, 10),
        firm_name="Old Name",
    )
    _insert_historical_filing(
        database,
        filing_id="F-2020-LATEST",
        firm_crd=361,
        submitted=datetime(2020, 12, 15, 11),
        firm_name="Latest Name",
    )
    with database.transaction() as connection:
        connection.execute(
            """
            INSERT INTO filing_private_funds (
                filing_id, private_fund_id, fund_reference, private_fund_name,
                artifact_id, source_member, source_row_number
            ) VALUES (?, ?, ?, ?, 'history', 'fund.csv', 2)
            """,
            ["F-2020-ANNUAL", "PF-OLD", "REF-OLD", "Old Fund"],
        )
        connection.execute(
            """
            INSERT INTO filing_private_funds (
                filing_id, private_fund_id, fund_reference, private_fund_name,
                artifact_id, source_member, source_row_number
            ) VALUES (?, ?, ?, ?, 'history', 'fund.csv', 3)
            """,
            ["F-2020-LATEST", "PF-LATEST", "REF-LATEST", "Latest Fund"],
        )

    result = FirmSnapshotBuilder(database).rebuild([2020], COLLECTED_AT)

    with database.connection() as connection:
        snapshot = connection.execute(
            """
            SELECT selected_filing_id, firm_name, principal_country_code,
                   principal_state, is_us_based, is_sec_registered,
                   is_state_registered, primary_registration_type
            FROM firm_snapshots
            """
        ).fetchone()
        funds = connection.execute("SELECT private_fund_id FROM firm_snapshot_private_funds").fetchall()
    assert snapshot == ("F-2020-LATEST", "Latest Name", "US", "NY", True, True, None, "SEC")
    assert funds == [("PF-LATEST",)]
    assert result.snapshot_count == 1


def test_withdrawal_changes_registration_only_on_effective_date(tmp_path: Path) -> None:
    database = _database(tmp_path)
    _record_artifact(database, "history", "adv_part1", date(2024, 12, 31))
    _record_artifact(database, "advw", "advw", date(2024, 12, 31))
    _insert_historical_filing(
        database,
        filing_id="F-2020",
        firm_crd=9001,
        submitted=datetime(2020, 1, 10),
        firm_name="Leaving Adviser",
    )
    with database.transaction() as connection:
        connection.execute(
            """
            INSERT INTO registration_events VALUES (
                'withdrawal:1', 9001, 'SEC', 'SEC', 'WITHDRAWN', DATE '2022-06-30',
                NULL, NULL, 'advw', 'advw.csv', 2
            )
            """
        )

    FirmSnapshotBuilder(database).rebuild([2021, 2022], COLLECTED_AT)

    with database.connection() as connection:
        rows = connection.execute(
            "SELECT snapshot_year, is_sec_registered FROM firm_snapshots ORDER BY snapshot_year"
        ).fetchall()
    assert rows == [(2021, True), (2022, False)]


def test_monthly_snapshots_require_paired_categories_and_use_latest_common_2026_date(tmp_path: Path) -> None:
    database = _database(tmp_path)
    _record_artifact(database, "history", "adv_part1", date(2024, 12, 31))
    _insert_historical_filing(
        database,
        filing_id="F-2024",
        firm_crd=361,
        submitted=datetime(2024, 12, 1),
        firm_name="Historical Name",
    )
    for report_date, suffix in ((date(2025, 12, 31), "2025"), (date(2026, 8, 3), "2026")):
        for category in ("RIA", "ERA"):
            kind = "ria_report" if category == "RIA" else "era_report"
            artifact_id = f"{category.lower()}-{suffix}"
            _record_artifact(database, artifact_id, kind, report_date)
        _insert_monthly_observation(
            database,
            report_date=report_date,
            firm_crd=361,
            category="SEC",
            artifact_id=f"ria-{suffix}",
            firm_name=f"Firm {suffix}",
            country=None,
        )
        _insert_monthly_observation(
            database,
            report_date=report_date,
            firm_crd=88001,
            category="ERA",
            artifact_id=f"era-{suffix}",
            firm_name=f"ERA {suffix}",
            country="CAYMAN ISLANDS",
        )
    _record_artifact(database, "ria-unpaired", "ria_report", date(2026, 8, 20))
    _insert_monthly_observation(
        database,
        report_date=date(2026, 8, 20),
        firm_crd=361,
        category="SEC",
        artifact_id="ria-unpaired",
        firm_name="Too New",
        country="UNITED STATES",
    )

    FirmSnapshotBuilder(database).rebuild([2025, 2026], COLLECTED_AT)

    with database.connection() as connection:
        rows = connection.execute(
            """
            SELECT snapshot_year, snapshot_date, snapshot_status, firm_crd,
                   selected_filing_id, source_observation_date, firm_name,
                   principal_country_code, country_source_date, country_carried_forward
            FROM firm_snapshots
            WHERE firm_crd = 361
            ORDER BY snapshot_year
            """
        ).fetchall()
    assert rows == [
        (
            2025,
            date(2025, 12, 31),
            "year_end",
            361,
            None,
            date(2025, 12, 31),
            "Firm 2025",
            "US",
            date(2024, 12, 1),
            True,
        ),
        (
            2026,
            date(2026, 8, 3),
            "provisional",
            361,
            None,
            date(2026, 8, 3),
            "Firm 2026",
            "US",
            date(2024, 12, 1),
            True,
        ),
    ]


def test_failed_monthly_rebuild_rolls_back_previous_snapshot(tmp_path: Path) -> None:
    database = _database(tmp_path)
    for category in ("RIA", "ERA"):
        kind = "ria_report" if category == "RIA" else "era_report"
        artifact_id = category.lower()
        _record_artifact(database, artifact_id, kind, date(2025, 12, 31))
        _insert_monthly_observation(
            database,
            report_date=date(2025, 12, 31),
            firm_crd=361 if category == "RIA" else 88001,
            category="SEC" if category == "RIA" else "ERA",
            artifact_id=artifact_id,
            firm_name=category,
            country="UNITED STATES",
        )
    builder = FirmSnapshotBuilder(database)
    builder.rebuild([2025], COLLECTED_AT)
    with database.transaction() as connection:
        connection.execute("DELETE FROM dated_firm_observations WHERE category = 'ERA'")

    with pytest.raises(SnapshotBuildError, match="RIA and ERA"):
        builder.rebuild([2025], COLLECTED_AT)

    with database.connection() as connection:
        rows = connection.execute(
            "SELECT firm_crd, firm_name FROM firm_snapshots WHERE snapshot_year = 2025 ORDER BY firm_crd"
        ).fetchall()
    assert rows == [(361, "RIA"), (88001, "ERA")]
