'use client';

import type React from 'react';

import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const contentStyles = cva({
  base: {
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
    rounded: '2xl',
    zIndex: '100',
  },
});

const StyledSubContent = styled(ContextMenuPrimitive.SubContent, contentStyles);

type Props = React.ComponentProps<typeof ContextMenuPrimitive.SubContent> & {
  inset?: boolean;
} & JsxStyleProps;

export const ContextMenuSubContent = ({ ...props }: Props) => {
  return (
    <ContextMenuPrimitive.Portal>
      <StyledSubContent data-slot="context-menu-sub-content" {...props} />
    </ContextMenuPrimitive.Portal>
  );
};
