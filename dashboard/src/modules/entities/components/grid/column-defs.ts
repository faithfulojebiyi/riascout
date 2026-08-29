import type { ColDef } from 'ag-grid-enterprise';

import { isTypeEditable } from '../attribute-inputs/input-map';
import type { EntityViewField, GridRow } from '../../types/grid';
import { CellEditorAdapter } from './cell-editor-adapter';
import { CellRendererAdapter } from './cell-renderer-adapter';

const DEFAULT_WIDTH = 180;

/** numeric-ish types read better right-aligned and need less room */
const WIDTH_BY_TYPE: Record<string, number> = {
  number: 120,
  currency: 140,
  percentage: 110,
  rating: 100,
  boolean: 90,
  checkbox: 90,
  date: 130,
  timestamp: 150,
  url: 200,
};

/**
 * Columns come from the view, never from a hand-written config. The legacy app
 * had two ~8,000-line grid-config files with 140 duplicated fields between them.
 */
export const buildColumnDefs = (fields: EntityViewField[]): ColDef<GridRow>[] =>
  fields
    .filter((field) => field.isVisible)
    .map((field) => ({
      colId: field.fieldId,
      headerName: field.label,
      // ag-grid needs a field path for sorting; the renderer reads the map itself
      field: `cellsByAttributeId.${field.attributeId}` as never,
      width: field.width ?? WIDTH_BY_TYPE[field.type] ?? DEFAULT_WIDTH,
      pinned: field.isPinned ? ('left' as const) : undefined,
      // projected market columns have no cell to write, and a type with no
      // registered input cannot be edited safely
      editable: field.isEditable && isTypeEditable(field.type),
      sortable: true,
      resizable: true,
      cellRenderer: CellRendererAdapter,
      cellRendererParams: {
        attributeId: field.attributeId,
        attributeType: field.type,
        isMultiValue: false,
      },
      cellEditor: CellEditorAdapter,
      cellEditorParams: {
        attributeId: field.attributeId,
        attributeType: field.type,
        isMultiValue: false,
        label: field.label,
        choices: field.choices,
      },
    }));
