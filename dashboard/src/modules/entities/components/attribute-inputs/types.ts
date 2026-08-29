import type { ReactNode } from 'react';

export type AttributeChoice = {
  id: string;
  name: string;
  color: string | null;
};

/**
 * Values cross this boundary as unknown and each field narrows its own, matching
 * the renderer registry. A generic prop cannot work here: onChange is a function
 * property, so the registry's value type ends up covariant and no single
 * instantiation accepts every field.
 */
export type AttributeFieldProps = {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  isEditable: boolean;
  isDisabled?: boolean;
  choices?: AttributeChoice[];
  autoFocus?: boolean;
};

export type AttributeInput = (props: AttributeFieldProps) => ReactNode;

export const asString = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

/** an unparseable number is absent, not zero */
export const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

export const asBoolean = (value: unknown): boolean => value === true;
