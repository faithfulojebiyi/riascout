-- Advisor detail, registrations and employment history.
--
-- Registrations carry a firm CRD on 100% of rows with ISO dates; employment
-- history carries none at all with month precision. They are separate tables
-- and only registrations are authoritative.

begin;

-- ── names: one observation, dated from the collection run ───────────────────
delete from pg.market.advisor_name;

insert into pg.market.advisor_name (
  advisor_crd, observed_on, first_name, middle_name, last_name, suffix_name
)
select n.individual_crd,
       coalesce(
         (select max(collection_completed_at)::date from individual_collection_runs),
         current_date
       ),
       max(n.first_name), max(n.middle_name), max(n.last_name), max(n.suffix_name)
from individual_names n
where exists (select 1 from individuals i where i.individual_crd = n.individual_crd)
group by n.individual_crd;

-- ── exams: exam_name is functionally dependent on the code, so it lives in
--    dim_exam and is not repeated on 739k rows ────────────────────────────────
insert into pg.market.dim_exam (code, name)
select distinct exam_code, first(exam_name)
from individual_exams
where exam_code is not null
group by exam_code
on conflict (code) do nothing;

delete from pg.market.advisor_exam;

insert into pg.market.advisor_exam (advisor_crd, exam_code, exam_date)
select e.individual_crd, e.exam_code, min(e.exam_date)
from individual_exams e
where e.exam_code is not null
  and exists (select 1 from individuals i where i.individual_crd = e.individual_crd)
group by e.individual_crd, e.exam_code;

-- ── designations ────────────────────────────────────────────────────────────
delete from pg.market.advisor_designation;

insert into pg.market.advisor_designation (advisor_crd, designation_name)
select distinct d.individual_crd, d.designation_name
from individual_designations d
where d.designation_name is not null
  and exists (select 1 from individuals i where i.individual_crd = d.individual_crd);

-- ── disclosure flags: flags are all this source has ─────────────────────────
delete from pg.market.advisor_disclosure_flag;

insert into pg.market.advisor_disclosure_flag (
  advisor_crd, has_regulatory_action, has_criminal, has_bankruptcy,
  has_civil_judgment, has_bond, has_judgment, has_investigation,
  has_customer_complaint, has_termination, has_other
)
select f.individual_crd,
       max(f.has_regulatory_action::int)::boolean, max(f.has_criminal::int)::boolean,
       max(f.has_bankruptcy::int)::boolean, max(f.has_civil_judgment::int)::boolean,
       max(f.has_bond::int)::boolean, max(f.has_judgment::int)::boolean,
       max(f.has_investigation::int)::boolean, max(f.has_customer_complaint::int)::boolean,
       max(f.has_termination::int)::boolean, max(f.has_other::int)::boolean
from individual_disclosure_flags f
where exists (select 1 from individuals i where i.individual_crd = f.individual_crd)
group by f.individual_crd;

-- ── registrations: the authoritative advisor↔firm truth ─────────────────────
--
-- The source reports the same registration more than once with differing end
-- dates (IAPD previous-registration context), which genuinely overlaps. Those
-- are coalesced per (advisor, firm, jurisdiction) using gaps-and-islands.
--
-- Only intervals that actually overlap or touch are merged — an advisor who
-- leaves a firm and returns later keeps two separate rows, because that
-- boomerang is a real recruiting signal, not a duplicate. Merging is
-- surgical: ~1,146 of 1.54M rows collapse.
--
-- Rows whose end precedes their start (135 in the seed) are rejected here and
-- reported by 090-quality rather than dropped silently.
delete from pg.market.advisor_registration;

insert into pg.market.advisor_registration (
  advisor_crd, employer_firm_crd, source_employer_name, jurisdiction,
  registration_category, status, start_date, end_date,
  start_precision, end_precision, interval_source
)
with src as (
  select r.individual_crd, r.employer_firm_crd,
         coalesce(r.jurisdiction, '~') as jkey, r.jurisdiction,
         r.registration_category, r.status, r.start_date,
         -- open intervals sort last; converted back to NULL after merging
         coalesce(r.end_date, date '9999-12-31') as end_eff,
         r.start_precision, r.end_precision, r.interval_source, r.source_employer_name
  from individual_registration_intervals r
  where exists (select 1 from individuals i where i.individual_crd = r.individual_crd)
    and r.employer_firm_crd is not null
    and (r.end_date is null or r.start_date is null or r.end_date >= r.start_date)
),
ordered as (
  select *, max(end_eff) over (
      partition by individual_crd, employer_firm_crd, jkey
      order by start_date, end_eff
      rows between unbounded preceding and 1 preceding) as prev_max_end
  from src
),
islands as (
  select *, sum(case when prev_max_end is null or start_date > prev_max_end then 1 else 0 end)
       over (partition by individual_crd, employer_firm_crd, jkey
             order by start_date, end_eff) as island
  from ordered
)
select individual_crd, employer_firm_crd,
       max(source_employer_name), max(jurisdiction),
       max(registration_category), max(status),
       min(start_date),
       case when max(end_eff) = date '9999-12-31' then null else max(end_eff) end,
       max(start_precision), max(end_precision), max(interval_source)
from islands
group by individual_crd, employer_firm_crd, jkey, island;

-- ── employment history: no firm CRD in the source, month precision ──────────
delete from pg.market.advisor_employment;

insert into pg.market.advisor_employment (
  advisor_crd, source_employer_name, city, region_raw,
  start_month, end_month, is_open_ended, employment_sequence
)
select e.individual_crd, e.source_employer_name, e.city, e.region_raw,
       e.start_month, e.end_month, coalesce(e.is_open_ended, false), e.employment_sequence
from individual_employment_intervals e
where exists (select 1 from individuals i where i.individual_crd = e.individual_crd)
  and e.source_employer_name is not null
  and (e.end_month is null or e.start_month is null or e.end_month >= e.start_month);

-- ── work locations, SEC-sourced ─────────────────────────────────────────────
delete from pg.market.advisor_location;

insert into pg.market.advisor_location (
  advisor_crd, sequence, location_source, street_1, street_2,
  city, region_raw, postal_code, country_code, is_us_workplace
)
select l.individual_crd, l.location_sequence, l.location_source,
       l.street_1, l.street_2, l.city, l.region_raw,
       l.postal_code, l.country_code, l.is_us_workplace
from individual_registration_locations l
where exists (select 1 from individuals i where i.individual_crd = l.individual_crd);

commit;
