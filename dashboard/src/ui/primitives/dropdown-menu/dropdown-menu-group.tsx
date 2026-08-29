'use client';

import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const StyledGroup = styled(DropdownMenuPrimitive.Group);

export const DropdownMenuGroup = ({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group> &
  JsxStyleProps) => {
  return <StyledGroup data-slot="dropdown-menu-group" {...props} />;
};
