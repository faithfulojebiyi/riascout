'use client';

import type * as React from 'react';

import { HoverCard as HoverCardPrimitive } from 'radix-ui';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

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
    rounded: '2xl',
    zIndex: 50,
  },
});

const StyledHoverContent = styled(HoverCardPrimitive.Content, contentStyles);

export const HoverCardContent: React.FC<
  React.ComponentProps<typeof HoverCardPrimitive.Content> & JsxStyleProps
> = ({ align = 'center', sideOffset = 4, ...props }) => {
  return (
    <HoverCardPrimitive.Portal>
      <StyledHoverContent align={align} sideOffset={sideOffset} {...props} />
    </HoverCardPrimitive.Portal>
  );
};
