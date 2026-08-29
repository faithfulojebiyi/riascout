-- Populates market.firm_fact_derived, the per-filing ratios, bands and channel
-- that both search projections read. Nothing produced this table before, so
-- firm_search.aum_band/channel_code and advisor_search.firm_aum_band/firm_channel
-- were all null — including the AUM band the prospecting facet is built on.
--
-- Current filings only. The table is filing-grained, but advisor_count comes
-- from open registrations, which carry no filing dimension; writing it against
-- historical filings would date a present-day headcount to 2020. Both
-- projections join through firm_current_filing, so nothing else is consumed.

begin;

create temp table _firm_derived on commit drop as
with cur as (
  select fcf.firm_crd, fcf.filing_id
    from market.firm_current_filing fcf
),
advisor_counts as (
  select employer_firm_crd as firm_crd, count(distinct advisor_crd)::int as advisor_count
    from market.advisor_registration
   where end_date is null and employer_firm_crd is not null
   group by employer_firm_crd
),
/**
 * A broker-dealer affiliate is identifiable by its SEC number: 8-xxxxx is a
 * broker-dealer, 801-xxxxx an adviser. relationship_types is null on all 1.8M
 * affiliation rows, so this prefix is the only available signal.
 */
bd_affiliated as (
  select distinct a.filing_id
    from market.firm_fact_affiliation a
    join cur on cur.filing_id = a.filing_id
   where a.related_sec_number ~ '^8-'
),
base as (
  select c.firm_crd,
         c.filing_id,
         m.regulatory_aum,
         m.client_count,
         m.employee_count,
         ac.advisor_count,
         r.is_era,
         (bd.filing_id is not null) as has_bd_affiliate
    from cur c
    left join market.firm_fact_metrics      m  on m.filing_id  = c.filing_id
    left join market.firm_fact_registration r  on r.filing_id  = c.filing_id
    left join advisor_counts                ac on ac.firm_crd  = c.firm_crd
    left join bd_affiliated                 bd on bd.filing_id = c.filing_id
)
select b.filing_id,
       b.advisor_count,

       (b.regulatory_aum / nullif(b.advisor_count, 0))   as aum_per_advisor,
       (b.regulatory_aum / nullif(b.client_count, 0))    as aum_per_client,
       (b.regulatory_aum / nullif(b.employee_count, 0))  as aum_per_employee,
       (b.client_count::numeric / nullif(b.advisor_count, 0)) as clients_per_advisor,

       -- percentiles rank against the current population, not all of history
       case when b.regulatory_aum is not null then
         (percent_rank() over (order by b.regulatory_aum) * 100)::int
       end                                               as aum_percentile,
       case when b.regulatory_aum is not null and b.advisor_count > 0 then
         (percent_rank() over (order by b.regulatory_aum / nullif(b.advisor_count, 0)) * 100)::int
       end                                               as aum_per_advisor_percentile,
       case when b.regulatory_aum is not null and b.client_count > 0 then
         (percent_rank() over (order by b.regulatory_aum / nullif(b.client_count, 0)) * 100)::int
       end                                               as aum_per_client_percentile,

       /**
        * Only era and hybrid are evidenced. bank_affiliated and
        * insurance_affiliated have no signal in the source and are never
        * assigned; pure_ria relies on ADV requiring affiliates to be disclosed,
        * so absence is taken as none.
        */
       case
         when b.is_era                          then 'era'
         when b.has_bd_affiliate                then 'hybrid'
         when b.is_era is not null              then 'pure_ria'
       end                                               as channel_code,

       band.code                                         as aum_band_code
  from base b
  left join lateral (
    select d.code
      from market.dim_aum_band d
     where b.regulatory_aum is not null
       and (d.lower_aum is null or b.regulatory_aum >= d.lower_aum)
       and (d.upper_aum is null or b.regulatory_aum <  d.upper_aum)
     limit 1
  ) band on true;

truncate market.firm_fact_derived;

insert into market.firm_fact_derived (
  filing_id, advisor_count,
  aum_per_advisor, aum_per_client, aum_per_employee, clients_per_advisor,
  aum_percentile, aum_per_advisor_percentile, aum_per_client_percentile,
  channel_code, aum_band_code
)
select
  filing_id, advisor_count,
  aum_per_advisor, aum_per_client, aum_per_employee, clients_per_advisor,
  aum_percentile, aum_per_advisor_percentile, aum_per_client_percentile,
  channel_code, aum_band_code
from _firm_derived;

commit;
