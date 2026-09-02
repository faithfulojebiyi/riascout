-- The firm's current filing, plus how many it has filed in total.
--
-- Reads the view rather than re-deriving it. The view orders by
-- effective_date desc nulls last, and effective_date is null on all 338,022
-- filings — a hand-rolled `order by effective_date desc` would take postgres's
-- nulls-first default and pick an arbitrary row.
--
-- filing_count 0 is the firm that has never filed an ADV, which is a different
-- statement from a firm that filed and reported nothing.
-- @param {BigInt} $1:firmCrd
select cf.filing_id,
       cf.submitted_at,
       f.filing_type,
       f.registration_category,
       f.sec_number,
       (select count(*) from market.filing x where x.firm_crd = $1) as filing_count
  from market.firm_current_filing cf
  left join market.filing f on f.filing_id = cf.filing_id
 where cf.firm_crd = $1;
