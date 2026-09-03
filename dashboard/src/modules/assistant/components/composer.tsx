import { useState, type KeyboardEvent } from 'react';

import { Box, Flex, HStack } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../ui/icons/base';
import { Button } from '../../../ui/primitives/button';
import { Textarea } from '../../../ui/primitives/textarea';

type ComposerProps = {
  onSend: (message: string) => void | Promise<void>;
  onStop?: () => void;
  busy?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** the home page shows the hint; a live thread does not need it twice */
  showHint?: boolean;
};

/**
 * One composer for the home page and the thread. Enter sends, Shift+Enter
 * breaks a line. While the assistant is working the send button becomes stop.
 */
export const Composer = ({
  onSend,
  onStop,
  busy = false,
  autoFocus = false,
  placeholder = 'Ask about advisers, firms, or a list',
  showHint = false,
}: ComposerProps) => {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSend) return;

    const message = draft.trim();

    setDraft('');
    void onSend(message);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    // a 4px grey band around the card, so the input reads as set into the page
    <Box
      bg="brand.panel.4"
      boxShadow="0 1px 2px rgba(10, 18, 23, 0.04)"
      p="4px"
      rounded="calc(token(radii.2xl) + 4px)"
      w="full"
    >
      <Box
        bg="background.app"
        boxShadow="0 1px 2px rgba(10, 18, 23, 0.06), 0 10px 30px rgba(10, 18, 23, 0.10)"
        p="2"
        rounded="2xl"
        w="full"
      >
        <Textarea
          autoFocus={autoFocus}
          bg="brand.panel.3"
          border="none"
          boxShadow="none"
          fontSize="2"
          minH="3.5rem"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          px="3"
          py="2.5"
          resize="none"
          rounded="xl"
          rows={2}
          value={draft}
          // the recipe tints only dark mode on hover/focus; pin one tint for both
          _dark={{ bg: 'brand.panel.3' }}
          _focus={{ bg: 'brand.panel.4', boxShadow: 'none', outline: 'none' }}
          _hover={{ bg: 'brand.panel.4' }}
        />
        <Flex
          alignItems="center"
          justifyContent="space-between"
          mt="1.5"
          px="1"
        >
          <HStack color="text.muted" fontSize="1" gap="1.5">
            {showHint ? (
              <span>Enter to send, Shift+Enter for a new line</span>
            ) : null}
          </HStack>
          {busy && onStop ? (
            <Button
              aria-label="Stop"
              onClick={onStop}
              size="icon"
              variant="soft"
            >
              <Icons.stop size={14} />
            </Button>
          ) : (
            <Button
              aria-label="Send"
              bg="brand.primary.12"
              color="brand.primary.1"
              disabled={!canSend}
              onClick={submit}
              rounded="full"
              size="icon"
              _hover={{ bg: 'brand.primary.11' }}
            >
              <Icons.arrowUp size={14} />
            </Button>
          )}
        </Flex>
      </Box>
    </Box>
  );
};
