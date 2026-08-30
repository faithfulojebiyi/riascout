import { useState } from 'react';
import { Box, Flex } from '@riascout-ui/styled-system/jsx';

import { Checkbox } from '../../../../ui/primitives/checkbox/checkbox';
import { Input } from '../../../../ui/primitives/input';
import { Span } from '../../../../ui/primitives/text';
import { useSearchFacetOptions } from '../../queries/use-search-facet-options';
import type { FacetInputProps } from './multi-select-facet';

/**
 * For columns with too many values to enumerate — 455,296 advisor names, 12,252
 * firms. Selected values stay pinned above the results so a choice does not
 * vanish when the query changes.
 */
export const SearchFacet = ({ facet, value, onChange }: FacetInputProps) => {
  const [query, setQuery] = useState('');
  const selected = value?.kind === 'multiSelect' ? value.values : [];

  const optionsQuery = useSearchFacetOptions(
    facet.allowKey,
    query,
    query.length > 0,
  );

  const results = (optionsQuery.data?.options ?? []).filter(
    (option) => !selected.includes(option.value),
  );

  const toggle = (option: string) => {
    const next = selected.includes(option)
      ? selected.filter((v) => v !== option)
      : [...selected, option];

    onChange(
      next.length > 0
        ? { kind: 'multiSelect', operator: 'isAnyOf', values: next }
        : undefined,
    );
  };

  const row = (label: string, optionValue: string) => (
    <label key={optionValue}>
      <Flex
        _hover={{ bg: 'background.muted' }}
        align="center"
        cursor="pointer"
        gap="2"
        py="1"
      >
        <Checkbox
          checked={selected.includes(optionValue)}
          onCheckedChange={() => toggle(optionValue)}
        />
        <Span fontSize="2">{label}</Span>
      </Flex>
    </label>
  );

  return (
    <Box>
      <Input
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${facet.label.toLowerCase()}`}
        value={query}
      />

      {selected.map((option) => row(option, option))}

      <Box maxH="48" overflowY="auto">
        {results.map((option) => row(option.label, option.value))}
        {query.length > 0 &&
        results.length === 0 &&
        !optionsQuery.isFetching ? (
          <Span color="text.placeholder" fontSize="2">
            No matches
          </Span>
        ) : null}
      </Box>
    </Box>
  );
};
