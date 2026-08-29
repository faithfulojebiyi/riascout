'use client';

import type * as React from 'react';

import { Drawer as DrawerPrimitive } from 'vaul';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';

const overlayStyles = cva({
  base: {
    '&[data-state=closed]': {
      animation: 'fadeElementOut',
    },
    '&[data-state=open]': {
      animation: 'fadeElementIn',
    },
    bg: 'background.popoverOverlay',
    inset: '0',
    pos: 'fixed',
    zIndex: '100',
  },
});

const StyledOverlay = styled(DrawerPrimitive.Overlay, overlayStyles);

export const DrawerOverlay = (
  props: React.ComponentProps<typeof DrawerPrimitive.Overlay>,
) => {
  return <StyledOverlay data-slot="drawer-overlay" {...props} />;
};
