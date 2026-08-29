import { Switch } from '../../../../ui/primitives/switch';
import { asBoolean, type AttributeFieldProps } from './types';

/**
 * A switch is two-state, but the cell is three: true, false, and no data. An
 * unset boolean shows as off, so only an explicit toggle writes a value.
 */
export const BooleanField = ({
  value,
  onChange,
  isEditable,
  isDisabled,
}: AttributeFieldProps) => (
  <Switch
    defaultChecked={asBoolean(value)}
    disabled={isDisabled || !isEditable}
    onCheckedChange={(checked) => onChange(checked)}
  />
);
