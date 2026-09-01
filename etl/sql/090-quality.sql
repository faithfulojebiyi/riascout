-- Data-quality report. Surfaces values that cannot be true, so they are
-- visible rather than silently averaged into derived metrics.
--
-- These are FILER errors accepted by the SEC, not pipeline defects. The
-- canonical example: CRD 283824 filed 9,252,166,047 employees at one branch
-- office — their telephone number (92521656047) typed into the Employees box.
--
-- Thresholds flag only the impossible, never merely the large. LPL Financial
-- genuinely reports 20,865 offices and Edward Jones 15,322, so office_count
-- is deliberately NOT gated.

select 'firm employee_count > 1M' as issue, count(*) as rows
from pg.market.firm_fact_metrics where employee_count > 1000000
union all
select 'firm client_count > 100M', count(*)
from pg.market.firm_fact_metrics where client_count > 100000000
union all
select 'office employee_count > 100k', count(*)
from pg.market.firm_fact_office where employee_count > 100000
union all
select 'negative AUM', count(*)
from pg.market.firm_fact_metrics where regulatory_aum < 0
union all
select 'asset allocation outside 0-100', count(*)
from pg.market.firm_fact_asset_allocation where percentage < 0 or percentage > 100
union all
select 'filings with no firm', count(*)
from pg.market.filing f
where not exists (select 1 from pg.market.firm x where x.firm_crd = f.firm_crd)
union all
select 'registrations with open end and closed status', count(*)
from pg.market.advisor_registration
where end_date is null and status = 'PREVIOUS'
union all
-- rejected at load: end date precedes start date in the source
select 'source registrations rejected (inverted interval)', count(*)
from individual_registration_intervals where end_date < start_date
union all
-- an unclassified status must never default into "permitted to transact"; add
-- it to REGISTRATION_STATUSES in prisma/seed/dimensions.ts
select 'observations with unclassified status (expect 0)', count(*)
from pg.market.advisor_firm_observation
where firm_crd is not null and can_conduct_business is null
union all
select 'source statuses missing from dim_registration_status', count(*)
from (
  select distinct c.status from individual_current_registrations c
   where c.status is not null
     and not exists (select 1 from pg.market.dim_registration_status d where d.code = c.status)
) unknown_status
union all
-- every CRD is nameable from one of the three sources; a non-zero count means
-- the canonical name layer has regressed and firms will render blank again
select 'firms with no canonical name (expect 0)', count(*)
from pg.market.firm f
where not exists (
  select 1 from pg.market.firm_name_observation n where n.firm_crd = f.firm_crd
)
union all
-- DRPs: {} means ZERO disclosures, not unknown. NULL is reserved for
-- genuinely malformed source data and should be near-zero. A large count
-- here means the upstream normalization has regressed.
select 'advisors with NULL disclosure flags (expect ~0)', count(*)
from pg.market.advisor_disclosure_flag
where has_criminal is null or has_customer_complaint is null
   or has_regulatory_action is null
order by rows desc;
