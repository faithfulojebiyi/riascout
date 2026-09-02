-- The current filing's reported-client total, kept separate from Form ADV
-- account counts because clients and accounts have different regulatory grains.
-- @param {BigInt} $1:firmCrd
select m.reported_client_count_min,
       m.reported_client_count_max,
       m.reported_client_count_quality
  from market.firm_current_filing cf
  left join market.firm_fact_metrics m on m.filing_id = cf.filing_id
 where cf.firm_crd = $1;
