import { useMemo } from 'react';
import { Box, Flex } from '@riascout-ui/styled-system/jsx';

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../../../ui/primitives/sheet';
import { Span } from '../../../../ui/primitives/text';
import { rendererFor } from '../../../entities/components/attribute-renderers';
import type { FacetDefinition, ProspectRow } from '../../types/prospecting';

export type ProspectDetailSheetProps = {
  row: ProspectRow | null;
  facets: FacetDefinition[];
  onOpenChange: (open: boolean) => void;
};

/**
 * A sheet rather than a dialog: a record is read alongside the results, not
 * instead of them, and the rail stays visible so a filter can be adjusted
 * without losing the record.
 */
export const ProspectDetailSheet = ({
  row,
  facets,
  onOpenChange,
}: ProspectDetailSheetProps) => {
  const groups = useMemo(() => {
    if (!row) return [];

    const byId = new Map(row.values.map((v) => [v.attributeId, v.value]));
    const byGroup = new Map<
      string,
      { facet: FacetDefinition; value: unknown }[]
    >();

    for (const facet of facets) {
      if (!byId.has(facet.attributeId)) continue;

      const list = byGroup.get(facet.group) ?? [];

      list.push({ facet, value: byId.get(facet.attributeId) });
      byGroup.set(facet.group, list);
    }

    return [...byGroup.entries()];
  }, [row, facets]);

  const title = row
    ? String(
        row.values.find((v) => v.value && typeof v.value === 'string')?.value ??
          row.sourceCrd,
      )
    : '';

  return (
    <Sheet onOpenChange={onOpenChange} open={row !== null}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <SheetBody flex="1" maxH="100%">
          {groups.map(([group, entries]) => (
            <Box key={group} mb="4">
              <Span
                color="text.muted"
                display="block"
                fontSize="xs"
                fontWeight="medium"
                mb="1"
                textTransform="uppercase"
              >
                {group}
              </Span>
              {entries.map(({ facet, value }) => {
                const Renderer = rendererFor(
                  facet.kind === 'number' ? 'number' : 'text',
                );

                return (
                  <Flex
                    gap="2"
                    justify="space-between"
                    key={facet.attributeId}
                    py="1"
                  >
                    <Span color="text.muted" fontSize="sm">
                      {facet.label}
                    </Span>
                    <Span fontSize="sm">
                      <Renderer value={value} />
                    </Span>
                  </Flex>
                );
              })}
            </Box>
          ))}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
};
