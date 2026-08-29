'use client';

import type * as React from 'react';

import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';

import { css, cx } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { ScrollBar } from './scroll-bar';

const StyledScollAreaRoot = styled(ScrollAreaPrimitive.Root);

export const ScrollArea = ({
  children,
  scrollbarClassname,
  padScrollbar = true,
  orientation,
  viewportClassname,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> &
  JsxStyleProps & {
    padScrollbar?: boolean;
    hideBar?: boolean;
    scrollbarClassname?: string;
    orientation?: 'vertical' | 'horizontal';
    viewportClassname?: string;
  }) => {
  return (
    <StyledScollAreaRoot pos="relative" {...props}>
      <ScrollAreaPrimitive.Viewport
        className={cx(
          css({
            '& > div': {
              display: 'block !important',
            },
            rounded: 'inherit',
            w: padScrollbar
              ? 'calc(100% - 1rem) !important'
              : '100% !important',
          }),
          viewportClassname,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar className={scrollbarClassname} orientation={orientation} />
      <ScrollAreaPrimitive.Corner />
    </StyledScollAreaRoot>
  );
};
