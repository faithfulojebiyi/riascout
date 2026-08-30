import { VStack } from '@riascout-ui/styled-system/jsx';

import { Span, Text } from '../../../../ui/primitives/text';

export type EmptyStateProps = { hasFilters: boolean };

/**
 * Coverage is SEC-registered and ERA only — state-registered RIAs are absent
 * from the source — so an empty result must not read as "no such advisors".
 */
export const ProspectingEmptyState = ({ hasFilters }: EmptyStateProps) => (
  <VStack gap="2" px="6" py="16">
    <Text fontWeight="medium">
      {hasFilters ? 'No advisors match these filters' : 'Start with a filter'}
    </Text>
    <Span color="text.placeholder" fontSize="2" textAlign="center">
      {hasFilters
        ? 'Coverage is SEC-registered and exempt reporting advisers only, so state-registered firms will not appear.'
        : 'Pick a state, an exam or an AUM band from the rail to narrow 510,725 advisors.'}
    </Span>
  </VStack>
);
