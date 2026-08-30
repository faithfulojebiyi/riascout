-- Bootstraps market.advisor_movement from the registration spine.
--
-- The authoritative path is successive-snapshot diffs over
-- advisor_firm_observation, which needs snapshots we do not have yet. The
-- intervals carry their own time axis, so movement is derivable now — but only
-- valid time. detected_on is the load date, because every one of these was
-- learned at once; latency is not real until snapshots accumulate.
--
-- Append-only. ON CONFLICT DO NOTHING against a NULLS NOT DISTINCT unique key,
-- so a departure does not duplicate on re-run.

begin;

create temp table _movement on commit drop as
with ordered as (
  /**
   * One row per advisor per firm stint. Registrations at the same firm with
   * different categories start on different dates; collapsing them first is
   * what stops one job reading as two moves.
   */
  select advisor_crd,
         employer_firm_crd as firm_crd,
         min(start_date)                          as started_on,
         max(end_date)                            as ended_on,
         bool_or(end_date is null)                as still_open
    from market.advisor_registration
   where employer_firm_crd is not null
     and start_date is not null
   group by advisor_crd, employer_firm_crd
),
sequenced as (
  select advisor_crd,
         firm_crd,
         started_on,
         ended_on,
         still_open,
         lag(firm_crd)   over w as prev_firm_crd,
         lag(started_on) over w as prev_started_on,
         lag(ended_on)   over w as prev_ended_on,
         lag(still_open) over w as prev_still_open
    from ordered
  window w as (partition by advisor_crd order by started_on, firm_crd)
),
moves as (
  -- joining a firm: either the first one we know of, or a change from another
  select advisor_crd,
         prev_firm_crd                            as from_firm_crd,
         firm_crd                                 as to_firm_crd,
         case when prev_firm_crd is null
              then 'FIRST_REGISTRATION'
              else 'FIRM_CHANGE'
         end                                      as event_type,
         started_on                               as occurred_on,
         case when prev_firm_crd is not null and prev_started_on is not null
              then (started_on - prev_started_on)
         end                                      as tenure_days
    from sequenced
   where prev_firm_crd is distinct from firm_crd

  union all

  /**
   * Leaving the industry: the last stint closed and nothing followed. Both firm
   * CRDs are nullable precisely so this is representable — a NOT NULL
   * to_firm_crd would make departure inexpressible.
   */
  select s.advisor_crd,
         s.firm_crd                               as from_firm_crd,
         null::bigint                             as to_firm_crd,
         'DEPARTURE'                              as event_type,
         s.ended_on                               as occurred_on,
         (s.ended_on - s.started_on)              as tenure_days
    from sequenced s
   where s.ended_on is not null
     and not s.still_open
     and not exists (
       select 1 from sequenced n
        where n.advisor_crd = s.advisor_crd
          and (n.started_on, n.firm_crd) > (s.started_on, s.firm_crd)
     )
)
select advisor_crd, from_firm_crd, to_firm_crd, event_type, occurred_on,
       tenure_days
  from moves
 where occurred_on is not null;

insert into market.advisor_movement (
  advisor_crd, from_firm_crd, to_firm_crd, event_type, occurred_on,
  detected_on, tenure_days
)
select m.advisor_crd, m.from_firm_crd, m.to_firm_crd, m.event_type,
       m.occurred_on,
       -- know time: today, honestly. Not backfilled to look like we saw it live
       current_date,
       m.tenure_days
  from _movement m
  join market.advisor a on a.advisor_crd = m.advisor_crd
    -- inferred from the unique index, which is NULLS NOT DISTINCT so a
    -- departure does not duplicate
    on conflict (advisor_crd, to_firm_crd, occurred_on) do nothing;

commit;
