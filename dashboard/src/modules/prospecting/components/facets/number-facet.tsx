import { useState } from 'react';
import { Flex, VStack } from '@riascout-ui/styled-system/jsx';

import { Input } from '../../../../ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/primitives/select';
import type { FilterOperator } from '../../types/prospecting';
import type { FacetInputProps } from './multi-select-facet';

const COMPARATORS: { value: FilterOperator; label: string }[] = [
  { value: 'isGreaterThan', label: 'Over' },
  { value: 'isLessThan', label: 'Under' },
  { value: 'isBetween', label: 'Between' },
];

/** the select hands back a plain string; only a known comparator may be stored */
const asComparator = (raw: string): FilterOperator =>
  COMPARATORS.find((c) => c.value === raw)?.value ?? 'isGreaterThan';

/**
 * A comparator and a typed number, never a slider. A slider across $0–$100B
 * cannot express "over $1B", and a recruiter thinks in thresholds.
 */
export const NumberFacet = ({ value, onChange }: FacetInputProps) => {
  const [operator, setOperator] = useState(
    value?.kind === 'number' ? value.operator : 'isGreaterThan',
  );

  const current = value?.kind === 'number' ? value.value : null;
  const single = typeof current === 'number' ? String(current) : '';
  const range = Array.isArray(current) ? current : null;

  const commit = (raw: string, index?: number) => {
    const parsed = Number(raw.replace(/[^0-9.-]/g, ''));

    if (raw === '' || !Number.isFinite(parsed)) {
      if (index === undefined) onChange(undefined);

      return;
    }

    if (operator === 'isBetween') {
      const next: [number, number] = [range?.[0] ?? 0, range?.[1] ?? 0];

      next[index ?? 0] = parsed;
      onChange({ kind: 'number', operator, value: next });

      return;
    }

    onChange({ kind: 'number', operator, value: parsed });
  };

  return (
    <VStack alignItems="stretch" gap="2">
      <Select
        onValueChange={(next) => {
          setOperator(asComparator(next));
          onChange(undefined);
        }}
        value={operator}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMPARATORS.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {operator === 'isBetween' ? (
        <Flex gap="2">
          <Input
            defaultValue={range?.[0] ?? ''}
            inputMode="numeric"
            onBlur={(e) => commit(e.target.value, 0)}
            placeholder="Min"
          />
          <Input
            defaultValue={range?.[1] ?? ''}
            inputMode="numeric"
            onBlur={(e) => commit(e.target.value, 1)}
            placeholder="Max"
          />
        </Flex>
      ) : (
        <Input
          defaultValue={single}
          inputMode="numeric"
          onBlur={(e) => commit(e.target.value)}
          placeholder="Amount"
        />
      )}
    </VStack>
  );
};
