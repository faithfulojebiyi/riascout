'use client';

import type * as React from 'react';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const tableHeadStyles = cva({
  base: {
    '&:has([role=checkbox])': {
      pr: '0',
    },
    color: 'text.app',
    fontWeight: 'medium',
    h: '10',
    px: '2',
    textAlign: 'left',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  },
});

const StyledTableHead = styled('th', tableHeadStyles);

export const TableHead = ({
  ...props
}: React.ComponentProps<'th'> & JsxStyleProps) => {
  return <StyledTableHead data-slot="table-head" {...props} />;
};
