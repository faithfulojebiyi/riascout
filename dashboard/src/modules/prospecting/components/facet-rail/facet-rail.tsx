import { useMemo } from 'react';
import { Box, Flex } from '@riascout-ui/styled-system/jsx';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../../ui/primitives/accordion';
import { Aside } from '../../../../ui/primitives/layout';
import { Span } from '../../../../ui/primitives/text';
import type {
  FacetDefinition,
  FacetSelection,
  FacetValue,
} from '../../types/prospecting';
import { FacetInput } from '../facets/facet-input';
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
      borderColor="border.subtle"
      borderRightWidth="1px"
      h="full"
      overflowY="auto"
      px="3"
      py="2"
      w="30rem"
    >
      <FilterHeader activeCount={activeCount} onClear={onClear} />
      <Accordion collapsible type="single">
        {groups.map(([group, groupFacets]) => {
          const active = groupFacets.filter(
            (f) => selection[f.attributeId],
          ).length;

          return (
            <AccordionItem key={group} value={group}>
              <AccordionTrigger>
                <Flex align="center" gap="1">
                  <Span fontSize="sm" fontWeight="medium">
                    {group}
                  </Span>
                  {active > 0 ? (
                    <Span color="text.placeholder" fontSize="xs">
                      {active}
                    </Span>
                  ) : null}
                </Flex>
              </AccordionTrigger>
              <AccordionContent>
                {groupFacets.map((facet) => (
                  <Box key={facet.attributeId} mb="3">
                    <Span display="block" fontSize="sm" mb="1">
                      {facet.label}
                    </Span>
                    <FacetInput
                      facet={facet}
                      onChange={(value) => onChange(facet.attributeId, value)}
                      value={selection[facet.attributeId]}
                    />
                  </Box>
                ))}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Aside>
  );
};
