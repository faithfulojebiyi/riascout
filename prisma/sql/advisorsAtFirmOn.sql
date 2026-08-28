-- Advisors registered at a firm on a given date. Half-open [start, end).
-- Types are derived from the database by `bun run prisma:generate`.
-- @param {BigInt} $1:firmCrd
-- @param {DateTime} $2:asOf
select
  t.advisor_crd,
  t.source_employer_name,
  t.start_date,
  t.end_date
from market.advisor_tenure t
where t.firm_crd = $1
  and t.kind = 'registration'
  and t.start_date <= $2
  and (t.end_date is null or t.end_date > $2)
order by t.start_date desc;
