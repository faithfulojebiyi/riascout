'use client';

import type * as React from 'react';

import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

type Props = React.ComponentProps<typeof DropdownMenuPrimitive.SubContent> & {
  inset?: boolean;
} & JsxStyleProps;

const contentStyles = cva({
  base: {
    _light: {
      bg: 'white',
      glass: 'none',
    },
    '&[data-state=closed]': {
      animation: 'popoverHide',
    },

    '&[data-state=open]': {
      animation: 'popoverUpIn',
    },
    bg: 'background.popover',
    border: 'subtle',
    glass: 'popup',
    minW: '8rem',
    mt: '-0.5rem',
    mx: '1rem',
    my: '0',
    overflow: 'hidden',
    p: '1',
    rounded: 'xl',
  },
});

const StyledSubContent = styled(
  DropdownMenuPrimitive.SubContent,
  contentStyles,
);

export const DropdownMenuSubContent = (props: Props) => {
  return <StyledSubContent data-slot="dropdown-menu-sub-content" {...props} />;
};
