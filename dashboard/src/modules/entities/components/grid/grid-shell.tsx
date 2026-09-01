import {
  type CellValueChangedEvent,
  type GridApi,
  type GridReadyEvent,
  type SelectionChangedEvent,
  themeAlpine,
} from 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  GRID_ROW_HEIGHT,
  GridWrapper,
} from '../../../../ui/primitives/data-grid';
import { useUpdateRecordValues } from '../../mutations/use-update-record-values';
import type { EntityViewSummary, GridRow } from '../../types/grid';
import { buildColumnDefs } from './column-defs';
import { EntityGridDatasource } from './ssrm-datasource';

export type EntityGridProps = {
  entityId: string;
  view: EntityViewSummary;
  /** ticked rows, lifted so the toolbar can act on them */
  onSelectionChange?: (sourceCrds: string[]) => void;
};

/**
 * Server-side row model, not client-side: 510k advisors will not fit in the
 * browser, and the projection is already paged and sorted in postgres.
 *
 * AgGridReact directly rather than the DataGrid primitive, which hardcodes
 * sortable/resizable false and suppressColumnVirtualisation — all wrong for 63
 * columns over 510k rows. Only GridWrapper, the theme layer, is shared.
 */
export const EntityGrid = ({
  entityId,
  view,
  onSelectionChange,
}: EntityGridProps) => {
  const updateRecordValues = useUpdateRecordValues();

  // single-column sort is what the header menu offers; the rest is view settings
  const activeSort = view.sort[0];

  const columnDefs = useMemo(
    () =>
      buildColumnDefs(view.fields, {
        viewId: view.id,
        sortedAttributeId: activeSort?.path[0]?.attributeId ?? null,
        sortDirection: activeSort?.direction ?? null,
      }),
    [view.fields, view.id, activeSort],
  );

  const visibleFieldIds = useMemo(
    () => view.fields.filter((f) => f.isVisible).map((f) => f.fieldId),
    [view.fields],
  );

  // read at call time rather than captured, so scrolling to a new column
  // widens the fetch without rebuilding the datasource
  const visibleFieldIdsRef = useRef<string[]>(visibleFieldIds);
  const gridApiRef = useRef<GridApi<GridRow> | null>(null);

  /**
   * The server drops any attribute not named in visibleFieldIds, so this ref has
   * to track the view. A useRef initialiser runs once, and the columnVisible
   * event that used to update it never fires — buildColumnDefs omits hidden
   * fields rather than marking them hidden — so a newly added column fetched
   * nothing and rendered blank until a full page load.
   *
   * Cached blocks were fetched without it too, hence the purge.
   */
  useEffect(() => {
    visibleFieldIdsRef.current = visibleFieldIds;
    gridApiRef.current?.refreshServerSide({ purge: true });
  }, [visibleFieldIds]);

  const datasource = useMemo(
    () =>
      new EntityGridDatasource({
        entityId,
        viewId: view.id,
        visibleFieldIds: () => visibleFieldIdsRef.current,
      }),
    [entityId, view.id],
  );

  /**
   * Only rows pointing at market have a CRD, so a manually created record is
   * selectable but contributes nothing to a list add.
   */
  const onSelectionChanged = useCallback(
    (event: SelectionChangedEvent<GridRow>) => {
      onSelectionChange?.(
        event.api
          .getSelectedRows()
          .map((row) => row.sourceCrd)
          .filter((crd): crd is string => crd !== null),
      );
    },
    [onSelectionChange],
  );

  /**
   * ag-grid has already applied the new value to the row node by the time this
   * fires, so a failed write must put the old one back — otherwise the grid
   * shows an edit that was never persisted.
   */
  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<GridRow>) => {
      const attributeId = event.colDef.cellEditorParams?.attributeId;
      const recordId = event.data?.id;

      if (!attributeId || !recordId || event.newValue === event.oldValue)
        return;

      updateRecordValues.mutate(
        { recordId, values: [{ attributeId, value: event.newValue }] },
        {
          onError: () => {
            event.node.setDataValue(event.column.getColId(), event.oldValue);
          },
        },
      );
    },
    [updateRecordValues],
  );

  const onGridReady = useCallback((event: GridReadyEvent<GridRow>) => {
    gridApiRef.current = event.api;
  }, []);

  return (
    <GridWrapper borderless>
      <AgGridReact<GridRow>
        cacheBlockSize={100}
        columnDefs={columnDefs}
        /**
         * Our header owns sorting and column actions. ag-grid's own menu offers
         * pinning, autosize and "choose columns", none of which reach the view,
         * so anything done through it is lost on reload.
         */
        defaultColDef={{
          enableCellChangeFlash: false,
          sortable: false,
          suppressHeaderMenuButton: true,
        }}
        getRowId={(params) => params.data.id}
        /**
         * Equal heights: alpine defaults to a 48px header over 42px rows, which
         * makes the header loom over the data instead of reading as one grid.
         */
        headerHeight={GRID_ROW_HEIGHT}
        rowHeight={GRID_ROW_HEIGHT}
        maxBlocksInCache={10}
        onCellValueChanged={onCellValueChanged}
        onGridReady={onGridReady}
        onSelectionChanged={onSelectionChanged}
        rowModelType="serverSide"
        /**
         * selectAll is currentPage on purpose: with 510k rows behind the server
         * model, a header tick cannot mean "every matching row" — saving those
         * goes through the filter instead, which the list add already accepts.
         */
        rowSelection={{
          checkboxes: true,
          enableClickSelection: false,
          headerCheckbox: true,
          mode: 'multiRow',
          selectAll: 'currentPage',
        }}
        /**
         * Pinned left, or it lands after the primary column — that one is pinned
         * and the selection column is not, so it drifted to second place.
         */
        selectionColumnDef={{
          pinned: 'left',
          resizable: false,
          suppressMovable: true,
          width: 44,
        }}
        serverSideDatasource={datasource}
        suppressCellFocus={false}
        // right-click would otherwise open ag-grid's own context menu
        suppressContextMenu
        suppressServerSideFullWidthLoadingRow
        theme={themeAlpine}
      />
    </GridWrapper>
  );
};
