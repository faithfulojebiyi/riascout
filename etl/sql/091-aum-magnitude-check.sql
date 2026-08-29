-- Counts AUM values a thousandfold below the same firm's maximum. Non-zero
-- means the seed still carries the dropped-exponent defect, and the temporary
-- baseline guard in 051 must stay.
select 'regulatory_aum'    as field,
       count(*) filter (where regulatory_aum > 0 and regulatory_aum < mx_reg / 1000)       as suspect,
       count(*) filter (where regulatory_aum > 0 and regulatory_aum < mx_reg / 1000
                          and filed between date '2025-02-01' and date '2025-08-31')       as in_window
  from (
    select f.submitted_at::date as filed, m.regulatory_aum,
           max(m.regulatory_aum) over (partition by f.firm_crd) as mx_reg
      from market.filing f
      join market.firm_fact_metrics m on m.filing_id = f.filing_id
  ) t
union all
select 'discretionary_aum',
       count(*) filter (where discretionary_aum > 0 and discretionary_aum < mx_dis / 1000),
       count(*) filter (where discretionary_aum > 0 and discretionary_aum < mx_dis / 1000
                          and filed between date '2025-02-01' and date '2025-08-31')
  from (
    select f.submitted_at::date as filed, m.discretionary_aum,
           max(m.discretionary_aum) over (partition by f.firm_crd) as mx_dis
      from market.filing f
      join market.firm_fact_metrics m on m.filing_id = f.filing_id
  ) t;
