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
from pg.market.firm_fact_metrics where employee_count_raw > 1000000
union all
select 'firm account_count > 100M', count(*)
from pg.market.firm_fact_metrics where account_count_raw > 100000000
union all
select 'account components differ from total', count(*)
from pg.market.firm_fact_metrics
where discretionary_account_count is not null
  and non_discretionary_account_count is not null
  and account_count_raw is not null
  and discretionary_account_count + non_discretionary_account_count <> account_count_raw
union all
select 'reported client bounds invalid', count(*)
from pg.market.firm_fact_metrics
where reported_client_count_quality not in ('reported_number', 'bounded_range', 'unavailable')
   or reported_client_count_min < 0
   or reported_client_count_max < reported_client_count_min
   or (reported_client_count_quality = 'unavailable'
       and (reported_client_count_min is not null or reported_client_count_max is not null))
   or (reported_client_count_quality = 'reported_number'
       and reported_client_count_min is distinct from reported_client_count_max)
   or (reported_client_count_quality = 'bounded_range'
       and reported_client_count_min >= reported_client_count_max)
union all
select 'positive client AUM without count evidence', count(*)
from pg.market.firm_fact_client_type
where regulatory_aum > 0 and coalesce(client_count, 0) <= 0
  and fewer_than_five is not true
union all
select 'client type AUM differs from regulatory AUM', count(*)
from pg.market.firm_fact_metrics m
join (
  select filing_id, sum(regulatory_aum) as client_type_aum
  from pg.market.firm_fact_client_type
  group by filing_id
) c using (filing_id)
where m.regulatory_aum is not null and c.client_type_aum is not null
  and m.regulatory_aum <> c.client_type_aum
union all
select 'AUM per account ratio mismatch', count(*)
from pg.market.firm_fact_metrics m
join pg.market.firm_fact_derived d using (filing_id)
where m.regulatory_aum is not null and m.account_count > 0
  and abs(d.aum_per_account - m.regulatory_aum / m.account_count) > 0.01
union all
select 'AUM per linked adviser ratio mismatch', count(*)
from pg.market.firm_fact_metrics m
join pg.market.firm_fact_derived d using (filing_id)
where m.regulatory_aum is not null and d.advisor_count > 0
  and abs(d.aum_per_advisor - m.regulatory_aum / d.advisor_count) > 0.01
union all
select 'AUM per employee ratio mismatch', count(*)
from pg.market.firm_fact_metrics m
join pg.market.firm_fact_derived d using (filing_id)
where m.regulatory_aum is not null and m.employee_count > 0
  and abs(d.aum_per_employee - m.regulatory_aum / m.employee_count) > 0.01
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
