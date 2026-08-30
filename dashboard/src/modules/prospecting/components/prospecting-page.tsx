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
import { FacetRail } from './facet-rail/facet-rail';
import { ProspectDetailSheet } from './results/prospect-detail-sheet';
import { ProspectResults } from './results/prospect-results';
import { ProspectingEmptyState } from './results/prospecting-empty-state';
import { TopBar, type ProspectTab } from './results/top-bar';

/**
 * Keyed by allowlist key, not label: a label is display text a user may rename,
 * and matching on it silently yields no columns.
 */
const TABLE_COLUMNS = [
  'advisor.full_name',
  'advisor.current_firm_name',
  'advisor.state',
  'advisor.tenure_years',
];

export const ProspectingPage = () => {
  const [selection, setSelection] = useState<FacetSelection>({});
  const [tab, setTab] = useState<ProspectTab>('search');
  const [openRow, setOpenRow] = useState<ProspectRow | null>(null);

  const facetsQuery = useFetchFacets('advisor');
  const facets = useMemo(
    () => facetsQuery.data?.facets ?? [],
    [facetsQuery.data],
  );

  const columns = useMemo(
    () =>
      TABLE_COLUMNS.flatMap((allowKey) => {
        const match = facets.find((facet) => facet.allowKey === allowKey);

        return match ? [match] : [];
      }),
    [facets],
  );

  const filter = useMemo(() => buildFilterTree(selection), [selection]);

  /**
   * Every facet column is selected, not just the four on screen, so opening a
   * record needs no second request. Fifty rows wide is cheap; a per-click fetch
   * would not be.
   */
  const search = useSearchProspects(
    {
      sourceKind: 'advisor',
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
          isFetching={search.isFetching}
          onTabChange={setTab}
          tab={tab}
          total={search.data?.total ?? null}
        />
        {rows.length === 0 && !search.isFetching ? (
          <ProspectingEmptyState hasFilters={hasFilters} />
        ) : (
          <ProspectResults
            columns={columns}
            onRowClick={setOpenRow}
            rows={rows}
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
