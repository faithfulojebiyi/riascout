'use client';

import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { Input, type InputProps } from '../input/input';

const inputGroupInputStyles = cva({
  base: {
    _dark: {
      _disabled: {
        bg: 'transparent',
      },
      bg: 'transparent',
    },

    _disabled: {
      bg: 'transparent',
    },

    _focusVisible: {
      ring: '0',
    },
    _invalid: {
      ring: '0',
    },

    bg: 'transparent',
    border: 'none',
    flex: '1',
    fontSize: '1',
    rounded: 'none',
    shadow: 'none',
  },
});

const StyledInputGroupInput = styled(Input, inputGroupInputStyles);

export type InputGroupInputVariants = RecipeVariantProps<
  typeof inputGroupInputStyles
>;

export type InputGroupInputProps = InputProps &
  JsxStyleProps &
  InputGroupInputVariants;

export const InputGroupInput = ({ ...props }: InputGroupInputProps) => {
  return <StyledInputGroupInput data-slot="input-group-control" {...props} />;
};
