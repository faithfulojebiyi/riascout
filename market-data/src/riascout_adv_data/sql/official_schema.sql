CREATE SEQUENCE IF NOT EXISTS raw_error_sequence START 1;

CREATE TABLE IF NOT EXISTS source_artifacts (
    artifact_id VARCHAR PRIMARY KEY,
    dataset_key VARCHAR NOT NULL,
    dataset_kind VARCHAR NOT NULL,
    source_url VARCHAR NOT NULL,
    observation_date DATE,
    retrieved_at TIMESTAMPTZ NOT NULL,
    sha256 VARCHAR NOT NULL,
    payload_path VARCHAR NOT NULL,
    manifest_path VARCHAR NOT NULL,
    byte_count UBIGINT NOT NULL,
    ingest_status VARCHAR NOT NULL DEFAULT 'downloaded',
    transformation_version VARCHAR
);

CREATE TABLE IF NOT EXISTS raw_table_inventory (
    artifact_id VARCHAR NOT NULL,
    member_name VARCHAR NOT NULL,
    raw_table_name VARCHAR NOT NULL,
    row_count UBIGINT NOT NULL,
    columns_json JSON NOT NULL,
    header_row_number INTEGER NOT NULL DEFAULT 1,
    source_encoding VARCHAR DEFAULT 'utf-8',
    ingested_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (artifact_id, member_name)
);

ALTER TABLE raw_table_inventory
ADD COLUMN IF NOT EXISTS source_encoding VARCHAR DEFAULT 'utf-8';

CREATE TABLE IF NOT EXISTS raw_row_errors (
    sequence BIGINT DEFAULT nextval('raw_error_sequence'),
    artifact_id VARCHAR NOT NULL,
    member_name VARCHAR NOT NULL,
    source_row_number UBIGINT,
    error_code VARCHAR NOT NULL,
    error_message VARCHAR NOT NULL,
    raw_values_json JSON,
    recorded_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS canonicalization_runs (
    artifact_id VARCHAR NOT NULL,
    transformation_version VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    quarantined_rows UBIGINT NOT NULL DEFAULT 0,
    message VARCHAR,
    PRIMARY KEY (artifact_id, transformation_version)
);

CREATE TABLE IF NOT EXISTS firms (
    firm_crd BIGINT PRIMARY KEY,
    first_seen_date DATE,
    last_seen_date DATE
);

CREATE TABLE IF NOT EXISTS filings (
    filing_id VARCHAR PRIMARY KEY,
    firm_crd BIGINT NOT NULL,
    submitted_at TIMESTAMP NOT NULL,
    effective_date DATE,
    filing_type VARCHAR,
    sec_number VARCHAR,
    registration_category VARCHAR NOT NULL,
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS firm_names (
    filing_id VARCHAR PRIMARY KEY,
    firm_name VARCHAR NOT NULL,
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS firm_addresses (
    filing_id VARCHAR PRIMARY KEY,
    principal_street_1 VARCHAR,
    principal_street_2 VARCHAR,
    principal_city VARCHAR,
    principal_region_raw VARCHAR,
    principal_state VARCHAR,
    principal_country_raw VARCHAR,
    principal_country_code VARCHAR,
    principal_postal_code VARCHAR,
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS firm_metrics (
    filing_id VARCHAR PRIMARY KEY,
    regulatory_aum DECIMAL(38, 2),
    discretionary_aum DECIMAL(38, 2),
    non_discretionary_aum DECIMAL(38, 2),
    employee_count BIGINT,
    advisory_employee_count BIGINT,
    client_count BIGINT,
    office_count BIGINT,
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS filing_client_types (
    filing_id VARCHAR NOT NULL,
    client_type VARCHAR NOT NULL,
    client_count BIGINT,
    regulatory_aum DECIMAL(38, 2),
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL,
    PRIMARY KEY (filing_id, client_type)
);

CREATE TABLE IF NOT EXISTS filing_services (
    filing_id VARCHAR NOT NULL,
    service_type VARCHAR NOT NULL,
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL,
    PRIMARY KEY (filing_id, service_type)
);

CREATE TABLE IF NOT EXISTS filing_fee_methods (
    filing_id VARCHAR NOT NULL,
    fee_method VARCHAR NOT NULL,
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL,
    PRIMARY KEY (filing_id, fee_method)
);

CREATE TABLE IF NOT EXISTS filing_offices (
    filing_id VARCHAR NOT NULL,
    office_reference VARCHAR NOT NULL,
    city VARCHAR,
    region_raw VARCHAR,
    country_raw VARCHAR,
    employee_count BIGINT,
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL,
    PRIMARY KEY (filing_id, office_reference)
);

CREATE TABLE IF NOT EXISTS filing_asset_allocations (
    filing_id VARCHAR NOT NULL,
    asset_category VARCHAR NOT NULL,
    reporting_basis VARCHAR NOT NULL,
    percentage DECIMAL(18, 8),
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL,
    PRIMARY KEY (filing_id, asset_category, reporting_basis)
);

CREATE TABLE IF NOT EXISTS filing_custodians (
    filing_id VARCHAR NOT NULL,
    custodian_reference VARCHAR NOT NULL,
    source_subtype VARCHAR NOT NULL,
    private_fund_id VARCHAR,
    custodian_name VARCHAR,
    city VARCHAR,
    region_raw VARCHAR,
    country_raw VARCHAR,
    aum_at_custodian DECIMAL(38, 2),
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL,
    PRIMARY KEY (filing_id, custodian_reference, source_subtype)
);

ALTER TABLE filing_custodians
ADD COLUMN IF NOT EXISTS private_fund_id VARCHAR;

CREATE TABLE IF NOT EXISTS filing_private_funds (
    filing_id VARCHAR NOT NULL,
    private_fund_id VARCHAR NOT NULL,
    private_fund_name VARCHAR,
    private_fund_type VARCHAR,
    gross_asset_value DECIMAL(38, 2),
    country_raw VARCHAR,
    region_raw VARCHAR,
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL,
    PRIMARY KEY (filing_id, private_fund_id)
);

CREATE TABLE IF NOT EXISTS filing_affiliations (
    filing_id VARCHAR NOT NULL,
    affiliation_reference VARCHAR NOT NULL,
    legal_name VARCHAR,
    business_name VARCHAR,
    related_sec_number VARCHAR,
    related_crd BIGINT,
    relationship_types VARCHAR,
    country_raw VARCHAR,
    region_raw VARCHAR,
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL,
    PRIMARY KEY (filing_id, affiliation_reference)
);

CREATE TABLE IF NOT EXISTS registration_events (
    event_id VARCHAR PRIMARY KEY,
    firm_crd BIGINT NOT NULL,
    authority VARCHAR NOT NULL,
    category VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    effective_date DATE NOT NULL,
    filing_id VARCHAR,
    jurisdiction VARCHAR,
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS dated_firm_observations (
    report_date DATE NOT NULL,
    firm_crd BIGINT NOT NULL,
    category VARCHAR NOT NULL,
    firm_name VARCHAR,
    sec_number VARCHAR,
    filing_date DATE,
    principal_city VARCHAR,
    principal_region_raw VARCHAR,
    principal_country_raw VARCHAR,
    principal_postal_code VARCHAR,
    regulatory_aum DECIMAL(38, 2),
    employee_count BIGINT,
    advisory_employee_count BIGINT,
    artifact_id VARCHAR NOT NULL,
    source_member VARCHAR NOT NULL,
    source_row_number UBIGINT NOT NULL,
    PRIMARY KEY (report_date, firm_crd, category)
);

CREATE TABLE IF NOT EXISTS field_coverage (
    artifact_id VARCHAR NOT NULL,
    field_group VARCHAR NOT NULL,
    coverage_status VARCHAR NOT NULL,
    message VARCHAR,
    PRIMARY KEY (artifact_id, field_group)
);

CREATE TABLE IF NOT EXISTS firm_snapshots (
    snapshot_year INTEGER NOT NULL,
    snapshot_date DATE NOT NULL,
    snapshot_status VARCHAR NOT NULL,
    as_of_collected_at TIMESTAMPTZ NOT NULL,
    firm_crd BIGINT NOT NULL,
    firm_name VARCHAR,
    sec_number VARCHAR,
    selected_filing_id VARCHAR,
    selected_filing_date DATE,
    source_observation_date DATE,
    source_artifact_id VARCHAR NOT NULL,
    source_dataset VARCHAR NOT NULL,
    principal_country_raw VARCHAR,
    principal_country_code VARCHAR,
    principal_region_raw VARCHAR,
    principal_state VARCHAR,
    principal_country_method VARCHAR,
    country_source_date DATE,
    country_carried_forward BOOLEAN NOT NULL DEFAULT FALSE,
    is_us_based BOOLEAN,
    is_sec_registered BOOLEAN,
    is_era BOOLEAN,
    is_state_registered BOOLEAN,
    primary_registration_type VARCHAR NOT NULL,
    regulatory_aum DECIMAL(38, 2),
    employee_count BIGINT,
    advisory_employee_count BIGINT,
    validation_status VARCHAR NOT NULL,
    PRIMARY KEY (snapshot_year, firm_crd)
);

CREATE TABLE IF NOT EXISTS firm_snapshot_registration_types (
    snapshot_year INTEGER NOT NULL,
    firm_crd BIGINT NOT NULL,
    registration_type VARCHAR NOT NULL,
    PRIMARY KEY (snapshot_year, firm_crd, registration_type)
);

CREATE TABLE IF NOT EXISTS firm_snapshot_field_provenance (
    snapshot_year INTEGER NOT NULL,
    firm_crd BIGINT NOT NULL,
    field_name VARCHAR NOT NULL,
    source_artifact_id VARCHAR NOT NULL,
    source_date DATE,
    source_field VARCHAR,
    transformation_method VARCHAR NOT NULL,
    PRIMARY KEY (snapshot_year, firm_crd, field_name)
);

CREATE TABLE IF NOT EXISTS snapshot_coverage (
    snapshot_year INTEGER NOT NULL,
    entity_category VARCHAR NOT NULL,
    field_group VARCHAR NOT NULL,
    coverage_status VARCHAR NOT NULL,
    record_count UBIGINT NOT NULL,
    message VARCHAR,
    PRIMARY KEY (snapshot_year, entity_category, field_group)
);

CREATE OR REPLACE VIEW firm_snapshot_client_types AS
SELECT s.snapshot_year, s.snapshot_date, s.snapshot_status, s.firm_crd,
       c.filing_id, c.client_type, c.client_count, c.regulatory_aum,
       c.artifact_id, c.source_member, c.source_row_number
FROM firm_snapshots s
JOIN filing_client_types c ON c.filing_id = s.selected_filing_id;

CREATE OR REPLACE VIEW firm_snapshot_services AS
SELECT s.snapshot_year, s.snapshot_date, s.snapshot_status, s.firm_crd,
       c.filing_id, c.service_type, c.artifact_id, c.source_member, c.source_row_number
FROM firm_snapshots s
JOIN filing_services c ON c.filing_id = s.selected_filing_id;

CREATE OR REPLACE VIEW firm_snapshot_fee_methods AS
SELECT s.snapshot_year, s.snapshot_date, s.snapshot_status, s.firm_crd,
       c.filing_id, c.fee_method, c.artifact_id, c.source_member, c.source_row_number
FROM firm_snapshots s
JOIN filing_fee_methods c ON c.filing_id = s.selected_filing_id;

CREATE OR REPLACE VIEW firm_snapshot_offices AS
SELECT s.snapshot_year, s.snapshot_date, s.snapshot_status, s.firm_crd,
       c.filing_id, c.office_reference, c.city, c.region_raw, c.country_raw,
       c.employee_count, c.artifact_id, c.source_member, c.source_row_number
FROM firm_snapshots s
JOIN filing_offices c ON c.filing_id = s.selected_filing_id;

CREATE OR REPLACE VIEW firm_snapshot_asset_allocations AS
SELECT s.snapshot_year, s.snapshot_date, s.snapshot_status, s.firm_crd,
       c.filing_id, c.asset_category, c.reporting_basis, c.percentage,
       c.artifact_id, c.source_member, c.source_row_number
FROM firm_snapshots s
JOIN filing_asset_allocations c ON c.filing_id = s.selected_filing_id;

CREATE OR REPLACE VIEW firm_snapshot_custodians AS
SELECT s.snapshot_year, s.snapshot_date, s.snapshot_status, s.firm_crd,
       c.filing_id, c.custodian_reference, c.source_subtype, c.private_fund_id,
       c.custodian_name,
       c.city, c.region_raw, c.country_raw, c.aum_at_custodian,
       c.artifact_id, c.source_member, c.source_row_number
FROM firm_snapshots s
JOIN filing_custodians c ON c.filing_id = s.selected_filing_id;

CREATE OR REPLACE VIEW firm_snapshot_private_funds AS
SELECT s.snapshot_year, s.snapshot_date, s.snapshot_status, s.firm_crd,
       c.filing_id, c.private_fund_id, c.private_fund_name, c.private_fund_type,
       c.gross_asset_value, c.country_raw, c.region_raw,
       c.artifact_id, c.source_member, c.source_row_number
FROM firm_snapshots s
JOIN filing_private_funds c ON c.filing_id = s.selected_filing_id;

CREATE OR REPLACE VIEW firm_snapshot_affiliations AS
SELECT s.snapshot_year, s.snapshot_date, s.snapshot_status, s.firm_crd,
       c.filing_id, c.affiliation_reference, c.legal_name, c.business_name,
       c.related_sec_number, c.related_crd, c.relationship_types,
       c.country_raw, c.region_raw, c.artifact_id, c.source_member, c.source_row_number
FROM firm_snapshots s
JOIN filing_affiliations c ON c.filing_id = s.selected_filing_id;

CREATE TABLE IF NOT EXISTS individual_collection_runs (
    collection_id VARCHAR PRIMARY KEY,
    plan_artifact_id VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    highest_individual_crd BIGINT NOT NULL,
    expected_individual_count UBIGINT NOT NULL,
    retrieved_individual_count UBIGINT NOT NULL DEFAULT 0,
    expected_page_requests UBIGINT NOT NULL,
    completed_page_requests UBIGINT NOT NULL DEFAULT 0,
    collection_started_at TIMESTAMPTZ,
    collection_completed_at TIMESTAMPTZ,
    transformation_version VARCHAR,
    message VARCHAR
);

CREATE TABLE IF NOT EXISTS individual_query_shards (
    collection_id VARCHAR NOT NULL,
    low_crd BIGINT NOT NULL,
    high_crd BIGINT NOT NULL,
    expected_count UBIGINT NOT NULL,
    retrieved_count UBIGINT NOT NULL DEFAULT 0,
    page_count UBIGINT NOT NULL DEFAULT 0,
    reconciliation_status VARCHAR NOT NULL,
    PRIMARY KEY (collection_id, low_crd, high_crd)
);

CREATE TABLE IF NOT EXISTS individuals (
    individual_crd BIGINT PRIMARY KEY,
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS individual_observations (
    collection_id VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    artifact_id VARCHAR NOT NULL,
    source_record_index UBIGINT NOT NULL,
    source_payload_digest VARCHAR NOT NULL,
    PRIMARY KEY (collection_id, individual_crd)
);

CREATE TABLE IF NOT EXISTS individual_names (
    collection_id VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    first_name VARCHAR,
    middle_name VARCHAR,
    last_name VARCHAR,
    suffix_name VARCHAR,
    active_agent_registration BOOLEAN,
    artifact_id VARCHAR NOT NULL,
    source_json_path VARCHAR NOT NULL,
    PRIMARY KEY (collection_id, individual_crd)
);

CREATE TABLE IF NOT EXISTS individual_current_employments (
    collection_id VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    employment_sequence UINTEGER NOT NULL,
    employer_firm_crd BIGINT,
    employer_name VARCHAR,
    employer_street_1 VARCHAR,
    employer_street_2 VARCHAR,
    employer_city VARCHAR,
    employer_region_raw VARCHAR,
    employer_country_raw VARCHAR,
    employer_country_code VARCHAR,
    employer_postal_code VARCHAR,
    employer_firm_coverage VARCHAR NOT NULL,
    artifact_id VARCHAR NOT NULL,
    source_json_path VARCHAR NOT NULL,
    PRIMARY KEY (collection_id, individual_crd, employment_sequence)
);

CREATE TABLE IF NOT EXISTS individual_current_registrations (
    collection_id VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    employment_sequence UINTEGER NOT NULL,
    registration_sequence UINTEGER NOT NULL,
    employer_firm_crd BIGINT,
    jurisdiction VARCHAR,
    registration_category VARCHAR,
    status VARCHAR,
    status_posted_date DATE,
    artifact_id VARCHAR NOT NULL,
    source_json_path VARCHAR NOT NULL,
    PRIMARY KEY (collection_id, individual_crd, employment_sequence, registration_sequence)
);

CREATE TABLE IF NOT EXISTS individual_registration_intervals (
    interval_id VARCHAR PRIMARY KEY,
    collection_id VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    employer_firm_crd BIGINT,
    source_employer_name VARCHAR,
    jurisdiction VARCHAR,
    registration_category VARCHAR,
    status VARCHAR,
    start_date DATE,
    end_date DATE,
    start_precision VARCHAR NOT NULL,
    end_precision VARCHAR NOT NULL,
    start_method VARCHAR NOT NULL,
    end_method VARCHAR NOT NULL,
    interval_source VARCHAR NOT NULL,
    iar_evidence_method VARCHAR,
    artifact_id VARCHAR NOT NULL,
    source_json_path VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS individual_registration_locations (
    location_id VARCHAR PRIMARY KEY,
    collection_id VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    interval_id VARCHAR NOT NULL,
    location_sequence UINTEGER NOT NULL,
    location_source VARCHAR NOT NULL,
    street_1 VARCHAR,
    street_2 VARCHAR,
    city VARCHAR,
    region_raw VARCHAR,
    country_raw VARCHAR,
    country_code VARCHAR,
    postal_code VARCHAR,
    is_us_workplace BOOLEAN,
    artifact_id VARCHAR NOT NULL,
    source_json_path VARCHAR NOT NULL,
    UNIQUE (collection_id, individual_crd, interval_id, location_sequence)
);

CREATE TABLE IF NOT EXISTS individual_employment_intervals (
    employment_interval_id VARCHAR PRIMARY KEY,
    collection_id VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    employment_sequence UINTEGER NOT NULL,
    source_employer_name VARCHAR,
    employer_firm_crd BIGINT,
    from_raw VARCHAR,
    to_raw VARCHAR,
    start_month DATE,
    end_month DATE,
    is_open_ended BOOLEAN NOT NULL,
    start_precision VARCHAR NOT NULL,
    end_precision VARCHAR NOT NULL,
    end_method VARCHAR NOT NULL,
    city VARCHAR,
    region_raw VARCHAR,
    artifact_id VARCHAR NOT NULL,
    source_json_path VARCHAR NOT NULL,
    UNIQUE (collection_id, individual_crd, employment_sequence)
);

CREATE TABLE IF NOT EXISTS individual_exams (
    collection_id VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    exam_sequence UINTEGER NOT NULL,
    exam_code VARCHAR,
    exam_name VARCHAR,
    exam_date DATE,
    artifact_id VARCHAR NOT NULL,
    source_json_path VARCHAR NOT NULL,
    PRIMARY KEY (collection_id, individual_crd, exam_sequence)
);

CREATE TABLE IF NOT EXISTS individual_designations (
    collection_id VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    designation_sequence UINTEGER NOT NULL,
    designation_name VARCHAR,
    artifact_id VARCHAR NOT NULL,
    source_json_path VARCHAR NOT NULL,
    PRIMARY KEY (collection_id, individual_crd, designation_sequence)
);

CREATE TABLE IF NOT EXISTS individual_disclosure_flags (
    collection_id VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    has_regulatory_action BOOLEAN,
    has_criminal BOOLEAN,
    has_bankruptcy BOOLEAN,
    has_civil_judgment BOOLEAN,
    has_bond BOOLEAN,
    has_judgment BOOLEAN,
    has_investigation BOOLEAN,
    has_customer_complaint BOOLEAN,
    has_termination BOOLEAN,
    has_other BOOLEAN,
    artifact_id VARCHAR NOT NULL,
    source_json_path VARCHAR NOT NULL,
    PRIMARY KEY (collection_id, individual_crd)
);

CREATE TABLE IF NOT EXISTS individual_year_snapshots (
    collection_id VARCHAR NOT NULL,
    snapshot_year INTEGER NOT NULL,
    snapshot_date DATE NOT NULL,
    snapshot_status VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    first_name VARCHAR,
    middle_name VARCHAR,
    last_name VARCHAR,
    suffix_name VARCHAR,
    is_iar BOOLEAN,
    iar_evidence_method VARCHAR,
    active_registration_relationship_count UBIGINT NOT NULL,
    active_employer_firm_count UBIGINT NOT NULL,
    active_jurisdiction_count UBIGINT NOT NULL,
    is_current_observation BOOLEAN NOT NULL,
    has_us_workplace BOOLEAN,
    has_us_employer BOOLEAN,
    has_disclosure_summary BOOLEAN,
    population_coverage_status VARCHAR NOT NULL,
    validation_status VARCHAR NOT NULL,
    built_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (collection_id, snapshot_year, individual_crd)
);

CREATE TABLE IF NOT EXISTS individual_firm_year (
    relationship_id VARCHAR PRIMARY KEY,
    collection_id VARCHAR NOT NULL,
    snapshot_year INTEGER NOT NULL,
    snapshot_date DATE NOT NULL,
    snapshot_status VARCHAR NOT NULL,
    individual_crd BIGINT NOT NULL,
    firm_crd BIGINT NOT NULL,
    relationship_kind VARCHAR NOT NULL,
    jurisdiction VARCHAR,
    jurisdiction_key VARCHAR NOT NULL,
    registration_category VARCHAR,
    registration_status VARCHAR,
    source_interval_id VARCHAR,
    interval_start_date DATE,
    interval_end_date DATE,
    interval_start_precision VARCHAR,
    interval_end_precision VARCHAR,
    iar_evidence_method VARCHAR,
    workplace_country_raw VARCHAR,
    workplace_country_code VARCHAR,
    is_us_workplace BOOLEAN,
    employer_country_code VARCHAR,
    employer_is_us_based BOOLEAN,
    employer_country_method VARCHAR,
    employer_firm_coverage VARCHAR NOT NULL,
    artifact_id VARCHAR NOT NULL,
    source_json_path VARCHAR NOT NULL,
    UNIQUE (
        collection_id,
        snapshot_year,
        individual_crd,
        firm_crd,
        relationship_kind,
        jurisdiction_key
    )
);

CREATE TABLE IF NOT EXISTS individual_snapshot_field_provenance (
    collection_id VARCHAR NOT NULL,
    snapshot_year INTEGER NOT NULL,
    individual_crd BIGINT NOT NULL,
    field_name VARCHAR NOT NULL,
    source_artifact_id VARCHAR NOT NULL,
    source_json_path VARCHAR NOT NULL,
    source_date DATE,
    source_interval_id VARCHAR,
    transformation_method VARCHAR NOT NULL,
    PRIMARY KEY (collection_id, snapshot_year, individual_crd, field_name)
);

CREATE TABLE IF NOT EXISTS individual_snapshot_coverage (
    collection_id VARCHAR NOT NULL,
    snapshot_year INTEGER NOT NULL,
    field_group VARCHAR NOT NULL,
    coverage_status VARCHAR NOT NULL,
    record_count UBIGINT NOT NULL,
    message VARCHAR,
    PRIMARY KEY (collection_id, snapshot_year, field_group)
);

CREATE OR REPLACE VIEW current_individual_year_snapshots AS
SELECT snapshots.*
FROM individual_year_snapshots snapshots
JOIN (
    SELECT collection_id
    FROM individual_collection_runs
    WHERE status = 'published'
    ORDER BY collection_completed_at DESC, collection_id DESC
    LIMIT 1
) latest USING (collection_id);

CREATE OR REPLACE VIEW current_individual_firm_year AS
SELECT relationships.*
FROM individual_firm_year relationships
JOIN (
    SELECT collection_id
    FROM individual_collection_runs
    WHERE status = 'published'
    ORDER BY collection_completed_at DESC, collection_id DESC
    LIMIT 1
) latest USING (collection_id);
