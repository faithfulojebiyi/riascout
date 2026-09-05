import type { SourceKind } from '@orm/app';

import type { AppPrismaService } from '@system/database/database.service.js';

import { buildInsertMembers, buildUpsertRecords } from './bulk-add.builder.js';

/** postgres binds at most 65535 parameters, and one huge array is a single slow
 *  statement rather than several quick ones */
export const CHUNK = 5000;

export type PerformBulkAddInput = {
  listId: string;
  entityId: string;
  workspaceId: string;
  sourceKind: SourceKind;
  userId: string;
  sourceCrds: string[];
};

export type BulkAddResult = {
  created: number;
  added: number;
  requested: number;
};

/** what one committed chunk contributed, for progress reporting */
export type BulkAddChunk = {
  processed: number;
  created: number;
  added: number;
};

type UpsertRow = { id: string; inserted: boolean };

/**
 * Shared by the synchronous api path and the queued worker command, so the two
 * cannot drift. The api cannot import the worker and vice versa, which is
 * exactly why this lives in the feature layer.
 *
 * One transaction per chunk: a record created without its membership would
 * leave someone in the CRM that nobody asked to save.
 */
export const performBulkAdd = async (
  appPrismaService: AppPrismaService,
  input: PerformBulkAddInput,
  onChunk?: (chunk: BulkAddChunk) => Promise<void>,
): Promise<BulkAddResult> => {
  let created = 0;
  let added = 0;

  for (let i = 0; i < input.sourceCrds.length; i += CHUNK) {
    const chunk = {
      ...input,
      sourceCrds: input.sourceCrds.slice(i, i + CHUNK),
    };

    const result = await appPrismaService.$transaction(async (tx) => {
      const upsert = buildUpsertRecords(chunk);
      const records = await tx.$queryRawUnsafe<UpsertRow[]>(
        upsert.sql,
        ...upsert.params,
      );
      const members = buildInsertMembers(
        chunk,
        records.map((record) => record.id),
      );
      const inserted = await tx.$queryRawUnsafe<{ record_id: string }[]>(
        members.sql,
        ...members.params,
      );

      return {
        created: records.filter((record) => record.inserted).length,
        added: inserted.length,
      };
    });

    created += result.created;
    added += result.added;
    await onChunk?.({ processed: chunk.sourceCrds.length, ...result });
  }

  return { created, added, requested: input.sourceCrds.length };
};
