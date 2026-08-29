-- Rebuilds market.firm_search, the firm-side prospecting projection.
--
-- Every fact table is keyed by filing, so each join goes through
-- firm_current_filing. Joining a firm_fact_* table by firm alone would
-- aggregate its entire filing history: firm_fact_custodian holds 3.4M rows
-- across 338k filings, of which only the current ~32k are wanted.
--
-- Built into a temp table and swapped, so a reader never sees a half-populated
-- projection.

begin;

create temp table _firm_search on commit drop as
with cur as (
  select fcf.firm_crd,
         fcf.filing_id,
         fcf.submitted_at::date as latest_on,
         m.regulatory_aum       as aum_now,
         m.employee_count       as emp_now
    from market.firm_current_filing fcf
    left join market.firm_fact_metrics m on m.filing_id = fcf.filing_id
),
/**
 * effective_date is null on every filing, so submitted_at is the only usable
 * time axis. It spans 2020-2026 at ~10 filings per firm, which is enough for
 * the growth horizons below.
 */
filing_metrics as (
  select f.firm_crd,
         f.submitted_at::date as on_date,
         m.regulatory_aum,
         m.employee_count
    from market.filing f
    join market.firm_fact_metrics m on m.filing_id = f.filing_id
),
-- our own count of open registrations, not the ADV's self-reported headcount
advisor_counts as (
  select employer_firm_crd as firm_crd, count(distinct advisor_crd)::int as advisor_count
    from market.advisor_registration
   where end_date is null and employer_firm_crd is not null
   group by employer_firm_crd
),
custodians as (
  select c.filing_id,
         array_agg(distinct c.custodian_id) filter (where c.custodian_id is not null) as custodian_ids,
         (array_agg(c.custodian_id order by c.aum_at_custodian desc nulls last))[1]   as top_custodian_id,
         max(c.aum_at_custodian)                                                      as top_custodian_aum
    from market.firm_fact_custodian c
    join cur on cur.filing_id = c.filing_id
   group by c.filing_id
),
funds as (
  select p.filing_id,
         array_agg(distinct p.fund_type_code) filter (where p.fund_type_code is not null) as fund_type_codes,
         count(distinct p.private_fund_id)::int                                           as fund_count,
         sum(p.gross_asset_value)                                                         as total_fund_gav
    from market.firm_fact_private_fund p
    join cur on cur.filing_id = p.filing_id
   group by p.filing_id
),
affiliations as (
  select a.filing_id,
         array_agg(distinct a.related_crd) filter (where a.related_crd is not null) as affiliated_crds
    from market.firm_fact_affiliation a
    join cur on cur.filing_id = a.filing_id
   group by a.filing_id
),
client_types as (
  select t.filing_id,
         array_agg(distinct t.client_type_code) filter (where t.client_type_code is not null) as client_type_codes
    from market.firm_fact_client_type t
    join cur on cur.filing_id = t.filing_id
   group by t.filing_id
),
services as (
  select s.filing_id,
         array_agg(distinct s.service_type_code) filter (where s.service_type_code is not null) as service_codes
    from market.firm_fact_service s
    join cur on cur.filing_id = s.filing_id
   group by s.filing_id
),
asset_categories as (
  select aa.filing_id,
         array_agg(distinct aa.asset_category_code) filter (where aa.asset_category_code is not null) as asset_category_codes
    from market.firm_fact_asset_allocation aa
    join cur on cur.filing_id = aa.filing_id
   group by aa.filing_id
),
owners as (
  /**
   * ownership_code is a band, not a percentage, so concentration uses the
   * band's lower bound: a floor on the largest stake rather than a fabricated
   * precise share.
   */
  select o.filing_id,
         count(*)::int                                                     as owner_count,
         count(*) filter (where o.owner_advisor_crd is not null)::int      as owner_advisor_count,
         (max(d.lower_pct) / 100.0)::numeric(6, 4)                         as ownership_concentration
    from market.firm_fact_owner o
    join cur on cur.filing_id = o.filing_id
    left join market.dim_ownership_code d on d.code = o.ownership_code
   group by o.filing_id
),
web as (
  select w.filing_id,
         jsonb_agg(jsonb_build_object('platform', w.platform, 'url', w.url_raw)
                   order by w.sequence) filter (where w.platform is not null) as social_profiles,
         array_agg(distinct w.platform) filter (where w.platform is not null) as social_platforms,
         (array_agg(w.url_raw order by w.sequence)
            filter (where w.platform = 'linkedin'))[1]                       as linkedin_url
    from market.firm_web_presence w
    join cur on cur.filing_id = w.filing_id
   group by w.filing_id
),
/**
 * Growth compares the current filing to the most recent one at or before the
 * horizon, but only within 180 days of it — otherwise a firm whose only prior
 * filing is five years old would report that gap as its one-year growth. The
 * elapsed period is measured from the actual dates, not the nominal horizon.
 *
 * The baseline need only exist and be > 0. A minimum size would be a product
 * judgement, and applying it here would destroy the value rather than let a
 * caller filter: a firm growing from $2M to $2B is a real ratio, not an
 * artifact, and a growth leaderboard filters on current AUM instead.
 */
growth_aum_raw as (
  select distinct on (c.firm_crd, g.horizon)
         c.firm_crd,
         g.horizon,
         power(c.aum_now / h.regulatory_aum,
               365.25 / nullif(c.latest_on - h.on_date, 0)) - 1 as cagr
    from cur c
    cross join (values (1), (3), (5)) as g(horizon)
    join filing_metrics h
      on h.firm_crd = c.firm_crd
     and h.on_date <= c.latest_on - make_interval(years => g.horizon)
     and h.on_date >= c.latest_on - make_interval(years => g.horizon, days => 180)
   where h.regulatory_aum > 0
     and c.aum_now > 0
   order by c.firm_crd, g.horizon, h.on_date desc
),
/**
 * 153 filings report AUM under $1,000, and growth off such a baseline exceeds
 * what numeric(12,6) holds. The ratio is real but unrepresentable, so it is
 * null rather than clamped to a value that would sort as if it were the truth.
 */
growth_aum as (
  select firm_crd, horizon,
         case when abs(cagr) < 1000000 then cagr::numeric(12, 6) end as cagr
    from growth_aum_raw
),
growth_emp_raw as (
  select distinct on (c.firm_crd)
         c.firm_crd,
         power(c.emp_now::numeric / h.employee_count,
               365.25 / nullif(c.latest_on - h.on_date, 0)) - 1 as cagr
    from cur c
    join filing_metrics h
      on h.firm_crd = c.firm_crd
     and h.on_date <= c.latest_on - interval '3 years'
     and h.on_date >= c.latest_on - interval '3 years' - interval '180 days'
   where h.employee_count > 0 and c.emp_now > 0
   order by c.firm_crd, h.on_date desc
),
growth_emp as (
  select firm_crd,
         case when abs(cagr) < 1000000 then cagr::numeric(12, 6) end as cagr
    from growth_emp_raw
),
filing_span as (
  select firm_crd,
         min(submitted_at)::date as first_filing_date,
         max(submitted_at)::date as latest_filing_date,
         count(*)::int           as filing_count
    from market.filing
   group by firm_crd
)
select f.firm_crd,

       fi.firm_name,
       fi.sec_number,
       fd.domain,
       web.linkedin_url,
       web.social_profiles,
       coalesce(web.social_platforms, '{}'::text[])          as social_platforms,

       -- identity.state is null on every filing; region_raw carries it
       fi.city, fi.region_raw as state, fi.postal_code, fi.country_code,

       fr.is_sec_registered, fr.is_era, fr.primary_registration_type,
       fdv.channel_code,

       fm.regulatory_aum, fm.discretionary_aum, fm.non_discretionary_aum,
       fdv.aum_band_code                                     as aum_band,

       fm.client_count::int, fm.employee_count::int,
       fm.advisory_employee_count::int, fm.office_count::int,
       ac.advisor_count,

       fdv.aum_per_advisor, fdv.aum_per_client, fdv.aum_per_employee,
       fdv.aum_percentile, fdv.aum_per_advisor_percentile,

       g1.cagr                                               as aum_cagr_1y,
       g3.cagr                                               as aum_cagr_3y,
       g5.cagr                                               as aum_cagr_5y,
       ge.cagr                                               as employee_cagr_3y,

       coalesce(ct.client_type_codes,    '{}'::text[])       as client_type_codes,
       coalesce(sv.service_codes,        '{}'::text[])       as service_codes,
       coalesce(acat.asset_category_codes, '{}'::text[])     as asset_category_codes,

       coalesce(cu.custodian_ids, '{}'::int[])               as custodian_ids,
       cu.top_custodian_id, cu.top_custodian_aum,

       coalesce(fu.fund_type_codes, '{}'::text[])            as fund_type_codes,
       fu.fund_count, fu.total_fund_gav,

       coalesce(af.affiliated_crds, '{}'::bigint[])          as affiliated_crds,

       ow.owner_count, ow.owner_advisor_count, ow.ownership_concentration,

       -- null until the movement engine lands; never 0, which would read as
       -- "no advisors moved" rather than "we do not know yet"
       null::int as advisors_gained_90d,
       null::int as advisors_lost_90d,
       null::int as net_advisor_flow_90d,

       fs.first_filing_date, fs.latest_filing_date, fs.filing_count,

       setweight(to_tsvector('simple', coalesce(fi.firm_name, '')), 'A') ||
       setweight(to_tsvector('simple', coalesce(fi.city, '')), 'B')      ||
       setweight(to_tsvector('simple', coalesce(fi.region_raw, '')), 'C')     as search_tsv,
       now()                                                 as refreshed_at
  from market.firm f
  left join cur                            on cur.firm_crd = f.firm_crd
  left join market.firm_fact_identity     fi  on fi.filing_id  = cur.filing_id
  left join market.firm_fact_metrics      fm  on fm.filing_id  = cur.filing_id
  left join market.firm_fact_derived      fdv on fdv.filing_id = cur.filing_id
  left join market.firm_fact_registration fr  on fr.filing_id  = cur.filing_id
  left join market.firm_domain            fd  on fd.firm_crd   = f.firm_crd
  left join web        on web.filing_id  = cur.filing_id
  left join custodians cu   on cu.filing_id   = cur.filing_id
  left join funds      fu   on fu.filing_id   = cur.filing_id
  left join affiliations af on af.filing_id   = cur.filing_id
  left join client_types ct on ct.filing_id   = cur.filing_id
  left join services   sv   on sv.filing_id   = cur.filing_id
  left join asset_categories acat on acat.filing_id = cur.filing_id
  left join owners     ow   on ow.filing_id   = cur.filing_id
  left join advisor_counts ac on ac.firm_crd  = f.firm_crd
  left join filing_span    fs on fs.firm_crd  = f.firm_crd
  left join growth_aum     g1 on g1.firm_crd  = f.firm_crd and g1.horizon = 1
  left join growth_aum     g3 on g3.firm_crd  = f.firm_crd and g3.horizon = 3
  left join growth_aum     g5 on g5.firm_crd  = f.firm_crd and g5.horizon = 5
  left join growth_emp     ge on ge.firm_crd  = f.firm_crd;
truncate market.firm_search;

-- named rather than `select *`: a positional insert silently shifts every
-- column when the table gains one, and surfaces as a type error far from the
-- cause
insert into market.firm_search (
  firm_crd,
  firm_name, sec_number, domain, linkedin_url, social_profiles, social_platforms,
  city, state, postal_code, country_code,
  is_sec_registered, is_era, primary_registration_type, channel_code,
  regulatory_aum, discretionary_aum, non_discretionary_aum, aum_band,
  client_count, employee_count, advisory_employee_count, office_count, advisor_count,
  aum_per_advisor, aum_per_client, aum_per_employee,
  aum_percentile, aum_per_advisor_percentile,
  aum_cagr_1y, aum_cagr_3y, aum_cagr_5y, employee_cagr_3y,
  client_type_codes, service_codes, asset_category_codes,
  custodian_ids, top_custodian_id, top_custodian_aum,
  fund_type_codes, fund_count, total_fund_gav,
  affiliated_crds,
  owner_count, owner_advisor_count, ownership_concentration,
  advisors_gained_90d, advisors_lost_90d, net_advisor_flow_90d,
  first_filing_date, latest_filing_date, filing_count,
  search_tsv, refreshed_at
)
select
  firm_crd,
  firm_name, sec_number, domain, linkedin_url, social_profiles, social_platforms,
  city, state, postal_code, country_code,
  is_sec_registered, is_era, primary_registration_type, channel_code,
  regulatory_aum, discretionary_aum, non_discretionary_aum, aum_band,
  client_count, employee_count, advisory_employee_count, office_count, advisor_count,
  aum_per_advisor, aum_per_client, aum_per_employee,
  aum_percentile, aum_per_advisor_percentile,
  aum_cagr_1y, aum_cagr_3y, aum_cagr_5y, employee_cagr_3y,
  client_type_codes, service_codes, asset_category_codes,
  custodian_ids, top_custodian_id, top_custodian_aum,
  fund_type_codes, fund_count, total_fund_gav,
  affiliated_crds,
  owner_count, owner_advisor_count, ownership_concentration,
  advisors_gained_90d, advisors_lost_90d, net_advisor_flow_90d,
  first_filing_date, latest_filing_date, filing_count,
  search_tsv, refreshed_at
from _firm_search;

commit;
