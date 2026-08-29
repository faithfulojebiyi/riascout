'use client';

import type * as React from 'react';

import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

export type BreadcrumbProps = React.ComponentProps<'nav'> & JsxStyleProps;

const StyledNav = styled('nav');

export const Breadcrumb = ({ ...props }: BreadcrumbProps) => {
  return (
    <StyledNav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />
  );
};
