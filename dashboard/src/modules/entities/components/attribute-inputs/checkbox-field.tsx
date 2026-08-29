import { Checkbox } from '../../../../ui/primitives/checkbox/checkbox';
import { asBoolean, type AttributeFieldProps } from './types';

export const CheckboxField = ({
  value,
  onChange,
  isEditable,
  isDisabled,
}: AttributeFieldProps) => (
  <Checkbox
    defaultChecked={asBoolean(value)}
    disabled={isDisabled || !isEditable}
    onCheckedChange={(checked: boolean | 'indeterminate') =>
      onChange(checked === true)
    }
  />
);
