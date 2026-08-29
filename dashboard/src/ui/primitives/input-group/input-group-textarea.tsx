'use client';

import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { Textarea, type TextareaProps } from '../textarea/textarea';

const inputGroupTextareaStyles = cva({
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
    py: '2',
    resize: 'none',
    rounded: 'none',
    shadow: 'none',
  },
});

const StyledInputGroupTextarea = styled(Textarea, inputGroupTextareaStyles);

export type InputGroupTextareaVariants = RecipeVariantProps<
  typeof inputGroupTextareaStyles
>;

export type InputGroupTextareaProps = TextareaProps &
  JsxStyleProps &
  InputGroupTextareaVariants;

export const InputGroupTextarea = ({ ...props }: InputGroupTextareaProps) => {
  return (
    <StyledInputGroupTextarea data-slot="input-group-control" {...props} />
  );
};
