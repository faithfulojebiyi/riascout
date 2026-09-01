import type { SourceKind } from '@orm/app';

export type BulkAddInput = {
  listId: string;
  entityId: string;
  workspaceId: string;
  sourceKind: SourceKind;
  userId: string;
  /** market CRDs, as strings: bigint has no JSON representation */
  sourceCrds: string[];
};

export type BuiltStatement = { sql: string; params: unknown[] };

// two statements keep database round trips constant as the batch grows
export const buildUpsertRecords = (input: BulkAddInput): BuiltStatement => {
  const params: unknown[] = [
    input.entityId,
    input.workspaceId,
    input.sourceKind,
    input.sourceCrds,
  ];

  return {
    /**
     * ON CONFLICT DO UPDATE rather than DO NOTHING: an untouched row returns no
     * id, and the membership insert needs every id, including the ones already
     * saved.
     */
    sql: `
INSERT INTO app.entity_record (id, entity_id, workspace_id, source_kind, source_crd, created_at, updated_at)
SELECT gen_random_uuid(), $1, $2, $3::"app"."source_kind", crd::bigint, now(), now()
  FROM unnest($4::text[]) AS crd
    ON CONFLICT (entity_id, source_kind, source_crd, workspace_id)
    DO UPDATE SET updated_at = app.entity_record.updated_at
 RETURNING id, source_crd, (xmax = 0) AS inserted`,
    params,
  };
};

export const buildInsertMembers = (
  input: BulkAddInput,
  recordIds: string[],
): BuiltStatement => ({
  // a record already in the list is not an error; re-adding is idempotent
  sql: `
INSERT INTO app.list_member (list_id, record_id, workspace_id, added_at, added_by_user_id)
SELECT $1, rid, $2, now(), $3
  FROM unnest($4::uuid[]) AS rid
    ON CONFLICT (list_id, record_id) DO NOTHING
 RETURNING record_id`,
  params: [input.listId, input.workspaceId, input.userId, recordIds],
});
