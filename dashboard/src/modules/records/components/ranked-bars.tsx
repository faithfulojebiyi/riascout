import { css } from '@riascout-ui/styled-system/css';
import { Flex } from '@riascout-ui/styled-system/jsx';

export type RankedRow = {
  key: string;
  label: string;
  /** null is unknown; the row still lists, it just has no bar */
  value: number | null;
  /** the figure as it should read, already formatted */
  display: string;
  /** a secondary figure, e.g. the client count behind an AUM bar */
  meta?: string;
};

const label = css({
  fontSize: '1',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const track = css({
  bg: 'background.muted',
  borderRadius: 'sm',
  h: '0.5rem',
  overflow: 'hidden',
  w: 'full',
});

/**
 * A share-of-total read, which a chip list cannot give: the bar is scaled
 * against the largest row, so the gap between a firm's biggest client type and
 * the rest is visible at a glance rather than inferred from the digits.
 *
 * Rows with an unknown value keep their place and show no bar, so "not
 * reported" never reads as "smallest".
 */
export const RankedBars = ({ rows }: { rows: RankedRow[] }) => {
  const max = Math.max(...rows.map((row) => row.value ?? 0), 0);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className={css({ display: 'grid', gap: '2.5', w: 'full' })}>
      {rows.map((row) => (
        <div key={row.key}>
          <Flex align="baseline" gap="3" justify="space-between" pb="1">
            <span className={label} title={row.label}>
              {row.label}
            </span>
            <Flex align="baseline" flexShrink="0" gap="2">
              {row.meta ? (
                <span className={css({ color: 'text.muted', fontSize: '0' })}>
                  {row.meta}
                </span>
              ) : null}
              <span
                className={css({
                  fontSize: '1',
                  fontVariantNumeric: 'tabular-nums',
                })}
              >
                {row.display}
              </span>
            </Flex>
          </Flex>
          <div className={track}>
            {row.value === null || max === 0 ? null : (
              <div
                className={css({ bg: 'brand.solid', h: 'full' })}
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
