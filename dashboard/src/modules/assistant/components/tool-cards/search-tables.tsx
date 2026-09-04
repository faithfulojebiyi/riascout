import { Box, HStack, styled } from '@riascout-ui/styled-system/jsx';

import { useOpenHref } from './artifact-card';
import { isRecord, money } from './types';

type AdviserRow = {
  advisorCrd: string;
  fullName: string | null;
  firmCrd: string | null;
  firmName: string | null;
  state: string | null;
  firmAumBand: string | null;
  firmAumBandLabel?: string | null;
  tenureYears: number | null;
  lastMovedOn?: string | null;
};

type FirmRow = {
  firmCrd: string;
  firmName: string | null;
  state: string | null;
  channelLabel: string | null;
  channelCode: string | null;
  regulatoryAum: string | null;
  advisorCount: number | null;
  netAdvisorFlow90d: number | null;
};

type SearchResult<Row> = { total: number; rows: Row[]; openUrl: string };

export const isSearchResult = (
  value: unknown,
): value is SearchResult<Record<string, unknown>> =>
  isRecord(value) &&
  Array.isArray(value.rows) &&
  typeof value.total === 'number' &&
  typeof value.openUrl === 'string';

/* tiles: every cell is its own panel, the page background is the gridline */
export const Table = styled('table', {
  base: {
    borderCollapse: 'separate',
    borderSpacing: '3px',
    display: 'block',
    fontSize: '1',
    overflowX: 'auto',
    w: 'full',
  },
});

export const Th = styled('th', {
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

export const Td = styled('td', {
  base: {
    bg: 'brand.panel.3',
    px: '2.5',
    py: '1.5',
    rounded: 'md',
    whiteSpace: 'nowrap',
  },
});

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

const Footer = ({ result }: { result: SearchResult<unknown> }) => {
  const open = useOpenHref();

  return (
    <HStack color="text.muted" fontSize="1" gap="3" mt="1.5" px="1">
      <span>
        {result.total.toLocaleString()} match
        {result.rows.length < result.total
          ? `, showing ${result.rows.length}`
          : ''}
      </span>
      <styled.a
        color="text.app"
        href={result.openUrl}
        onClick={open(result.openUrl)}
        textDecoration="underline"
        textUnderlineOffset="3px"
      >
        Open in Prospecting
      </styled.a>
    </HStack>
  );
};

export const searchDetail = (result: unknown): string | null =>
  isSearchResult(result) ? `${result.total.toLocaleString()} match` : null;

export const AdviserSearchTable = ({ result }: { result: unknown }) => {
  if (!isSearchResult(result) || result.rows.length === 0) return null;

  const rows = result.rows as unknown as AdviserRow[];

  return (
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
          {rows.map((row) => (
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
              <Td>
                {row.tenureYears === null ? '—' : `${row.tenureYears} yrs`}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Footer result={result} />
    </Box>
  );
};

export const FirmSearchTable = ({ result }: { result: unknown }) => {
  if (!isSearchResult(result) || result.rows.length === 0) return null;

  const rows = result.rows as unknown as FirmRow[];

  return (
    <Box my="2">
      <Table>
        <thead>
          <tr>
            <Th>Firm</Th>
            <Th>CRD</Th>
            <Th>State</Th>
            <Th>Channel</Th>
            <Th>Regulatory AUM</Th>
            <Th>Advisers</Th>
            <Th>Net flow 90d</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.firmCrd}>
              <Td fontWeight="500">{row.firmName ?? 'Name not reported'}</Td>
              <Td color="text.muted" fontFamily="mono">
                {row.firmCrd}
              </Td>
              <Td>{row.state ?? '—'}</Td>
              <Td>{row.channelLabel ?? row.channelCode ?? '—'}</Td>
              <Td>{money(row.regulatoryAum)}</Td>
              <Td>{row.advisorCount?.toLocaleString() ?? '—'}</Td>
              <Td>
                {row.netAdvisorFlow90d === null
                  ? '—'
                  : row.netAdvisorFlow90d > 0
                    ? `+${row.netAdvisorFlow90d}`
                    : String(row.netAdvisorFlow90d)}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Footer result={result} />
    </Box>
  );
};
