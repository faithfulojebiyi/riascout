-- Firms and advisors: identity only. Names are time-varying observations and
-- live elsewhere. Loaded first because everything else FKs to these.
--
-- market.firm is the universe of KNOWN FIRM CRDs, not the universe of firms we
-- hold ADV data for. Two populations live here:
--
--   1. ~32,215 firms from Form ADV — these have filings and full facts.
--   2. ~28,896 firms referenced only as an advisor's employer — broker-dealers,
--      state-registered advisers and deregistered firms outside the SEC ADV
--      set. Identity only, no filings.
--
-- Without (2), 179,932 registrations covering 118,189 advisors (23%) would be
-- dropped by the FK, losing a quarter of all employment history. A previous
-- firm is often the most interesting fact about a recruit.
--
-- Whether a firm has filings is the signal for "do we hold ADV data" — join to
-- market.filing to find out. Do not infer it from presence in market.firm.
-- firm_search applies exactly that test, so (2) is nameable and reachable
-- through movement without ever appearing as a prospecting target.
--
-- Names for both populations come from 015-firm-names.sql, never from here.

-- Insert-only, so the stage is idempotent without deleting rows that filings
-- and registrations reference. Use the `reset` stage for a genuine full reload.

begin;

insert into pg.market.firm (firm_crd, first_seen, last_seen)
select f.firm_crd, f.first_seen_date, f.last_seen_date
from firms f
where not exists (select 1 from pg.market.firm x where x.firm_crd = f.firm_crd);

-- employer CRDs referenced by registrations but absent from the ADV set
insert into pg.market.firm (firm_crd, first_seen, last_seen)
select r.employer_firm_crd, min(r.start_date), max(r.end_date)
from individual_registration_intervals r
where r.employer_firm_crd is not null
  and not exists (select 1 from firms f where f.firm_crd = r.employer_firm_crd)
  and not exists (select 1 from pg.market.firm x where x.firm_crd = r.employer_firm_crd)
group by r.employer_firm_crd;

/**
 * 661 employers appear only in individual_current_registrations. Someone is
 * registered there right now, so the CRD is real and 040 needs the FK — but the
 * table carries no employer name, so these are the only firms we cannot name.
 */
insert into pg.market.firm (firm_crd, first_seen, last_seen)
select c.employer_firm_crd, min(c.status_posted_date), null
from individual_current_registrations c
where c.employer_firm_crd is not null
  and not exists (select 1 from pg.market.firm x where x.firm_crd = c.employer_firm_crd)
group by c.employer_firm_crd;

insert into pg.market.advisor (advisor_crd, first_seen, last_seen)
select i.individual_crd, i.first_seen_at::date, i.last_seen_at::date
from individuals i
where not exists (select 1 from pg.market.advisor x where x.advisor_crd = i.individual_crd);

commit;
