import type { MastraDBMessage } from '@mastra/react';
import { toast } from 'sonner';

import { Box, Flex, HStack, styled } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../ui/icons/base';
import { Button } from '../../../ui/primitives/button';
import { toolLabel } from '../constants';
import { exchangeTime } from '../relative-time';
import { useApprovalActions } from './approval-context';
import { MarkdownText } from './markdown-text';
import { ApprovalCard } from './tool-cards/approval-card';
import { GenericCard } from './tool-cards/generic-card';
import { TOOL_RENDERERS } from './tool-cards/registry';
import type { ToolInvocationPart } from './tool-cards/types';

const textOf = (message: MastraDBMessage): string =>
  message.content.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n\n');

const StatusRow = ({
  finished,
  label,
  detail,
  tone = 'muted',
}: {
  finished: boolean;
  label: string;
  detail?: string | null;
  tone?: 'muted' | 'error';
}) => (
  <HStack
    color={tone === 'error' ? 'red.11' : 'text.muted'}
    fontSize="1"
    gap="1.5"
  >
    {tone === 'error' ? (
      <Icons.closeCircle size={12} />
    ) : finished ? (
      <Icons.checkCircle size={12} />
    ) : (
      <Icons.loading animation="loader" size={12} />
    )}
    <span>{label}</span>
    {detail ? <styled.span opacity="0.7">· {detail}</styled.span> : null}
  </HStack>
);

type PendingApproval = { toolCallId: string; toolName: string; args: unknown };

const isPendingApproval = (value: unknown): value is PendingApproval =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PendingApproval).toolCallId === 'string';

/**
 * @mastra/react leaves the part in state "call" and records the pending
 * approval on the message metadata: keyed by tool name while streaming, by
 * tool call id after a reload. The part state alone never says "approval".
 */
const pendingApprovalFor = (
  message: MastraDBMessage,
  toolCallId: string,
): PendingApproval | null => {
  const metadata = message.content.metadata ?? {};
  const buckets = [
    metadata.requireApprovalMetadata,
    metadata.pendingToolApprovals,
  ];

  for (const bucket of buckets) {
    if (typeof bucket !== 'object' || bucket === null) continue;

    const match = Object.values(bucket).find(
      (entry) => isPendingApproval(entry) && entry.toolCallId === toolCallId,
    );

    if (match) return match as PendingApproval;
  }

  return null;
};

/**
 * One tool call, from in-flight to landed. Running work stays a status row;
 * a write parks on the approval card; a landed result gets its renderer.
 */
const ToolStep = ({
  part,
  message,
}: {
  part: ToolInvocationPart;
  message: MastraDBMessage;
}) => {
  const approvalActions = useApprovalActions();
  const invocation = part.toolInvocation;
  const { toolName, toolCallId, state } = invocation;
  const renderer = TOOL_RENDERERS[toolName];
  const input = invocation.args;
  const settled =
    state === 'result' || state === 'output-error' || state === 'output-denied';
  const pending = settled ? null : pendingApprovalFor(message, toolCallId);

  if (
    pending ||
    state === 'approval-requested' ||
    state === 'approval-responded'
  ) {
    const description = renderer?.describeApproval?.(input) ?? {
      title: toolLabel(toolName, false),
      lines: [],
    };
    const local = approvalActions.approvals[toolCallId]?.status;
    const declined =
      local === 'declined' ||
      (state === 'approval-responded' &&
        invocation.approval?.approved === false);

    if (declined) {
      return (
        <Box my="2">
          <StatusRow finished label="Declined" detail={description.title} />
        </Box>
      );
    }

    const phase =
      state === 'approval-responded' || local === 'approved'
        ? 'running'
        : approvalActions.awaiting
          ? 'pending'
          : 'expired';

    return (
      <ApprovalCard
        description={description}
        onApprove={() => approvalActions.approve(toolCallId)}
        onDecline={() => approvalActions.decline(toolCallId)}
        phase={phase}
      />
    );
  }

  if (state === 'output-denied') {
    return (
      <Box my="2">
        <StatusRow
          finished
          label="Declined"
          detail={toolLabel(toolName, false)}
        />
      </Box>
    );
  }

  if (state === 'output-error' || invocation.isError) {
    return (
      <Box my="2">
        <StatusRow
          detail={invocation.errorText ?? 'the tool failed'}
          finished
          label={toolLabel(toolName, false)}
          tone="error"
        />
      </Box>
    );
  }

  const finished = state === 'result';
  const result = 'result' in invocation ? invocation.result : undefined;
  const Result = renderer?.Result;

  return (
    <Box my="2">
      <StatusRow
        detail={finished ? renderer?.detail?.(result) : null}
        finished={finished}
        label={toolLabel(toolName, finished)}
      />
      {finished ? (
        Result ? (
          <Result input={input} result={result} toolCallId={toolCallId} />
        ) : renderer ? null : (
          <GenericCard result={result} />
        )
      ) : null}
    </Box>
  );
};

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    toast.error('Could not copy to the clipboard');
  }
};

/** one centered stamp per exchange, above the user's message */
const TimeSeparator = ({ at }: { at: Date | string | number }) => (
  <styled.div color="text.muted" fontSize="0.688" textAlign="center">
    {exchangeTime(at)}
  </styled.div>
);

const UserMessage = ({ message }: { message: MastraDBMessage }) => (
  <Flex alignItems="flex-end" direction="column" gap="1">
    <TimeSeparator at={message.createdAt} />
    <Box
      bg="brand.panel.5"
      fontSize="1"
      lineHeight="1.55"
      maxW="85%"
      mt="2"
      px="3.5"
      py="2.5"
      rounded="xl"
      whiteSpace="pre-wrap"
    >
      {textOf(message)}
    </Box>
  </Flex>
);

const AssistantMessage = ({
  message,
  streaming,
}: {
  message: MastraDBMessage;
  streaming: boolean;
}) => {
  const text = textOf(message);
  const parts = message.content.parts;
  const hasVisibleWork = parts.some(
    (part) => part.type === 'tool-invocation' || part.type === 'text',
  );
  return (
    <Flex direction="column" gap="0.5" maxW="85%">
      {parts.map((part, index) => {
        if (part.type === 'tool-invocation') {
          return (
            <ToolStep
              key={`${message.id}-${index}`}
              message={message}
              part={part}
            />
          );
        }

        if (part.type === 'text' && part.text.length > 0) {
          return (
            <MarkdownText key={`${message.id}-${index}`} streaming={streaming}>
              {part.text}
            </MarkdownText>
          );
        }

        return null;
      })}
      {streaming && !hasVisibleWork ? (
        <HStack color="text.muted" fontSize="1" gap="1.5" my="2">
          <Icons.loading animation="loader" size={12} />
          <span>Working</span>
        </HStack>
      ) : null}
      {!streaming && text ? (
        <HStack color="text.muted" fontSize="0.688" gap="1" mt="0.5">
          <Button
            aria-label="Copy answer"
            h="6"
            minW="6"
            onClick={() => void copyText(text)}
            p="0"
            size="icon"
            variant="ghost"
            w="6"
          >
            <Icons.copy size={12} />
          </Button>
        </HStack>
      ) : null}
    </Flex>
  );
};

export const MessageList = ({
  messages,
  isRunning,
}: {
  messages: MastraDBMessage[];
  isRunning: boolean;
}) => {
  const last = messages.at(-1);

  return (
    <Flex direction="column" gap="5">
      {messages.map((message) =>
        message.role === 'user' ? (
          <UserMessage key={message.id} message={message} />
        ) : (
          <AssistantMessage
            key={message.id}
            message={message}
            streaming={isRunning && message === last}
          />
        ),
      )}
      {isRunning && last?.role === 'user' ? (
        <HStack color="text.muted" fontSize="1" gap="1.5">
          <Icons.loading animation="loader" size={12} />
          <span>Working</span>
        </HStack>
      ) : null}
    </Flex>
  );
};
