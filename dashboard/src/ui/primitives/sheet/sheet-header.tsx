'use client';

import type { FlexProps } from '@riascout-ui/styled-system/jsx';

import { Flex } from '../layout';

export const SheetHeader = (props: FlexProps) => {
  return (
    <Flex
      align="center"
      borderBottom="subtle"
      // glass="popup"
      justify="space-between"
      px="4"
      py="3"
      roundedTopLeft="inherit"
      roundedTopRight="inherit"
      {...props}
    />
  );
};
