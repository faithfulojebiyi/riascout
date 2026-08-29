import type { CustomCellEditorProps } from 'ag-grid-react';
import { useEffect } from 'react';

import { inputFor } from '../attribute-inputs/input-map';
import type { AttributeChoice } from '../attribute-inputs/types';
import type { GridRow } from '../../types/grid';

export type CellEditorParams = CustomCellEditorProps<GridRow> & {
  attributeType: string;
  isMultiValue: boolean;
  choices?: AttributeChoice[];
  label: string;
};

/**
 * Bridges ag-grid's editor API to the type-keyed input registry. The field
 * commits through onValueChange; ag-grid then fires onCellValueChanged, which is
 * where the write actually happens.
 */
export const CellEditorAdapter = (params: CellEditorParams) => {
  const Input = inputFor(params.attributeType);
  const canEdit = Input !== null && !params.isMultiValue;
  const { stopEditing } = params;

  /**
   * An unmapped type has no safe editor, so cancel rather than offer a text box
   * that would corrupt the cell. In an effect, not in render — column-defs
   * already blocks these, so this only ever runs as a backstop.
   */
  useEffect(() => {
    if (!canEdit) stopEditing(true);
  }, [canEdit, stopEditing]);

  if (!Input || params.isMultiValue) return null;

  return (
    <Input
      autoFocus
      choices={params.choices}
      isEditable
      label={params.label}
      onChange={(next) => {
        params.onValueChange(next);
        params.stopEditing();
      }}
      value={params.value}
    />
  );
};
