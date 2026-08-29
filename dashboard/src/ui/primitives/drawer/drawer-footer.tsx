'use client';

import { Flex, type FlexProps } from '@riascout-ui/styled-system/jsx';

export const DrawerFooter = ({ ...props }: FlexProps) => {
  return <Flex direction="column" gap="2" mt="auto" px="4" py="4" {...props} />;
};
