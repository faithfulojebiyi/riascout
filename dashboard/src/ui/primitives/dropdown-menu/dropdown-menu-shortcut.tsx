'use client';

import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { Span } from '../typography';

type Props = React.HTMLAttributes<HTMLSpanElement> & JsxStyleProps;

export const DropdownMenuShortcut = ({ ...props }: Props) => {
  return (
    <Span
      data-slot="dropdown-menu-shortcut"
      fontSize="1"
      letterSpacing="0.1rem"
      ml="auto"
      opacity="0.5"
      {...props}
    />
  );
};
