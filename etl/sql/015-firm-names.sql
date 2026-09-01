-- Canonical firm names. One row per distinct name per source, so a rename stays
-- distinguishable from a typo and the winner is a view, not a stored guess.
--
-- Three sources, because Form ADV alone names only 32,217 of 61,116 firms. The
-- 28,895 that appear only as an adviser's employer have no filing and so no
-- firm_fact_identity row; source_employer_name covers 100% of them.

begin;

delete from pg.market.firm_name_observation;

insert into pg.market.firm_name_observation (
  firm_crd, source_code, firm_name,
  first_observed_on, last_observed_on, observation_count
)
with observed as (
  select fl.firm_crd,
         'sec_adv' as source_code,
         trim(n.firm_name) as firm_name,
         fl.submitted_at::date as observed_on
    from firm_names n
    join filings fl on fl.filing_id = n.filing_id
   where n.firm_name is not null and trim(n.firm_name) <> ''

  union all

  select d.firm_crd, 'sec_adv_monthly', trim(d.firm_name), d.report_date
    from dated_firm_observations d
   where d.firm_name is not null and trim(d.firm_name) <> ''

  union all

  -- the employer's name as it stood while the adviser held the registration
  select r.employer_firm_crd, 'sec_iapd', trim(r.source_employer_name), r.start_date
    from individual_registration_intervals r
   where r.employer_firm_crd is not null
     and r.source_employer_name is not null
     and trim(r.source_employer_name) <> ''

  union all

  /**
   * Current employment names 31,077 firms and is the only source for the 661
   * that appear nowhere but individual_current_registrations. It carries no
   * date of its own, so the observation is dated by the collection run.
   */
  select e.employer_firm_crd, 'sec_iapd_current', trim(e.employer_name),
         (select max(collection_completed_at)::date from individual_collection_runs)
    from individual_current_employments e
   where e.employer_firm_crd is not null
     and e.employer_name is not null
     and trim(e.employer_name) <> ''
),
known as (
  select firm_crd from pg.market.firm
)
select o.firm_crd, o.source_code, o.firm_name,
       min(o.observed_on), max(o.observed_on), count(*)::int
  from observed o
  join known k on k.firm_crd = o.firm_crd
 group by o.firm_crd, o.source_code, o.firm_name;

commit;
