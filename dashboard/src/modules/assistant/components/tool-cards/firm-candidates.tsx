import { Box, styled } from '@riascout-ui/styled-system/jsx';

import { Table, Td, Th } from './search-tables';
import { isRecord, money } from './types';

type FirmCandidate = {
  firmCrd: string;
  firmName: string | null;
  city: string | null;
  state: string | null;
  regulatoryAum: string | null;
  advisorCount: number | null;
};

const isFirmLookup = (
  value: unknown,
): value is { candidates: FirmCandidate[] } =>
  isRecord(value) && Array.isArray(value.candidates);

export const firmLookupDetail = (result: unknown): string | null =>
  isFirmLookup(result)
    ? `${result.candidates.length} candidate${result.candidates.length === 1 ? '' : 's'}`
    : null;

export const FirmCandidates = ({ result }: { result: unknown }) => {
  if (!isFirmLookup(result) || result.candidates.length === 0) return null;

  return (
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
          {result.candidates.map((firm) => (
            <tr key={firm.firmCrd}>
              <Td fontWeight="500">{firm.firmName ?? 'Name not reported'}</Td>
              <Td color="text.muted" fontFamily="mono">
                {firm.firmCrd}
              </Td>
              <Td>
                {[firm.city, firm.state].filter(Boolean).join(', ') || '—'}
              </Td>
              <Td>{money(firm.regulatoryAum)}</Td>
              <Td>{firm.advisorCount?.toLocaleString() ?? 'not reported'}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <styled.div color="text.muted" fontSize="0.688" mt="1" px="1">
        Names change between filings. The CRD is the identity.
      </styled.div>
    </Box>
  );
};
