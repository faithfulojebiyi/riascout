'use client';

import type * as React from 'react';

import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const separatorStyles = cva({
  base: { bg: 'background.muted', h: '1px', mx: '-1', my: '4px' },
});

const StyledSeparator = styled(
  DropdownMenuPrimitive.Separator,
  separatorStyles,
);

export const DropdownMenuSeparator = (
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Separator> &
    JsxStyleProps,
) => {
  return <StyledSeparator data-slot="dropdown-menu-separator" {...props} />;
};
