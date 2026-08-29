'use client';

import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { Icons } from '../../icons/base';
import type { IconProps } from '../../icons/types';
import { Span } from '../typography';

export const AccordionCaret = (props: JsxStyleProps & IconProps) => {
  return (
    <Span>
      <Icons.caretDown
        {...props}
        className="caret"
        color="text.muted"
        flexShrink="0"
        transition="transform 200ms"
      />
    </Span>
  );
};
