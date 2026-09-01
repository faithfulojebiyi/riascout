-- Processes every complete-but-unprocessed observation run, oldest first.
--
-- Oldest first matters: each run diffs against the one before it, so processing
-- out of order would compare a snapshot against the wrong predecessor.
--
-- The first complete run has no predecessor and is the baseline — processed,
-- zero movements. That is a real state, not a failure, and it is what lets the
-- projections tell "nothing moved" apart from "the engine never ran".

begin;

do $$
declare
  r record;
  n integer;
begin
  for r in
    select collection_id
      from market.observation_run
     where is_complete
       and movement_status <> 'processed'
     order by completed_at asc, collection_id asc
  loop
    n := market.derive_movements(r.collection_id);
    raise notice 'movement: % -> % events', r.collection_id, n;
  end loop;
end $$;

commit;
