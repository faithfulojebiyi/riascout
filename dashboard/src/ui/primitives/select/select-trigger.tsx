'use client';

import type * as React from 'react';

import { Select as SelectPrimitive } from 'radix-ui';

import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { Icons } from '../../icons/base';

const triggerStyles = cva({
  base: {
    _active: {
      border: 'focused',
    },

    _disabled: {
      cursor: 'not-allowed',
      opacity: '0.5',
      pointerEvents: 'none',
    },

    _focus: {
      border: 'focused',
      outline: 'none',
    },

    '&[data-placeholder]': {
      color: 'text.placeholder',
    },
    alignItems: 'center',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    w: 'full',
    whiteSpace: 'nowrap',
  },
  compoundVariants: [
    {
      css: {
        shadow: 'xs',
      },
      feel: 'button',
      look: 'subtle',
    },
  ],
  defaultVariants: {
    look: 'form',
    size: 'xs',
  },
  variants: {
    feel: {
      button: {},
      input: {},
    },
    look: {
      editable: {
        _focus: {
          border: 'focused',
        },

        _hover: {
          bg: 'background.muted',
        },
        border: 'none',
      },
      form: {
        _focus: {
          border: 'focused',
        },
        border: 'subtle',
      },
      ghost: {
        border: 'none',
        h: 'auto',
      },
      subtle: {
        _focus: {
          border: 'focused',
        },
        border: 'subtle',
      },
      transparent: {
        _focus: {
          border: 'focused',
        },

        _hover: {
          bg: 'background.muted',
        },
        border: 'none',
      },
    },
    size: {
      auto: {},
      lg: {
        fontSize: '2',
        h: '2.5rem',
        px: '4',
        rounded: 'xl',
      },
      md: {
        fontSize: '2',
        h: '2.25rem',
        px: '4',
        rounded: 'lg',
      },
      sm: {
        fontSize: '2',
        h: '2rem',
        px: '3',
        rounded: 'lg',
      },
      xs: {
        fontSize: 1,
        h: '1.75rem',
        px: '1.5',
        rounded: 'lg',
      },
    },
  },
});

type TriggerVariants = RecipeVariantProps<typeof triggerStyles>;

export type STriggerProps = React.ComponentProps<
  typeof SelectPrimitive.Trigger
> &
  JsxStyleProps &
  TriggerVariants & {
    hideCaret?: boolean;
  };

const StyledTrigger = styled(SelectPrimitive.Trigger, triggerStyles);

export const SelectTrigger = ({
  children,
  hideCaret,
  ...props
}: STriggerProps) => {
  return (
    <StyledTrigger {...props}>
      {children}

      {!hideCaret && (
        <SelectPrimitive.Icon asChild>
          <Icons.caretDown color="text.muted" ml="1" size={12} />
        </SelectPrimitive.Icon>
      )}
    </StyledTrigger>
  );
};
