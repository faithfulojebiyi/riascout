'use client';

import type * as React from 'react';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const breadcrumbPageStyles = cva({
  base: {
    color: 'text.app',
    fontWeight: '400',
  },
});

const StyledSpan = styled('span', breadcrumbPageStyles);

export type BreadcrumbPageProps = React.ComponentProps<'span'> & JsxStyleProps;

export const BreadcrumbPage = ({ ...props }: BreadcrumbPageProps) => {
  return (
    <StyledSpan
      aria-current="page"
      aria-disabled="true"
      data-slot="breadcrumb-page"
      role="link"
      {...props}
    />
  );
};
