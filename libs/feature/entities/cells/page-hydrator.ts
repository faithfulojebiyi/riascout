import type { AttributeType } from '@orm/app';

import { attributeTypeRegistry } from '../attribute-types/registry.js';

export type HydrateExecutor = {
  query: <T>(sql: string, params: unknown[]) => Promise<{ rows: T[] }>;
};

export type CellValue = {
  attributeId: string;
  value: unknown;
  source: string | null;
  version: number;
};

export type EdgeValue = { attributeId: string; targetIds: string[] };

/**
 * Fetches every cell for a page of records in one round trip. The typed column
 * is chosen per row from the attribute's type, so callers never guess which of
 * the five value columns is populated.
 */
export const readCellsForRecords = async (
  db: HydrateExecutor,
  recordIds: string[],
  workspaceId: string,
  /** restrict to these attributes; omit for every cell on the record */
  attributeIds?: string[],
): Promise<Map<string, CellValue[]>> => {
  const out = new Map<string, CellValue[]>();

  if (recordIds.length === 0 || attributeIds?.length === 0) {
    return out;
  }

  const { rows } = await db.query<{
    record_id: string;
    attribute_id: string;
    type: AttributeType;
    is_multi_value: boolean;
    text_value: string | null;
    numeric_value: string | null;
    date_value: Date | null;
    boolean_value: boolean | null;
    json_value: unknown;
    source: string | null;
    version: number;
  }>(
    `SELECT v.record_id, v.attribute_id, a.type, a.is_multi_value,
            v.text_value, v.numeric_value, v.date_value, v.boolean_value, v.json_value,
            v.source, v.version
       FROM app.entity_record_value v
       JOIN app.entity_attribute a ON a.id = v.attribute_id
      WHERE v.record_id = ANY($1::text[])
        AND v.workspace_id = $2
        AND ($3::text[] IS NULL OR v.attribute_id = ANY($3::text[]))`,
    [recordIds, workspaceId, attributeIds ?? null],
  );

  for (const row of rows) {
    const column = attributeTypeRegistry.effectiveStorageColumn(
      row.type,
      row.is_multi_value,
    );

    const value =
      column === 'text_value'
        ? row.text_value
        : column === 'numeric_value'
          ? row.numeric_value === null
            ? null
            : Number(row.numeric_value)
          : column === 'date_value'
            ? row.date_value
            : column === 'boolean_value'
              ? row.boolean_value
              : column === 'json_value'
                ? row.json_value
                : null;

    const list = out.get(row.record_id) ?? [];

    list.push({
      attributeId: row.attribute_id,
      value,
      source: row.source,
      version: row.version,
    });
    out.set(row.record_id, list);
  }

  return out;
};

/**
 * Edges are stored once on the canonical side, so a record appears either as
 * the source (read directly) or as the target (re-keyed to the paired
 * attribute). One UNION covers both directions in a single round trip.
 */
export const readEdgesForRecords = async (
  db: HydrateExecutor,
  recordIds: string[],
  workspaceId: string,
  attributeIds?: string[],
): Promise<Map<string, EdgeValue[]>> => {
  const out = new Map<string, EdgeValue[]>();

  if (recordIds.length === 0 || attributeIds?.length === 0) {
    return out;
  }

  const { rows } = await db.query<{
    record_id: string;
    attribute_id: string;
    other_id: string;
  }>(
    `SELECT rel.source_record_id AS record_id,
            rel.attribute_id,
            rel.target_record_id AS other_id
       FROM app.entity_record_relationship rel
      WHERE rel.source_record_id = ANY($1::text[])
        AND rel.workspace_id = $2
        AND ($3::text[] IS NULL OR rel.attribute_id = ANY($3::text[]))
      UNION ALL
     SELECT rel.target_record_id AS record_id,
            paired.id AS attribute_id,
            rel.source_record_id AS other_id
       FROM app.entity_record_relationship rel
       JOIN app.entity_attribute paired
         ON paired.other_relationship_side_attribute_id = rel.attribute_id
      WHERE rel.target_record_id = ANY($1::text[])
        AND rel.workspace_id = $2
        AND ($3::text[] IS NULL OR paired.id = ANY($3::text[]))`,
    [recordIds, workspaceId, attributeIds ?? null],
  );

  for (const row of rows) {
    const list = out.get(row.record_id) ?? [];
    const entry = list.find((e) => e.attributeId === row.attribute_id);

    if (entry) {
      entry.targetIds.push(row.other_id);
    } else {
      list.push({ attributeId: row.attribute_id, targetIds: [row.other_id] });
    }

    out.set(row.record_id, list);
  }

  return out;
};
