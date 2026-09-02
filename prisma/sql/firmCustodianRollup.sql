-- Custodians on a firm's current filing, rolled up by canonical name.
--
-- The raw grain is one row per (custodian, private fund), so the worst case is
-- 22,277 rows describing exactly one custodian. Listing those raw would not just
-- be large, it would misreport a single custodial relationship as thousands.
--
-- Keyed by filing_id, never firm_crd: every firm fact hangs off a filing, and
-- querying by firm alone aggregates the entire 3.4M-row filing history.
-- @param {BigInt} $1:firmCrd
select coalesce(d.canonical_name, c.source_name) as custodian_name,
       -- resolved means it matched the dimension, so the name is comparable
       -- across firms; an unresolved one is only as good as the filer typed it
       (d.id is not null)                        as is_resolved,
       count(*)                                  as fund_count,
       -- sums nulls away rather than to zero: a custodian holding unreported
       -- assets is unknown, not empty
       sum(c.aum_at_custodian)                   as aum_at_custodian
  from market.firm_current_filing cf
  join market.firm_fact_custodian c on c.filing_id = cf.filing_id
  left join market.dim_custodian d on d.id = c.custodian_id
 where cf.firm_crd = $1
 group by coalesce(d.canonical_name, c.source_name), (d.id is not null)
 order by aum_at_custodian desc nulls last, fund_count desc, custodian_name;
