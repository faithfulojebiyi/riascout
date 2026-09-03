-- Complete Schedule D 7.B.1 fund identities, filing facts, and repeating detail.
begin;

delete from pg.market.firm_fact_custodian;
delete from pg.market.firm_fact_private_fund_provider_website;
delete from pg.market.firm_fact_private_fund_service_provider;
delete from pg.market.firm_fact_private_fund_form_d;
delete from pg.market.firm_fact_private_fund_adviser;
delete from pg.market.firm_fact_private_fund_foreign_authority;
delete from pg.market.firm_fact_private_fund_manager;
delete from pg.market.firm_fact_private_fund_related_fund;
delete from pg.market.firm_fact_private_fund;
delete from pg.market.private_fund;

insert into pg.market.private_fund (private_fund_id, first_seen_date, last_seen_date)
select p.private_fund_id, p.first_seen_date, p.last_seen_date
from private_funds p
where exists (
  select 1 from filing_private_funds f
  join pg.market.filing target on target.filing_id = f.filing_id
  where f.private_fund_id = p.private_fund_id
);

insert into pg.market.firm_fact_private_fund (
  filing_id, private_fund_id, fund_reference, fund_name, fund_type_code,
  fund_type_raw, fund_type_other, region_raw, country_raw, exclusion_3c1, exclusion_3c7,
  is_master_fund, is_feeder_fund, master_fund_name, master_fund_id,
  is_fund_of_funds, adviser_or_related_invested,
  invested_in_registered_investment_companies, gross_asset_value,
  minimum_investment, beneficial_owner_count, owned_by_adviser_related_pct,
  owned_by_funds_pct, sales_limited_to_qualified_clients, owned_by_non_us_pct,
  is_subadviser, has_other_advisers, clients_solicited, clients_invested_pct,
  relied_on_regulation_d, annual_audit, financial_statements_gaap,
  financial_statements_distributed, audit_opinion_status, uses_prime_brokers,
  uses_custodians, uses_administrator, externally_valued_assets_pct, uses_marketers
)
select p.filing_id, p.private_fund_id, p.fund_reference, p.private_fund_name,
       m.code, p.private_fund_type, p.private_fund_type_other, p.region_raw, p.country_raw,
       p.exclusion_3c1, p.exclusion_3c7, p.is_master_fund, p.is_feeder_fund,
       p.master_fund_name, p.master_fund_id, p.is_fund_of_funds,
       p.adviser_or_related_invested, p.invested_in_registered_investment_companies,
       p.gross_asset_value, p.minimum_investment, p.beneficial_owner_count,
       p.owned_by_adviser_related_pct, p.owned_by_funds_pct,
       p.sales_limited_to_qualified_clients, p.owned_by_non_us_pct,
       p.is_subadviser, p.has_other_advisers, p.clients_solicited,
       p.clients_invested_pct, p.relied_on_regulation_d, p.annual_audit,
       p.financial_statements_gaap, p.financial_statements_distributed,
       p.audit_opinion_status, p.uses_prime_brokers, p.uses_custodians,
       p.uses_administrator, p.externally_valued_assets_pct, p.uses_marketers
from filing_private_funds p
left join (values
  ('Private Equity Fund','private_equity'),
  ('Hedge Fund','hedge'),
  ('Venture Capital Fund','venture_capital'),
  ('Real Estate Fund','real_estate'),
  ('Securitized Asset Fund','securitized_asset'),
  ('Liquidity Fund','liquidity'),
  ('Other Private Fund','other_private')
) as m(src, code) on m.src = p.private_fund_type
where exists (select 1 from pg.market.filing f where f.filing_id = p.filing_id);

-- Custodian facts follow their optional composite fund parent. SMA rows keep a
-- null fund ID, while private-fund rows carry the resolved SEC Fund ID.
insert into pg.market.firm_fact_custodian (
  filing_id, custodian_reference, source_name, aum_at_custodian,
  private_fund_id, city, region_raw, country_raw
)
select c.filing_id, c.custodian_reference,
       max(coalesce(c.custodian_name, '(unnamed)')), max(c.aum_at_custodian),
       max(c.private_fund_id), max(c.city), max(c.region_raw), max(c.country_raw)
from filing_custodians c
where exists (select 1 from pg.market.filing f where f.filing_id = c.filing_id)
  and c.custodian_reference is not null
group by c.filing_id, c.custodian_reference;

insert into pg.market.firm_fact_private_fund_related_fund
select c.filing_id, c.private_fund_id, c.fund_reference, c.relation_role,
       c.source_record_key, c.related_private_fund_name, c.related_private_fund_id
from filing_private_fund_related_funds c
where exists (
  select 1 from pg.market.firm_fact_private_fund f
  where f.filing_id = c.filing_id and f.private_fund_id = c.private_fund_id
);

insert into pg.market.firm_fact_private_fund_manager
select c.filing_id, c.private_fund_id, c.fund_reference, c.manager_role,
       c.source_record_key, c.manager_name
from filing_private_fund_managers c
where exists (
  select 1 from pg.market.firm_fact_private_fund f
  where f.filing_id = c.filing_id and f.private_fund_id = c.private_fund_id
);

insert into pg.market.firm_fact_private_fund_foreign_authority
select c.filing_id, c.private_fund_id, c.fund_reference, c.authority_role,
       c.source_record_key, c.authority_name
from filing_private_fund_foreign_authorities c
where exists (
  select 1 from pg.market.firm_fact_private_fund f
  where f.filing_id = c.filing_id and f.private_fund_id = c.private_fund_id
);

insert into pg.market.firm_fact_private_fund_adviser
select c.filing_id, c.private_fund_id, c.fund_reference, c.adviser_role,
       c.source_record_key, c.adviser_name, c.sec_file_number, c.crd_number
from filing_private_fund_advisers c
where exists (
  select 1 from pg.market.firm_fact_private_fund f
  where f.filing_id = c.filing_id and f.private_fund_id = c.private_fund_id
);

insert into pg.market.firm_fact_private_fund_form_d
select c.filing_id, c.private_fund_id, c.fund_reference, c.source_record_key,
       c.form_d_file_number
from filing_private_fund_form_d c
where exists (
  select 1 from pg.market.firm_fact_private_fund f
  where f.filing_id = c.filing_id and f.private_fund_id = c.private_fund_id
);

insert into pg.market.firm_fact_private_fund_service_provider
select c.filing_id, c.private_fund_id, c.fund_reference, c.provider_role,
       c.source_record_key, c.legal_name, c.business_name, c.sec_number,
       c.crd_number, c.pcaob_number, c.lei, c.city, c.region_raw, c.country_raw,
       c.related_person, c.independent, c.pcaob_registered, c.pcaob_inspected,
       c.acts_as_custodian, c.sends_statements, c.statement_sender, c.has_websites
from filing_private_fund_service_providers c
where exists (
  select 1 from pg.market.firm_fact_private_fund f
  where f.filing_id = c.filing_id and f.private_fund_id = c.private_fund_id
);

insert into pg.market.firm_fact_private_fund_provider_website
select c.filing_id, c.private_fund_id, c.fund_reference, c.provider_reference,
       c.source_record_key, c.website_address
from filing_private_fund_provider_websites c
where exists (
  select 1 from pg.market.firm_fact_private_fund f
  where f.filing_id = c.filing_id and f.private_fund_id = c.private_fund_id
);

commit;
