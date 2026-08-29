'use client';

import type * as React from 'react';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const cardTitleStyles = cva({
  base: {
    '[data-size=sm] &': { fontSize: '2' },
    fontSize: '3',
    fontWeight: 'medium',
    lineHeight: 'snug',
  },
});

const StyledCardTitle = styled('div', cardTitleStyles);

export const CardTitle = ({
  ...props
}: React.ComponentProps<'div'> & JsxStyleProps) => {
  return <StyledCardTitle data-slot="card-title" {...props} />;
};
