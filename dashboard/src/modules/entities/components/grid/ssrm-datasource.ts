import type {
  IServerSideDatasource,
  IServerSideGetRowsParams,
} from 'ag-grid-enterprise';

import { entitiesControllerGetEntityRecords } from '../../../../api/generated/entities/entities';
import { toGridRow } from '../../types/grid';

export type SsrmArgs = {
  entityId: string;
  viewId: string | null;
  /** scope to one list's members; null shows every record */
  listId?: string | null;
  /** only the columns on screen, so a 63-column view does not fetch all of them */
  visibleFieldIds: () => string[];
};

/**
 * One instance per mounted view. ag-grid drops blocks when you scroll past them
 * or change a filter; without aborting, a late response writes into a cache slot
 * that no longer exists and the grid shows rows from a previous query.
 */
export class EntityGridDatasource implements IServerSideDatasource {
  private inflight: AbortController | null = null;

  constructor(private readonly args: SsrmArgs) {}

  getRows = async (params: IServerSideGetRowsParams): Promise<void> => {
    const { request, success, fail } = params;

    // grouping and pivot are not supported; failing is honest, empty is not
    if ((request.groupKeys?.length ?? 0) > 0 || request.pivotMode) {
      fail();

      return;
    }

    this.inflight?.abort();
    const controller = new AbortController();
    this.inflight = controller;

    const startRow = request.startRow ?? 0;
    const endRow = request.endRow ?? startRow + 100;

    try {
      const response = await entitiesControllerGetEntityRecords({
        entityId: this.args.entityId,
        viewId: this.args.viewId,
        listId: this.args.listId ?? null,
        visibleFieldIds: this.args.visibleFieldIds(),
        limit: endRow - startRow,
        offset: startRow,
      });

      if (controller.signal.aborted) {
        return;
      }

      success({
        rowData: response.records.map(toGridRow),
        rowCount: response.total,
      });
    } catch {
      if (!controller.signal.aborted) {
        fail();
      }
    }
  };

  destroy = (): void => {
    this.inflight?.abort();
  };
}
