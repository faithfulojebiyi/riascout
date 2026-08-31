'use client';

import type * as React from 'react';

import { css } from '@riascout-ui/styled-system/css';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

type SidebarFooterProps = React.ComponentProps<'div'> & JsxStyleProps;

const footerStyles = css({
  borderColor: 'brand.panel.4',
  // the footer is pushed to the bottom, so its rule sits above it
  borderTopWidth: '1px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  p: '2',
});

export const SidebarFooter = (props: SidebarFooterProps) => {
  return <div className={footerStyles} data-slot="sidebar-footer" {...props} />;
};
