-- The complete current-registration population as a dated snapshot.
--
-- individual_current_registrations says who is registered where TODAY. It says
-- nothing about when that began: status_posted_date is when the status last
-- changed, and it clusters on annual CE processing. Writing it as an interval
-- start fabricated tenure and movement, so these are observations instead.
--
-- APPEND-ONLY across collections. Deleting a prior run is what makes movement
-- underivable, so re-running the same collection is idempotent via ON CONFLICT
-- and a different collection lands beside the old one.
--
-- Jurisdiction grain, because the source reports one row per state and the same
-- adviser-firm pair can be APPROVED in one and SUSPENDED in another.
--
-- Classification comes from dim_registration_status, never a denylist here: an
-- unrecognised status resolves to NULL and 090-quality reports it, rather than
-- defaulting into "permitted to transact".
--
-- Staged, because DuckDB falls back to a whole-row COPY when it sees ON
-- CONFLICT, and a COPY supplies no column defaults — the serial id arrives NULL.
-- The staging tables carry no id; postgres assigns it on the final insert.

call postgres_execute('pg', 'drop table if exists market.observation_run__load');
call postgres_execute('pg', 'create unlogged table market.observation_run__load (
  collection_id text, source_code text, observed_on date,
  started_at timestamptz, completed_at timestamptz,
  expected_advisor_count integer, observed_advisor_count integer,
  is_complete boolean)');

call postgres_execute('pg', 'drop table if exists market.advisor_firm_observation__load');
call postgres_execute('pg', 'create unlogged table market.advisor_firm_observation__load (
  advisor_crd bigint, observed_on date, firm_crd bigint, jurisdiction text,
  collection_id text, registration_category text, source_code text,
  status_code text, registration_current boolean, can_conduct_business boolean)');

begin;

insert into pg.market.observation_run__load (
  collection_id, source_code, observed_on, started_at, completed_at,
  expected_advisor_count, observed_advisor_count, is_complete
)
select r.collection_id,
       'sec_iapd_current',
       r.collection_completed_at::date,
       r.collection_started_at,
       r.collection_completed_at,
       r.expected_individual_count,
       r.retrieved_individual_count,
       /**
        * Measured, not taken on the source's word: a status string is its
        * opinion and its vocabulary can change, but retrieving every expected
        * adviser and every expected page is evidence we can check.
        */
       r.collection_completed_at is not null
         and r.expected_individual_count > 0
         and r.retrieved_individual_count >= r.expected_individual_count
         and r.completed_page_requests >= r.expected_page_requests
from individual_collection_runs r
where r.collection_completed_at is not null;

-- one row per adviser-firm-jurisdiction the collection saw
insert into pg.market.advisor_firm_observation__load (
  advisor_crd, observed_on, firm_crd, jurisdiction, collection_id,
  registration_category, source_code, status_code,
  registration_current, can_conduct_business
)
select c.individual_crd,
       -- each row dated by its own collection, never the global maximum: with
       -- two collections the global max would misdate the older snapshot
       max(cr.collection_completed_at)::date,
       c.employer_firm_crd,
       c.jurisdiction,
       c.collection_id,
       max(c.registration_category),
       'sec_iapd_current',
       max(c.status),
       -- NULL, not false, when the status is unclassified: unknown is not "no"
       case when count(*) filter (where d.code is null) > 0 then null
            else max(case when d.registration_current then 1 else 0 end) = 1 end,
       case when count(*) filter (where d.code is null) > 0 then null
            else max(case when d.can_conduct_business then 1 else 0 end) = 1 end
from individual_current_registrations c
join individual_collection_runs cr on cr.collection_id = c.collection_id
left join pg.market.dim_registration_status d on d.code = c.status
where c.employer_firm_crd is not null
  and exists (select 1 from individuals i where i.individual_crd = c.individual_crd)
  and exists (select 1 from pg.market.firm f where f.firm_crd = c.employer_firm_crd)
group by c.individual_crd, c.employer_firm_crd, c.jurisdiction, c.collection_id;

/**
 * Absence, recorded explicitly. Without a null-firm row an adviser who vanishes
 * from every firm produces no new observation next snapshot, so the diff cannot
 * see a departure — it would look like nothing happened.
 */
insert into pg.market.advisor_firm_observation__load (
  advisor_crd, observed_on, firm_crd, jurisdiction, collection_id,
  source_code, registration_current, can_conduct_business
)
select i.individual_crd,
       cr.collection_completed_at::date,
       null, null,
       cr.collection_id,
       'sec_iapd_current', false, false
from individuals i
cross join (
  select collection_id, collection_completed_at from individual_collection_runs
   where collection_completed_at is not null
   order by collection_completed_at desc limit 1
) cr
where not exists (
  select 1 from individual_current_registrations c
   join pg.market.dim_registration_status d on d.code = c.status
   where c.individual_crd = i.individual_crd
     and c.employer_firm_crd is not null
     and d.can_conduct_business
);

commit;

-- postgres assigns the serial id here, and ON CONFLICT keeps a re-run of the
-- same collection idempotent without touching any other snapshot
call postgres_execute('pg', $swap$
begin;
insert into market.observation_run (
  collection_id, source_code, observed_on, started_at, completed_at,
  expected_advisor_count, observed_advisor_count, is_complete)
select collection_id, source_code, observed_on, started_at, completed_at,
       expected_advisor_count, observed_advisor_count, is_complete
  from market.observation_run__load
-- the run record is metadata about the collection, so a re-measure updates it;
-- the observations below stay DO NOTHING because they are the snapshot itself
on conflict (collection_id) do update set
  observed_on = excluded.observed_on,
  started_at = excluded.started_at,
  completed_at = excluded.completed_at,
  expected_advisor_count = excluded.expected_advisor_count,
  observed_advisor_count = excluded.observed_advisor_count,
  is_complete = excluded.is_complete;

insert into market.advisor_firm_observation (
  advisor_crd, observed_on, firm_crd, jurisdiction, collection_id,
  registration_category, source_code, status_code,
  registration_current, can_conduct_business)
select advisor_crd, observed_on, firm_crd, jurisdiction, collection_id,
       registration_category, source_code, status_code,
       registration_current, can_conduct_business
  from market.advisor_firm_observation__load
on conflict do nothing;

drop table market.observation_run__load;
drop table market.advisor_firm_observation__load;
commit;
$swap$);
