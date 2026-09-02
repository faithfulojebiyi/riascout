import { useQuery } from '@tanstack/react-query';
import { css } from '@riascout-ui/styled-system/css';

import type { GetEntityRecordResponse } from '../../../api/generated/rIAScoutAPI.schemas';
import { firmProfileQuery } from '../record-queries';
import { valueOf } from '../record-values';
import { TabLoading } from './tab-state';
import { RankedBars, type RankedRow } from '../components/ranked-bars';
import {
  formatClientTypeCount,
  formatReportedClients,
} from '../client-metrics';

const heading = css({
  fontSize: '2',
  fontWeight: 'semibold',
  pb: '2',
  pt: '5',
});
const prose = css({ fontSize: '2', lineHeight: 'relaxed', maxW: '46rem' });
const chip = css({
  bg: 'background.muted',
  borderRadius: 'md',
  display: 'inline-block',
  fontSize: '1',
  mb: '1',
  mr: '1.5',
  px: '2',
  py: '0.5',
});

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const asNumber = (value: unknown): number | null => {
  const parsed = Number(value);

  return value === null || value === undefined || Number.isNaN(parsed)
    ? null
    : parsed;
};

/**
 * Every clause maps to one filed field and is dropped when that field is null,
 * rather than guessed or filled with a default. A recruiter has to be able to
 * defend each sentence from the ADV, so nothing here is generated.
 */
const narrative = (record: GetEntityRecordResponse): string[] => {
  const sentences: string[] = [];
  const city = asText(valueOf(record, 'firm.city'));
  const state = asText(valueOf(record, 'firm.state'));
  const employees = asNumber(valueOf(record, 'firm.employee_count'));
  const advisory = asNumber(valueOf(record, 'firm.advisory_employee_count'));
  const offices = asNumber(valueOf(record, 'firm.office_count'));

  const place = [city, state].filter(Boolean).join(', ');

  if (place) {
    sentences.push(`Headquartered in ${place}.`);
  }

  if (offices !== null) {
    sentences.push(
      `Reports ${offices.toLocaleString()} office${offices === 1 ? '' : 's'}.`,
    );
  }

  if (employees !== null) {
    sentences.push(
      advisory === null
        ? `Employs ${employees.toLocaleString()}.`
        : `Employs ${employees.toLocaleString()}, of whom ${advisory.toLocaleString()} perform advisory functions.`,
    );
  }

  return sentences;
};

const compactMoney = (value: string | null): string =>
  value === null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        compactDisplay: 'short',
        currency: 'USD',
        maximumFractionDigits: 1,
        notation: 'compact',
        style: 'currency',
      }).format(Number(value));

/** ranked by assets, which is the figure a recruiter is actually comparing */
const clientRows = (
  types: {
    code: string;
    label: string | null;
    clientCount: number | null;
    fewerThanFive: boolean | null;
    regulatoryAum: string | null;
  }[],
): RankedRow[] =>
  types
    .filter((type) => type.fewerThanFive || (type.clientCount ?? 0) > 0)
    .map((type) => ({
      key: type.code,
      label: type.label ?? type.code,
      value: type.regulatoryAum === null ? null : Number(type.regulatoryAum),
      display: compactMoney(type.regulatoryAum),
      meta: formatClientTypeCount(type),
    }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

export const OverviewTab = ({
  record,
  firmCrd,
}: {
  record: GetEntityRecordResponse;
  firmCrd: string | null;
}) => {
  const query = useQuery({
    ...firmProfileQuery(firmCrd ?? ''),
    enabled: !!firmCrd,
  });
  const sentences = narrative(record);
  const profile = query.data;

  return (
    <>
      {sentences.length > 0 ? (
        <p className={prose}>{sentences.join(' ')}</p>
      ) : null}

      {firmCrd && query.isPending ? <TabLoading rows={3} /> : null}

      {profile ? (
        <>
          <h2 className={heading}>Reported clients</h2>
          <p className={prose}>
            {formatReportedClients(profile.reportedClients)}
            {profile.reportedClients.quality === 'bounded_range'
              ? ' (reported as fewer than five)'
              : ''}
          </p>

          <h2 className={heading}>Client types</h2>
          {/*
            Zero here is a reported zero: the ADV asks about all 13 categories,
            so an entry with no clients was answered, not skipped. Only the
            answered-positive ones are shown, ranked by the assets behind them.
          */}
          <RankedBars rows={clientRows(profile.clientTypes)} />

          <h2 className={heading}>Services</h2>
          <div>
            {profile.services.map((s) => (
              <span className={chip} key={s.code}>
                {s.label ?? s.code}
              </span>
            ))}
          </div>

          <h2 className={heading}>Fee structure</h2>
          {profile.feeMethods.length === 0 ? (
            // absent from the ERA form entirely, so silence is not "no fees"
            <p className={css({ color: 'text.muted', fontSize: '1' })}>
              This filing does not report fee methods.
            </p>
          ) : (
            <div>
              {profile.feeMethods.map((f) => (
                <span className={chip} key={f.code}>
                  {f.label ?? f.code}
                </span>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
};
