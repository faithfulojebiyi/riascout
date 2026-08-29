import * as React from 'react';

import { Avatar as AvatarPrimitive } from 'radix-ui';

import { cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

type Element = React.ElementRef<typeof AvatarPrimitive.AvatarFallback>;

const avatarFallbackStyle = cva({
  base: {
    alignItems: 'center',
    aspectRatio: 'square',
    bg: 'muted',
    display: 'flex',
    h: '100%',
    justifyContent: 'center',
    w: '100%',
  },
});

const StyledAvatarFallback = styled(
  AvatarPrimitive.AvatarFallback,
  avatarFallbackStyle,
);

export type AvatarFallbackProps = React.ComponentPropsWithoutRef<
  typeof AvatarPrimitive.AvatarFallback
> &
  JsxStyleProps;

export const AvatarFallback = React.forwardRef<Element, AvatarFallbackProps>(
  function AvatarFallback({ ...props }, ref) {
    return <StyledAvatarFallback ref={ref} {...props} />;
  },
);
