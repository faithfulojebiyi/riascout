-- Resolves the custodian dimension from the names already on the fact rows.
--
-- 3.4M fact rows carry a source_name and a null custodian_id because nothing
-- ever populated dim_custodian, so every custodian facet and filter matched
-- nothing at all while looking like it worked.
--
-- Normalisation is deterministic and conservative: periods dropped so "U.S."
-- and "US" agree, runs of single letters fused so "N A" becomes "NA", trailing
-- legal forms stripped. 8,451 raw spellings collapse to 5,679 custodians, and
-- BNY Mellon stays distinct from BNY Mellon Trust.
--
-- The raw name is never discarded: it stays on the fact row and in
-- dim_custodian_alias, so a wrong merge is visible and reversible.

begin;

create temp table _custodian_key on commit drop as
with named as (
  select source_name, count(*) as row_count
    from market.firm_fact_custodian
   where source_name <> '(unnamed)'
   group by source_name
),
stripped as (
  select source_name, row_count,
         regexp_replace(upper(source_name), '[.]', '', 'g') as s
    from named
),
spaced as (
  select source_name, row_count,
         trim(regexp_replace(
           regexp_replace(regexp_replace(s, '[^A-Z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'),
           '^THE ', '')) as s
    from stripped
),
/**
 * Applied three times rather than in a loop: the longest acronym in the data is
 * four letters, and a recursive CTE for this would be far less readable.
 */
fused as (
  select source_name, row_count,
         regexp_replace(
           regexp_replace(
             regexp_replace(s, '\y([A-Z]) ([A-Z])\y', '\1\2', 'g'),
             '\y([A-Z]) ([A-Z])\y', '\1\2', 'g'),
           '\y([A-Z]) ([A-Z])\y', '\1\2', 'g') as s
    from spaced
)
select source_name, row_count,
       trim(regexp_replace(s,
         '( (LLC|LLP|LP|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED'
         || '|PLC|NA|NATIONAL ASSOCIATION|SA|NV|AG|GMBH|AB|BV|USA))+$', '', 'g')) as norm_key
  from fused;

-- an all-punctuation name would strip to nothing and swallow every other one
delete from _custodian_key where norm_key = '';

-- the most-reported spelling represents the group: a real name, not the key
create temp table _custodian_canonical on commit drop as
select distinct on (norm_key)
       norm_key, source_name as canonical_name
  from _custodian_key
 order by norm_key, row_count desc, source_name;

-- ids must stay stable: firm_search.custodian_ids and facet_option hold them
insert into market.dim_custodian (canonical_name)
select canonical_name from _custodian_canonical
on conflict (canonical_name) do nothing;

delete from market.dim_custodian_alias;

insert into market.dim_custodian_alias (source_name, custodian_id, confidence, method)
select k.source_name, d.id, 100, 'normalized'
  from _custodian_key k
  join _custodian_canonical c on c.norm_key = k.norm_key
  join market.dim_custodian d on d.canonical_name = c.canonical_name;

update market.firm_fact_custodian f
   set custodian_id = a.custodian_id
  from market.dim_custodian_alias a
 where a.source_name = f.source_name
   and f.custodian_id is distinct from a.custodian_id;

commit;
