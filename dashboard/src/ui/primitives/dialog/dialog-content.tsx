'use client';

import { type ComponentProps } from 'react';

import { Dialog as DialogPrimitive } from 'radix-ui';

import { css, cva } from '@riascout-ui/styled-system/css';
import { styled, VisuallyHidden } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { Icons } from '../../icons/base';
import { Span } from '../typography';
import { DialogDescription } from './dialog-description';
import { DialogOverlay } from './dialog-overlay';
import { DialogPortal } from './dialog-portal';

type Props = ComponentProps<typeof DialogPrimitive.Content> &
  JsxStyleProps & {
    showCloseIcon?: boolean;
  };

const contentStyles = cva({
  base: {
    _dark: {
      // outline: '2px solid {colors.colors.gray.4}'
    },
    _light: {
      bg: 'white',
      glass: 'none',
    },
    '&[data-state=closed]': {
      animation: 'fadeElementOut',
    },
    '&[data-state=open]': {
      animation: 'fadeElementIn',
    },
    bg: 'background.popover',
    border: 'subtle',
    gap: '4',
    glass: 'popup',
    left: '50%',
    // sane default so a dialog never goes full-bleed — pass maxW to widen one.
    maxW: 'min(28rem, calc(100vw - 2rem))',
    overflow: 'hidden',
    pos: 'fixed',
    rounded: '2xl',
    shadow: 'sLg',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    w: '100%',
    zIndex: '100',
  },
});

const StyledDialogContent = styled(DialogPrimitive.Content, contentStyles);

const closeWrapperStyles = css({
  _disabled: {
    pointerEvents: 'none',
  },

  _focus: {
    outline: 'none',
  },

  _hover: {
    bg: 'colors.gray.3',
    opacity: '100',
  },
  alignItems: 'center',
  borderRadius: 'xl',
  color: 'text.muted',
  cursor: 'pointer',
  display: 'flex',
  h: '1.75rem',
  justifyContent: 'center',
  pos: 'absolute',
  right: '0.6rem',
  top: '0.6rem',
  transition: 'opacity 100ms',
  w: '1.75rem',
});

const closeIconStyles = css({ h: '1rem', w: '1rem' });

export const DialogContent = ({
  children,
  showCloseIcon = true,
  style,
  ...props
}: Props) => {
  // useEffect(() => {
  // 	if (resolvedTheme !== 'light') {
  // 		setBgGrain(DARK_BODY_GRAIN_PATH)
  // 	} else {
  // 		setBgGrain(undefined)
  // 	}
  // }, [resolvedTheme])

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <StyledDialogContent
        data-slot="dialog-content"
        {...props}
        aria-describedby={'dialog-content'}
        style={{ ...style }}
      >
        <VisuallyHidden>
          <DialogDescription>Dialog content</DialogDescription>
        </VisuallyHidden>

        {children}

        {showCloseIcon && (
          <DialogPrimitive.Close
            className={closeWrapperStyles}
            data-slot="dialog-close"
          >
            <Icons.close className={closeIconStyles} />
            <Span srOnly>Close</Span>
          </DialogPrimitive.Close>
        )}
      </StyledDialogContent>
    </DialogPortal>
  );
};
