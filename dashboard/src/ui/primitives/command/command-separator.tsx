'use client';

import type * as React from 'react';

import { Command as CommandPrimitive } from 'cmdk';

import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const StyledCommandSeparator = styled(CommandPrimitive.Separator);

export const CommandSeparator = ({
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator> & JsxStyleProps) => {
  return (
    <StyledCommandSeparator
      bg="background.muted"
      data-slot="command-separator"
      h="1px"
      my="1"
      w="full"
      {...props}
    />
  );
};
