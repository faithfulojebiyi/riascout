import { Flex } from '@riascout-ui/styled-system/jsx';

import { Button } from '../../../../ui/primitives/button';
import type { FacetInputProps } from './multi-select-facet';

/** three states, not two: any / yes / no. A switch cannot express "any". */
const OPTIONS: { label: string; next: boolean | null }[] = [
  { label: 'Any', next: null },
  { label: 'Yes', next: true },
  { label: 'No', next: false },
];

export const BooleanFacet = ({ value, onChange }: FacetInputProps) => {
  const current = value?.kind === 'boolean' ? value.value : null;

  return (
    <Flex gap="1">
      {OPTIONS.map((option) => (
        <Button
          key={option.label}
          onClick={() =>
            onChange(
              option.next === null
                ? undefined
                : { kind: 'boolean', value: option.next },
            )
          }

          variant={current === option.next ? 'solid' : 'outline'}
        >
          {option.label}
        </Button>
      ))}
    </Flex>
  );
};
