import { css } from '@riascout-ui/styled-system/css';

import { Skeleton } from '../../../ui/primitives/skeleton';

const note = css({ color: 'text.muted', fontSize: '1', py: '6' });

/**
 * The three states a market tab can be in, kept distinct on purpose.
 *
 * "Never filed" is not "reported nothing": 29,560 firms are known only as an
 * adviser's employer and have no ADV at all, so rendering them as zero offices
 * or zero AUM would assert something the filings never said.
 */
export const NoMarketLink = () => (
  <p className={note}>This record is not linked to a firm in market data.</p>
);

export const NeverFiled = () => (
  <p className={note}>This firm has never filed a Form ADV.</p>
);

export const NothingReported = ({ what }: { what: string }) => (
  <p className={note}>The current filing reported no {what}.</p>
);

export const TabLoading = ({ rows = 6 }: { rows?: number }) => (
  <div className={css({ display: 'grid', gap: '2', py: '2' })}>
    {Array.from({ length: rows }, (_, row) => (
      <Skeleton h="1rem" key={`tab-skeleton-${row}`} w={row % 2 ? '62%' : '84%'} />
    ))}
  </div>
);
