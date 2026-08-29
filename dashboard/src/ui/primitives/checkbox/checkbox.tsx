'use client';

import type * as React from 'react';

import { Checkbox as CheckboxPrimitive } from 'radix-ui';

import { css, cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { Icons } from '../../icons/base';
import type { TIcon } from '../../icons/types';

type Props = React.ComponentProps<typeof CheckboxPrimitive.Root> &
  JsxStyleProps & {
    icon?: TIcon;
  };

const checkboxStyles = cva({
  base: {
    _disabled: { cursor: 'not-allowed', opacity: '0.5' },

    '&[data-state=checked]': {
      bg: 'brand.primary.9',
      border: '1.5px solid transparent',
    },
    border: '1.5px solid token(colors.colors.gray.4)',
    cursor: 'pointer',
    display: 'flex',
    h: '1rem',
    rounded: 'md',
    w: '1rem',
  },
});

const StyledCheckbox = styled(CheckboxPrimitive.Root, checkboxStyles);

const indicatorStyles = cva({
  base: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    overflow: 'hidden',
    rounded: 'inherit',
  },
});

const StyledIndicator = styled(CheckboxPrimitive.Indicator, indicatorStyles);

export const Checkbox = ({ icon, ...props }: Props) => {
  const Icon = icon || Icons.check;

  return (
    <StyledCheckbox data-slot="checkbox" {...props}>
      <StyledIndicator data-slot="checkbox-indicator">
        <Icon
          className={css({
            _focus: { border: 'focused', outline: 'none' },
            color: 'white',
            h: '0.75rem',
            rounded: 'md',
            w: '0.75rem',
          })}
        />
      </StyledIndicator>
    </StyledCheckbox>
  );
};
