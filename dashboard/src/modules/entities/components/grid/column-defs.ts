import type { ColDef } from 'ag-grid-enterprise';

import type { EntityViewField, GridRow } from '../../types/grid';
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
      // projected market columns have no cell to write
      editable: field.isEditable,
      sortable: true,
      resizable: true,
      cellRenderer: CellRendererAdapter,
      cellRendererParams: {
        attributeId: field.attributeId,
        attributeType: field.type,
        isMultiValue: false,
      },
    }));
