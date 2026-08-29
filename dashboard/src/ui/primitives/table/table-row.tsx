'use client';

import type * as React from 'react';

import { cva, cx } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const tableRowStyles = cva({
  base: {
    _hover: {
      bg: 'background.muted',
    },
    '&[data-state=selected]': {
      bg: 'background.muted',
    },
    borderBottom: 'subtle',
    p: '0',
    transition: 'colors',
  },
});

const StyledTableRow = styled('tr', tableRowStyles);

export const TableRow = ({
  className,
  ...props
}: React.ComponentProps<'tr'> & JsxStyleProps) => {
  return (
    <StyledTableRow
      className={cx(className)}
      data-slot="table-row"
      {...props}
    />
  );
};
