-- Advisors registered at a firm on a given date. Half-open [start, end).
-- Distinct because an advisor holds one row per jurisdiction at the same firm.
-- @param {BigInt} $1:firmCrd
-- @param {DateTime} $2:asOf
select distinct
  r.advisor_crd,
  r.source_employer_name,
  min(r.start_date) as start_date
from market.advisor_registration r
where r.employer_firm_crd = $1
  and r.start_date <= $2
  and (r.end_date is null or r.end_date > $2)
group by r.advisor_crd, r.source_employer_name
order by start_date desc;
