import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/primitives/select';
import { asString, type AttributeFieldProps } from './types';

/** choices come from entity_attribute_choice, never from a hardcoded list */
export const SelectField = ({
  label,
  value,
  onChange,
  isEditable,
  isDisabled,
  choices = [],
}: AttributeFieldProps) => {
  const current = asString(value);

  return (
    <Select
      defaultValue={current === '' ? undefined : current}
      disabled={isDisabled || !isEditable}
      onValueChange={(next) => onChange(next === '' ? null : next)}
    >
      <SelectTrigger>
        <SelectValue placeholder={isEditable ? `Set ${label}` : label} />
      </SelectTrigger>
      <SelectContent>
        {choices.map((choice) => (
          <SelectItem key={choice.id} value={choice.name}>
            {choice.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
