'use client';

import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';

import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const StyledGroup = styled(ContextMenuPrimitive.Group);

export const ContextMenuGroup = ({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Group> & JsxStyleProps) => {
  return <StyledGroup data-slot="context-menu-group" {...props} />;
};
