import { BooleanField } from './boolean-field';
import { CheckboxField } from './checkbox-field';
import { DateField } from './date-field';
import { CurrencyField, NumberField, PercentageField } from './number-field';
import { RatingField } from './rating-field';
import { SelectField } from './select-field';
import { EmailField, PhoneField, TextField, UrlField } from './text-field';
import type { AttributeInput } from './types';

/**
 * The write half of the renderer registry, keyed by AttributeType. record,
 * relationship, user and file are deliberately absent — they need pickers that
 * do not exist yet, and an unmapped type reads as read-only rather than
 * silently falling back to a text box that would corrupt the cell.
 */
export const ATTRIBUTE_INPUTS: Record<string, AttributeInput> = {
  boolean: BooleanField,
  checkbox: CheckboxField,
  country: TextField,
  currency: CurrencyField,
  date: DateField,
  domain: TextField,
  email: EmailField,
  location: TextField,
  number: NumberField,
  percentage: PercentageField,
  phone: PhoneField,
  rating: RatingField,
  select: SelectField,
  status: SelectField,
  text: TextField,
  timestamp: DateField,
  url: UrlField,
};

export const inputFor = (type: string): AttributeInput | null =>
  ATTRIBUTE_INPUTS[type] ?? null;

export const isTypeEditable = (type: string): boolean =>
  type in ATTRIBUTE_INPUTS;
