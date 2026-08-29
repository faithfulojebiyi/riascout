-- Derives per-advisor career facts from the registration spine and credential
-- tables. Postgres-side: every input is already in market, and this is the
-- table advisor_search reads for tenure, experience, exams and designations.
--
-- Tenure and experience are measured to today rather than stored as dates,
-- because "how long have they been there" is the question a recruiter asks and
-- it changes daily.

begin;

create temp table _advisor_derived on commit drop as
with open_reg as (
  select advisor_crd,
         min(start_date)                      as current_since,
         count(distinct employer_firm_crd)    as current_firm_count
    from market.advisor_registration
   where end_date is null
   group by advisor_crd
),
closed_reg as (
  select advisor_crd,
         count(distinct employer_firm_crd)    as previous_firm_count,
         -- mean months at firms already left; a mobility signal
         avg((end_date - start_date) / 30.44) filter (
           where start_date is not null and end_date is not null
         )                                    as avg_previous_tenure_months
    from market.advisor_registration
   where end_date is not null
   group by advisor_crd
),
career as (
  select advisor_crd, min(start_date) as first_registered
    from market.advisor_registration
   group by advisor_crd
),
juris as (
  select advisor_crd,
         array_agg(distinct jurisdiction) filter (where jurisdiction is not null) as jurisdictions,
         count(distinct jurisdiction) filter (where jurisdiction is not null)     as jurisdiction_count
    from market.advisor_registration
   group by advisor_crd
),
exams as (
  select advisor_crd, array_agg(distinct exam_code order by exam_code) as exam_codes
    from market.advisor_exam
   where exam_code is not null
   group by advisor_crd
),
designations as (
  -- the source carries a name, not a code; there is no dim table for these
  select advisor_crd, array_agg(distinct designation_name order by designation_name) as designations
    from market.advisor_designation
   where designation_name is not null
   group by advisor_crd
)
select a.advisor_crd,
       -- months, floored; the projection divides to years for display
       case when c.first_registered is not null
            then (extract(year  from age(current_date, c.first_registered)) * 12
                + extract(month from age(current_date, c.first_registered)))::int
       end                                                as experience_months,
       case when o.current_since is not null
            then (extract(year  from age(current_date, o.current_since)) * 12
                + extract(month from age(current_date, o.current_since)))::int
       end                                                as tenure_months,
       coalesce(o.current_firm_count, 0)                  as current_firm_count,
       coalesce(cl.previous_firm_count, 0)                as previous_firm_count,
       round(cl.avg_previous_tenure_months)::int          as avg_previous_tenure_months,
       coalesce(j.jurisdiction_count, 0)::int             as jurisdiction_count,
       coalesce(j.jurisdictions,  '{}'::text[])           as jurisdictions,
       coalesce(e.exam_codes,     '{}'::text[])           as exam_codes,
       coalesce(d.designations,   '{}'::text[])           as designations,
       -- active means holding an open registration today, not merely present
       (o.advisor_crd is not null)                        as is_active
  from market.advisor a
  left join open_reg      o  on o.advisor_crd  = a.advisor_crd
  left join closed_reg    cl on cl.advisor_crd = a.advisor_crd
  left join career        c  on c.advisor_crd  = a.advisor_crd
  left join juris         j  on j.advisor_crd  = a.advisor_crd
  left join exams         e  on e.advisor_crd  = a.advisor_crd
  left join designations  d  on d.advisor_crd  = a.advisor_crd;

truncate market.advisor_derived;

insert into market.advisor_derived (
  advisor_crd, experience_months, tenure_months, current_firm_count,
  previous_firm_count, avg_previous_tenure_months, jurisdiction_count,
  jurisdictions, exam_codes, designations, is_active
)
select
  advisor_crd, experience_months, tenure_months, current_firm_count,
  previous_firm_count, avg_previous_tenure_months, jurisdiction_count,
  jurisdictions, exam_codes, designations, is_active
from _advisor_derived;

commit;
