import { memo } from 'react';
import { Streamdown } from 'streamdown';
import 'streamdown/styles.css';

import { Box } from '@riascout-ui/styled-system/jsx';

import { mdComponents } from './md-components';

type MarkdownTextProps = {
  children: string;
  /** streaming keeps half-written fences and tables from flickering */
  streaming?: boolean;
};

/**
 * Streamdown's own chrome (copy buttons, code toolbars) is styled with
 * tailwind classes this app does not ship, so controls stay off and the
 * component map supplies every visible element.
 */
export const MarkdownText = memo(
  ({ children, streaming = false }: MarkdownTextProps) => (
    <Box color="text.app" fontSize="1" lineHeight="1.6">
      <Streamdown
        components={mdComponents}
        controls={false}
        mode={streaming ? 'streaming' : 'static'}
      >
        {children}
      </Streamdown>
    </Box>
  ),
);

MarkdownText.displayName = 'MarkdownText';
