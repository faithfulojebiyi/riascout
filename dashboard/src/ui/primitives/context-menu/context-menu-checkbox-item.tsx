'use client';

import type React from 'react';

import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { Icons } from '../../icons/base';
import { Span } from '../typography';

type Props = React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem> &
  JsxStyleProps & { showIndicator?: boolean };

const checkboxItemStyles = cva({
  base: {
    _disabled: {
      opacity: '0.5',
    },

    _focus: {
      bg: 'background.muted',
    },
    alignItems: 'center',
    display: 'flex',
    gap: '0.625rem',
    justifyContent: 'space-between',
    mx: '0.5rem',
    outline: 'none',
    pos: 'relative',
    userSelect: 'none',
  },
});

const StyledCheckboxItem = styled(
  ContextMenuPrimitive.CheckboxItem,
  checkboxItemStyles,
);

export const ContextMenuCheckboxItem = ({
  children,
  checked,
  ...props
}: Props) => {
  return (
    <StyledCheckboxItem
      checked={checked}
      data-slot="context-menu-checkbox-item"
      {...props}
    >
      <Span alignItems="center" display="flex" justifyContent="center">
        <ContextMenuPrimitive.ItemIndicator>
          <Icons.check />
        </ContextMenuPrimitive.ItemIndicator>
      </Span>
      {children}
    </StyledCheckboxItem>
  );
};
