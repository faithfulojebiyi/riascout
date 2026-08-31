import { useMemo } from 'react';
import { Box, Flex } from '@riascout-ui/styled-system/jsx';

import { Accordion } from '../../../../ui/primitives/accordion';
import { Aside } from '../../../../ui/primitives/layout';
import { Span } from '../../../../ui/primitives/text';
import type { FacetSelection, FacetValue } from '../../types/prospecting';
import type { FacetDefinition } from '../../types/prospecting';
import { FacetRow } from './facet-row';
import { FilterHeader } from './filter-header';

export type FacetRailProps = {
  facets: FacetDefinition[];
  selection: FacetSelection;
  activeCount: number;
  onChange: (attributeId: string, value: FacetValue | undefined) => void;
  onClear: () => void;
};

export const FacetRail = ({
  facets,
  selection,
  activeCount,
  onChange,
  onClear,
}: FacetRailProps) => {
  /** grouped by attribute group, so the rail matches the grid's columns */
  const groups = useMemo(() => {
    const byGroup = new Map<string, FacetDefinition[]>();

    for (const facet of facets) {
      const list = byGroup.get(facet.group) ?? [];

      list.push(facet);
      byGroup.set(facet.group, list);
    }

    return [...byGroup.entries()];
  }, [facets]);

  return (
    <Aside
      borderColor="brand.panel.4"
      borderRightWidth="1px"
      display="flex"
      flexDirection="column"
      h="full"
      w="22rem"
    >
      {/* no padding on the aside — the header rule has to reach both edges */}
      <FilterHeader activeCount={activeCount} onClear={onClear} />

      <Box flex="1" minH="0" overflowY="auto">
        {groups.map(([group, groupFacets]) => (
          <Box key={group}>
            <Flex
              align="center"
              bg="background.app"
              justify="space-between"
              position="sticky"
              px="3"
              py="1.5"
              top="0"
              zIndex="1"
            >
              <Span
                color="text.placeholder"
                fontSize="0.688"
                fontWeight="600"
                letterSpacing="wide"
                textTransform="uppercase"
              >
                {group}
              </Span>
            </Flex>

            {/* single, so opening one facet closes the last — 52 rows otherwise scroll away */}
            <Accordion collapsible type="single">
              {groupFacets.map((facet) => (
                <FacetRow
                  facet={facet}
                  key={facet.attributeId}
                  onChange={(value) => onChange(facet.attributeId, value)}
                  value={selection[facet.attributeId]}
                />
              ))}
            </Accordion>
          </Box>
        ))}
      </Box>
    </Aside>
  );
};
