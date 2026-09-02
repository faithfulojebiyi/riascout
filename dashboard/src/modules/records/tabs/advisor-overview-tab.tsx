import { css } from '@riascout-ui/styled-system/css';

import type { GetEntityRecordResponse } from '../../../api/generated/rIAScoutAPI.schemas';
import { valueOf } from '../record-values';

const prose = css({ fontSize: '2', lineHeight: 'relaxed', maxW: '46rem' });

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const asNumber = (value: unknown): number | null => {
  const parsed = Number(value);

  return value === null || value === undefined || Number.isNaN(parsed)
    ? null
    : parsed;
};

const years = (value: number | null, noun: string): string | null =>
  value === null ? null : `${value} ${noun}${value === 1 ? '' : 's'}`;

/**
 * Composed only from filed fields, each clause dropped when its field is null.
 *
 * Tenure is deliberately conditional: an observation-backed affiliation has no
 * start date, so the projection leaves tenure null rather than guessing, and a
 * sentence claiming "0 years" would be a fabrication.
 */
const narrative = (record: GetEntityRecordResponse): string[] => {
  const sentences: string[] = [];
  const firm = asText(valueOf(record, 'advisor.current_firm_name'));
  const city = asText(valueOf(record, 'advisor.city'));
  const state = asText(valueOf(record, 'advisor.state'));
  const tenure = years(asNumber(valueOf(record, 'advisor.tenure_years')), 'year');
  const experience = years(
    asNumber(valueOf(record, 'advisor.experience_years')),
    'year',
  );
  const previousFirms = asNumber(valueOf(record, 'advisor.previous_firm_count'));
  const place = [city, state].filter(Boolean).join(', ');

  if (firm) {
    sentences.push(
      tenure ? `Registered at ${firm} for ${tenure}.` : `Registered at ${firm}.`,
    );
  }

  if (place) {
    sentences.push(`Works out of ${place}.`);
  }

  if (experience) {
    sentences.push(`${experience} in the industry.`);
  }

  if (previousFirms !== null && previousFirms > 0) {
    sentences.push(
      `Previously registered at ${previousFirms} other firm${previousFirms === 1 ? '' : 's'}.`,
    );
  }

  return sentences;
};

export const AdvisorOverviewTab = ({
  record,
}: {
  record: GetEntityRecordResponse;
}) => {
  const sentences = narrative(record);

  if (sentences.length === 0) {
    return null;
  }

  return <p className={prose}>{sentences.join(' ')}</p>;
};
