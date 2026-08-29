import type { AttributeType, CellSource } from '@orm/app';

import {
  attributeTypeRegistry,
  type StorageColumn,
} from '../attribute-types/registry.js';

export type CellWrite = {
  recordId: string;
  attributeId: string;
  workspaceId: string;
  type: AttributeType;
  isMultiValue: boolean;
  value: unknown;
  /** null means a human typed it; a source means a machine did */
  source: CellSource | null;
  /** required for a manual edit; rejects the write when the row moved on */
  expectedVersion?: number;
};

export type CellWriteResult =
  | { status: 'written'; version: number }
  | { status: 'skipped'; reason: 'manual_edit_wins' }
  | { status: 'conflict'; actualVersion: number | null };

export class CellVersionConflictError extends Error {
  readonly code = 'CELL_VERSION_CONFLICT';

  constructor(
    readonly attributeId: string,
    readonly actualVersion: number | null,
  ) {
    super(`Cell for attribute ${attributeId} changed underneath this write`);
    this.name = 'CellVersionConflictError';
  }
}

const COLUMNS: readonly StorageColumn[] = [
  'text_value',
  'numeric_value',
  'date_value',
  'boolean_value',
  'json_value',
];

/** the client surface these helpers need, so the logic is testable without prisma */
export type CellExecutor = {
  query: <T>(sql: string, params: unknown[]) => Promise<{ rows: T[] }>;
};

/**
 * Routes a value to its typed column and upserts it.
 *
 * Two rules the grid depends on:
 * an enrichment refresh must never overwrite a cell a human edited (source is
 * null on manual edits), and a manual edit carrying a stale version is a
 * conflict rather than a silent last-write-wins.
 */
export const writeCell = async (
  db: CellExecutor,
  write: CellWrite,
): Promise<CellWriteResult> => {
  const column = attributeTypeRegistry.effectiveStorageColumn(
    write.type,
    write.isMultiValue,
  );

  if (column === 'none') {
    throw new Error(`Attribute type ${write.type} stores no cell value`);
  }

  const assignments = COLUMNS.map(
    (c) => `${c} = ${c === column ? '$4' : 'NULL'}`,
  ).join(', ');
  const coerced = coerce(column, write.value);

  // a machine write yields to a manual edit; a manual write always applies
  const machineGuard = write.source
    ? 'AND app.entity_record_value.source IS NOT NULL'
    : '';

  const versionGuard =
    write.expectedVersion === undefined
      ? ''
      : `AND app.entity_record_value.version = ${write.expectedVersion}`;

  const { rows } = await db.query<{ version: number }>(
    `INSERT INTO app.entity_record_value
       (id, record_id, attribute_id, workspace_id, ${column}, source, version)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::"app"."cell_source", 0)
     ON CONFLICT (record_id, attribute_id) DO UPDATE
        SET ${assignments},
            source = $5::"app"."cell_source",
            version = app.entity_record_value.version + 1,
            updated_at = now()
      WHERE app.entity_record_value.workspace_id = $3
        ${machineGuard}
        ${versionGuard}
     RETURNING version`,
    [
      write.recordId,
      write.attributeId,
      write.workspaceId,
      coerced,
      write.source,
    ],
  );

  if (rows.length > 0) {
    return { status: 'written', version: rows[0]?.version ?? 0 };
  }

  // no row returned: the WHERE blocked the update. Distinguish why.
  const { rows: existing } = await db.query<{
    version: number;
    source: string | null;
  }>(
    `SELECT version, source FROM app.entity_record_value
      WHERE record_id = $1 AND attribute_id = $2 AND workspace_id = $3`,
    [write.recordId, write.attributeId, write.workspaceId],
  );

  const current = existing[0];

  if (write.source && current && current.source === null) {
    return { status: 'skipped', reason: 'manual_edit_wins' };
  }

  return { status: 'conflict', actualVersion: current?.version ?? null };
};

/** postgres needs the value in a shape the target column accepts */
const coerce = (column: StorageColumn, value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }

  switch (column) {
    case 'json_value':
      return JSON.stringify(value);
    case 'date_value':
      return value instanceof Date ? value.toISOString() : String(value);
    case 'boolean_value':
      return Boolean(value);
    case 'numeric_value':
      return String(value);
    default:
      return String(value);
  }
};
