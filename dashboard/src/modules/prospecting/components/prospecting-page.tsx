import { useMemo, useState } from 'react';
import { Flex, VStack } from '@riascout-ui/styled-system/jsx';

import { Span } from '../../../ui/primitives/text';
import { useFetchFacets } from '../queries/use-fetch-facets';
import { useSearchProspects } from '../queries/use-search-prospects';
import { buildFilterTree } from '../stores/build-filter-tree';
import type { FacetSelection, FacetValue } from '../types/prospecting';
import { FacetRail } from './facet-rail/facet-rail';
import { ProspectResults } from './results/prospect-results';

/**
 * Keyed by allowlist key, not label: a label is display text a user may rename,
 * and matching on it silently yields no columns.
 */
const DEFAULT_COLUMNS = [
  'advisor.full_name',
  'advisor.current_firm_name',
  'advisor.state',
  'advisor.tenure_years',
];

export const ProspectingPage = () => {
  const [selection, setSelection] = useState<FacetSelection>({});
  const facetsQuery = useFetchFacets('advisor');
  const facets = useMemo(
    () => facetsQuery.data?.facets ?? [],
    [facetsQuery.data],
  );

  const columns = useMemo(
    () =>
      DEFAULT_COLUMNS.flatMap((allowKey) => {
        const match = facets.find((facet) => facet.allowKey === allowKey);

        return match ? [match] : [];
      }),
    [facets],
  );

  const filter = useMemo(() => buildFilterTree(selection), [selection]);

  const search = useSearchProspects(
    {
      sourceKind: 'advisor',
      filter,
      sort: [],
      selectAttributeIds: columns.map((column) => column.attributeId),
      limit: 50,
      offset: 0,
    },
    columns.length > 0,
  );

  const onChange = (attributeId: string, value: FacetValue | undefined) =>
    setSelection((current) => {
      const next = { ...current };

      if (value) next[attributeId] = value;
      else delete next[attributeId];

      return next;
    });

  return (
    <Flex h="full" w="full">
      <FacetRail facets={facets} onChange={onChange} selection={selection} />
      <VStack alignItems="stretch" flex="1" gap="0" minW="0">
        <Flex
          align="center"
          borderBottomWidth="1px"
          borderColor="border.subtle"
          gap="3"
          px="4"
          py="2"
        >
          <Span fontSize="sm" fontWeight="medium">
            {search.data
              ? `${search.data.total.toLocaleString()} advisors`
              : '—'}
          </Span>
          {search.isFetching ? (
            <Span color="text.placeholder" fontSize="sm">
              Updating…
            </Span>
          ) : null}
        </Flex>
        <ProspectResults columns={columns} rows={search.data?.rows ?? []} />
      </VStack>
    </Flex>
  );
};
