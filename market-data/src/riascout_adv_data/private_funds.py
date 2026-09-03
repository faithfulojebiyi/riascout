"""Complete Schedule D 7.B.1 private-fund canonicalization."""

from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Protocol

from duckdb import DuckDBPyConnection

from riascout_adv_data.field_mapping import ColumnMappingError, ColumnResolver
from riascout_adv_data.raw_ingest import quote_ident


class PrivateFundMappingError(ValueError):
    """Raised when a private-fund source table cannot be mapped losslessly."""


class RawTable(Protocol):
    """Raw-table fields required by the private-fund publisher."""

    @property
    def artifact_id(self) -> str: ...

    @property
    def member_name(self) -> str: ...

    @property
    def table_name(self) -> str: ...

    @property
    def columns(self) -> tuple[str, ...]: ...


@dataclass(frozen=True)
class _MappedTable:
    table: RawTable
    family: str
    columns: Mapping[str, str | None]


MAIN_FIELDS: dict[str, tuple[str, ...]] = {
    "filing_id": ("FilingID", "Filing ID"),
    "private_fund_name": ("Fund Name",),
    "private_fund_id": ("Fund ID", "Private Fund ID", "PrivateFundID"),
    "fund_reference": ("ReferenceID", "Reference ID"),
    "region_raw": ("State",),
    "country_raw": ("Country",),
    "exclusion_3c1": ("3(c)(1) Exclusion",),
    "exclusion_3c7": ("3(c)(7) Exclusion",),
    "is_master_fund": ("Master Fund",),
    "is_feeder_fund": ("Feeder Fund",),
    "master_fund_name": ("Master Fund Name",),
    "master_fund_id": ("Master Fund ID",),
    "is_fund_of_funds": ("Fund of Funds",),
    "adviser_or_related_invested": ("Fund Invested Self or Related",),
    "invested_in_registered_investment_companies": ("Fund Invested in Securities",),
    "private_fund_type": ("Fund Type", "Type of Private Fund"),
    "private_fund_type_other": ("Fund Type Other",),
    "gross_asset_value": ("Gross Asset Value",),
    "minimum_investment": ("Minimum Investment",),
    "beneficial_owner_count": ("Owners",),
    "owned_by_adviser_related_pct": ("%Owned You or Related",),
    "owned_by_funds_pct": ("%Owned Funds",),
    "sales_limited_to_qualified_clients": ("Sales Limited",),
    "owned_by_non_us_pct": ("%Owned Non-US",),
    "is_subadviser": ("Subadviser",),
    "has_other_advisers": ("Other IAs Advise",),
    "clients_solicited": ("Clients Solicited",),
    "clients_invested_pct": ("Percentage Invested",),
    "relied_on_regulation_d": ("Exempt from Registration",),
    "annual_audit": ("Annual Audit",),
    "financial_statements_gaap": ("GAAP",),
    "financial_statements_distributed": ("FS Distributed",),
    "audit_opinion_status": ("Unqualified Opinion",),
    "uses_prime_brokers": ("Prime Brokers",),
    "uses_custodians": ("Custodians",),
    "uses_administrator": ("Administrator",),
    "externally_valued_assets_pct": ("% Assets Valued",),
    "uses_marketers": ("Marketing",),
}

CHILD_FIELDS: dict[str, dict[str, tuple[str, ...]]] = {
    "a3a": {"filing_id": ("FilingID",), "fund_reference": ("ReferenceID",), "name": ("Name of Partner, etc.",)},
    "a3b": {"filing_id": ("FilingID",), "fund_reference": ("ReferenceID",), "name": ("Filing/Relying Adviser",)},
    "a5": {"filing_id": ("FilingID",), "fund_reference": ("ReferenceID",), "name": ("Foreign Regulatory Authority",)},
    "a6b": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "name": ("Private Fund Name",),
        "related_id": ("Fund ID",),
    },
    "a7d1": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "source_reference": ("SubreferenceID",),
        "name": ("Name of General Partner, etc.",),
    },
    "a7d2": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "source_reference": ("SubreferenceID",),
        "name": ("Filing/Relying Adviser",),
    },
    "a7f": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "source_reference": ("SubreferenceID",),
        "name": ("Foreign Regulatory Authority",),
    },
    "a17b": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "name": ("Name of Adviser",),
        "sec_number": ("SEC File Number",),
        "crd_number": ("CRD Number",),
    },
    "a18b": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "name": ("Name of Adviser",),
        "sec_number": ("SEC File Number",),
        "crd_number": ("CRD Number",),
    },
    "a22": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "form_d_file_number": ("Form D File Number",),
    },
    "a23": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "name": ("Name of Auditing Firm",),
        "city": ("City",),
        "region_raw": ("State",),
        "country_raw": ("Country",),
        "independent": ("Independent",),
        "pcaob_registered": ("PCAOB Registered",),
        "pcaob_number": ("PCAOB Number",),
        "pcaob_inspected": ("PCAOB Inspected",),
    },
    "a24": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "name": ("Name of Prime Broker",),
        "sec_number": ("SEC Number",),
        "crd_number": ("CRD Number",),
        "city": ("City",),
        "region_raw": ("State",),
        "country_raw": ("Country",),
        "acts_as_custodian": ("Custodian",),
    },
    "a25": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "name": ("Legal Name of Custodian",),
        "business_name": ("Primary Business Name",),
        "city": ("City",),
        "region_raw": ("State",),
        "country_raw": ("Country",),
        "related_person": ("Related Person",),
        "sec_number": ("SEC Number",),
        "lei": ("Legal Entity Identifier",),
    },
    "a26": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "name": ("Name of Administrator",),
        "city": ("City",),
        "region_raw": ("State",),
        "country_raw": ("Country",),
        "related_person": ("Related Person",),
        "sends_statements": ("Statements",),
        "statement_sender": ("Who Sends Statements",),
    },
    "a28": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "source_reference": ("SubreferenceID",),
        "related_person": ("Related Person",),
        "name": ("Name of Marketer",),
        "sec_number": ("SEC Number",),
        "crd_number": ("CRD Number",),
        "city": ("City",),
        "region_raw": ("State",),
        "country_raw": ("Country",),
        "has_websites": ("Websites",),
    },
    "a28_websites": {
        "filing_id": ("FilingID",),
        "fund_reference": ("ReferenceID",),
        "source_reference": ("SubreferenceID",),
        "website_address": ("Website Address",),
    },
}


def private_fund_family(member_name: str) -> str | None:
    """Return the exact 7.B.1 source family encoded by an archive member."""
    name = Path(member_name).name.lower()
    if not name.startswith(("ia_schedule_d_7b1", "era_schedule_d_7b1")):
        return None
    for family in sorted(CHILD_FIELDS, key=len, reverse=True):
        if f"7b1{family}_" in name:
            return family
    if "7b1_" in name:
        return "main"
    return None


def publish_private_fund_tables(
    connection: DuckDBPyConnection,
    tables: Sequence[RawTable],
    valid_filing_ids_by_category: Mapping[str, set[str]],
) -> None:
    """Publish complete main and child records after resolving SEC fund identities."""
    mapped = [_map_table(table) for table in tables if private_fund_family(table.member_name) is not None]
    for item in mapped:
        if item.family == "main":
            _publish_main(connection, item, _valid_filing_ids(item.table, valid_filing_ids_by_category))

    fund_ids = _fund_id_map(connection)
    for item in mapped:
        if item.family != "main":
            _publish_child(
                connection,
                item,
                _valid_filing_ids(item.table, valid_filing_ids_by_category),
                fund_ids,
            )
    _rebuild_private_funds(connection)


def _map_table(table: RawTable) -> _MappedTable:
    family = private_fund_family(table.member_name)
    if family is None:
        raise PrivateFundMappingError(f"{table.member_name}: not a Schedule D 7.B.1 table")
    specs = MAIN_FIELDS if family == "main" else CHILD_FIELDS[family]
    resolver = ColumnResolver(table.columns)
    required = (
        {"filing_id", "fund_reference", "private_fund_id"} if family == "main" else {"filing_id", "fund_reference"}
    )
    try:
        mapped = {
            field: resolver.require(field, aliases) if field in required else resolver.optional(field, aliases)
            for field, aliases in specs.items()
        }
    except ColumnMappingError as error:
        raise PrivateFundMappingError(f"{table.member_name}: {error}") from error
    claimed = {column for column in mapped.values() if column is not None}
    unexpected = sorted(column for column in table.columns if column not in claimed and not column.startswith("_"))
    if unexpected:
        raise PrivateFundMappingError(f"{table.member_name}: unmapped source columns: {', '.join(unexpected)}")
    return _MappedTable(table, family, mapped)


def _valid_filing_ids(table: RawTable, by_category: Mapping[str, set[str]]) -> set[str]:
    name = Path(table.member_name).name.lower()
    category = "SEC" if name.startswith("ia_") else "ERA"
    return by_category[category]


def _publish_main(connection: DuckDBPyConnection, mapped: _MappedTable, valid_filing_ids: set[str]) -> None:
    boolean_fields = {
        "exclusion_3c1",
        "exclusion_3c7",
        "is_master_fund",
        "is_feeder_fund",
        "is_fund_of_funds",
        "adviser_or_related_invested",
        "invested_in_registered_investment_companies",
        "sales_limited_to_qualified_clients",
        "is_subadviser",
        "has_other_advisers",
        "clients_solicited",
        "relied_on_regulation_d",
        "annual_audit",
        "financial_statements_gaap",
        "financial_statements_distributed",
        "uses_prime_brokers",
        "uses_custodians",
        "uses_administrator",
        "uses_marketers",
    }
    decimal_fields = {
        "gross_asset_value",
        "minimum_investment",
        "owned_by_adviser_related_pct",
        "owned_by_funds_pct",
        "owned_by_non_us_pct",
        "clients_invested_pct",
        "externally_valued_assets_pct",
    }
    data_fields = [field for field in MAIN_FIELDS if field not in {"filing_id", "private_fund_id"}]
    for row in _iter_rows(connection, mapped.table.table_name):
        filing_id = _field(row, mapped.columns["filing_id"])
        private_fund_id = _field(row, mapped.columns["private_fund_id"])
        if not filing_id or filing_id not in valid_filing_ids or not private_fund_id:
            continue
        values: list[object] = []
        for field in data_fields:
            value = _field(row, mapped.columns[field])
            if field in boolean_fields:
                values.append(_yes_no(value))
            elif field in decimal_fields:
                values.append(_decimal(value))
            elif field == "beneficial_owner_count":
                values.append(_integer(value))
            elif field == "audit_opinion_status":
                values.append(_audit_opinion(value))
            else:
                values.append(value)
        columns = ["filing_id", "private_fund_id", *data_fields, "artifact_id", "source_member", "source_row_number"]
        placeholders = ", ".join("?" for _ in columns)
        connection.execute(
            f"INSERT INTO filing_private_funds ({', '.join(columns)}) VALUES ({placeholders})",
            [filing_id, private_fund_id, *values, mapped.table.artifact_id, mapped.table.member_name, _source_row(row)],
        )


def _publish_child(
    connection: DuckDBPyConnection,
    mapped: _MappedTable,
    valid_filing_ids: set[str],
    fund_ids: Mapping[tuple[str, str], str],
) -> None:
    for row in _iter_rows(connection, mapped.table.table_name):
        filing_id = _field(row, mapped.columns["filing_id"])
        fund_reference = _field(row, mapped.columns["fund_reference"])
        if not filing_id or filing_id not in valid_filing_ids:
            continue
        if not fund_reference or (filing_id, fund_reference) not in fund_ids:
            raise PrivateFundMappingError(
                f"{mapped.table.member_name}: unresolved fund ReferenceID {fund_reference!r} for filing {filing_id!r}"
            )
        private_fund_id = fund_ids[(filing_id, fund_reference)]
        source_row = _source_row(row)
        explicit_reference = _field(row, mapped.columns.get("source_reference"))
        source_reference = explicit_reference or f"row-{source_row}"
        source_record_key = (
            f"{explicit_reference}:row-{source_row}" if explicit_reference is not None else source_reference
        )
        _insert_child(
            connection,
            mapped,
            row,
            filing_id,
            private_fund_id,
            fund_reference,
            source_reference,
            source_record_key,
            source_row,
        )


def _insert_child(
    connection: DuckDBPyConnection,
    mapped: _MappedTable,
    row: Mapping[str, Any],
    filing_id: str,
    private_fund_id: str,
    fund_reference: str,
    source_reference: str,
    source_record_key: str,
    source_row: int,
) -> None:
    family = mapped.family
    provenance = [mapped.table.artifact_id, mapped.table.member_name, source_row]
    common = [filing_id, private_fund_id, fund_reference]
    if family == "a6b":
        connection.execute(
            "INSERT INTO filing_private_fund_related_funds VALUES (?, ?, ?, 'feeder_fund', ?, ?, ?, ?, ?, ?)",
            [*common, source_record_key, _value(mapped, row, "name"), _value(mapped, row, "related_id"), *provenance],
        )
    elif family in {"a3a", "a3b", "a7d1", "a7d2"}:
        roles = {
            "a3a": "fund_partner_or_manager",
            "a3b": "fund_filing_or_relying_adviser",
            "a7d1": "master_fund_partner_or_manager",
            "a7d2": "master_fund_filing_or_relying_adviser",
        }
        connection.execute(
            "INSERT INTO filing_private_fund_managers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [*common, roles[family], source_record_key, _value(mapped, row, "name"), *provenance],
        )
    elif family in {"a5", "a7f"}:
        role = "fund" if family == "a5" else "master_fund"
        connection.execute(
            "INSERT INTO filing_private_fund_foreign_authorities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [*common, role, source_record_key, _value(mapped, row, "name"), *provenance],
        )
    elif family in {"a17b", "a18b"}:
        role = "primary_adviser" if family == "a17b" else "other_adviser"
        connection.execute(
            "INSERT INTO filing_private_fund_advisers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                *common,
                role,
                source_record_key,
                _value(mapped, row, "name"),
                _value(mapped, row, "sec_number"),
                _integer(_value(mapped, row, "crd_number")),
                *provenance,
            ],
        )
    elif family == "a22":
        connection.execute(
            "INSERT INTO filing_private_fund_form_d VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [*common, source_record_key, _value(mapped, row, "form_d_file_number"), *provenance],
        )
    elif family == "a28_websites":
        connection.execute(
            "INSERT INTO filing_private_fund_provider_websites VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                *common,
                source_reference,
                source_record_key,
                _value(mapped, row, "website_address"),
                *provenance,
            ],
        )
    else:
        _insert_service_provider(connection, mapped, row, common, source_record_key, provenance)
        if family == "a25":
            connection.execute(
                """
                INSERT INTO filing_custodians (
                    filing_id, custodian_reference, source_subtype, private_fund_id, custodian_name,
                    city, region_raw, country_raw, aum_at_custodian, artifact_id, source_member, source_row_number
                ) VALUES (?, ?, 'PRIVATE_FUND', ?, ?, ?, ?, ?, NULL, ?, ?, ?)
                """,
                [
                    filing_id,
                    f"row-{source_row}",
                    private_fund_id,
                    _value(mapped, row, "name"),
                    _value(mapped, row, "city"),
                    _value(mapped, row, "region_raw"),
                    _value(mapped, row, "country_raw"),
                    *provenance,
                ],
            )


def _insert_service_provider(
    connection: DuckDBPyConnection,
    mapped: _MappedTable,
    row: Mapping[str, Any],
    common: list[str],
    source_reference: str,
    provenance: list[object],
) -> None:
    roles = {"a23": "auditor", "a24": "prime_broker", "a25": "custodian", "a26": "administrator", "a28": "marketer"}
    boolean_fields_before_statement = (
        "related_person",
        "independent",
        "pcaob_registered",
        "pcaob_inspected",
        "acts_as_custodian",
        "sends_statements",
    )
    connection.execute(
        """
        INSERT INTO filing_private_fund_service_providers (
            filing_id, private_fund_id, fund_reference, provider_role, source_record_key,
            legal_name, business_name, sec_number, crd_number, pcaob_number, lei,
            city, region_raw, country_raw, related_person, independent, pcaob_registered,
            pcaob_inspected, acts_as_custodian, sends_statements, statement_sender, has_websites,
            artifact_id, source_member, source_row_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            *common,
            roles[mapped.family],
            source_reference,
            _value(mapped, row, "name"),
            _value(mapped, row, "business_name"),
            _value(mapped, row, "sec_number"),
            _integer(_value(mapped, row, "crd_number")),
            _value(mapped, row, "pcaob_number"),
            _value(mapped, row, "lei"),
            _value(mapped, row, "city"),
            _value(mapped, row, "region_raw"),
            _value(mapped, row, "country_raw"),
            *[_yes_no(_value(mapped, row, field)) for field in boolean_fields_before_statement],
            _value(mapped, row, "statement_sender"),
            _yes_no(_value(mapped, row, "has_websites")),
            *provenance,
        ],
    )


def _fund_id_map(connection: DuckDBPyConnection) -> dict[tuple[str, str], str]:
    rows = connection.execute("SELECT filing_id, fund_reference, private_fund_id FROM filing_private_funds").fetchall()
    result: dict[tuple[str, str], str] = {}
    for filing_id, fund_reference, private_fund_id in rows:
        key = (str(filing_id), str(fund_reference))
        value = str(private_fund_id)
        if key in result and result[key] != value:
            raise PrivateFundMappingError(f"conflicting SEC Fund IDs for filing/reference {key!r}")
        result[key] = value
    return result


def _rebuild_private_funds(connection: DuckDBPyConnection) -> None:
    connection.execute("DELETE FROM private_funds")
    connection.execute(
        """
        INSERT INTO private_funds
        SELECT p.private_fund_id,
               min(cast(f.submitted_at AS DATE)),
               max(cast(f.submitted_at AS DATE))
        FROM filing_private_funds p
        JOIN filings f USING (filing_id)
        GROUP BY p.private_fund_id
        """
    )


def _iter_rows(connection: DuckDBPyConnection, table_name: str) -> Iterator[dict[str, Any]]:
    cursor = connection.cursor()
    cursor.execute(f"SELECT * FROM {quote_ident(table_name)}")
    columns = [str(description[0]) for description in cursor.description]
    while rows := cursor.fetchmany(1000):
        for row in rows:
            yield dict(zip(columns, row, strict=True))
    cursor.close()


def _value(mapped: _MappedTable, row: Mapping[str, Any], field: str) -> str | None:
    return _field(row, mapped.columns.get(field))


def _field(row: Mapping[str, Any], column: str | None) -> str | None:
    if column is None or row.get(column) is None:
        return None
    value = str(row[column]).strip()
    return value or None


def _source_row(row: Mapping[str, Any]) -> int:
    value = _integer(_field(row, "_source_row_number"))
    if value is None:
        raise PrivateFundMappingError("raw private-fund row is missing source provenance")
    return value


def _yes_no(value: str | None) -> bool | None:
    normalized = (value or "").strip().upper()
    if normalized in {"Y", "YES", "TRUE", "1"}:
        return True
    if normalized in {"N", "NO", "FALSE", "0"}:
        return False
    return None


def _audit_opinion(value: str | None) -> str | None:
    normalized = (value or "").strip().upper()
    if normalized in {"Y", "YES", "TRUE", "1", "UNQUALIFIED"}:
        return "unqualified"
    if normalized in {"N", "NO", "FALSE", "0", "NOT UNQUALIFIED"}:
        return "not_unqualified"
    if normalized == "REPORT NOT YET RECEIVED":
        return "report_not_yet_received"
    return value


def _integer(value: str | None) -> int | None:
    decimal = _decimal(value)
    return int(decimal) if decimal is not None else None


def _decimal(value: str | None) -> Decimal | None:
    if not value:
        return None
    normalized = value.strip().replace(",", "").replace("$", "").replace("%", "")
    try:
        return Decimal(normalized)
    except InvalidOperation:
        return None


__all__ = [
    "PrivateFundMappingError",
    "private_fund_family",
    "publish_private_fund_tables",
]
