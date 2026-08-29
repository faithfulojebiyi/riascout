'use client';

import type * as React from 'react';

import { Slot } from 'radix-ui';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const breadcrumbLinkStyles = cva({
  base: {
    _hover: {
      color: 'text.app',
    },
    transitionDuration: '150ms',
    transitionProperty: 'color',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
});

const StyledAnchor = styled('a', breadcrumbLinkStyles);

export type BreadcrumbLinkProps = React.ComponentProps<'a'> &
  JsxStyleProps & {
    asChild?: boolean;
  };

export const BreadcrumbLink = ({ asChild, ...props }: BreadcrumbLinkProps) => {
  const Comp = asChild ? Slot.Root : StyledAnchor;

  return <Comp data-slot="breadcrumb-link" {...props} />;
};
