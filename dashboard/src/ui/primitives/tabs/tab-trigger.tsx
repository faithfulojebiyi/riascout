'use client';

import type * as React from 'react';

import { Tabs as TabsPrimitive } from 'radix-ui';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const tabTriggerStyles = cva({
  base: {
    _disabled: {
      opacity: '0.5',
      pointerEvents: 'none',
    },
    _focusVisible: {
      outline: 'none',
      ring: '2',
      ringColor: 'ring',
      ringOffset: '2',
    },
    '&[data-state=active]': {
      bg: 'background.app',
      color: 'text.app',
      shadow: 'sm',
    },
    alignItems: 'center',
    cursor: 'pointer',
    display: 'inline-flex',
    fontSize: 'sm',
    fontWeight: 'medium',
    justifyContent: 'center',
    px: '3',
    py: '0.5',
    ringOffset: 'background.app',
    rounded: 'sm',
    transition: 'all',
    w: '100%',
    whiteSpace: 'nowrap',
  },
  variants: {
    variant: {
      pill: {},
      /**
       * The record page's tab strip. Overrides the pill's active treatment
       * rather than extending it: a filled chip and an underline read as two
       * different selections when both are showing.
       */
      underline: {
        '&[data-state=active]': {
          bg: 'transparent',
          borderColor: 'brand.solid',
          color: 'text.app',
          shadow: 'none',
        },
        borderBottomWidth: '2px',
        // transparent rather than absent, so selecting a tab shifts nothing
        borderColor: 'transparent',
        color: 'text.muted',
        px: '0',
        py: '2',
        rounded: 'none',
        w: 'auto',
      },
    },
  },
  defaultVariants: { variant: 'pill' },
});

const StyledTabTrigger = styled(TabsPrimitive.Trigger, tabTriggerStyles);

export const TabTrigger = (
  props: React.ComponentProps<typeof TabsPrimitive.Trigger> &
    JsxStyleProps & { variant?: 'pill' | 'underline' },
) => {
  return <StyledTabTrigger {...props} />;
};
