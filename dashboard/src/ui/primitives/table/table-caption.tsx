'use client';

import type * as React from 'react';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const tableCaptionStyles = cva({
  base: {
    color: 'text.muted',
    fontSize: '1',
    mt: '4',
  },
});

const StyledTableCaption = styled('caption', tableCaptionStyles);

export const TableCaption = ({
  ...props
}: React.ComponentProps<'caption'> & JsxStyleProps) => {
  return <StyledTableCaption data-slot="table-caption" {...props} />;
};
