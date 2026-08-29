'use client';

import type { HTMLMotionProps } from 'motion/react';

import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { MotionDiv } from './motion-div';

export type FadeInProps = Omit<JsxStyleProps, 'transition'> &
  HTMLMotionProps<'div'>;

export const FadeIn = ({ ...props }: FadeInProps) => {
  return (
    <MotionDiv
      animate={{ opacity: 1 }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      {...props}
    />
  );
};
