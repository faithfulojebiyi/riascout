'use client';

import type * as React from 'react';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const cardHeaderStyles = cva({
  base: {
    '[data-size=sm] &': { px: '3' },
    '&:has([data-slot=card-action])': { gridTemplateColumns: '1fr auto' },
    '&:has([data-slot=card-description])': { gridTemplateRows: 'auto auto' },
    alignItems: 'start',
    display: 'grid',
    gap: '1',
    gridAutoRows: 'min-content',
    px: '4',
    roundedTop: '2xl',
  },
});

const StyledCardHeader = styled('div', cardHeaderStyles);

export const CardHeader = ({
  ...props
}: React.ComponentProps<'div'> & JsxStyleProps) => {
  return <StyledCardHeader data-slot="card-header" {...props} />;
};
