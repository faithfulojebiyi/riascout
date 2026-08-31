import { useMemo, useState } from 'react';
import { Flex, VStack } from '@riascout-ui/styled-system/jsx';

import { useFetchFacets } from '../queries/use-fetch-facets';
import { useSearchProspects } from '../queries/use-search-prospects';
import { buildFilterTree } from '../stores/build-filter-tree';
import type {
  FacetSelection,
  FacetValue,
  ProspectRow,
} from '../types/prospecting';
import { useFetchEntities } from '../../entities/queries/use-fetch-entities';
import { SaveToList } from '../../lists/components/save-to-list';
import { FacetRail } from './facet-rail/facet-rail';
import { ProspectDetailSheet } from './results/prospect-detail-sheet';
import { ProspectResults } from './results/prospect-results';
import { ProspectingEmptyState } from './results/prospecting-empty-state';
import { TopBar } from './results/top-bar';

/**
 * Keyed by allowlist key, not label: a label is display text a user may rename,
 * and matching on it silently yields no columns.
 */
const TABLE_COLUMNS: Record<SourceKind, string[]> = {
  advisor: [
    'advisor.full_name',
    'advisor.current_firm_name',
    'advisor.state',
    'advisor.tenure_years',
  ],
  firm: ['firm.firm_name', 'firm.state', 'firm.aum_band', 'firm.advisor_count'],
};

export type SourceKind = 'advisor' | 'firm';

export type ProspectingPageProps = { sourceKind?: SourceKind };

/** the same page for both; only the source kind and default columns differ */
export const ProspectingPage = ({
  sourceKind = 'advisor',
}: ProspectingPageProps) => {
  const [selection, setSelection] = useState<FacetSelection>({});
  const [openRow, setOpenRow] = useState<ProspectRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const facetsQuery = useFetchFacets(sourceKind);
  const entitiesQuery = useFetchEntities();

  /** the list a save lands in belongs to the advisor entity, not the facets */
  const entityId =
    entitiesQuery.data?.entities.find((e) => e.sourceKind === sourceKind)?.id ??
    null;
  const facets = useMemo(
    () => facetsQuery.data?.facets ?? [],
    [facetsQuery.data],
  );

  const columns = useMemo(
    () =>
      TABLE_COLUMNS[sourceKind].flatMap((allowKey) => {
        const match = facets.find((facet) => facet.allowKey === allowKey);

        return match ? [match] : [];
      }),
    [facets, sourceKind],
  );

  const filter = useMemo(() => buildFilterTree(selection), [selection]);

  /**
   * Every facet column is selected, not just the four on screen, so opening a
   * record needs no second request. Fifty rows wide is cheap; a per-click fetch
   * would not be.
   */
  const search = useSearchProspects(
    {
      sourceKind,
      filter,
      sort: [],
      selectAttributeIds: facets.map((facet) => facet.attributeId),
      limit: 50,
      offset: 0,
    },
    facets.length > 0,
  );

  const onChange = (attributeId: string, value: FacetValue | undefined) =>
    setSelection((current) => {
      const next = { ...current };

      if (value) next[attributeId] = value;
      else delete next[attributeId];

      return next;
    });

  const rows = search.data?.rows ?? [];

  const toggle = (sourceCrd: string) =>
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(sourceCrd)) next.delete(sourceCrd);
      else next.add(sourceCrd);

      return next;
    });

  // all means all loaded, not all matching — the page is what was fetched
  const toggleAll = () =>
    setSelected((current) =>
      current.size === rows.length
        ? new Set()
        : new Set(rows.map((row) => row.sourceCrd)),
    );
  const hasFilters = Object.keys(selection).length > 0;

  return (
    <Flex h="full" w="full">
      <FacetRail
        activeCount={Object.keys(selection).length}
        facets={facets}
        onChange={onChange}
        onClear={() => setSelection({})}
        selection={selection}
      />
      <VStack alignItems="stretch" flex="1" gap="0" minW="0">
        <TopBar
          actions={
            <SaveToList entityId={entityId} sourceCrds={[...selected]} />
          }
          isFetching={search.isFetching}
          noun={sourceKind === 'firm' ? 'firms' : 'advisors'}
          title={sourceKind === 'firm' ? 'Firms' : 'Advisors'}
          total={search.data?.total ?? null}
        />
        {rows.length === 0 && !search.isFetching ? (
          <ProspectingEmptyState hasFilters={hasFilters} />
        ) : (
          <ProspectResults
            columns={columns}
            onRowClick={setOpenRow}
            onToggle={toggle}
            onToggleAll={toggleAll}
            rows={rows}
            selected={selected}
          />
        )}
      </VStack>
      <ProspectDetailSheet
        facets={facets}
        onOpenChange={(open) => !open && setOpenRow(null)}
        row={openRow}
      />
    </Flex>
  );
};
