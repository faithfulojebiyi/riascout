-- Derives movement from the diff between successive observations.
-- Append-only: never deletes, so a vendor dropping a registration reads as a
-- DEPARTURE rather than silently erasing what we believed yesterday.
--
-- @param {DateTime} $1:observedOn

with primary_firm as (
  -- an advisor may hold several concurrent registrations, so collapse each
  -- observation to one firm: the earliest-joined, matching current_firm_crd
  select distinct on (o.advisor_crd, o.observed_on)
         o.advisor_crd,
         o.observed_on,
         o.firm_crd
    from market.advisor_firm_observation o
    left join lateral (
      select min(r.start_date) as joined_on
        from market.advisor_registration r
       where r.advisor_crd = o.advisor_crd
         and r.employer_firm_crd = o.firm_crd
    ) j on true
   order by o.advisor_crd, o.observed_on, j.joined_on asc nulls last, o.firm_crd
),
ranked as (
  select advisor_crd,
         observed_on,
         firm_crd,
         lag(firm_crd) over (partition by advisor_crd order by observed_on) as prev_firm_crd
    from primary_firm
),
changes as (
  select advisor_crd,
         prev_firm_crd,
         firm_crd,
         observed_on,
         case
           when prev_firm_crd is null then 'FIRST_REGISTRATION'
           when firm_crd is null      then 'DEPARTURE'
           else 'FIRM_CHANGE'
         end as event_type
    from ranked
   where firm_crd is distinct from prev_firm_crd
     and observed_on = $1
     -- an advisor first seen with no firm is not a first registration
     and not (prev_firm_crd is null and firm_crd is null)
)
insert into market.advisor_movement
  (advisor_crd, from_firm_crd, to_firm_crd, event_type, occurred_on, detected_on, tenure_days)
select c.advisor_crd,
       c.prev_firm_crd,
       c.firm_crd,
       c.event_type,
       joined.start_date,
       c.observed_on,
       case
         when joined.start_date is not null and prev_joined.start_date is not null
         then joined.start_date - prev_joined.start_date
       end
  from changes c
  left join lateral (
    -- the current stint's start, not the earliest ever: an advisor returning to
    -- a former firm must not inherit the original join date and be deduped away
    select max(r.start_date) as start_date
      from market.advisor_registration r
     where r.advisor_crd = c.advisor_crd
       and r.employer_firm_crd = c.firm_crd
       and r.start_date <= c.observed_on
  ) joined on true
  left join lateral (
    select max(r.start_date) as start_date
      from market.advisor_registration r
     where r.advisor_crd = c.advisor_crd
       and r.employer_firm_crd = c.prev_firm_crd
       and r.start_date <= c.observed_on
  ) prev_joined on true
on conflict do nothing
returning id;
