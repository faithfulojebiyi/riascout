import { Input } from '../../../../ui/primitives/input';
import { asString, type AttributeFieldProps } from './types';

/**
 * Covers text, email, phone, url, domain, location and country — the html type
 * differs, the commit behaviour does not. Blur-commit rather than per keystroke:
 * a cell write is a round trip with a version check.
 */
const makeTextField = (type: string) =>
  function TextField({
    label,
    value,
    onChange,
    isEditable,
    isDisabled,
    autoFocus,
  }: AttributeFieldProps) {
    return (
      <Input
        autoFocus={autoFocus}
        defaultValue={asString(value)}
        disabled={isDisabled || !isEditable}
        onBlur={(event) =>
          onChange(event.target.value === '' ? null : event.target.value)
        }
        placeholder={isEditable ? `Set ${label}` : label}
        type={type}
      />
    );
  };

export const TextField = makeTextField('text');
export const EmailField = makeTextField('email');
export const PhoneField = makeTextField('tel');
export const UrlField = makeTextField('url');
