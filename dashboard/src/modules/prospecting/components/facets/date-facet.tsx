import { Flex, VStack } from '@riascout-ui/styled-system/jsx';

import { Button } from '../../../../ui/primitives/button';
import { Input } from '../../../../ui/primitives/input';
import type { FacetInputProps } from './multi-select-facet';

/** the windows a recruiter actually asks for, before any date picker */
const WINDOWS = [30, 90, 180, 365];

export const DateFacet = ({ value, onChange }: FacetInputProps) => {
  const days =
    value?.kind === 'date' && value.operator === 'isWithinLastNDays'
      ? Number(value.value)
      : null;

  return (
    <VStack alignItems="stretch" gap="2">
      <Flex flexWrap="wrap" gap="1">
        {WINDOWS.map((window) => (
          <Button
            key={window}
            onClick={() =>
              onChange(
                days === window
                  ? undefined
                  : {
                      kind: 'date',
                      operator: 'isWithinLastNDays',
                      value: window,
                    },
              )
            }
            size="sm"
            variant={days === window ? 'solid' : 'outline'}
          >
            {window}d
          </Button>
        ))}
      </Flex>
      <Input
        onBlur={(e) =>
          onChange(
            e.target.value === ''
              ? undefined
              : { kind: 'date', operator: 'isAfter', value: e.target.value },
          )
        }
        type="date"
      />
    </VStack>
  );
};
