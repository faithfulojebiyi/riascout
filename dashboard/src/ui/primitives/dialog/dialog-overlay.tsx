'use client';

import type * as React from 'react';

import { Dialog as DialogPrimitive } from 'radix-ui';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';

type Props = React.ComponentProps<typeof DialogPrimitive.Overlay>;

const overlayStyles = cva({
  base: {
    bg: 'background.popoverOverlay',
    glass: 'overlay',
    inset: '0',
    pos: 'fixed',
    zIndex: '100',
  },
});

const StyledOverlay = styled(DialogPrimitive.Overlay, overlayStyles);

export const DialogOverlay = function DialogOverlay({ ...props }: Props) {
  return <StyledOverlay data-slot="dialog-overlay" {...props} />;
};
