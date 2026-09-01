-- Form ADV Item 5.E fee methods.
--
-- A separate stage because a release published before the canonicalizer emitted
-- filing_fee_methods has no such table, and the loader skips a stage whose
-- source is absent rather than failing the whole run.
--
-- Only affirmative flags are recorded upstream, so a firm with no rows has not
-- reported a method — unknown, not a statement that it charges nothing.

begin;

delete from pg.market.firm_fact_fee_method;

insert into pg.market.firm_fact_fee_method (filing_id, fee_method_code)
select distinct f.filing_id, m.code
from filing_fee_methods f
join (values
  ('Percentage of Assets Under Management','percentage_of_aum'),
  ('Hourly Charges','hourly'),
  ('Subscription Fees','subscription'),
  ('Fixed Fees','fixed'),
  ('Commissions','commissions'),
  ('Performance-Based Fees','performance_based'),
  ('Other','other')
) as m(label, code) on m.label = f.fee_method
where exists (select 1 from pg.market.filing x where x.filing_id = f.filing_id);

commit;
