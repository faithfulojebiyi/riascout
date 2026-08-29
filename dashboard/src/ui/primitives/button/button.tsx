'use client';

import type * as React from 'react';

import { Slot } from 'radix-ui';

import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { Icons } from '../../icons/base';
import { KeyboardShortcut } from '../keyboard-shortcut';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
import type { TooltipContentProps } from '../tooltip/tooltip-content';
import { Span } from '../typography';

export const buttonStyle = cva({
  base: {
    _disabled: {
      cursor: 'not-allowed',
      opacity: '0.8',
      pointerEvents: 'none',
    },

    _hover: {
      _disabled: {
        opacity: '0.8',
      },
    },

    '& span': {
      alignItems: 'center',
      display: 'flex',
      gap: '1',
    },
    alignItems: 'center',
    boxSizing: 'border-box',
    colorPalette: 'colors.gray',
    cursor: 'pointer',
    display: 'flex',
    fontWeight: '500',
    gap: '1',
    justifyContent: 'center',
    rounded: 'xl',
    transition:
      'border-color 0.2s ease-in-out, text-decoration-color 0.2s ease-in-out',
    userSelect: 'none',
    w: 'auto',
    whiteSpace: 'nowrap',
  },
  defaultVariants: {
    size: 'xs',
    variant: 'solid',
  },
  variants: {
    size: {
      icon: {
        fontSize: '1',
        h: '1.75rem',
        rounded: 'lg',
        w: '1.75rem',
      },
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
        fontSize: '1',
        h: '1.75rem',
        px: '1.5',
        rounded: 'lg',
      },
    },
    variant: {
      form: {
        '&[data-state=active], &[data-state=on], &[data-state=open]': {
          border: 'focused',
        },
        bg: 'transparent',
        border: 'subtle',
        fontWeight: '400',
        justifyContent: 'space-between',
        w: '100%',
        whiteSpace: 'nowrap',
      },
      ghost: {
        _hover: {
          bg: 'colorPalette.4',
        },
        bg: 'transparent',
        color: 'colorPalette.12',
      },
      outline: {
        '& .spinner, & .spinner *': {
          borderTopColor: 'colorPalette.11',
        },

        '&[data-state=active], &[data-state=on], &[data-state=open]': {
          bg: 'colorPalette.3',
          opacity: '1',
        },
        bg: 'transparent',
        border: '1px solid',
        borderColor: 'colorPalette.4',
        color: 'colorPalette.12',
        colorPalette: 'colors.gray',
        shadow: 'xs',
        shadowColor: 'colorPalette.4',
      },
      soft: {
        _hover: {
          bg: 'colorPalette.4',
        },

        _light: {
          color: 'colorPalette.11',
        },

        '& .spinner, & .spinner *': {
          borderTopColor: 'colorPalette.11',
        },

        '&[data-state=active], &[data-state=on], &[data-state=open]': {
          bg: 'colorPalette.6',
          color: 'colorPalette.12',
          opacity: '1',
        },
        bg: 'colorPalette.3',
        borderColor: 'colorPalette.2',
        color: 'colorPalette.12',
      },
      solid: {
        _hover: {
          _disabled: {
            opacity: '0.8',
          },
        },

        '& .spinner, & .spinner *': {
          borderTopColor: 'color.gray.1',
        },

        '&[data-state=active], &[data-state=on], &[data-state=open]': {
          bg: 'colorPalette.9',
          color: 'colorPalette.contrast',
          opacity: '1',
        },
        bg: 'colorPalette.9',
        color: 'colorPalette.contrast',
        colorPalette: 'brand.primary',
      },
      transparent: {
        _hover: {
          bg: 'colorPalette.3',
        },

        '&[data-state=active], &[data-state=on], &[data-state=open]': {
          _hover: {
            bg: 'colorPalette.3',
          },
          bg: 'colorPalette.3',
          opacity: '1',
        },
        bg: 'transparent',
        color: 'colorPalette.12',
      },
      underline: {
        _hover: {
          textDecorationColor: 'colorPalette.9',
        },

        '&[data-state=active], &[data-state=on], &[data-state=open]': {
          colorPalette: 'brand.primary',
          opacity: '1',
          textDecorationColor: 'colorPalette.9',
        },
        bg: 'transparent',
        colorPalette: 'colors.gray',
        textDecoration: 'underline',
        textDecorationColor: 'colorPalette.4',
        textUnderlineOffset: '3px',
      },
    },
  },
});

const StyledButton = styled('button', buttonStyle);

const StyledSlot = styled(Slot.Root, buttonStyle);

export type ButtonVariants = RecipeVariantProps<typeof buttonStyle>;

export type ButtonProps = {
  isLoading?: boolean;
  isDisabled?: boolean;
  loadingText?: string;
  tooltipContentProps?: TooltipContentProps;
  tooltipChildren?: React.ReactNode;
  shortcut?: React.ReactNode;
  asChild?: boolean;
} & React.ComponentProps<'button'> &
  ButtonVariants &
  JsxStyleProps;

export const Button = ({
  isLoading,
  isDisabled,
  loadingText,
  children,
  tooltipChildren,
  tooltipContentProps,
  shortcut,
  asChild,
  ...props
}: ButtonProps) => {
  const tooltipContent = tooltipChildren || tooltipContentProps?.children;

  const Component = asChild ? StyledSlot : StyledButton;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Component
          data-slot="button"
          disabled={isLoading || isDisabled}
          type="button"
          {...props}
        >
          {!isLoading ? (
            <span data-slot="button-content">
              {children}
              {shortcut && (
                <KeyboardShortcut size={props.size}>
                  {shortcut}
                </KeyboardShortcut>
              )}
            </span>
          ) : (
            <span data-slot="button-loading">
              {loadingText && <Span pr="1">{loadingText}</Span>}
              <Icons.loading animation="loader" />
            </span>
          )}
        </Component>
      </TooltipTrigger>
      {tooltipContent && (
        <TooltipContent align="start" {...tooltipContentProps}>
          {tooltipContent}
        </TooltipContent>
      )}
    </Tooltip>
  );
};
