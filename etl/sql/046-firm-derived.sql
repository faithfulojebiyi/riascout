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
         m.account_count,
         m.employee_count,
         ac.advisor_count,
         r.is_era,
         (bd.filing_id is not null) as has_bd_affiliate
    from cur c
    left join market.firm_fact_metrics      m  on m.filing_id  = c.filing_id
    left join market.firm_fact_registration r  on r.filing_id  = c.filing_id
    left join advisor_counts                ac on ac.firm_crd  = c.firm_crd
    left join bd_affiliated                 bd on bd.filing_id = c.filing_id
),
ratios as (
  select b.*,
         (b.regulatory_aum / nullif(b.advisor_count, 0)) as aum_per_advisor,
         (b.regulatory_aum / nullif(b.account_count, 0)) as aum_per_account,
         (b.regulatory_aum / nullif(b.employee_count, 0)) as aum_per_employee,
         (b.account_count::numeric / nullif(b.advisor_count, 0)) as accounts_per_advisor
    from base b
),
aum_population as (
  select filing_id,
         round(percent_rank() over (order by regulatory_aum) * 100)::int as percentile
    from ratios
   where regulatory_aum is not null
),
aum_per_advisor_population as (
  select filing_id,
         round(percent_rank() over (order by aum_per_advisor) * 100)::int as percentile
    from ratios
   where aum_per_advisor is not null
),
aum_per_account_population as (
  select filing_id,
         round(percent_rank() over (order by aum_per_account) * 100)::int as percentile
    from ratios
   where aum_per_account is not null
)
select r.filing_id,
       r.advisor_count,

       r.aum_per_advisor,
       r.aum_per_account,
       r.aum_per_employee,
       r.accounts_per_advisor,

       ap.percentile                                     as aum_percentile,
       aap.percentile                                    as aum_per_advisor_percentile,
       aacp.percentile                                   as aum_per_account_percentile,

       /**
        * Only era and hybrid are evidenced. bank_affiliated and
        * insurance_affiliated have no signal in the source and are never
        * assigned; pure_ria relies on ADV requiring affiliates to be disclosed,
        * so absence is taken as none.
        */
       case
         when r.is_era                          then 'era'
         when r.has_bd_affiliate                then 'hybrid'
         when r.is_era is not null              then 'pure_ria'
       end                                               as channel_code,

       band.code                                         as aum_band_code
  from ratios r
  left join aum_population ap on ap.filing_id = r.filing_id
  left join aum_per_advisor_population aap on aap.filing_id = r.filing_id
  left join aum_per_account_population aacp on aacp.filing_id = r.filing_id
  left join lateral (
    select d.code
      from market.dim_aum_band d
     where r.regulatory_aum is not null
       and (d.lower_aum is null or r.regulatory_aum >= d.lower_aum)
       and (d.upper_aum is null or r.regulatory_aum <  d.upper_aum)
     limit 1
  ) band on true;

truncate market.firm_fact_derived;

insert into market.firm_fact_derived (
  filing_id, advisor_count,
  aum_per_advisor, aum_per_account, aum_per_employee, accounts_per_advisor,
  aum_percentile, aum_per_advisor_percentile, aum_per_account_percentile,
  channel_code, aum_band_code
)
select
  filing_id, advisor_count,
  aum_per_advisor, aum_per_account, aum_per_employee, accounts_per_advisor,
  aum_percentile, aum_per_advisor_percentile, aum_per_account_percentile,
  channel_code, aum_band_code
from _firm_derived;

commit;
