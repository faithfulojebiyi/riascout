import { useState } from 'react';

import { Box, Flex, HStack, styled } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../../ui/icons/base';
import { Button } from '../../../../ui/primitives/button';
import type { ApprovalDescription } from './types';

export type ApprovalPhase = 'pending' | 'running' | 'expired'; // rehydrated from history; the run that asked is gone

/**
 * The gate before a write. Approve turns into the running label rather than a
 * separate badge; a resolved gate is replaced by the artifact card or a
 * one-line marker by the caller.
 */
export const ApprovalCard = ({
  description,
  phase,
  onApprove,
  onDecline,
}: {
  description: ApprovalDescription;
  phase: ApprovalPhase;
  onApprove?: () => Promise<void> | void;
  onDecline?: () => Promise<void> | void;
}) => {
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const running = phase === 'running' || busy === 'approve';

  const act = (kind: 'approve' | 'decline') => async () => {
    setBusy(kind);

    try {
      await (kind === 'approve' ? onApprove?.() : onDecline?.());
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box my="2">
      <Box
        bg="brand.panel.3"
        borderColor="brand.panel.6"
        borderWidth="1px"
        boxShadow="0 1px 2px rgba(10, 18, 23, 0.06)"
        p="1"
        rounded="2xl"
      >
        <Box bg="background.app" rounded="xl">
          <HStack
            borderBottomWidth="1px"
            borderColor="brand.panel.5"
            color="text.muted"
            fontSize="1"
            gap="1.5"
            px="3"
            py="2"
          >
            <Icons.shieldCheck size={13} />
            <span>{description.title}</span>
          </HStack>
          <Flex direction="column" fontSize="1" gap="1" px="3" py="2.5">
            {description.lines.map((line) => (
              <styled.p key={line} lineHeight="1.5">
                {line}
              </styled.p>
            ))}
            {phase === 'expired' ? (
              <styled.p color="text.muted">
                This request expired when the conversation was reopened. Ask
                again to save.
              </styled.p>
            ) : null}
          </Flex>
          {phase === 'expired' ? null : (
            <HStack gap="2" justifyContent="flex-end" px="3" py="2">
              <Button
                disabled={running || busy !== null}
                onClick={act('decline')}
                size="sm"
                variant="ghost"
              >
                {busy === 'decline' ? 'Declining…' : 'Decline'}
              </Button>
              <Button
                bg="brand.primary.12"
                color="brand.primary.1"
                disabled={running || busy !== null}
                onClick={act('approve')}
                size="sm"
                _hover={{ bg: 'brand.primary.11' }}
              >
                {running ? (
                  <HStack gap="1.5">
                    <Icons.loading animation="loader" size={12} />
                    <span>Running…</span>
                  </HStack>
                ) : (
                  'Approve'
                )}
              </Button>
            </HStack>
          )}
        </Box>
      </Box>
    </Box>
  );
};
