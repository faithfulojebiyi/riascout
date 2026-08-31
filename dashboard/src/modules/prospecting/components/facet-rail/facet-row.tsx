import { Flex } from '@riascout-ui/styled-system/jsx';

import {
  AccordionCaret,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../../ui/primitives/accordion';
import { Icons } from '../../../../ui/icons/base';
import { Button } from '../../../../ui/primitives/button';
import { Span } from '../../../../ui/primitives/text';
import { attributeIcon } from '../../../entities/components/grid/attribute-icon';
import type { FacetDefinition, FacetValue } from '../../types/prospecting';
import { FacetInput } from '../facets/facet-input';
import { facetSummary } from './facet-summary';

export type FacetRowProps = {
  facet: FacetDefinition;
  value: FacetValue | undefined;
  onChange: (value: FacetValue | undefined) => void;
};

/**
 * One row per facet, not per group. Nine group headers hiding 52 facets put
 * every filter two clicks deep; the group is a heading now and the facet is
 * the row.
 */
export const FacetRow = ({ facet, value, onChange }: FacetRowProps) => {
  const Icon = attributeIcon(facet.icon, facet.kind);
  const summary = facetSummary(facet, value);

  return (
    <AccordionItem value={facet.attributeId}>
      <AccordionTrigger
        _hover={{ bg: 'background.muted' }}
        alignItems="center"
        borderBottomWidth="1px"
        borderColor="brand.panel.4"
        css={{ '&[data-state=open]': { borderBottomWidth: '0' } }}
        display="flex"
        /** 2.5rem is TableHead's h:10, so a rail row and a results row rule at the same pitch */
        h="2.5rem"
        justifyContent="space-between"
        px="3"
        py="0"
      >
        <Flex align="center" gap="2" minW="0">
          <Span color="text.muted" flexShrink="0">
            <Icon />
          </Span>
          <Span fontSize="2" whiteSpace="nowrap">
            {facet.label}
          </Span>
        </Flex>

        <Flex align="center" gap="1" minW="0">
          {summary ? (
            <>
              <Span
                color="brand.primary.11"
                fontSize="1"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {summary}
              </Span>
              {/* clearing from the row saves opening a facet to empty it */}
              <Button
                asChild
                aria-label={`Clear ${facet.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(undefined);
                }}
                size="icon"
                variant="ghost"
              >
                <span>
                  <Icons.close size={12} />
                </span>
              </Button>
            </>
          ) : null}
          <AccordionCaret />
        </Flex>
      </AccordionTrigger>

      <AccordionContent
        borderBottomWidth="1px"
        borderColor="brand.panel.4"
        px="3"
        py="2.5"
      >
        <FacetInput facet={facet} onChange={onChange} value={value} />
      </AccordionContent>
    </AccordionItem>
  );
};
