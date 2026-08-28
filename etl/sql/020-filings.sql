-- The filing spine. A filing is a point in time; "current" is the latest one.
-- Only filings whose firm exists are loaded — an orphan filing would violate
-- the FK and abort the whole load.

begin;

delete from pg.market.filing;

insert into pg.market.filing (
  filing_id, firm_crd, submitted_at, effective_date,
  filing_type, registration_category, sec_number
)
select f.filing_id, f.firm_crd, f.submitted_at, f.effective_date,
       f.filing_type, f.registration_category, f.sec_number
from filings f
where exists (select 1 from firms x where x.firm_crd = f.firm_crd);

commit;
