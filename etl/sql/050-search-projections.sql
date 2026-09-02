-- Rebuilds the prospecting projections. Runs against postgres directly, not
-- through duckdb: every source is already in market, and window functions plus
-- ON CONFLICT have no business going through an attached scanner.
--
-- Built into a temp table and swapped in one statement, so a reader never sees
-- a half-populated projection.

begin;

-- ── advisor_search ──────────────────────────────────────────────────────────

create temp table _advisor_search on commit drop as
with latest_name as (
  select distinct on (advisor_crd)
         advisor_crd, first_name, last_name,
         nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') as full_name
    from market.advisor_name
   order by advisor_crd, observed_on desc nulls last
),
primary_firm as (
  /**
   * From the canonical affiliation relation, never re-derived here. A
   * registration outranks an observation, then longest-held wins; an
   * observation-backed link keeps a null start because none is known.
   */
  select distinct on (a.advisor_crd)
         a.advisor_crd, a.firm_crd, a.since as start_date,
         a.source, a.observed_on
    from market.advisor_current_affiliation a
   order by a.advisor_crd,
            case a.source when 'registration' then 0 else 1 end,
            a.since asc nulls last
),
firm_now as (
  select f.firm_crd, f.filing_id
    from market.firm_current_filing f
),
disclosure as (
  select advisor_crd,
         (coalesce(has_regulatory_action, false) or coalesce(has_criminal, false)
          or coalesce(has_bankruptcy, false) or coalesce(has_civil_judgment, false)
          or coalesce(has_bond, false) or coalesce(has_judgment, false)
          or coalesce(has_investigation, false) or coalesce(has_customer_complaint, false)
          or coalesce(has_termination, false)) as any_disclosure,
         -- has_other exists in the source but is not one of the nine
         -- documented flags, so it is excluded from status and count
         (has_regulatory_action is null) as unknown_flags,
         (coalesce(has_regulatory_action::int, 0) + coalesce(has_criminal::int, 0)
          + coalesce(has_bankruptcy::int, 0) + coalesce(has_civil_judgment::int, 0)
          + coalesce(has_bond::int, 0) + coalesce(has_judgment::int, 0)
          + coalesce(has_investigation::int, 0) + coalesce(has_customer_complaint::int, 0)
          + coalesce(has_termination::int, 0)) as disclosure_count
    from market.advisor_disclosure_flag
),
location as (
  -- no is_primary column; the lowest sequence is the primary address, and the
  -- source records a free-text region rather than a normalised state
  select distinct on (advisor_crd)
         advisor_crd, city, region_raw as state, postal_code, country_code, is_us_workplace
    from market.advisor_location
   order by advisor_crd, sequence asc nulls last
),
previous_firms as (
  select advisor_crd, array_agg(distinct employer_firm_crd) as crds
    from market.advisor_registration
   where end_date is not null
   group by advisor_crd
),
movement_ready as (
  select (select count(*) from market.observation_run where is_complete) >= 2
     and coalesce((
       select movement_status = 'processed'
         from market.observation_run
        where is_complete
        order by completed_at desc, collection_id desc
        limit 1), false) as ready
)
select a.advisor_crd,
       n.full_name, n.first_name, n.last_name,
       d.is_active,

       pf.firm_crd                                      as current_firm_crd,
       -- not fi.firm_name: 25,361 advisers work at a firm with no ADV filing,
       -- and reading the name off the current filing left them blank
       coalesce(fcn.firm_name, fi.firm_name)            as current_firm_name,
       pf.start_date                                    as current_firm_since,
       pf.source                                        as current_firm_source,
       pf.observed_on                                   as current_firm_observed_on,
       coalesce(d.current_firm_count, 0)                as current_firm_count,

       -- no authentic start means no tenure; it is not zero and not guessable
       case when pf.source = 'registration' then d.tenure_months end as tenure_months,
       d.experience_months,
       case when pf.source = 'registration' then d.tenure_months / 12 end as tenure_years,
       (d.experience_months / 12)                       as experience_years,
       coalesce(d.previous_firm_count, 0)               as previous_firm_count,
       d.avg_previous_tenure_months,
       coalesce(prev.crds, '{}'::bigint[])                        as previous_firm_crds,

       coalesce(d.exam_codes, '{}'::text[])                     as exam_codes,
       coalesce(d.designations, '{}'::text[])                   as designations,
       coalesce(d.jurisdictions, '{}'::text[])                  as jurisdictions,
       coalesce(d.jurisdiction_count, 0)                as jurisdiction_count,

       case
         when disc.advisor_crd is null then 'unknown'
         when disc.unknown_flags        then 'unknown'
         when disc.any_disclosure       then 'has_disclosure'
         else 'none_reported'
       end                                              as disclosure_status,
       disc.disclosure_count,

       own.owns_current_firm, own.ownership_band, own.is_control_person, own.owner_title,

       loc.city, loc.state, loc.postal_code, loc.country_code, loc.is_us_workplace,

       /**
        * NULL until two complete snapshots can be diffed. A zero move count
        * would claim we looked and saw nothing; we have not looked yet.
        */
       case when mr.ready then mv.last_moved_on end     as last_moved_on,
       case when mr.ready then mv.last_detected_on end  as last_detected_on,
       case when mr.ready then mv.previous_firm_crd end as previous_firm_crd,
       case when mr.ready then mv.move_count_5y end     as move_count_5y,

       fm.regulatory_aum                                as firm_aum,
       fd.aum_band_code                                 as firm_aum_band,
       fm.discretionary_account_count                   as firm_discretionary_account_count,
       fm.non_discretionary_account_count               as firm_non_discretionary_account_count,
       fm.account_count                                 as firm_account_count,
       fm.reported_client_count_min                     as firm_reported_client_count_min,
       fm.reported_client_count_max                     as firm_reported_client_count_max,
       fm.reported_client_count_quality                 as firm_reported_client_count_quality,
       fm.employee_count                                as firm_employee_count,
       fd.advisor_count                                 as firm_advisor_count,
       fm.office_count                                  as firm_office_count,
       fd.aum_per_advisor                               as firm_aum_per_advisor,
       fd.aum_per_account                               as firm_aum_per_account,
       null::numeric                                    as firm_aum_cagr_3y,
       fd.channel_code                                  as firm_channel,
       fi.region_raw                                    as firm_state,
       fdom.domain                                      as firm_domain,
       fweb.linkedin_url                                as firm_linkedin_url,
       fr.is_sec_registered                             as firm_is_sec_registered,
       fr.is_era                                        as firm_is_era,
       coalesce(fct.codes, '{}'::text[])                        as firm_client_type_codes,
       coalesce(fsv.codes, '{}'::text[])                        as firm_service_codes,
       coalesce(fcu.ids,   '{}'::int[])                        as firm_custodian_ids,
       coalesce(ffu.codes, '{}'::text[])                        as firm_fund_type_codes,

       -- no contact source yet; null means unknown, never false
       null::boolean as has_personal_email,
       null::boolean as has_mobile_phone,
       null::boolean as has_linkedin,
       null::boolean as is_contactable,
       false         as do_not_contact,

       setweight(to_tsvector('simple', coalesce(n.full_name, '')), 'A') ||
       setweight(to_tsvector('simple', coalesce(fcn.firm_name, fi.firm_name, '')), 'B') as search_tsv,
       now() as refreshed_at
  from market.advisor a
  left join latest_name       n    on n.advisor_crd = a.advisor_crd
  left join market.advisor_derived d on d.advisor_crd = a.advisor_crd
  left join primary_firm      pf   on pf.advisor_crd = a.advisor_crd
  left join market.firm_current_name fcn on fcn.firm_crd = pf.firm_crd
  left join firm_now          fn   on fn.firm_crd = pf.firm_crd
  left join market.firm_fact_identity     fi on fi.filing_id = fn.filing_id
  left join market.firm_fact_metrics      fm on fm.filing_id = fn.filing_id
  left join market.firm_fact_derived      fd on fd.filing_id = fn.filing_id
  left join market.firm_fact_registration fr on fr.filing_id = fn.filing_id
  left join market.firm_domain            fdom on fdom.firm_crd = pf.firm_crd
  left join lateral (
    select url_raw as linkedin_url from market.firm_web_presence w
     where w.filing_id = fn.filing_id and w.platform = 'linkedin' limit 1
  ) fweb on true
  left join lateral (
    select array_agg(distinct client_type_code) as codes
      from market.firm_fact_client_type where filing_id = fn.filing_id
  ) fct on true
  left join lateral (
    select array_agg(distinct service_type_code) as codes
      from market.firm_fact_service where filing_id = fn.filing_id
  ) fsv on true
  left join lateral (
    -- custodian_id is null on 316,540 of 3,365,278 rows (the unresolved
    -- custodians), and an unfiltered array_agg turns those into {NULL} rather
    -- than {} — an int[] holding a null, which the prisma client refuses to
    -- deserialize. 051-firm-search.sql already filters for the same reason.
    select array_agg(distinct custodian_id) filter (where custodian_id is not null) as ids
      from market.firm_fact_custodian where filing_id = fn.filing_id
  ) fcu on true
  left join lateral (
    select array_agg(distinct fund_type_code) as codes
      from market.firm_fact_private_fund where filing_id = fn.filing_id
  ) ffu on true
  left join disclosure        disc on disc.advisor_crd = a.advisor_crd
  left join location          loc  on loc.advisor_crd = a.advisor_crd
  left join previous_firms    prev on prev.advisor_crd = a.advisor_crd
  left join lateral (
    select bool_or(o.owner_advisor_crd is not null)              as owns_current_firm,
           max(o.ownership_code)                                 as ownership_band,
           bool_or(coalesce(o.is_control_person, false))         as is_control_person,
           max(o.title_or_status)                                as owner_title
      from market.firm_fact_owner o
     where o.filing_id = fn.filing_id and o.owner_advisor_crd = a.advisor_crd
  ) own on true
  /**
   * Entering the industry is not a move, so FIRST_REGISTRATION is excluded from
   * both — otherwise "moved in the last 90 days" returns 8,167 people who have
   * never worked anywhere else.
   *
   * The count is on occurred_on, not detected_on: the bootstrap detected every
   * move today, so a detection window would return a whole career as recent.
   */
  left join lateral (
    select max(m.occurred_on) filter (where m.event_type <> 'FIRST_REGISTRATION')
             as last_moved_on,
           max(m.detected_on) as last_detected_on,
           (array_agg(m.from_firm_crd order by m.occurred_on desc)
              filter (where m.from_firm_crd is not null))[1] as previous_firm_crd,
           count(*) filter (
             where m.event_type <> 'FIRST_REGISTRATION'
               and m.occurred_on > current_date - interval '5 years'
           )::int as move_count_5y
      from market.advisor_movement m
     where m.advisor_crd = a.advisor_crd
  ) mv on true
  cross join movement_ready mr;

truncate market.advisor_search;

-- named rather than `select *`: positional insert silently shifts every column
-- when the table gains one, and the failure surfaces as a type error far from
-- the cause
insert into market.advisor_search (
  advisor_crd, full_name, first_name, last_name, is_active,
  current_firm_crd, current_firm_name, current_firm_since,
  current_firm_source, current_firm_observed_on, current_firm_count,
  tenure_months, experience_months, tenure_years, experience_years,
  previous_firm_count, avg_previous_tenure_months, previous_firm_crds,
  exam_codes, designations, jurisdictions, jurisdiction_count,
  disclosure_status, disclosure_count,
  owns_current_firm, ownership_band, is_control_person, owner_title,
  city, state, postal_code, country_code, is_us_workplace,
  last_moved_on, last_detected_on, previous_firm_crd, move_count_5y,
  firm_aum, firm_aum_band,
  firm_discretionary_account_count, firm_non_discretionary_account_count, firm_account_count,
  firm_reported_client_count_min, firm_reported_client_count_max,
  firm_reported_client_count_quality,
  firm_employee_count, firm_advisor_count,
  firm_office_count, firm_aum_per_advisor, firm_aum_per_account, firm_aum_cagr_3y,
  firm_channel, firm_state, firm_domain, firm_linkedin_url,
  firm_is_sec_registered, firm_is_era,
  firm_client_type_codes, firm_service_codes, firm_custodian_ids, firm_fund_type_codes,
  has_personal_email, has_mobile_phone, has_linkedin, is_contactable, do_not_contact,
  search_tsv, refreshed_at
)
select
  advisor_crd, full_name, first_name, last_name, is_active,
  current_firm_crd, current_firm_name, current_firm_since,
  current_firm_source, current_firm_observed_on, current_firm_count,
  tenure_months, experience_months, tenure_years, experience_years,
  previous_firm_count, avg_previous_tenure_months, previous_firm_crds,
  exam_codes, designations, jurisdictions, jurisdiction_count,
  disclosure_status, disclosure_count,
  owns_current_firm, ownership_band, is_control_person, owner_title,
  city, state, postal_code, country_code, is_us_workplace,
  last_moved_on, last_detected_on, previous_firm_crd, move_count_5y,
  firm_aum, firm_aum_band,
  firm_discretionary_account_count, firm_non_discretionary_account_count, firm_account_count,
  firm_reported_client_count_min, firm_reported_client_count_max,
  firm_reported_client_count_quality,
  firm_employee_count, firm_advisor_count,
  firm_office_count, firm_aum_per_advisor, firm_aum_per_account, firm_aum_cagr_3y,
  firm_channel, firm_state, firm_domain, firm_linkedin_url,
  firm_is_sec_registered, firm_is_era,
  firm_client_type_codes, firm_service_codes, firm_custodian_ids, firm_fund_type_codes,
  has_personal_email, has_mobile_phone, has_linkedin, is_contactable, do_not_contact,
  search_tsv, refreshed_at
from _advisor_search;

commit;
