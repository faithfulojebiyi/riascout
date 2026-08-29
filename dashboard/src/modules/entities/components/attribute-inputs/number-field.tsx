import { NumberInput } from '../../../../ui/primitives/number-input';
import { asNumber, type AttributeFieldProps } from './types';

/** currency and percentage differ only in prefix/suffix, so one field serves */
const makeNumberField = (opts: { prefix?: string; suffix?: string } = {}) =>
  function NumberField({
    label,
    value,
    onChange,
    isEditable,
    isDisabled,
    autoFocus,
  }: AttributeFieldProps) {
    return (
      <NumberInput
        autoFocus={autoFocus}
        defaultValue={asNumber(value) ?? undefined}
        disabled={isDisabled || !isEditable}
        // NumericFormat renders thousand separators, so strip before parsing
        onBlur={(event) =>
          onChange(asNumber(event.target.value.replace(/[^0-9.-]/g, '')))
        }
        placeholder={isEditable ? `Set ${label}` : label}
        prefix={opts.prefix}
        suffix={opts.suffix}
      />
    );
  };

export const NumberField = makeNumberField();
export const CurrencyField = makeNumberField({ prefix: '$' });
export const PercentageField = makeNumberField({ suffix: '%' });
