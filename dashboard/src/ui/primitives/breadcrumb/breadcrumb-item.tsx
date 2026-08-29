'use client';

import type * as React from 'react';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const breadcrumbItemStyles = cva({
  base: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: '1.5',
  },
});

const StyledLi = styled('li', breadcrumbItemStyles);

export type BreadcrumbItemProps = React.ComponentProps<'li'> & JsxStyleProps;

export const BreadcrumbItem = ({ ...props }: BreadcrumbItemProps) => {
  return <StyledLi data-slot="breadcrumb-item" {...props} />;
};
