import { AllEnterpriseModule, LicenseManager, ModuleRegistry } from 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useMemo, useRef } from 'react';
import { css } from '@riascout-ui/styled-system/css';

import type { EntityViewSummary, GridRow } from '../../types/grid';
import { buildColumnDefs } from './column-defs';
import { EntityGridDatasource } from './ssrm-datasource';

ModuleRegistry.registerModules([AllEnterpriseModule]);

const licenseKey = import.meta.env?.VITE_AG_GRID_LICENSE_KEY;

if (licenseKey) {
  LicenseManager.setLicenseKey(licenseKey);
}

export type EntityGridProps = {
  entityId: string;
  view: EntityViewSummary;
};

/**
 * Server-side row model, not client-side: 510k advisors will not fit in the
 * browser, and the projection is already paged and sorted in postgres.
 */
export const EntityGrid = ({ entityId, view }: EntityGridProps) => {
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
    visibleFieldIdsRef.current = view.fields.filter((f) => f.isVisible).map((f) => f.fieldId);
  }, [view.fields]);

  return (
    <div className={css({ h: 'full', w: 'full' })}>
      <AgGridReact<GridRow>
        columnDefs={columnDefs}
        rowModelType="serverSide"
        serverSideDatasource={datasource}
        cacheBlockSize={100}
        maxBlocksInCache={10}
        getRowId={(params) => params.data.id}
        onColumnVisible={onColumnVisible}
        suppressCellFocus={false}
        theme="legacy"
      />
    </div>
  );
};
