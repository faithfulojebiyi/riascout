import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const productionSql = readFileSync(
  fileURLToPath(new URL('./032-private-funds.sql', import.meta.url)),
  'utf8',
);

describe('private-fund ETL', () => {
  it('loads identities, filing facts, children, and resolved fund IDs', () => {
    const query = `
      attach ':memory:' as pg;
      create schema pg.market;
      create table filings (filing_id text);
      insert into filings values ('F-1'), ('F-2');

      create table private_funds (private_fund_id text, first_seen_date date, last_seen_date date);
      insert into private_funds values ('PF-1', date '2024-03-31', date '2025-03-31');
      create table filing_private_funds (
        filing_id text, private_fund_id text, fund_reference text, private_fund_name text,
        private_fund_type text, private_fund_type_other text, region_raw text, country_raw text,
        exclusion_3c1 boolean, exclusion_3c7 boolean, is_master_fund boolean, is_feeder_fund boolean,
        master_fund_name text, master_fund_id text, is_fund_of_funds boolean,
        adviser_or_related_invested boolean, invested_in_registered_investment_companies boolean,
        gross_asset_value decimal(20,2), minimum_investment decimal(20,2), beneficial_owner_count bigint,
        owned_by_adviser_related_pct decimal(11,8), owned_by_funds_pct decimal(11,8),
        sales_limited_to_qualified_clients boolean, owned_by_non_us_pct decimal(11,8),
        is_subadviser boolean, has_other_advisers boolean, clients_solicited boolean,
        clients_invested_pct decimal(11,8), relied_on_regulation_d boolean, annual_audit boolean,
        financial_statements_gaap boolean, financial_statements_distributed boolean,
        audit_opinion_status text, uses_prime_brokers boolean, uses_custodians boolean,
        uses_administrator boolean, externally_valued_assets_pct decimal(11,8), uses_marketers boolean
      );
      insert into filing_private_funds values
        ('F-1','PF-1','REF-1','Alpha','Hedge Fund',null,'NY','UNITED STATES',true,false,false,false,
         null,null,false,true,false,100,10,2,1,2,true,3,false,true,true,4,true,true,true,true,
         'unqualified',true,true,true,5,true),
        ('F-2','PF-1','REF-2','Alpha II','Hedge Fund',null,'NY','UNITED STATES',true,false,false,false,
         null,null,false,true,false,200,20,3,1,2,true,3,false,true,true,4,true,true,true,true,
         'unqualified',true,true,true,5,true);

      create table filing_private_fund_related_funds as select 'F-1' filing_id, 'PF-1' private_fund_id, 'REF-1' fund_reference, 'feeder_fund' relation_role, 'row-1' source_record_key, 'Feeder' related_private_fund_name, 'PF-2' related_private_fund_id;
      create table filing_private_fund_managers as select 'F-1' filing_id, 'PF-1' private_fund_id, 'REF-1' fund_reference, 'fund_partner_or_manager' manager_role, 'row-1' source_record_key, 'GP LLC' manager_name;
      create table filing_private_fund_foreign_authorities as select 'F-1' filing_id, 'PF-1' private_fund_id, 'REF-1' fund_reference, 'fund' authority_role, 'row-1' source_record_key, 'FCA' authority_name;
      create table filing_private_fund_advisers as select 'F-1' filing_id, 'PF-1' private_fund_id, 'REF-1' fund_reference, 'primary_adviser' adviser_role, 'row-1' source_record_key, 'Adviser LLC' adviser_name, '801-1' sec_file_number, 1::bigint crd_number;
      create table filing_private_fund_form_d as select 'F-1' filing_id, 'PF-1' private_fund_id, 'REF-1' fund_reference, 'row-1' source_record_key, '021-1' form_d_file_number;
      create table filing_private_fund_service_providers as select 'F-1' filing_id, 'PF-1' private_fund_id, 'REF-1' fund_reference, 'marketer' provider_role, 'MARK-1' source_record_key, 'Marketer LLC' legal_name, null::text business_name, '8-1' sec_number, 2::bigint crd_number, null::text pcaob_number, 'LEI-1' lei, 'NYC' city, 'NY' region_raw, 'UNITED STATES' country_raw, false related_person, null::boolean independent, null::boolean pcaob_registered, null::boolean pcaob_inspected, null::boolean acts_as_custodian, null::boolean sends_statements, null::text statement_sender, true has_websites;
      create table filing_private_fund_provider_websites as select 'F-1' filing_id, 'PF-1' private_fund_id, 'REF-1' fund_reference, 'MARK-1' provider_reference, 'MARK-1' source_record_key, 'https://example.com' website_address;
      create table filing_custodians as select 'F-1' filing_id, 'row-1' custodian_reference, 'PRIVATE_FUND' source_subtype, 'PF-1' private_fund_id, 'Custodian Bank' custodian_name, 'NYC' city, 'NY' region_raw, 'UNITED STATES' country_raw, null::decimal(20,2) aum_at_custodian;

      create table pg.market.private_fund (private_fund_id text, first_seen_date date, last_seen_date date);
      create table pg.market.filing as select * from filings;
      create table pg.market.firm_fact_private_fund as select * from filing_private_funds where false;
      alter table pg.market.firm_fact_private_fund rename column private_fund_name to fund_name;
      alter table pg.market.firm_fact_private_fund drop column private_fund_type;
      alter table pg.market.firm_fact_private_fund rename column private_fund_type_other to fund_type_other;
      alter table pg.market.firm_fact_private_fund add column fund_type_code text;
      alter table pg.market.firm_fact_private_fund add column fund_type_raw text;
      create table pg.market.firm_fact_private_fund_related_fund as select * from filing_private_fund_related_funds where false;
      create table pg.market.firm_fact_private_fund_manager as select * from filing_private_fund_managers where false;
      create table pg.market.firm_fact_private_fund_foreign_authority as select * from filing_private_fund_foreign_authorities where false;
      create table pg.market.firm_fact_private_fund_adviser as select * from filing_private_fund_advisers where false;
      create table pg.market.firm_fact_private_fund_form_d as select * from filing_private_fund_form_d where false;
      create table pg.market.firm_fact_private_fund_service_provider as select * from filing_private_fund_service_providers where false;
      create table pg.market.firm_fact_private_fund_provider_website as select * from filing_private_fund_provider_websites where false;
      create table pg.market.firm_fact_custodian (
        filing_id text, custodian_reference text, source_name text,
        aum_at_custodian decimal(20,2), private_fund_id text,
        city text, region_raw text, country_raw text
      );

      ${productionSql}

      select
        (select count(*) from pg.market.private_fund),
        (select count(*) from pg.market.firm_fact_private_fund),
        (select count(*) from pg.market.firm_fact_private_fund_service_provider),
        (select count(*) from pg.market.firm_fact_private_fund_provider_website),
        (select count(distinct private_fund_id) from pg.market.firm_fact_private_fund),
        (select private_fund_id from pg.market.firm_fact_private_fund_adviser limit 1),
        (select private_fund_id from pg.market.firm_fact_custodian limit 1);
    `;

    const output = execFileSync(
      'duckdb',
      [':memory:', '-csv', '-noheader', query],
      {
        encoding: 'utf8',
      },
    );

    expect(output.trim()).toBe('1,2,1,1,1,PF-1,PF-1');
  });
});
