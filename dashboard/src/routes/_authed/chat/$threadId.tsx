import type { MastraDBMessage } from '@mastra/react';
import { useChat, useMastraClient } from '@mastra/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import { Box, Flex, HStack, styled } from '@riascout-ui/styled-system/jsx';

import { ApprovalContext } from '../../../modules/assistant/components/approval-context';
import { Composer } from '../../../modules/assistant/components/composer';
import { MessageList } from '../../../modules/assistant/components/message-list';
import { ThreadHistoryMenu } from '../../../modules/assistant/components/thread-history-menu';
import {
  AGENT_ID,
  titleFromMessage,
} from '../../../modules/assistant/constants';
import { takePendingMessage } from '../../../modules/assistant/pending-message';
import { useThreadMessages } from '../../../modules/assistant/queries/use-thread-messages';
import {
  RESOURCE_PLACEHOLDER,
  useInvalidateThreads,
  useThreads,
} from '../../../modules/assistant/queries/use-threads';
import { Icons } from '../../../ui/icons/base';

export const Route = createFileRoute('/_authed/chat/$threadId')({
  component: ThreadPage,
});

/**
 * useChat resets its messages whenever the initialMessages reference changes,
 * so a fresh [] literal per render would wipe the conversation on every
 * re-render. One shared empty array keeps the reference stable.
 */
const NO_MESSAGES: MastraDBMessage[] = [];

function ThreadPage() {
  const { threadId } = Route.useParams();
  const pendingRef = useRef<{ threadId: string; message: string } | null>(null);

  /**
   * The route component is reused when the param changes, so the pending
   * message is keyed by thread id: a stale value would replay one thread's
   * first message into the next one opened.
   */
  if (pendingRef.current?.threadId !== threadId) {
    pendingRef.current = {
      threadId,
      message: takePendingMessage(threadId) ?? '',
    };
  }

  const isNew = pendingRef.current.message !== '';
  const history = useThreadMessages(threadId, !isNew);

  if (!isNew && history.isPending) {
    return (
      <Flex h="full">
        <Flex alignItems="center" flex="1" justifyContent="center">
          <HStack color="text.muted" fontSize="1" gap="1.5">
            <Icons.loading animation="loader" size={12} />
            <span>Loading conversation</span>
          </HStack>
        </Flex>
      </Flex>
    );
  }

  return (
    <Conversation
      firstMessage={isNew ? pendingRef.current.message : null}
      initialMessages={history.data ?? NO_MESSAGES}
      key={threadId}
      threadId={threadId}
    />
  );
}

function Conversation({
  threadId,
  initialMessages,
  firstMessage,
}: {
  threadId: string;
  initialMessages: MastraDBMessage[];
  firstMessage: string | null;
}) {
  const client = useMastraClient();
  const invalidateThreads = useInvalidateThreads();
  const { data: threads } = useThreads();
  const {
    messages,
    sendMessage,
    isRunning,
    cancelRun,
    isAwaitingToolApproval,
    approveToolCall,
    declineToolCall,
    toolCallApprovals,
  } = useChat({
    agentId: AGENT_ID,
    threadId,
    initialMessages,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const send = async (message: string) => {
    // only a thread this page created gets a title; existing ones keep theirs
    if (firstMessage !== null && message === firstMessage) {
      await client
        .createMemoryThread({
          threadId,
          title: titleFromMessage(message),
          resourceId: RESOURCE_PLACEHOLDER,
          agentId: AGENT_ID,
        })
        .catch(() => undefined);
    }

    // the send args carry their own threadId; the hook prop alone is not sent
    await sendMessage({ message, threadId });
    void invalidateThreads();
  };

  useEffect(() => {
    if (firstMessage && !startedRef.current) {
      startedRef.current = true;
      void send(firstMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstMessage]);

  // follow the stream only while the reader is already near the bottom
  useEffect(() => {
    const el = scrollRef.current;

    if (!el) return;

    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (distance < 160) el.scrollTop = el.scrollHeight;
  }, [messages, isRunning]);

  const title =
    threads?.find((thread) => thread.id === threadId)?.title ||
    (firstMessage ? titleFromMessage(firstMessage) : 'Conversation');

  return (
    <Flex h="full" overflow="hidden">
      <Flex direction="column" flex="1" minW="0">
        <Flex
          alignItems="center"
          borderBottomWidth="1px"
          borderColor="brand.panel.8"
          flexShrink="0"
          h="44px"
          px="2"
        >
          <ThreadHistoryMenu activeThreadId={threadId} title={title} />
        </Flex>

        <Box flex="1" overflowY="auto" px="6" py="6" ref={scrollRef}>
          <Box maxW="780px" mx="auto" w="full">
            <ApprovalContext.Provider
              value={{
                awaiting: isAwaitingToolApproval,
                approvals: toolCallApprovals,
                approve: (toolCallId) => approveToolCall(toolCallId),
                decline: declineToolCall,
              }}
            >
              <MessageList isRunning={isRunning} messages={messages} />
            </ApprovalContext.Provider>
          </Box>
        </Box>

        <Box flexShrink="0" px="6" pb="4" pt="2">
          <Box maxW="780px" mx="auto" w="full">
            <Composer
              blockedHint={
                isAwaitingToolApproval
                  ? 'Approve or decline the request above to continue'
                  : undefined
              }
              busy={isRunning}
              onSend={send}
              onStop={cancelRun}
              placeholder="Ask a follow-up"
            />
            <styled.p
              color="text.muted"
              fontSize="0.688"
              mt="2"
              textAlign="center"
            >
              The assistant can be wrong. Check the CRD before you reach out.
            </styled.p>
          </Box>
        </Box>
      </Flex>
    </Flex>
  );
}
