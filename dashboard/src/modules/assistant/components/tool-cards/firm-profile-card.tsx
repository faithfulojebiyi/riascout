import { Box, Flex, HStack, styled } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../../ui/icons/base';
import { ArtifactCard } from './artifact-card';
import { isRecord } from './types';

type FacetRow = {
  code: string;
  label: string | null;
  clientCount: number | null;
  fewerThanFive: boolean | null;
};

type FirmProfile = {
  firmCrd: string;
  clientTypes: FacetRow[];
  services: FacetRow[];
  feeMethods: FacetRow[];
  reportedClients: {
    min: number | null;
    max: number | null;
    quality: 'reported_number' | 'bounded_range' | 'unavailable';
  };
  filingId: string | null;
};

const isFirmProfile = (value: unknown): value is FirmProfile =>
  isRecord(value) &&
  typeof value.firmCrd === 'string' &&
  Array.isArray(value.clientTypes) &&
  isRecord(value.reportedClients);

const clientsText = (clients: FirmProfile['reportedClients']): string => {
  if (clients.quality === 'unavailable') return 'Clients not reported';
  if (clients.quality === 'reported_number') {
    return `${(clients.max ?? clients.min ?? 0).toLocaleString()} clients`;
  }

  const lo = clients.min?.toLocaleString() ?? '?';
  const hi = clients.max?.toLocaleString() ?? '?';

  return `${lo} – ${hi} clients (range)`;
};

const Tiles = ({ title, rows }: { title: string; rows: FacetRow[] }) =>
  rows.length === 0 ? null : (
    <Box>
      <styled.div color="text.muted" fontSize="0.688" mb="1">
        {title}
      </styled.div>
      <Flex flexWrap="wrap" gap="1">
        {rows.map((row) => (
          <styled.span
            bg="brand.panel.3"
            fontSize="0.688"
            key={row.code}
            px="1.5"
            py="0.5"
            rounded="md"
          >
            {row.label ?? row.code}
            {row.clientCount !== null ? (
              <styled.span color="text.muted" ml="1">
                {row.clientCount.toLocaleString()}
              </styled.span>
            ) : row.fewerThanFive ? (
              <styled.span color="text.muted" ml="1">
                &lt;5
              </styled.span>
            ) : null}
          </styled.span>
        ))}
      </Flex>
    </Box>
  );

export const firmProfileDetail = (result: unknown): string | null =>
  isFirmProfile(result) ? `CRD ${result.firmCrd}` : null;

export const FirmProfileCard = ({ result }: { result: unknown }) => {
  if (!isFirmProfile(result)) return null;

  return (
    <ArtifactCard
      href={null}
      icon={<Icons.building size={16} />}
      meta={
        <HStack gap="2">
          <span>{clientsText(result.reportedClients)}</span>
          {result.filingId === null ? (
            <span>· no Form ADV filing on record</span>
          ) : null}
        </HStack>
      }
      title={`Firm CRD ${result.firmCrd}`}
    >
      <Flex direction="column" gap="2.5" px="3" py="2.5">
        <Tiles rows={result.clientTypes} title="Client types" />
        <Tiles rows={result.services} title="Services" />
        <Tiles rows={result.feeMethods} title="Fee methods" />
      </Flex>
    </ArtifactCard>
  );
};
