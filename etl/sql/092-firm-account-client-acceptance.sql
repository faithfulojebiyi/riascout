-- One row per current filing for the approval-gated post-load audit.
select fs.firm_crd,
       fs.firm_name,
       fs.regulatory_aum,
       fs.discretionary_aum,
       fs.non_discretionary_aum,
       fs.discretionary_account_count,
       fs.non_discretionary_account_count,
       fs.account_count,
       fs.reported_client_count_min,
       fs.reported_client_count_max,
       fs.reported_client_count_quality,
       ct.client_type_count_min,
       ct.client_type_count_max,
       ct.client_type_aum_sum,
       fs.advisor_count as linked_active_advisor_count,
       fs.aum_per_account,
       fs.aum_per_advisor as aum_per_linked_active_advisor,
       fs.aum_per_employee,
       fs.aum_percentile,
       fs.aum_per_advisor_percentile,
       fd.aum_per_account_percentile,
       case
         when fs.discretionary_account_count is null
           or fs.non_discretionary_account_count is null
           or fs.account_count is null then 'not_comparable'
         when fs.discretionary_account_count + fs.non_discretionary_account_count
           = fs.account_count then 'reconciled'
         else 'source_difference'
       end as account_reconciliation_status,
       case
         when fs.regulatory_aum is null or ct.client_type_aum_sum is null
           then 'not_comparable'
         when fs.regulatory_aum = ct.client_type_aum_sum then 'reconciled'
         else 'source_difference'
       end as client_aum_reconciliation_status
from market.firm_search fs
join market.firm_current_filing cf on cf.firm_crd = fs.firm_crd
left join market.firm_fact_derived fd on fd.filing_id = cf.filing_id
left join lateral (
  select sum(
           case
             when t.client_count > 0 then t.client_count
             when t.fewer_than_five is true then 1
             else 0
           end
         ) as client_type_count_min,
         sum(
           case
             when t.client_count > 0 then t.client_count
             when t.fewer_than_five is true then 4
             else 0
           end
         ) as client_type_count_max,
         sum(t.regulatory_aum) as client_type_aum_sum
  from market.firm_fact_client_type t
  where t.filing_id = cf.filing_id
) ct on true
order by fs.firm_crd;
