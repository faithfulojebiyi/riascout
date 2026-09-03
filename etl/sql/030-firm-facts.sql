-- Firm facts, all filing-grained. Dimension codes are mapped explicitly:
-- unmatched source values are reported by 090-assert rather than dropped
-- silently or passed through as free text.

begin;

-- ── identity: name + principal address, joined on filing ────────────────────
delete from pg.market.firm_fact_identity;

insert into pg.market.firm_fact_identity (
  filing_id, firm_name, sec_number, street_1, street_2,
  city, region_raw, state, country_raw, country_code, postal_code
)
select f.filing_id, n.firm_name, f.sec_number,
       a.principal_street_1, a.principal_street_2, a.principal_city,
       a.principal_region_raw, a.principal_state, a.principal_country_raw,
       a.principal_country_code, a.principal_postal_code
from filings f
left join firm_names n on n.filing_id = f.filing_id
left join firm_addresses a on a.filing_id = f.filing_id
where exists (select 1 from firms x where x.firm_crd = f.firm_crd);

-- ── metrics ─────────────────────────────────────────────────────────────────
delete from pg.market.firm_fact_metrics;

-- Impossible source values are withheld from the usable column, preserved in
-- *_raw and explained by *_quality. Verified examples: CRD 283824 filed a
-- telephone number as an employee count; CRD 129376 filed 1,060,430,120 in a
-- 2022-03 amendment while adjacent filings report 111, 135 and 158.
--
-- Thresholds flag only the impossible, never merely the large: LPL genuinely
-- reports 20,865 offices and Edward Jones 15,322, so office_count is not gated.
-- No corrected value is ever invented — a correction would need its own
-- derivation and provenance.
insert into pg.market.firm_fact_metrics (
  filing_id, regulatory_aum, discretionary_aum, non_discretionary_aum,
  employee_count, employee_count_raw, employee_count_quality,
  discretionary_account_count, non_discretionary_account_count,
  account_count, account_count_raw, account_count_quality,
  reported_client_count_min, reported_client_count_max,
  reported_client_count_quality,
  advisory_employee_count, office_count
)
select m.filing_id, m.regulatory_aum, m.discretionary_aum, m.non_discretionary_aum,
       case when m.employee_count > 1000000 then null else m.employee_count end,
       m.employee_count,
       case when m.employee_count > 1000000 then 'invalid_source_value' end,
       m.discretionary_account_count,
       m.non_discretionary_account_count,
       case when m.account_count > 100000000 then null else m.account_count end,
       m.account_count,
       case when m.account_count > 100000000 then 'invalid_source_value' end,
       totals.reported_client_count_min,
       totals.reported_client_count_max,
       coalesce(totals.reported_client_count_quality, 'unavailable'),
       m.advisory_employee_count, m.office_count
from firm_metrics m
left join filing_reported_client_totals totals using (filing_id)
where exists (select 1 from pg.market.filing f where f.filing_id = m.filing_id);

-- ── registration category from the filing itself ────────────────────────────
delete from pg.market.firm_fact_registration;

insert into pg.market.firm_fact_registration (
  filing_id, is_sec_registered, is_era, primary_registration_type
)
select f.filing_id,
       f.registration_category = 'SEC',
       f.registration_category = 'ERA',
       f.registration_category
from filings f
where f.registration_category is not null
  and exists (select 1 from pg.market.filing p where p.filing_id = f.filing_id);

-- ── client types: source codes match ours 1:1 ───────────────────────────────
delete from pg.market.firm_fact_client_type;

insert into pg.market.firm_fact_client_type (
  filing_id, client_type_code, client_count, fewer_than_five, regulatory_aum
)
select c.filing_id, c.client_type, max(c.client_count),
       bool_or(c.fewer_than_five), max(c.regulatory_aum)
from filing_client_types c
where exists (select 1 from pg.market.filing f where f.filing_id = c.filing_id)
  and exists (select 1 from pg.market.dim_client_type d where d.code = c.client_type)
group by c.filing_id, c.client_type;

-- ── services: long names mapped to codes ────────────────────────────────────
delete from pg.market.firm_fact_service;

insert into pg.market.firm_fact_service (filing_id, service_type_code)
select distinct s.filing_id, m.code
from filing_services s
join (values
  ('Portfolio Management for Individuals & Small Businesses','portfolio_mgmt_individuals'),
  ('Financial Planning Services','financial_planning'),
  ('Portfolio Management for Businesses or Institutional Clients','portfolio_mgmt_institutional'),
  ('Selection of Other Advisers','selection_other_advisers'),
  ('Portfolio Management for Pooled Investment Vehicles','portfolio_mgmt_pooled'),
  ('Pension Consulting Services','pension_consulting'),
  ('Educational Seminars/Workshops','educational_seminars'),
  ('Portfolio Management for Investment Companies','portfolio_mgmt_inv_companies'),
  ('Publication of Periodicals or Newsletters','publication_periodicals'),
  ('Market Timing Services','market_timing'),
  ('Security Ratings or Pricing Services','security_ratings'),
  ('Other','other')
) as m(src, code) on m.src = s.service_type
where exists (select 1 from pg.market.filing f where f.filing_id = s.filing_id);

-- ── asset allocations ───────────────────────────────────────────────────────
delete from pg.market.firm_fact_asset_allocation;

insert into pg.market.firm_fact_asset_allocation (
  filing_id, asset_category_code, reporting_basis, percentage
)
select a.filing_id, m.code, max(a.reporting_basis), max(a.percentage)
from filing_asset_allocations a
join (values
  ('Exchange-Traded Equity','exchange_traded_equity'),
  ('Non-Exchange-Traded Equity','non_exchange_traded_equity'),
  ('U.S. Government Bonds','us_government_bonds'),
  ('U.S. State and Local Bonds','us_state_local_bonds'),
  ('Sovereign Bonds','sovereign_bonds'),
  ('Investment-Grade Corporate Bonds','investment_grade_corporate'),
  ('Non-Investment-Grade Corporate Bonds','non_investment_grade_corporate'),
  ('Derivatives','derivatives'),
  ('Registered Investment Companies','registered_investment_companies'),
  ('Pooled Investment Vehicles','pooled_investment_vehicles'),
  ('Cash and Cash Equivalents','cash_and_equivalents'),
  ('Other','other')
) as m(src, code) on m.src = a.asset_category
where exists (select 1 from pg.market.filing f where f.filing_id = a.filing_id)
group by a.filing_id, m.code;

-- ── offices ─────────────────────────────────────────────────────────────────
delete from pg.market.firm_fact_office;

insert into pg.market.firm_fact_office (
  filing_id, office_reference, city, region_raw, country_raw,
  employee_count, employee_count_raw, employee_count_quality
)
select o.filing_id, o.office_reference,
       max(o.city), max(o.region_raw), max(o.country_raw),
       case when max(o.employee_count) > 100000 then null else max(o.employee_count) end,
       max(o.employee_count),
       case when max(o.employee_count) > 100000 then 'invalid_source_value' end
from filing_offices o
where exists (select 1 from pg.market.filing f where f.filing_id = o.filing_id)
  and o.office_reference is not null
group by o.filing_id, o.office_reference;

-- ── affiliations ────────────────────────────────────────────────────────────
delete from pg.market.firm_fact_affiliation;

insert into pg.market.firm_fact_affiliation (
  filing_id, affiliation_reference, legal_name, business_name,
  related_crd, related_sec_number, relationship_types, country_raw, region_raw
)
select a.filing_id, a.affiliation_reference,
       max(a.legal_name), max(a.business_name), max(a.related_crd),
       max(a.related_sec_number), max(a.relationship_types),
       max(a.country_raw), max(a.region_raw)
from filing_affiliations a
where exists (select 1 from pg.market.filing f where f.filing_id = a.filing_id)
  and a.affiliation_reference is not null
group by a.filing_id, a.affiliation_reference;

-- ── firm registration events ────────────────────────────────────────────────
delete from pg.market.firm_registration_event;

insert into pg.market.firm_registration_event (
  event_id, firm_crd, authority, category, status, effective_date, jurisdiction, filing_id
)
select e.event_id, e.firm_crd, e.authority, e.category, e.status,
       e.effective_date, e.jurisdiction, e.filing_id
from registration_events e
where exists (select 1 from pg.market.firm x where x.firm_crd = e.firm_crd);

commit;
