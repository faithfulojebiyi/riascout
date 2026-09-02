-- Canonical name for a firm, including the 29,560 firms that have never filed
-- an ADV and so have no firm_search row. Those are known only as an adviser's
-- reported employer, and the record page still has to title itself.
-- @param {BigInt} $1:firmCrd
select firm_crd,
       firm_name,
       -- which source won the precedence ladder, so the page can say how
       -- authoritative the name is
       source_code,
       last_observed_on
  from market.firm_current_name
 where firm_crd = $1;
