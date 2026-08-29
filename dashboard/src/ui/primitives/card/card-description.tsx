'use client';

import type * as React from 'react';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const cardDescriptionStyles = cva({
  base: {
    color: 'text.muted',
    fontSize: '2',
  },
});

const StyledCardDescription = styled('div', cardDescriptionStyles);

export const CardDescription = ({
  ...props
}: React.ComponentProps<'div'> & JsxStyleProps) => {
  return <StyledCardDescription data-slot="card-description" {...props} />;
};
