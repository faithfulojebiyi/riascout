import { css } from '@riascout-ui/styled-system/css';

const muted = css({ color: 'text.placeholder' });

/**
 * Money arrives as a decimal string because numeric(20,2) overflows a double.
 * Number() is safe only for display, where the magnitude is what matters.
 *
 * null renders as an em-dash, never $0: roughly a quarter of filings do not
 * report AUM, and "not reported" is not "holds nothing".
 */
export const Money = ({ value }: { value: string | null }) => {
  if (value === null) {
    return <span className={muted}>—</span>;
  }

  return (
    <span className={css({ fontVariantNumeric: 'tabular-nums' })}>
      {new Intl.NumberFormat('en-US', {
        compactDisplay: 'short',
        currency: 'USD',
        maximumFractionDigits: 1,
        notation: 'compact',
        style: 'currency',
      }).format(Number(value))}
    </span>
  );
};
