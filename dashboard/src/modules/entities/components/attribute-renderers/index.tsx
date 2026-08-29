import { css } from '@riascout-ui/styled-system/css';
import type { ReactNode } from 'react';

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
  fontSize: 'xs',
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

const Currency = ({ value }: RendererProps) =>
  isBlank(value) ? (
    <Blank />
  ) : (
    <span className={numeric}>
      {Number(value).toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
        notation: Number(value) >= 1_000_000 ? 'compact' : 'standard',
      })}
    </span>
  );

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

export { Identifier, Blank };
