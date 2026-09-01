import type { ColDef } from 'ag-grid-enterprise';

import { GRID_DEFAULT_COL_WIDTH } from '../../../../ui/primitives/data-grid/constants/sizing';

import { isTypeEditable } from '../attribute-inputs/input-map';
import type { EntityViewField, GridRow } from '../../types/grid';
import { CellEditorAdapter } from './cell-editor-adapter';
import { CellRendererAdapter } from './cell-renderer-adapter';
import { GridColumnHeader } from './grid-column-header';
// view metadata keeps rendering and query behavior aligned
export const buildColumnDefs = (
  fields: EntityViewField[],
  header: {
    viewId: string;
    sortedAttributeId: string | null;
    sortDirection: 'asc' | 'desc' | null;
  },
): ColDef<GridRow>[] =>
  fields
    .filter((field) => field.isVisible)
    .map((field) => ({
      colId: field.fieldId,
      headerName: field.label,
      headerComponent: GridColumnHeader,
      headerComponentParams: {
        field,
        viewId: header.viewId,
        sortDirection:
          header.sortedAttributeId === field.attributeId
            ? header.sortDirection
            : null,
      },
      // ag-grid needs a field path for sorting; the renderer reads the map itself
      field: `cellsByAttributeId.${field.attributeId}` as never,
      // one flat starting width; a user-resized column persists field.width
      width: field.width ?? GRID_DEFAULT_COL_WIDTH,
      pinned: field.isPinned ? ('left' as const) : undefined,
      // projected market columns have no cell to write, and a type with no
      // registered input cannot be edited safely
      editable: field.isEditable && isTypeEditable(field.type),
      // the header menu sorts, and persists it to the view
      resizable: true,
      cellRenderer: CellRendererAdapter,
      cellRendererParams: {
        attributeId: field.attributeId,
        attributeType: field.type,
        referenceColumn: field.referenceColumn,
        options: field.options,
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
