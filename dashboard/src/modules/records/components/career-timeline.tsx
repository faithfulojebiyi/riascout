import { Link } from '@tanstack/react-router';
import { css } from '@riascout-ui/styled-system/css';
import { Flex } from '@riascout-ui/styled-system/jsx';

import type { AdvisorStint } from '../../../api/generated/rIAScoutAPI.schemas';

const link = css({
  _hover: { color: 'text.app' },
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
});

const label = css({
  fontSize: '1',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const year = (iso: string) => new Date(iso).getFullYear();

const span = (stint: AdvisorStint): string => {
  if (!stint.startedOn) {
    return stint.isCurrent ? 'Current, start unknown' : 'Dates unknown';
  }

  return stint.isCurrent
    ? `${year(stint.startedOn)} – present`
    : `${year(stint.startedOn)} – ${stint.endedOn ? year(stint.endedOn) : '?'}`;
};

/**
 * A career read across one shared time axis, which a list of date ranges cannot
 * give: overlapping registrations and gaps between firms are the two things a
 * recruiter is looking for, and both are shape rather than digits.
 *
 * A stint with no start date is listed but drawn as no bar. Anchoring it to the
 * axis start would invent a date the registration never carried.
 */
export const CareerTimeline = ({ stints }: { stints: AdvisorStint[] }) => {
  const dated = stints.filter((stint) => stint.startedOn !== null);

  if (dated.length === 0) {
    return null;
  }

  const now = Date.now();
  const starts = dated.map((stint) => Date.parse(stint.startedOn as string));
  const ends = dated.map((stint) =>
    stint.isCurrent || !stint.endedOn ? now : Date.parse(stint.endedOn),
  );
  const min = Math.min(...starts);
  const max = Math.max(...ends, now);
  const range = Math.max(max - min, 1);

  return (
    <div className={css({ display: 'grid', gap: '2.5', w: 'full' })}>
      {stints.map((stint, index) => {
        const start = stint.startedOn ? Date.parse(stint.startedOn) : null;
        const end =
          stint.isCurrent || !stint.endedOn
            ? now
            : Date.parse(stint.endedOn);

        return (
          <div key={`${stint.firmCrd}-${index}`}>
            <Flex align="baseline" gap="3" justify="space-between" pb="1">
              <span className={label} title={stint.firmName ?? stint.firmCrd}>
                {stint.recordId ? (
                  <Link
                    className={link}
                    params={{ recordId: stint.recordId }}
                    to="/record/$recordId"
                  >
                    {stint.firmName ?? `CRD #${stint.firmCrd}`}
                  </Link>
                ) : (
                  (stint.firmName ?? `CRD #${stint.firmCrd}`)
                )}
              </span>
              <span
                className={css({
                  color: 'text.muted',
                  flexShrink: '0',
                  fontSize: '0',
                })}
              >
                {span(stint)}
              </span>
            </Flex>
            <div
              className={css({
                bg: 'background.muted',
                borderRadius: 'sm',
                h: '0.5rem',
                position: 'relative',
                w: 'full',
              })}
            >
              {start === null ? null : (
                <div
                  className={css({
                    borderRadius: 'sm',
                    h: 'full',
                    position: 'absolute',
                  })}
                  style={{
                    background: stint.isCurrent
                      ? 'var(--riascout-colors-brand-success-9)'
                      : 'var(--riascout-colors-brand-info-9)',
                    left: `${((start - min) / range) * 100}%`,
                    // a same-day stint would otherwise be invisible
                    width: `${Math.max(((end - start) / range) * 100, 0.75)}%`,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
      <Flex color="text.muted" fontSize="0" justify="space-between" pt="1">
        <span>{new Date(min).getFullYear()}</span>
        <span>{new Date(max).getFullYear()}</span>
      </Flex>
    </div>
  );
};
