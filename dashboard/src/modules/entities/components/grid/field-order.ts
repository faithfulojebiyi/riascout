import type { EntityViewField } from '../../types/grid';

/**
 * The order the grid actually renders in. ag-grid puts pinned columns first
 * regardless of position, so sorting by position alone made view settings
 * disagree with the table it configures.
 */
export const orderedVisibleFields = (
  fields: EntityViewField[],
): EntityViewField[] => {
  const visible = fields.filter((field) => field.isVisible);

  return [
    ...visible.filter((field) => field.isPinned),
    ...visible.filter((field) => !field.isPinned),
  ];
};

/** pinned columns are locked to the front, so only the rest can be dragged */
export const pinnedCount = (fields: EntityViewField[]): number =>
  fields.filter((field) => field.isVisible && field.isPinned).length;
