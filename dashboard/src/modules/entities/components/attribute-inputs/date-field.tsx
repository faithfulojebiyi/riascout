import { Input } from '../../../../ui/primitives/input';
import { asString, type AttributeFieldProps } from './types';

/** the native date input is keyboard-first, which beats a picker in a grid */
export const DateField = ({
  label,
  value,
  onChange,
  isEditable,
  isDisabled,
  autoFocus,
}: AttributeFieldProps) => (
  <Input
    autoFocus={autoFocus}
    defaultValue={asString(value).slice(0, 10)}
    disabled={isDisabled || !isEditable}
    onBlur={(event) =>
      onChange(event.target.value === '' ? null : event.target.value)
    }
    placeholder={isEditable ? `Set ${label}` : label}
    type="date"
  />
);
