import { useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Flex, HStack, styled, VStack } from '@riascout-ui/styled-system/jsx';

import { useFetchFacets } from '../queries/use-fetch-facets';
import { useSearchProspects } from '../queries/use-search-prospects';
import {
  decodeAgentFilter,
  encodeAgentFilter,
} from '../stores/agent-filter-url';
import {
  toAgentFilter,
  toFacetSelection,
} from '../stores/agent-filter-to-selection';
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
 *
 * The label and width are carried here so the header renders at its final
 * geometry on first paint. Deriving columns from the facets response meant the
 * table rendered two headers, then six, and every column jumped sideways.
 */
/** width omitted means the column absorbs the slack, so nothing overflows */
type ColumnDef = { allowKey: string; label: string; width?: string };

const TABLE_COLUMNS: Record<SourceKind, ColumnDef[]> = {
  advisor: [
    { allowKey: 'advisor.full_name', label: 'Name' },
    { allowKey: 'advisor.current_firm_name', label: 'Current Firm' },
    { allowKey: 'advisor.state', label: 'State', width: '4.5rem' },
    { allowKey: 'advisor.tenure_years', label: 'Tenure', width: '5.5rem' },
  ],
  // the actual AUM, not the band: a band is a filter control, not a fact
  firm: [
    { allowKey: 'firm.firm_name', label: 'Firm Name', width: '15rem' },
    { allowKey: 'firm.firm_crd', label: 'CRD', width: '4.5rem' },
    { allowKey: 'firm.state', label: 'State', width: '4.5rem' },
    { allowKey: 'firm.regulatory_aum', label: 'AUM', width: '5rem' },
    { allowKey: 'firm.aum_per_advisor', label: 'AUM / Adviser', width: '6rem' },
    { allowKey: 'firm.advisor_count', label: 'Advisers', width: '6rem' },
  ],
};

export type SourceKind = 'advisor' | 'firm';

export type ProspectingPageProps = {
  sourceKind?: SourceKind;
  /** the assistant's filter from the url, applied once the facets are known */
  encodedFilter?: string;
};

/** the same page for both; only the source kind and default columns differ */
export const ProspectingPage = ({
  sourceKind = 'advisor',
  encodedFilter,
}: ProspectingPageProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [selection, setSelection] = useState<FacetSelection>({});
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const hydratedRef = useRef(false);
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

  /**
   * Always the full set, facets or not. The facet supplies the attributeId a
   * cell is keyed by and the workspace's own label once loaded; until then the
   * static definition holds the column open.
   */
  const columns = useMemo(
    () =>
      TABLE_COLUMNS[sourceKind].map((def) => {
        const facet = facets.find((f) => f.allowKey === def.allowKey);

        return {
          allowKey: def.allowKey,
          width: def.width ?? null,
          label: facet?.label ?? def.label,
          attributeId: facet?.attributeId ?? null,
          type: facet?.type ?? 'text',
          isArray: facet?.isArray ?? false,
          options: facet?.options ?? [],
        };
      }),
    [facets, sourceKind],
  );

  /**
   * Hydrate once, after the facets arrive: the token names fields, and only
   * a facet knows the attribute id and control behind a field. Conditions the
   * rail cannot show are surfaced, not applied, so the count is never quietly
   * different from what the assistant reported.
   */
  useEffect(() => {
    if (hydratedRef.current || facets.length === 0) return;

    hydratedRef.current = true;

    const parsed = encodedFilter ? decodeAgentFilter(encodedFilter) : null;

    if (!parsed) {
      if (encodedFilter)
        setUnmapped(['the filter in this link could not be read']);

      return;
    }

    const hydrated = toFacetSelection(parsed, facets);

    setSelection(hydrated.selection);
    setUnmapped(hydrated.unmapped);
  }, [encodedFilter, facets]);

  // keep the url shareable: the rail's state is always in `f`
  useEffect(() => {
    if (!hydratedRef.current) return;

    const agentFilter = toAgentFilter(selection, facets);
    const f = agentFilter ? encodeAgentFilter(agentFilter) : undefined;

    if (f === encodedFilter) return;

    void navigate({
      href: f ? `${pathname}?f=${f}` : pathname,
      replace: true,
    });
  }, [selection, facets, encodedFilter, navigate, pathname]);

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
  /**
   * Cold load only. Facets gate the search, so "not started yet" counts — but a
   * refetch keeps the rows on screen; swapping in the skeleton made the table
   * blink on every facet toggle. TopBar already shows isFetching.
   */
  const isLoading =
    (facetsQuery.isPending || search.isPending) && rows.length === 0;

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
        {unmapped.length > 0 ? (
          <HStack
            bg="brand.panel.3"
            borderBottomWidth="1px"
            borderColor="brand.panel.4"
            fontSize="1"
            gap="3"
            px="4"
            py="2"
          >
            <styled.span color="text.muted" flex="1" minW="0">
              Not applied here, so the count may differ from the assistant's:{' '}
              <styled.span color="text.app">{unmapped.join(' · ')}</styled.span>
            </styled.span>
            <styled.button
              color="text.muted"
              cursor="pointer"
              flexShrink="0"
              onClick={() => setUnmapped([])}
              textDecoration="underline"
              textUnderlineOffset="3px"
              type="button"
            >
              Dismiss
            </styled.button>
          </HStack>
        ) : null}
        {rows.length === 0 && !isLoading ? (
          <ProspectingEmptyState hasFilters={hasFilters} />
        ) : (
          <ProspectResults
            columns={columns}
            isLoading={isLoading}
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
