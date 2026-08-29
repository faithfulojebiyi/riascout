'use client';

import type * as React from 'react';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const tableHeaderStyles = cva({
  base: {
    '& tr': {
      borderBottom: 'subtle',
    },
  },
});

const StyledTableHeader = styled('thead', tableHeaderStyles);

export const TableHeader = ({
  ...props
}: React.ComponentProps<'thead'> & JsxStyleProps) => {
  return <StyledTableHeader data-slot="table-header" {...props} />;
};
