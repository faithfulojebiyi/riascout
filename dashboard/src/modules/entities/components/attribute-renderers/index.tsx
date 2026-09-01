import { css } from '@riascout-ui/styled-system/css';
import type { ReactNode } from 'react';

import { stringToDesignSystemColor } from '../../../../lib/color';
import { ColorBadge } from '../../../../ui/blocks/colored-elements';

/**
 * One renderer per AttributeType, mirroring the backend's operator registry.
 * Keyed by type rather than by column, so a new allowlisted column renders
 * correctly without a new component.
 */
export type RendererProps = { value: unknown };

const muted = css({ color: 'text.placeholder' });
const numeric = css({ fontVariantNumeric: 'tabular-nums', textAlign: 'right' });
const chip = css({
  bg: 'background.muted',
  borderRadius: 'md',
  display: 'inline-block',
  fontSize: '1',
  mr: '1',
  px: '1.5',
  py: '0.5',
});

const isBlank = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/** a blank cell must read as "no data", never as a zero or a false */
const Blank = () => <span className={muted}>—</span>;

const Text = ({ value }: RendererProps) =>
  isBlank(value) ? <Blank /> : <>{String(value)}</>;

const Numeric = ({ value }: RendererProps) =>
  isBlank(value) ? (
    <Blank />
  ) : (
    <span className={numeric}>{Number(value).toLocaleString()}</span>
  );

/**
 * Locale is pinned: the runtime's own renders USD as "US$1bn". A compact figure
 * also keeps one decimal, or $1.0B and $1.4B collapse onto the same string.
 */
const Currency = ({ value }: RendererProps) => {
  if (isBlank(value)) {
    return <Blank />;
  }

  const amount = Number(value);
  const compact = Math.abs(amount) >= 1_000_000;

  return (
    <span className={numeric}>
      {amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : 0,
      })}
    </span>
  );
};

const Percentage = ({ value }: RendererProps) =>
  isBlank(value) ? (
    <Blank />
  ) : (
    <span className={numeric}>{Number(value).toFixed(1)}%</span>
  );

const Bool = ({ value }: RendererProps) =>
  // null is genuinely different from false and must not render as "No"
  value === null || value === undefined ? (
    <Blank />
  ) : (
    <>{value ? 'Yes' : 'No'}</>
  );

const DateCell = ({ value }: RendererProps) =>
  isBlank(value) ? (
    <Blank />
  ) : (
    <>
      {new Date(String(value)).toLocaleDateString(undefined, {
        dateStyle: 'medium',
      })}
    </>
  );

const Tags = ({ value }: RendererProps) => {
  if (!Array.isArray(value) || value.length === 0) {
    return <Blank />;
  }

  return (
    <>
      {value.slice(0, 3).map((v) => (
        <span className={chip} key={String(v)}>
          {String(v)}
        </span>
      ))}
      {value.length > 3 ? (
        <span className={muted}>+{value.length - 3}</span>
      ) : null}
    </>
  );
};

const Url = ({ value }: RendererProps) =>
  isBlank(value) ? (
    <Blank />
  ) : (
    <a
      href={String(value)}
      rel="noreferrer noopener"
      target="_blank"
      className={css({ textDecoration: 'underline' })}
      onClick={(e) => e.stopPropagation()}
    >
      {String(value).replace(/^https?:\/\/(www\.)?/, '')}
    </a>
  );

const Identifier = ({ value }: RendererProps) =>
  // a CRD is an identifier, not a quantity: no thousands separators to copy wrong
  isBlank(value) ? <Blank /> : <span className={numeric}>{String(value)}</span>;

export const ATTRIBUTE_RENDERERS: Record<
  string,
  (p: RendererProps) => ReactNode
> = {
  text: Text,
  email: Text,
  phone: Text,
  domain: Text,
  location: Text,
  country: Text,
  url: Url,

  number: Numeric,
  currency: Currency,
  percentage: Percentage,
  rating: Numeric,

  date: DateCell,
  timestamp: DateCell,

  boolean: Bool,
  checkbox: Bool,

  status: Tags,
  select: Tags,
  user: Text,
  record: Text,
  relationship: Tags,
  file: Text,
};

export const rendererFor = (type: string, isMultiValue = false) =>
  isMultiValue ? Tags : (ATTRIBUTE_RENDERERS[type] ?? Text);

/** the codes are lowercase slugs; these read wrong title-cased */
const ACRONYMS = new Set(['RIA', 'BD', 'ERA', 'SEC', 'AUM', 'CRD', 'US', 'IAR']);

/** `pure_ria` -> `Pure RIA`; the raw slug is not a label */
const formatCode = (value: string): string =>
  value
    .split('_')
    .map((word) => {
      const upper = word.toUpperCase();

      return ACRONYMS.has(upper)
        ? upper
        : word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

/**
 * A closed vocabulary reads as a chip, not as raw text — and the colour is
 * derived from the code, so the same channel is the same colour everywhere
 * without anyone maintaining a palette.
 */
const CodeBadge = ({ value }: RendererProps) => {
  if (isBlank(value)) {
    return <Blank />;
  }

  const code = String(value);

  return (
    // ColorBadge is a block by default, so in a cell it stretched the full width
    <ColorBadge
      alignItems="center"
      color={stringToDesignSystemColor(code)}
      display="inline-flex"
      h="1.125rem"
      lineHeight="1"
      maxW="full"
      overflow="hidden"
      px="1.5"
      rounded="md"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
      w="fit-content"
    >
      {formatCode(code)}
    </ColorBadge>
  );
};

/** columns whose values are enum codes rather than free text */
const CODE_COLUMNS = new Set([
  'advisor.disclosure_status',
  'advisor.firm_channel',
  'advisor.ownership_band',
  'firm.channel_code',
  'firm.primary_registration_type',
]);

/**
 * CRDs are typed `number` because they sort and filter numerically, but they are
 * identifiers — 104,559 is a firm you cannot look up, and the separators get
 * copied into a search box. Keyed by allowlist key, since the type cannot say it.
 */
const IDENTIFIER_COLUMNS = new Set([
  'advisor.advisor_crd',
  'advisor.current_firm_crd',
  'advisor.previous_firm_crd',
  'advisor.previous_firm_crds',
  'firm.firm_crd',
  'firm.affiliated_crds',
]);

/** as rendererFor, but an identifier column wins over its numeric type */
export const rendererForColumn = (
  referenceColumn: string | null | undefined,
  type: string,
  isMultiValue = false,
) => {
  if (referenceColumn && IDENTIFIER_COLUMNS.has(referenceColumn)) {
    return isMultiValue ? Tags : Identifier;
  }

  if (referenceColumn && CODE_COLUMNS.has(referenceColumn)) {
    return isMultiValue ? Tags : CodeBadge;
  }

  return rendererFor(type, isMultiValue);
};

export { Identifier, Blank };
