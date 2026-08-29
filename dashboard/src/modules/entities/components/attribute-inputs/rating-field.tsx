import { StarRating } from '../../../../ui/primitives/star-rating';
import { asNumber, type AttributeFieldProps } from './types';

/**
 * StarRating fires onValueChange from a mount effect, so an unguarded handler
 * would write the existing value back on every open. Only a real change commits.
 */
export const RatingField = ({
  value,
  onChange,
  isEditable,
  isDisabled,
}: AttributeFieldProps) => {
  const current = asNumber(value) ?? 0;

  return (
    <StarRating
      disabled={isDisabled || !isEditable}
      onValueChange={(next) => {
        const parsed = Number(next);

        if (parsed !== current) onChange(parsed === 0 ? null : parsed);
      }}
      value={String(current)}
    />
  );
};
