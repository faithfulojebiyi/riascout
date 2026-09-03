-- Firm candidates for a name a recruiter or the assistant typed. Ranks on the
-- 'simple' tsvector the projection already carries (name A, city B, state C),
-- so the query side must use the same config or nothing matches.
-- @param {String} $1:query
-- @param {String} $2:state   two-letter state, or '' for any
-- @param {Int} $3:limit
select firm_crd,
       firm_name,
       city,
       state,
       regulatory_aum,
       advisor_count
  from market.firm_search
 where search_tsv @@ websearch_to_tsquery('simple', $1)
   and ($2 = '' or state = $2)
 order by ts_rank(search_tsv, websearch_to_tsquery('simple', $1)) desc,
          advisor_count desc nulls last,
          firm_crd
 limit $3;
