import { css } from '@riascout-ui/styled-system/css';
import { useState, type ReactNode } from 'react';

import { stringToDesignSystemColor } from '../../../../lib/color';
import { ColorBadge } from '../../../../ui/blocks/colored-elements';

/**
 * One renderer per AttributeType, mirroring the backend's operator registry.
 * Keyed by type rather than by column, so a new allowlisted column renders
 * correctly without a new component.
 */
export type CodeOption = { value: string; label: string };

export type RendererProps = {
  value: unknown;
  /** value/label pairs for a closed vocabulary; the code is the fallback */
  options?: CodeOption[];
};

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

/**
 * One row's worth. The grid clips rather than wraps because a wrapped cell would
 * change row height, so the overflow count carries what does not fit.
 */
const Tags = ({ value, options }: RendererProps) => {
  if (!Array.isArray(value) || value.length === 0) {
    return <Blank />;
  }

  return (
    <>
      {value.slice(0, 3).map((v) => (
        <span className={css({ mr: '1' })} key={String(v)}>
          <Badge code={String(v)} options={options} />
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
const ACRONYMS = new Set([
  'RIA',
  'BD',
  'ERA',
  'SEC',
  'AUM',
  'CRD',
  'US',
  'IAR',
]);

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
 *
 * The dimension's own label wins where one arrived. Which fallback applies when
 * it did not depends on the column, hence `humanise`.
 */
const Badge = ({
  code,
  options,
  humanise = true,
}: {
  code: string;
  options?: CodeOption[];
  humanise?: boolean;
}) => {
  const label =
    options?.find((option) => option.value === code)?.label ??
    (humanise ? formatCode(code) : code);

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
      {label}
    </ColorBadge>
  );
};

const Chip = ({
  value,
  options,
  humanise,
}: RendererProps & { humanise: boolean }) =>
  isBlank(value) ? (
    <Blank />
  ) : (
    <Badge code={String(value)} humanise={humanise} options={options} />
  );

/** words split cleanly: pure_ria -> Pure RIA */
const CodeBadge = (props: RendererProps) => <Chip {...props} humanise />;

/**
 * Not words: 1b_5b humanises to "1b 5b", which is worse than the code itself.
 * These depend on the dimension label, and show the raw code when the ETL has
 * not populated market.facet_option yet.
 */
const DimBadge = (props: RendererProps) => <Chip {...props} humanise={false} />;

/** codes that read as words once split */
const CODE_COLUMNS = new Set([
  'advisor.disclosure_status',
  'advisor.firm_channel',
  'advisor.ownership_band',
  'firm.channel_code',
  'firm.primary_registration_type',
]);

/** codes that only a dimension can label */
const DIM_LABEL_COLUMNS = new Set(['advisor.firm_aum_band', 'firm.aum_band']);

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

  if (referenceColumn && DIM_LABEL_COLUMNS.has(referenceColumn)) {
    return isMultiValue ? Tags : DimBadge;
  }

  return rendererFor(type, isMultiValue);
};

/**
 * The record panel's multi-value renderer. It wraps rather than clipping — the
 * panel has no row height to preserve — and the overflow expands in place, so a
 * firm's full client-type list is reachable without leaving the page.
 */
export const TagList = ({
  value,
  options,
  max = 6,
}: RendererProps & { max?: number }) => {
  const [expanded, setExpanded] = useState(false);

  if (!Array.isArray(value) || value.length === 0) {
    return <Blank />;
  }

  const hidden = value.length - max;
  const shown = expanded ? value : value.slice(0, max);

  return (
    <div
      className={css({
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1',
        minW: '0',
      })}
    >
      {shown.map((v) => (
        <Badge code={String(v)} key={String(v)} options={options} />
      ))}
      {hidden > 0 ? (
        <button
          className={css({
            color: 'text.muted',
            cursor: 'pointer',
            fontSize: '1',
            _hover: { color: 'text.app' },
          })}
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          {expanded ? 'Show less' : `+${hidden}`}
        </button>
      ) : null}
    </div>
  );
};

export { Identifier, Blank };
