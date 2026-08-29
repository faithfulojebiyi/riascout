import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';

import { controlSizes } from './_shared/control-sizes';

/**
 * Monochrome by design: the solid look is brand.primary.9, which is near-black
 * in light mode and near-white in dark. Colour is reserved for state and data.
 */
const button = cva({
  base: {
    alignItems: 'center',
    cursor: 'pointer',
    display: 'inline-flex',
    fontWeight: '500',
    gap: '2',
    justifyContent: 'center',
    transition: 'background 120ms, border-color 120ms',
    whiteSpace: 'nowrap',
    _disabled: { cursor: 'not-allowed', opacity: '0.5' },
  },
  variants: {
    look: {
      solid: {
        bg: 'brand.primary.9',
        color: 'brand.primary.1',
        _hover: { bg: 'brand.primary.10' },
      },
      outline: {
        bg: 'transparent',
        borderColor: 'brand.primary.6',
        borderWidth: '1px',
        color: 'brand.primary.12',
        _hover: { bg: 'brand.primary.3' },
      },
      ghost: {
        bg: 'transparent',
        color: 'brand.primary.11',
        _hover: { bg: 'brand.primary.3', color: 'brand.primary.12' },
      },
    },
    size: controlSizes,
  },
  defaultVariants: { look: 'solid', size: 'sm' },
});

export type ButtonProps = RecipeVariantProps<typeof button>;
export const Button = styled('button', button);
