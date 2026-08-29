import type * as React from 'react';

import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const kbdGroupStyles = cva({
  base: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: '1',
  },
});

const StyledKbdGroup = styled('div', kbdGroupStyles);

export type KbdGroupVariants = RecipeVariantProps<typeof kbdGroupStyles>;

export type KbdGroupProps = React.ComponentProps<'div'> &
  KbdGroupVariants &
  JsxStyleProps;

export const KbdGroup = (props: KbdGroupProps) => {
  return <StyledKbdGroup data-slot="kbd-group" {...props} />;
};
