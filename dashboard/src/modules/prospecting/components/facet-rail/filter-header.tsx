import { Flex } from '@riascout-ui/styled-system/jsx';

import { Button } from '../../../../ui/primitives/button';
import { Heading, Span } from '../../../../ui/primitives/text';

export type FilterHeaderProps = {
  activeCount: number;
  onClear: () => void;
};

export const FilterHeader = ({ activeCount, onClear }: FilterHeaderProps) => (
  /**
   * Same 1px brand.panel.4 as the results header and the grid, and the padding
   * is inside the row so the rule reaches both edges of the rail.
   */
  <Flex
    align="center"
    borderBottomWidth="1px"
    borderColor="brand.panel.4"
    flexShrink="0"
    justify="space-between"
    minH="2.75rem"
    px="3"
  >
    <Heading as="h4" fontSize="2" fontWeight="500">
      Filters
    </Heading>
    {activeCount > 0 ? (
      <Button onClick={onClear} variant="outline">
        <Span>Clear {activeCount}</Span>
      </Button>
    ) : null}
  </Flex>
);
