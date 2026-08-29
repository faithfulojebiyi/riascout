import { css, cva } from '@riascout-ui/styled-system/css';
import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

import { Separator } from '../separator';

const fieldSeparatorStyles = cva({
  base: {
    '.group\\/field-group[data-variant=outline] &': {
      mb: '-2',
    },
    fontSize: '2',
    h: '5',
    my: '-2',
    pos: 'relative',
  },
});

const fieldSeparatorContentStyles = cva({
  base: {
    bg: 'background.app',
    color: 'text.muted',
    display: 'block',
    mx: 'auto',
    pos: 'relative',
    px: '2',
    w: 'fit-content',
  },
});

const separatorStyles = css({
  inset: '0',
  pos: 'absolute',
  top: '1/2',
});

const StyledFieldSeparator = styled('div', fieldSeparatorStyles);
const StyledFieldSeparatorContent = styled('span', fieldSeparatorContentStyles);

export const FieldSeparator = ({
  children,
  ...props
}: React.ComponentProps<'div'> &
  JsxStyleProps & {
    children?: React.ReactNode;
  }) => {
  return (
    <StyledFieldSeparator
      data-content={!!children}
      data-slot="field-separator"
      {...props}
    >
      <Separator className={separatorStyles} />
      {children && (
        <StyledFieldSeparatorContent data-slot="field-separator-content">
          {children}
        </StyledFieldSeparatorContent>
      )}
    </StyledFieldSeparator>
  );
};
