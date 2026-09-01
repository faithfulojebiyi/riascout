"""Canonical mapping for historical Form ADV Part 1 and ADV-W tables."""

import json
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from duckdb import DuckDBPyConnection

from riascout_adv_data.field_mapping import ColumnMappingError, ColumnResolver
from riascout_adv_data.official_db import OfficialDatabase
from riascout_adv_data.raw_ingest import quote_ident

TRANSFORMATION_VERSION = "official-v3"

BASE_FIELDS = {
    "filing_id": ("FilingID", "Filing ID"),
    "submitted_at": ("DateSubmitted", "Date Submitted"),
    "firm_crd": ("1E1", "CRD Number"),
    "sec_number": ("1D", "SEC Number"),
    "firm_name": ("1A", "Legal Name", "Primary Business Name"),
    "principal_street_1": ("1F1a", "1F1-Address 1"),
    "principal_street_2": ("1F1b", "1F1-Address 2"),
    "principal_city": ("1F1-City",),
    "principal_region": ("1F1-State",),
    "principal_country": ("1F1-Country",),
    "principal_postal_code": ("1F3", "1F1-Postal Code"),
    "regulatory_aum": ("5F2c",),
    "discretionary_aum": ("5F2a",),
    "non_discretionary_aum": ("5F2b",),
    "employee_count": ("5A",),
    "advisory_employee_count": ("5B1",),
    "client_count": ("5F2f",),
    "other_office_count": ("1F5",),
}

CLIENT_TYPES = {
    "Individuals": ("5D1a", "5D3a"),
    "High_Net_Worth_Individuals": ("5D1b", "5D3b"),
    "Banking_or_Thrift": ("5D1c", "5D3c"),
    "Investment_Companies": ("5D1d", "5D3d"),
    "Business_Development_Companies": ("5D1e", "5D3e"),
    "Pooled_Investment_Vehicles": ("5D1f", "5D3f"),
    "Pension_and_Profit_Sharing": ("5D1g", "5D3g"),
    "Charitable_Organizations": ("5D1h", "5D3h"),
    "Corporations_or_Other_Businesses": ("5D1i", "5D3i"),
    "State_or_Municipal_Governments": ("5D1j", "5D3j"),
    "Other_Investment_Advisers": ("5D1k", "5D3k"),
    "Insurance_Companies": ("5D1l", "5D3l"),
    "Sovereign_Wealth_Funds": ("5D1m", "5D3m"),
}

SERVICES = {
    "5G1": "Financial Planning Services",
    "5G2": "Portfolio Management for Individuals & Small Businesses",
    "5G3": "Portfolio Management for Investment Companies",
    "5G4": "Portfolio Management for Pooled Investment Vehicles",
    "5G5": "Portfolio Management for Businesses or Institutional Clients",
    "5G6": "Pension Consulting Services",
    "5G7": "Selection of Other Advisers",
    "5G8": "Publication of Periodicals or Newsletters",
    "5G9": "Security Ratings or Pricing Services",
    "5G10": "Market Timing Services",
    "5G11": "Educational Seminars/Workshops",
    "5G12": "Other",
}

FEE_METHODS = {
    "5E1": "Percentage of Assets Under Management",
    "5E2": "Hourly Charges",
    "5E3": "Subscription Fees",
    "5E4": "Fixed Fees",
    "5E5": "Commissions",
    "5E6": "Performance-Based Fees",
    "5E7": "Other",
}

ASSET_ALLOCATIONS = {
    "5K(1)(a)(i)EOY": "Exchange-Traded Equity",
    "5K(1)(a)(ii)EOY": "Non-Exchange-Traded Equity",
    "5K(1)(a)(iii)EOY": "U.S. Government Bonds",
    "5K(1)(a)(iv)EOY": "U.S. State and Local Bonds",
    "5K(1)(a)(v)EOY": "Sovereign Bonds",
    "5K(1)(a)(vi)EOY": "Investment-Grade Corporate Bonds",
    "5K(1)(a)(vii)EOY": "Non-Investment-Grade Corporate Bonds",
    "5K(1)(a)(viii)EOY": "Derivatives",
    "5K(1)(a)(ix)EOY": "Registered Investment Companies",
    "5K(1)(a)(x)EOY": "Pooled Investment Vehicles",
    "5K(1)(a)(xi)EOY": "Cash and Cash Equivalents",
    "5K(1)(a)(xii)EOY": "Other",
}


class CanonicalMappingError(ValueError):
    """Raised when required historical source fields cannot be mapped safely."""


@dataclass(frozen=True)
class CanonicalizationResult:
    """Counts produced by one historical canonical publication."""

    published_filings: int
    quarantined_rows: int


@dataclass(frozen=True)
class _RawTable:
    artifact_id: str
    dataset_kind: str
    member_name: str
    table_name: str
    columns: tuple[str, ...]


class HistoricalCanonicalizer:
    """Publish filing-version facts without cross-filing aggregation."""

    def __init__(self, database: OfficialDatabase) -> None:
        """Initialize the canonicalizer for one official database."""
        self._database = database

    def publish(self, artifact_ids: Sequence[str]) -> CanonicalizationResult:
        """Publish historical artifacts atomically and idempotently."""
        unique_ids = tuple(dict.fromkeys(artifact_ids))
        if not unique_ids:
            raise ValueError("artifact_ids must not be empty")
        if self._already_published(unique_ids):
            return self._result(unique_ids)

        quarantined_rows = 0
        with self._database.transaction() as connection:
            tables = self._tables(connection, unique_ids)
            if not tables:
                raise CanonicalMappingError("No ingested raw tables were found for the requested artifacts")
            filing_types = _filing_types(connection, tables)
            self._replace_previous_publication(connection, unique_ids)
            for artifact_id in unique_ids:
                connection.execute(
                    """
                    INSERT INTO canonicalization_runs (
                        artifact_id, transformation_version, status, started_at, quarantined_rows
                    ) VALUES (?, ?, 'running', ?, 0)
                    ON CONFLICT (artifact_id, transformation_version) DO UPDATE SET
                        status = 'running', started_at = excluded.started_at,
                        completed_at = NULL, quarantined_rows = 0, message = NULL
                    """,
                    [artifact_id, TRANSFORMATION_VERSION, datetime.now(UTC)],
                )

            base_tables = [
                table
                for table in tables
                if _member_starts(table, "ia_adv_base_a") or _member_starts(table, "era_adv_base_")
            ]
            for table in base_tables:
                quarantined_rows += self._publish_base(connection, table, filing_types)

            valid_filing_ids = {str(row[0]) for row in connection.execute("SELECT filing_id FROM filings").fetchall()}
            valid_filing_ids_by_category = {
                category: {
                    str(row[0])
                    for row in connection.execute(
                        "SELECT filing_id FROM filings WHERE registration_category = ?",
                        [category],
                    ).fetchall()
                }
                for category in ("SEC", "ERA")
            }
            for table in tables:
                normalized = Path(table.member_name).name.lower()
                source_category = _source_registration_category(normalized)
                source_filing_ids = (
                    valid_filing_ids if source_category is None else valid_filing_ids_by_category[source_category]
                )
                if normalized.startswith(("ia_schedule_d_7b1_", "era_schedule_d_7b1_")):
                    self._publish_private_funds(connection, table, source_filing_ids)
                elif normalized.startswith(("ia_schedule_d_1f_", "era_schedule_d_1f_")):
                    self._publish_offices(connection, table, source_filing_ids)
                elif normalized.startswith("ia_schedule_d_5k1_"):
                    self._publish_asset_allocations(connection, table, source_filing_ids)
                elif normalized.startswith(("ia_schedule_d_5k3_", "ia_schedule_d_7b1a25_", "era_schedule_d_7b1a25_")):
                    assert source_category is not None
                    self._publish_custodians(connection, table, source_category)
                elif _is_primary_affiliation_member(normalized):
                    assert source_category is not None
                    self._publish_affiliations(connection, table, source_category)
                elif table.dataset_kind == "advw" and "advw" in normalized and "base" in normalized:
                    quarantined_rows += self._publish_advw(connection, table)

            self._publish_era_final_events(connection, filing_types)
            completed_at = datetime.now(UTC)
            for artifact_id in unique_ids:
                connection.execute(
                    """
                    UPDATE canonicalization_runs
                    SET status = 'published', completed_at = ?, quarantined_rows = ?
                    WHERE artifact_id = ? AND transformation_version = ?
                    """,
                    [completed_at, quarantined_rows, artifact_id, TRANSFORMATION_VERSION],
                )
                connection.execute(
                    """
                    UPDATE source_artifacts
                    SET ingest_status = 'canonicalized', transformation_version = ?
                    WHERE artifact_id = ?
                    """,
                    [TRANSFORMATION_VERSION, artifact_id],
                )
        return self._result(unique_ids)

    @staticmethod
    def _replace_previous_publication(
        connection: DuckDBPyConnection,
        artifact_ids: tuple[str, ...],
    ) -> None:
        """Remove prior canonical rows for a transformation-version rebuild."""
        placeholders = ", ".join("?" for _ in artifact_ids)
        for table in (
            "firm_snapshot_registration_types",
            "firm_snapshot_field_provenance",
            "snapshot_coverage",
            "firm_snapshots",
        ):
            connection.execute(f"DELETE FROM {table}")
        for table in (
            "filing_client_types",
            "filing_services",
            "filing_offices",
            "filing_asset_allocations",
            "filing_custodians",
            "filing_private_funds",
            "filing_affiliations",
            "firm_addresses",
            "firm_metrics",
            "firm_names",
        ):
            connection.execute(
                f"""
                DELETE FROM {table}
                WHERE filing_id IN (
                    SELECT filing_id FROM filings WHERE artifact_id IN ({placeholders})
                )
                """,
                list(artifact_ids),
            )
        connection.execute(
            f"DELETE FROM registration_events WHERE artifact_id IN ({placeholders})",
            list(artifact_ids),
        )
        connection.execute(
            f"DELETE FROM filings WHERE artifact_id IN ({placeholders})",
            list(artifact_ids),
        )
        connection.execute(
            f"""
            DELETE FROM raw_row_errors
            WHERE artifact_id IN ({placeholders})
              AND error_code IN ('invalid_base_identity', 'invalid_advw_identity')
            """,
            list(artifact_ids),
        )

    def _already_published(self, artifact_ids: tuple[str, ...]) -> bool:
        placeholders = ", ".join("?" for _ in artifact_ids)
        with self._database.connection() as connection:
            row = connection.execute(
                f"""
                SELECT count(*) FROM canonicalization_runs
                WHERE artifact_id IN ({placeholders})
                  AND transformation_version = ? AND status = 'published'
                """,
                [*artifact_ids, TRANSFORMATION_VERSION],
            ).fetchone()
        return row is not None and int(row[0]) == len(artifact_ids)

    def _result(self, artifact_ids: tuple[str, ...]) -> CanonicalizationResult:
        placeholders = ", ".join("?" for _ in artifact_ids)
        with self._database.connection() as connection:
            filing_row = connection.execute(
                f"SELECT count(*) FROM filings WHERE artifact_id IN ({placeholders})",
                list(artifact_ids),
            ).fetchone()
            quarantine_row = connection.execute(
                f"""
                SELECT coalesce(sum(quarantined_rows), 0) FROM canonicalization_runs
                WHERE artifact_id IN ({placeholders}) AND transformation_version = ?
                """,
                [*artifact_ids, TRANSFORMATION_VERSION],
            ).fetchone()
        return CanonicalizationResult(
            published_filings=int(filing_row[0]) if filing_row else 0,
            quarantined_rows=int(quarantine_row[0]) if quarantine_row else 0,
        )

    @staticmethod
    def _tables(connection: DuckDBPyConnection, artifact_ids: tuple[str, ...]) -> list[_RawTable]:
        placeholders = ", ".join("?" for _ in artifact_ids)
        rows = connection.execute(
            f"""
            SELECT i.artifact_id, a.dataset_kind, i.member_name, i.raw_table_name, i.columns_json
            FROM raw_table_inventory i
            JOIN source_artifacts a USING (artifact_id)
            WHERE i.artifact_id IN ({placeholders})
            ORDER BY i.artifact_id, i.member_name
            """,
            list(artifact_ids),
        ).fetchall()
        return [
            _RawTable(str(row[0]), str(row[1]), str(row[2]), str(row[3]), tuple(json.loads(str(row[4]))))
            for row in rows
        ]

    def _publish_base(
        self,
        connection: DuckDBPyConnection,
        table: _RawTable,
        filing_types: dict[str, str],
    ) -> int:
        try:
            resolver = ColumnResolver(table.columns)
            filing_column = resolver.require("filing_id", BASE_FIELDS["filing_id"])
            submitted_column = resolver.require("submitted_at", BASE_FIELDS["submitted_at"])
            crd_column = resolver.require("firm_crd", BASE_FIELDS["firm_crd"])
            sec_number_column = resolver.require("sec_number", BASE_FIELDS["sec_number"])
            firm_name_column = resolver.require("firm_name", BASE_FIELDS["firm_name"])
            columns = {
                field: resolver.optional(field, aliases)
                for field, aliases in BASE_FIELDS.items()
                if field not in {"filing_id", "submitted_at", "firm_crd", "sec_number", "firm_name"}
            }
        except ColumnMappingError as error:
            raise CanonicalMappingError(f"{table.member_name}: {error}") from error

        quarantined = 0
        expected_category = _source_registration_category(Path(table.member_name).name.lower())
        for row in _iter_rows(connection, table.table_name):
            filing_id = _text(row.get(filing_column))
            submitted_at = _parse_datetime(_text(row.get(submitted_column)))
            firm_crd = _integer(_text(row.get(crd_column)))
            sec_number = _text(row.get(sec_number_column))
            firm_name = _text(row.get(firm_name_column))
            if (
                not filing_id
                or submitted_at is None
                or firm_crd is None
                or not firm_name
                or (not sec_number and expected_category is None)
            ):
                self._quarantine(
                    connection,
                    table,
                    row,
                    "invalid_base_identity",
                    "Invalid filing ID, date, CRD, firm name, or unclassified registration cohort",
                )
                quarantined += 1
                continue
            if not date(2020, 1, 1) <= submitted_at.date() <= date(2026, 12, 31):
                continue
            sec_number_category = _registration_category(sec_number)
            if expected_category is not None and sec_number and sec_number_category != expected_category:
                continue
            category = expected_category or sec_number_category
            source_row = _source_row(row)
            submitted_date = submitted_at.date()
            connection.execute(
                """
                INSERT INTO firms VALUES (?, ?, ?)
                ON CONFLICT (firm_crd) DO UPDATE SET
                    first_seen_date = least(firms.first_seen_date, excluded.first_seen_date),
                    last_seen_date = greatest(firms.last_seen_date, excluded.last_seen_date)
                """,
                [firm_crd, submitted_date, submitted_date],
            )
            filing_type = filing_types.get(filing_id)
            connection.execute(
                """
                INSERT INTO filings VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
                """,
                [
                    filing_id,
                    firm_crd,
                    submitted_at,
                    filing_type,
                    sec_number,
                    category,
                    table.artifact_id,
                    table.member_name,
                    source_row,
                ],
            )
            connection.execute(
                "INSERT INTO firm_names VALUES (?, ?, ?, ?, ?)",
                [filing_id, firm_name, table.artifact_id, table.member_name, source_row],
            )
            connection.execute(
                """
                INSERT INTO firm_addresses VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?)
                """,
                [
                    filing_id,
                    _field(row, columns["principal_street_1"]),
                    _field(row, columns["principal_street_2"]),
                    _field(row, columns["principal_city"]),
                    _field(row, columns["principal_region"]),
                    _field(row, columns["principal_country"]),
                    _field(row, columns["principal_postal_code"]),
                    table.artifact_id,
                    table.member_name,
                    source_row,
                ],
            )
            other_offices = _integer(_field(row, columns["other_office_count"]))
            connection.execute(
                """
                INSERT INTO firm_metrics VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    filing_id,
                    _decimal(_field(row, columns["regulatory_aum"])),
                    _decimal(_field(row, columns["discretionary_aum"])),
                    _decimal(_field(row, columns["non_discretionary_aum"])),
                    _integer(_field(row, columns["employee_count"])),
                    _integer(_field(row, columns["advisory_employee_count"])),
                    _integer(_field(row, columns["client_count"])),
                    other_offices + 1 if other_offices is not None else None,
                    table.artifact_id,
                    table.member_name,
                    source_row,
                ],
            )
            self._publish_base_children(connection, table, row, filing_id, source_row)
            if not (category == "ERA" and filing_type and "final report" in filing_type.lower()):
                _insert_event(
                    connection,
                    event_id=f"filing:{filing_id}:{category}",
                    firm_crd=firm_crd,
                    category=category,
                    status="ACTIVE" if category in {"SEC", "ERA"} else "UNKNOWN",
                    effective_date=submitted_date,
                    filing_id=filing_id,
                    artifact_id=table.artifact_id,
                    member_name=table.member_name,
                    source_row=source_row,
                )
        return quarantined

    @staticmethod
    def _publish_base_children(
        connection: DuckDBPyConnection,
        table: _RawTable,
        row: dict[str, Any],
        filing_id: str,
        source_row: int,
    ) -> None:
        resolver = ColumnResolver(table.columns)
        for client_type, (count_alias, aum_alias) in CLIENT_TYPES.items():
            count_column = resolver.optional(f"{client_type}_count", (count_alias,))
            aum_column = resolver.optional(f"{client_type}_aum", (aum_alias,))
            count = _integer(_field(row, count_column))
            aum = _decimal(_field(row, aum_column))
            if count is None and aum is None:
                continue
            connection.execute(
                "INSERT INTO filing_client_types VALUES (?, ?, ?, ?, ?, ?, ?)",
                [filing_id, client_type, count, aum, table.artifact_id, table.member_name, source_row],
            )
        for source_field, service_type in SERVICES.items():
            column = resolver.optional(f"service_{source_field}", (source_field,))
            if _is_yes(_field(row, column)):
                connection.execute(
                    "INSERT INTO filing_services VALUES (?, ?, ?, ?, ?)",
                    [filing_id, service_type, table.artifact_id, table.member_name, source_row],
                )
        # only an affirmative flag is recorded; an absent 5E column is unknown,
        # not a statement that the firm charges nothing
        for source_field, fee_method in FEE_METHODS.items():
            column = resolver.optional(f"fee_{source_field}", (source_field,))
            if _is_yes(_field(row, column)):
                connection.execute(
                    "INSERT INTO filing_fee_methods VALUES (?, ?, ?, ?, ?)",
                    [filing_id, fee_method, table.artifact_id, table.member_name, source_row],
                )

    @staticmethod
    def _publish_private_funds(
        connection: DuckDBPyConnection,
        table: _RawTable,
        valid_filing_ids: set[str],
    ) -> None:
        resolver = ColumnResolver(table.columns)
        filing_column = resolver.require("filing_id", ("FilingID", "Filing ID"))
        fund_id_column = resolver.require("private_fund_id", ("Fund ID", "Private Fund ID", "PrivateFundID"))
        optional = {
            "name": resolver.optional("private_fund_name", ("Fund Name", "Name of the Private Fund")),
            "type": resolver.optional("private_fund_type", ("Fund Type", "Type of Private Fund")),
            "gross": resolver.optional("gross_asset_value", ("Gross Asset Value",)),
            "country": resolver.optional("country", ("Country",)),
            "region": resolver.optional("region", ("State",)),
        }
        for row in _iter_rows(connection, table.table_name):
            filing_id = _text(row.get(filing_column))
            fund_id = _text(row.get(fund_id_column))
            if not filing_id or filing_id not in valid_filing_ids or not fund_id:
                continue
            source_row = _source_row(row)
            connection.execute(
                "INSERT INTO filing_private_funds VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    filing_id,
                    fund_id,
                    _field(row, optional["name"]),
                    _field(row, optional["type"]),
                    _decimal(_field(row, optional["gross"])),
                    _field(row, optional["country"]),
                    _field(row, optional["region"]),
                    table.artifact_id,
                    table.member_name,
                    source_row,
                ],
            )

    @staticmethod
    def _publish_offices(connection: DuckDBPyConnection, table: _RawTable, valid_filing_ids: set[str]) -> None:
        resolver = ColumnResolver(table.columns)
        filing_column = resolver.require("filing_id", ("FilingID", "Filing ID"))
        fields = {
            "reference": resolver.optional("office_reference", ("ReferenceID", "Reference ID", "Office ID")),
            "city": resolver.optional("city", ("City",)),
            "region": resolver.optional("region", ("State",)),
            "country": resolver.optional("country", ("Country",)),
            "employees": resolver.optional("employee_count", ("Number of Employees", "Employees")),
        }
        for row in _iter_rows(connection, table.table_name):
            filing_id = _text(row.get(filing_column))
            if not filing_id or filing_id not in valid_filing_ids:
                continue
            source_row = _source_row(row)
            reference = _field(row, fields["reference"]) or f"row-{source_row}"
            connection.execute(
                "INSERT INTO filing_offices VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    filing_id,
                    reference,
                    _field(row, fields["city"]),
                    _field(row, fields["region"]),
                    _field(row, fields["country"]),
                    _integer(_field(row, fields["employees"])),
                    table.artifact_id,
                    table.member_name,
                    source_row,
                ],
            )

    @staticmethod
    def _publish_asset_allocations(
        connection: DuckDBPyConnection,
        table: _RawTable,
        valid_filing_ids: set[str],
    ) -> None:
        resolver = ColumnResolver(table.columns)
        filing_column = resolver.require("filing_id", ("FilingID", "Filing ID"))
        mapped = {source: resolver.optional(f"asset_{source}", (source,)) for source in ASSET_ALLOCATIONS}
        for row in _iter_rows(connection, table.table_name):
            filing_id = _text(row.get(filing_column))
            if not filing_id or filing_id not in valid_filing_ids:
                continue
            source_row = _source_row(row)
            for source_field, category in ASSET_ALLOCATIONS.items():
                percentage = _decimal(_field(row, mapped[source_field]))
                if percentage is None:
                    continue
                connection.execute(
                    "INSERT INTO filing_asset_allocations VALUES (?, ?, 'EOY', ?, ?, ?, ?)",
                    [filing_id, category, percentage, table.artifact_id, table.member_name, source_row],
                )

    @staticmethod
    def _publish_custodians(
        connection: DuckDBPyConnection,
        table: _RawTable,
        expected_category: str,
    ) -> None:
        resolver = ColumnResolver(table.columns)
        filing_column = resolver.require("filing_id", ("FilingID", "Filing ID"))
        fields = {
            "reference": resolver.optional("custodian_reference", ("ReferenceID", "Reference ID", "Custodian ID")),
            "name": _first_optional_column(
                resolver,
                "custodian_name",
                (
                    "Custodian Name",
                    "Legal Name of Custodian",
                    "Legal Name",
                    "Primary Business Name",
                    "Business Name",
                ),
            ),
            "city": resolver.optional("city", ("City", "5K(3)(c) City")),
            "region": resolver.optional("region", ("State", "5K(3)(c) State")),
            "country": resolver.optional("country", ("Country", "5K(3)(c) Country")),
            "aum": resolver.optional("aum", ("AUM at Custodian", "5K(3)(g)")),
        }
        subtype = "SMA" if "5k3" in table.member_name.lower() else "PRIVATE_FUND"
        source_reference = _sql_text(fields["reference"])
        if subtype == "PRIVATE_FUND":
            custodian_reference = "'row-' || cast(r._source_row_number AS VARCHAR)"
            private_fund_id = source_reference
        else:
            custodian_reference = f"coalesce({source_reference}, 'row-' || cast(r._source_row_number AS VARCHAR))"
            private_fund_id = "NULL::VARCHAR"
        valid_row_condition = (
            "r._raw_values_json IS NULL"
            if _table_has_column(connection, table.table_name, "_raw_values_json")
            else "TRUE"
        )
        connection.execute(
            f"""
            INSERT INTO filing_custodians (
                filing_id, custodian_reference, source_subtype, private_fund_id,
                custodian_name, city, region_raw, country_raw, aum_at_custodian,
                artifact_id, source_member, source_row_number
            )
            SELECT f.filing_id, {custodian_reference}, ?, {private_fund_id},
                   {_sql_text(fields["name"])}, {_sql_text(fields["city"])},
                   {_sql_text(fields["region"])}, {_sql_text(fields["country"])},
                   {_sql_decimal(fields["aum"])}, ?, ?, r._source_row_number
            FROM {quote_ident(table.table_name)} r
            JOIN filings f ON f.filing_id = {_sql_text(filing_column)}
            WHERE {valid_row_condition} AND f.registration_category = ?
            """,
            [subtype, table.artifact_id, table.member_name, expected_category],
        )

    @staticmethod
    def _publish_affiliations(
        connection: DuckDBPyConnection,
        table: _RawTable,
        expected_category: str,
    ) -> None:
        resolver = ColumnResolver(table.columns)
        filing_column = resolver.require("filing_id", ("FilingID", "Filing ID"))
        fields = {
            "reference": resolver.optional("reference", ("ReferenceID", "Reference ID")),
            "legal": resolver.optional("legal_name", ("Legal Name",)),
            "business": resolver.optional("business_name", ("Business Name",)),
            "sec": resolver.optional("sec_number", ("SEC Number", "SEC Number or Other")),
            "crd": resolver.optional("crd", ("CRD Number",)),
            "relationships": resolver.optional("relationships", ("Relationship Types", "Relationship Type", "Type")),
            "region": resolver.optional("region", ("State",)),
            "country": resolver.optional("country", ("Country",)),
        }
        filing = _sql_text(filing_column)
        reference = _sql_text(fields["reference"])
        connection.execute(
            f"""
            INSERT INTO filing_affiliations
            SELECT f.filing_id,
                   coalesce({reference}, 'row-' || cast(r._source_row_number AS VARCHAR)),
                   {_sql_text(fields["legal"])},
                   {_sql_text(fields["business"])},
                   {_sql_text(fields["sec"])},
                   {_sql_integer(fields["crd"])},
                   {_sql_text(fields["relationships"])},
                   {_sql_text(fields["country"])},
                   {_sql_text(fields["region"])},
                   ?, ?, r._source_row_number
            FROM {quote_ident(table.table_name)} r
            JOIN filings f ON f.filing_id = {filing}
            WHERE r._raw_values_json IS NULL AND f.registration_category = ?
            """,
            [table.artifact_id, table.member_name, expected_category],
        )

    def _publish_advw(self, connection: DuckDBPyConnection, table: _RawTable) -> int:
        resolver = ColumnResolver(table.columns)
        try:
            filing_column = resolver.require("filing_id", ("FilingID", "Filing ID"))
            crd_column = resolver.require("firm_crd", ("1E1", "CRD Number"))
            submitted_column = resolver.require("submitted_at", ("DateSubmitted", "Date Submitted"))
            effective_column = resolver.optional("effective_date", ("Effective Date", "EffectiveDate"))
            sec_column = resolver.optional("sec_number", ("1D", "SEC Number"))
            type_column = resolver.optional("withdrawal_type", ("Withdrawal Type", "WithdrawalType"))
        except ColumnMappingError as error:
            raise CanonicalMappingError(f"{table.member_name}: {error}") from error
        quarantined = 0
        for row in _iter_rows(connection, table.table_name):
            filing_id = _text(row.get(filing_column))
            firm_crd = _integer(_text(row.get(crd_column)))
            submitted = _parse_datetime(_text(row.get(submitted_column)))
            effective = _parse_date(_field(row, effective_column)) or (submitted.date() if submitted else None)
            sec_number = _field(row, sec_column)
            if not filing_id or firm_crd is None or effective is None:
                self._quarantine(connection, table, row, "invalid_advw_identity", "Invalid ADV-W filing, CRD, or date")
                quarantined += 1
                continue
            withdrawal_type = (_field(row, type_column) or "FULL").upper()
            category = _registration_category(sec_number)
            status = "WITHDRAWN" if "FULL" in withdrawal_type else "PARTIALLY_WITHDRAWN"
            _insert_event(
                connection,
                event_id=f"advw:{filing_id}:{category}",
                firm_crd=firm_crd,
                category=category,
                status=status,
                effective_date=effective,
                filing_id=filing_id,
                artifact_id=table.artifact_id,
                member_name=table.member_name,
                source_row=_source_row(row),
            )
        return quarantined

    @staticmethod
    def _publish_era_final_events(connection: DuckDBPyConnection, filing_types: dict[str, str]) -> None:
        for filing_id, filing_type in filing_types.items():
            if "final report" not in filing_type.lower():
                continue
            row = connection.execute(
                """
                SELECT firm_crd, registration_category, CAST(submitted_at AS DATE), artifact_id,
                       source_member, source_row_number
                FROM filings WHERE filing_id = ?
                """,
                [filing_id],
            ).fetchone()
            if row is None or str(row[1]) != "ERA":
                continue
            _insert_event(
                connection,
                event_id=f"era-final:{filing_id}",
                firm_crd=int(row[0]),
                category="ERA",
                status="FINAL_REPORTED",
                effective_date=row[2],
                filing_id=filing_id,
                artifact_id=str(row[3]),
                member_name=str(row[4]),
                source_row=int(row[5]),
            )

    @staticmethod
    def _quarantine(
        connection: DuckDBPyConnection,
        table: _RawTable,
        row: dict[str, Any],
        code: str,
        message: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO raw_row_errors (
                artifact_id, member_name, source_row_number, error_code,
                error_message, raw_values_json, recorded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                table.artifact_id,
                table.member_name,
                _source_row(row),
                code,
                message,
                json.dumps(row, default=str),
                datetime.now(UTC),
            ],
        )


def _filing_types(connection: DuckDBPyConnection, tables: Sequence[_RawTable]) -> dict[str, str]:
    result: dict[str, str] = {}
    for table in tables:
        if not _member_starts(table, "adv_filing_types"):
            continue
        resolver = ColumnResolver(table.columns)
        try:
            filing_column = resolver.require("filing_id", ("FilingID", "Filing ID"))
        except ColumnMappingError as error:
            raise CanonicalMappingError(f"{table.member_name}: {error}") from error
        direct_type = resolver.optional("filing_type", ("FilingType", "Filing Type"))
        for row in _iter_rows(connection, table.table_name):
            filing_id = _text(row.get(filing_column))
            if not filing_id:
                continue
            filing_type = _field(row, direct_type) or _type_from_boolean_columns(row, table.columns)
            if filing_type:
                result[filing_id] = filing_type
    return result


def _type_from_boolean_columns(row: dict[str, Any], columns: tuple[str, ...]) -> str | None:
    for column in columns:
        if column.startswith("_") or not _is_yes(_text(row.get(column))):
            continue
        normalized = "".join(character for character in column.lower() if character.isalnum())
        if any(term in normalized for term in ("amendment", "application", "initialreport", "finalreport")):
            return column
    return None


def _iter_rows(connection: DuckDBPyConnection, table_name: str) -> Iterator[dict[str, Any]]:
    cursor = connection.cursor()
    cursor.execute(f"SELECT * FROM {quote_ident(table_name)}")
    columns = [str(description[0]) for description in cursor.description]
    while rows := cursor.fetchmany(1000):
        for row in rows:
            yield dict(zip(columns, row, strict=True))
    cursor.close()


def _member_starts(table: _RawTable, prefix: str) -> bool:
    return Path(table.member_name).name.lower().startswith(prefix)


def _source_registration_category(normalized_member_name: str) -> str | None:
    """Return the registration cohort encoded by an official archive member name."""
    if normalized_member_name.startswith("ia_"):
        return "SEC"
    if normalized_member_name.startswith("era_"):
        return "ERA"
    return None


def _field(row: dict[str, Any], column: str | None) -> str | None:
    return _text(row.get(column)) if column is not None else None


def _sql_text(column: str | None) -> str:
    """Return a source-text expression matching canonical blank handling."""
    if column is None:
        return "NULL::VARCHAR"
    return f"nullif(trim(cast(r.{quote_ident(column)} AS VARCHAR)), '')"


def _first_optional_column(
    resolver: ColumnResolver,
    field_name: str,
    aliases: tuple[str, ...],
) -> str | None:
    """Resolve the first present exact alias when source fields have documented precedence."""
    for alias in aliases:
        column = resolver.optional(field_name, (alias,))
        if column is not None:
            return column
    return None


def _sql_integer(column: str | None) -> str:
    """Return a nullable integer expression matching numeric canonicalization."""
    value = _sql_text(column)
    normalized = f"replace(replace(replace({value}, ',', ''), '$', ''), '%', '')"
    return f"try_cast(try_cast({normalized} AS DECIMAL(38, 2)) AS BIGINT)"


def _sql_decimal(column: str | None) -> str:
    """Return a nullable decimal expression matching numeric canonicalization."""
    value = _sql_text(column)
    normalized = f"replace(replace(replace({value}, ',', ''), '$', ''), '%', '')"
    return f"try_cast({normalized} AS DECIMAL(38, 2))"


def _table_has_column(
    connection: DuckDBPyConnection,
    table_name: str,
    column_name: str,
) -> bool:
    row = connection.execute(
        """
        SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'main' AND table_name = ? AND column_name = ?
        """,
        [table_name, column_name],
    ).fetchone()
    return row is not None and int(row[0]) > 0


def _is_primary_affiliation_member(normalized_member_name: str) -> bool:
    """Select the primary Schedule D 7A table, excluding its CIK support table."""
    return normalized_member_name.startswith(("ia_schedule_d_7a_", "era_schedule_d_7a_")) and not (
        normalized_member_name.startswith(("ia_schedule_d_7a_cik_", "era_schedule_d_7a_cik_"))
    )


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _source_row(row: dict[str, Any]) -> int:
    value = _integer(_text(row.get("_source_row_number")))
    if value is None:
        raise CanonicalMappingError("Raw row is missing _source_row_number provenance")
    return value


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    for pattern in (
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %I:%M %p",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y",
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(value, pattern)
        except ValueError:
            continue
    return None


def _parse_date(value: str | None) -> date | None:
    parsed = _parse_datetime(value)
    return parsed.date() if parsed else None


def _integer(value: str | None) -> int | None:
    decimal = _decimal(value)
    return int(decimal) if decimal is not None else None


def _decimal(value: str | None) -> Decimal | None:
    if not value:
        return None
    normalized = value.strip().replace(",", "").replace("$", "").replace("%", "")
    negative = normalized.startswith("(") and normalized.endswith(")")
    if negative:
        normalized = normalized[1:-1]
    try:
        parsed = Decimal(normalized)
    except InvalidOperation:
        return None
    if negative:
        parsed = -parsed
    return Decimal(format(parsed, "f"))


def _registration_category(sec_number: str | None) -> str:
    normalized = (sec_number or "").strip()
    if normalized.startswith("801"):
        return "SEC"
    if normalized.startswith("802"):
        return "ERA"
    return "UNKNOWN"


def _is_yes(value: str | None) -> bool:
    return (value or "").strip().upper() in {"Y", "YES", "TRUE", "1"}


def _insert_event(
    connection: DuckDBPyConnection,
    *,
    event_id: str,
    firm_crd: int,
    category: str,
    status: str,
    effective_date: date,
    filing_id: str,
    artifact_id: str,
    member_name: str,
    source_row: int,
) -> None:
    connection.execute(
        """
        INSERT INTO registration_events VALUES (?, ?, 'SEC', ?, ?, ?, ?, NULL, ?, ?, ?)
        """,
        [
            event_id,
            firm_crd,
            category,
            status,
            effective_date,
            filing_id,
            artifact_id,
            member_name,
            source_row,
        ],
    )


__all__ = ["CanonicalMappingError", "CanonicalizationResult", "HistoricalCanonicalizer"]
