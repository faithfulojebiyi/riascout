import type * as React from 'react';

import { Slot } from 'radix-ui';

import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const buttonGroupTextStyles = cva({
  base: {
    '& svg': {
      pointerEvents: 'none',
    },
    '& svg:not([class*="size-"])': {
      h: '4',
      w: '4',
    },
    alignItems: 'center',
    bg: 'background.muted',
    border: 'subtle',
    display: 'flex',
    fontSize: 'sm',
    fontWeight: 'medium',
    gap: '2',
    px: '2.5',
    rounded: 'lg',
  },
});

const StyledButtonGroupText = styled('div', buttonGroupTextStyles);
const StyledSlot = styled(Slot.Root, buttonGroupTextStyles);

export type ButtonGroupTextVariants = RecipeVariantProps<
  typeof buttonGroupTextStyles
>;

export type ButtonGroupTextProps = {
  asChild?: boolean;
} & React.ComponentProps<'div'> &
  ButtonGroupTextVariants &
  JsxStyleProps;

export const ButtonGroupText = ({
  asChild = false,
  ...props
}: ButtonGroupTextProps) => {
  const Component = asChild ? StyledSlot : StyledButtonGroupText;
  return <Component data-slot="button-group-text" {...props} />;
};
