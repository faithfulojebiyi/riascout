import type { MastraDBMessage, MastraMessagePart } from '@mastra/react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';

import { Box, Flex, HStack, styled } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../ui/icons/base';
import { Button } from '../../../ui/primitives/button';
import { toolLabel } from '../constants';
import { exchangeTime } from '../relative-time';
import { MarkdownText } from './markdown-text';

type AdviserRow = {
  advisorCrd: string;
  fullName: string | null;
  firmCrd: string | null;
  firmName: string | null;
  state: string | null;
  firmAumBand: string | null;
  firmAumBandLabel?: string | null;
  tenureYears: number | null;
};

type SearchResult = { total: number; rows: AdviserRow[]; openUrl: string };

type FirmCandidate = {
  firmCrd: string;
  firmName: string | null;
  city: string | null;
  state: string | null;
  regulatoryAum: string | null;
  advisorCount: number | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSearchResult = (value: unknown): value is SearchResult =>
  isRecord(value) &&
  Array.isArray(value.rows) &&
  typeof value.total === 'number';

const isFirmLookup = (
  value: unknown,
): value is { candidates: FirmCandidate[] } =>
  isRecord(value) && Array.isArray(value.candidates);

const textOf = (message: MastraDBMessage): string =>
  message.content.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n\n');

const money = (value: string | null): string => {
  if (value === null) return 'not reported';

  const amount = Number(value);

  if (!Number.isFinite(amount)) return value;
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${Math.round(amount / 1e6)}M`;

  return `$${Math.round(amount).toLocaleString()}`;
};

/** fallback for rows recorded before the tool started sending labels */
const AUM_BAND_LABEL: Record<string, string> = {
  lt_25m: 'Under $25M',
  '25m_100m': '$25M – $100M',
  '100m_250m': '$100M – $250M',
  '250m_500m': '$250M – $500M',
  '500m_1b': '$500M – $1B',
  '1b_5b': '$1B – $5B',
  '5b_20b': '$5B – $20B',
  gte_20b: '$20B+',
};

const bandLabel = (row: AdviserRow): string =>
  row.firmAumBandLabel ??
  (row.firmAumBand === null
    ? '—'
    : (AUM_BAND_LABEL[row.firmAumBand] ?? row.firmAumBand));

/* tiles: every cell is its own panel, the page background is the gridline */
const Table = styled('table', {
  base: {
    borderCollapse: 'separate',
    borderSpacing: '3px',
    display: 'block',
    fontSize: '1',
    overflowX: 'auto',
    w: 'full',
  },
});

const Th = styled('th', {
  base: {
    bg: 'brand.panel.6',
    color: 'text.muted',
    fontWeight: '500',
    px: '2.5',
    py: '1.5',
    rounded: 'md',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
});

const Td = styled('td', {
  base: {
    bg: 'brand.panel.3',
    px: '2.5',
    py: '1.5',
    rounded: 'md',
    whiteSpace: 'nowrap',
  },
});

const SearchTable = ({ result }: { result: SearchResult }) => (
  <Box my="2">
    <Table>
      <thead>
        <tr>
          <Th>Adviser</Th>
          <Th>CRD</Th>
          <Th>Firm</Th>
          <Th>State</Th>
          <Th>Firm AUM</Th>
          <Th>Tenure</Th>
        </tr>
      </thead>
      <tbody>
        {result.rows.map((row) => (
          <tr key={row.advisorCrd}>
            <Td fontWeight="500">{row.fullName ?? 'Name not reported'}</Td>
            <Td color="text.muted" fontFamily="mono">
              {row.advisorCrd}
            </Td>
            <Td>
              {row.firmName ?? '—'}
              {row.firmCrd ? (
                <styled.span color="text.muted" fontFamily="mono" ml="1.5">
                  {row.firmCrd}
                </styled.span>
              ) : null}
            </Td>
            <Td>{row.state ?? '—'}</Td>
            <Td>{bandLabel(row)}</Td>
            <Td>{row.tenureYears === null ? '—' : `${row.tenureYears} yrs`}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
    <HStack color="text.muted" fontSize="1" gap="3" mt="1.5" px="1">
      <span>
        {result.total.toLocaleString()} match
        {result.rows.length < result.total
          ? `, showing ${result.rows.length}`
          : ''}
      </span>
      <Link to="/prospecting/advisors">
        <styled.span
          color="text.app"
          textDecoration="underline"
          textUnderlineOffset="3px"
        >
          Open in Prospecting
        </styled.span>
      </Link>
    </HStack>
  </Box>
);

const FirmCandidates = ({ candidates }: { candidates: FirmCandidate[] }) => (
  <Box my="2">
    <Table>
      <thead>
        <tr>
          <Th>Firm</Th>
          <Th>CRD</Th>
          <Th>Location</Th>
          <Th>Regulatory AUM</Th>
          <Th>Advisers</Th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((firm) => (
          <tr key={firm.firmCrd}>
            <Td fontWeight="500">{firm.firmName ?? 'Name not reported'}</Td>
            <Td color="text.muted" fontFamily="mono">
              {firm.firmCrd}
            </Td>
            <Td>{[firm.city, firm.state].filter(Boolean).join(', ') || '—'}</Td>
            <Td>{money(firm.regulatoryAum)}</Td>
            <Td>{firm.advisorCount?.toLocaleString() ?? 'not reported'}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  </Box>
);

const ToolStep = ({
  part,
}: {
  part: Extract<MastraMessagePart, { type: 'tool-invocation' }>;
}) => {
  const { toolName, state } = part.toolInvocation;
  const finished = state === 'result' || state === 'output-error';
  const result =
    'result' in part.toolInvocation ? part.toolInvocation.result : undefined;
  const detail = isSearchResult(result)
    ? `${result.total.toLocaleString()} match`
    : isFirmLookup(result)
      ? `${result.candidates.length} candidate${result.candidates.length === 1 ? '' : 's'}`
      : null;

  return (
    <Box my="2">
      <HStack color="text.muted" fontSize="1" gap="1.5">
        {finished ? (
          <Icons.checkCircle size={12} />
        ) : (
          <Icons.loading animation="loader" size={12} />
        )}
        <span>{toolLabel(toolName, finished)}</span>
        {detail ? <styled.span opacity="0.7">· {detail}</styled.span> : null}
      </HStack>
      {isSearchResult(result) && result.rows.length > 0 ? (
        <SearchTable result={result} />
      ) : null}
      {isFirmLookup(result) && result.candidates.length > 0 ? (
        <FirmCandidates candidates={result.candidates} />
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
          return <ToolStep key={`${message.id}-${index}`} part={part} />;
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
