'use client';

import type React from 'react';

import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';

const separatorStyles = cva({
  base: { bg: 'background.muted', h: '1px', my: '4px' },
});

const StyledSeparator = styled(ContextMenuPrimitive.Separator, separatorStyles);

export const ContextMenuSeparator = ({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) => {
  return <StyledSeparator data-slot="context-menu-separator" {...props} />;
};
