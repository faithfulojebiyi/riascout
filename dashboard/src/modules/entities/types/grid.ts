import type {
  EntityRecordRow,
  EntityViewField,
  EntityViewSummary,
  GetEntityRecordsResponse,
} from '../../../api/generated/rIAScoutAPI.schemas';

export type {
  EntityRecordRow,
  EntityViewField,
  EntityViewSummary,
  GetEntityRecordsResponse,
};

/**
 * One ag-grid row. Cells arrive keyed by attribute id rather than by column, so
 * the renderer looks up its own value and a hidden column costs nothing.
 */
export type GridRow = {
  id: string;
  sourceCrd: string | null;
  cellsByAttributeId: Record<string, unknown>;
};

export const toGridRow = (
  record: GetEntityRecordsResponse['records'][number],
): GridRow => ({
  id: record.id,
  sourceCrd: record.sourceCrd,
  cellsByAttributeId: Object.fromEntries(
    record.cells.map((cell) => [cell.attributeId, cell.value]),
  ),
});
