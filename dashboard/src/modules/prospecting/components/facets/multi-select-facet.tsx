import { Box, Flex } from '@riascout-ui/styled-system/jsx';

import { Checkbox } from '../../../../ui/primitives/checkbox/checkbox';
import { Span } from '../../../../ui/primitives/text';
import type { FacetDefinition, FacetValue } from '../../types/prospecting';

export type FacetInputProps = {
  facet: FacetDefinition;
  value: FacetValue | undefined;
  onChange: (value: FacetValue | undefined) => void;
};

export const MultiSelectFacet = ({
  facet,
  value,
  onChange,
}: FacetInputProps) => {
  const selected = value?.kind === 'multiSelect' ? value.values : [];

  const toggle = (option: string) => {
    const next = selected.includes(option)
      ? selected.filter((v) => v !== option)
      : [...selected, option];

    // clearing the last option removes the facet rather than filtering on none
    onChange(
      next.length > 0
        ? { kind: 'multiSelect', operator: 'isAnyOf', values: next }
        : undefined,
    );
  };

  return (
    <Box maxH="56" overflowY="auto">
      {facet.options.map((option) => (
        <label key={option.value}>
          <Flex
            _hover={{ bg: 'background.muted' }}
            align="center"
            cursor="pointer"
            gap="2"
            py="1"
          >
            <Checkbox
              checked={selected.includes(option.value)}
              onCheckedChange={() => toggle(option.value)}
            />
            <Span fontSize="2">{option.label}</Span>
          </Flex>
        </label>
      ))}
    </Box>
  );
};
