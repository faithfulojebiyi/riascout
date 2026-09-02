-- Per-filing metrics for one firm, compressed to change points.
--
-- Filings restate rather than re-measure: the median firm has 8 filings and 3
-- distinct AUM values, so a point-per-filing chart draws restatements as growth.
--
-- firm_fact_derived is deliberately absent. It holds exactly one row per firm
-- (32,217 rows / 32,217 firms) on that firm's current filing, so joining it here
-- would make every historical point null.
-- @param {BigInt} $1:firmCrd
with per_filing as (
  select f.filing_id,
         f.submitted_at,
         f.filing_type,
         m.regulatory_aum,
         m.discretionary_aum,
         m.non_discretionary_aum,
         m.employee_count,
         m.advisory_employee_count,
         m.client_count,
         m.office_count
    from market.filing f
    left join market.firm_fact_metrics m on m.filing_id = f.filing_id
   where f.firm_crd = $1
),
-- effective_date is null on all 338,022 filings, so submitted_at is the only
-- axis, and 496 (firm_crd, submitted_at) pairs collide — hence the filing_id
-- tiebreak on every ordering below.
ordered as (
  select p.*,
         lag(p.regulatory_aum) over w as prev_aum,
         lag(p.employee_count) over w as prev_employees,
         lag(p.client_count)   over w as prev_clients,
         row_number()          over w as seq
    from per_filing p
  window w as (order by p.submitted_at, p.filing_id)
)
select filing_id,
       submitted_at,
       filing_type,
       regulatory_aum,
       discretionary_aum,
       non_discretionary_aum,
       employee_count,
       advisory_employee_count,
       client_count,
       office_count
  from ordered
 -- `is distinct from`, not `<>`: a measure going null -> value or value -> null
 -- is a change, and `<>` drops both.
 where seq = 1
    or regulatory_aum is distinct from prev_aum
    or employee_count is distinct from prev_employees
    or client_count   is distinct from prev_clients
 order by submitted_at, filing_id;
