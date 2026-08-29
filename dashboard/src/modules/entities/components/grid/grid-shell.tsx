import { type CellValueChangedEvent, themeAlpine } from 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useMemo, useRef } from 'react';

import { GridWrapper } from '../../../../ui/primitives/data-grid';
import { useUpdateRecordValues } from '../../mutations/use-update-record-values';
import type { EntityViewSummary, GridRow } from '../../types/grid';
import { buildColumnDefs } from './column-defs';
import { EntityGridDatasource } from './ssrm-datasource';

export type EntityGridProps = {
  entityId: string;
  view: EntityViewSummary;
};

/**
 * Server-side row model, not client-side: 510k advisors will not fit in the
 * browser, and the projection is already paged and sorted in postgres.
 *
 * AgGridReact directly rather than the DataGrid primitive, which hardcodes
 * sortable/resizable false and suppressColumnVirtualisation — all wrong for 63
 * columns over 510k rows. Only GridWrapper, the theme layer, is shared.
 */
export const EntityGrid = ({ entityId, view }: EntityGridProps) => {
  const updateRecordValues = useUpdateRecordValues();
  const columnDefs = useMemo(() => buildColumnDefs(view.fields), [view.fields]);

  // read at call time rather than captured, so scrolling to a new column
  // widens the fetch without rebuilding the datasource
  const visibleFieldIdsRef = useRef<string[]>(
    view.fields.filter((f) => f.isVisible).map((f) => f.fieldId),
  );

  const datasource = useMemo(
    () =>
      new EntityGridDatasource({
        entityId,
        viewId: view.id,
        visibleFieldIds: () => visibleFieldIdsRef.current,
      }),
    [entityId, view.id],
  );

  const onColumnVisible = useCallback(() => {
    visibleFieldIdsRef.current = view.fields
      .filter((f) => f.isVisible)
      .map((f) => f.fieldId);
  }, [view.fields]);

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

  return (
    <GridWrapper>
      <AgGridReact<GridRow>
        cacheBlockSize={100}
        columnDefs={columnDefs}
        getRowId={(params) => params.data.id}
        maxBlocksInCache={10}
        onCellValueChanged={onCellValueChanged}
        onColumnVisible={onColumnVisible}
        rowModelType="serverSide"
        serverSideDatasource={datasource}
        suppressCellFocus={false}
        theme={themeAlpine}
      />
    </GridWrapper>
  );
};
