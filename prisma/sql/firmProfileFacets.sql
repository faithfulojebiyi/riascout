-- Client types, services and fee methods on a firm's current filing, labelled.
--
-- One union instead of three round trips: all three are small closed
-- vocabularies (13 client types, and a filing carries a median of 4), and the
-- Overview narrative needs every one of them before it can render a sentence.
--
-- An empty result is "the filing reported no method", which is unknown rather
-- than a statement that the firm charges nothing — the caller must not render
-- it as none.
-- @param {BigInt} $1:firmCrd
select 'client_type' as facet,
       t.client_type_code as code,
       d.name             as label,
       t.client_count     as client_count,
       t.regulatory_aum   as regulatory_aum
  from market.firm_current_filing cf
  join market.firm_fact_client_type t on t.filing_id = cf.filing_id
  left join market.dim_client_type d on d.code = t.client_type_code
 where cf.firm_crd = $1

union all

select 'service', s.service_type_code, d.name, null::bigint, null::numeric
  from market.firm_current_filing cf
  join market.firm_fact_service s on s.filing_id = cf.filing_id
  left join market.dim_service_type d on d.code = s.service_type_code
 where cf.firm_crd = $1

union all

select 'fee_method', f.fee_method_code, d.name, null::bigint, null::numeric
  from market.firm_current_filing cf
  join market.firm_fact_fee_method f on f.filing_id = cf.filing_id
  left join market.dim_fee_method d on d.code = f.fee_method_code
 where cf.firm_crd = $1

order by facet, regulatory_aum desc nulls last, label;
