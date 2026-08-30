import type { ReactNode } from 'react';
import { VStack } from '@riascout-ui/styled-system/jsx';

import { Heading, Span, Text } from '../../../ui/primitives/text';

export type StepHeaderProps = {
  step: number;
  total: number;
  title: string;
  description?: ReactNode;
};

export const StepHeader = ({
  step,
  total,
  title,
  description,
}: StepHeaderProps) => (
  <VStack alignItems="stretch" gap="2">
    <Span color="text.placeholder" fontSize="2">
      {step}/{total}
    </Span>
    <Heading as="h2" fontSize="7" fontWeight="600" letterSpacing="tight">
      {title}
    </Heading>
    {description ? <Text color="text.muted">{description}</Text> : null}
  </VStack>
);
