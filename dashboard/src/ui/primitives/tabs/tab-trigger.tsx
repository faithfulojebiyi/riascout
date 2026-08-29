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
});

const StyledTabTrigger = styled(TabsPrimitive.Trigger, tabTriggerStyles);

export const TabTrigger = (
  props: React.ComponentProps<typeof TabsPrimitive.Trigger> & JsxStyleProps,
) => {
  return <StyledTabTrigger {...props} />;
};
