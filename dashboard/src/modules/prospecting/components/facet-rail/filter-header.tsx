import { Flex } from '@riascout-ui/styled-system/jsx';

import { Button } from '../../../../ui/primitives/button';
import { Heading, Span } from '../../../../ui/primitives/text';

export type FilterHeaderProps = {
  activeCount: number;
  onClear: () => void;
};

export const FilterHeader = ({ activeCount, onClear }: FilterHeaderProps) => (
  <Flex
    align="center"
    borderBottomWidth="1px"
    borderColor="border.subtle"
    justify="space-between"
    px="2"
    py="3"
  >
    <Heading as="h4" fontWeight="500">
      Filters
    </Heading>
    {activeCount > 0 ? (
      <Button onClick={onClear} size="xs" variant="outline">
        <Span>Clear {activeCount}</Span>
      </Button>
    ) : null}
  </Flex>
);
