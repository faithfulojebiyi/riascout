import { Logger } from '@nestjs/common';
import type { InngestFunction } from 'inngest';

import { filterTreeSchema } from '@feature/entities/filter-sort/ast.js';
import {
  buildInsertMembers,
  buildUpsertRecords,
} from '@feature/lists/bulk-add.builder.js';
import { resolveCrdsForFilter } from '@feature/lists/resolve-crds.js';
import type { AppPrismaService } from '@system/database/database.service.js';
import { EVENTS, INNGEST_OPTIONS } from '@system/queues/events.config.js';

import { inngest } from './event-publisher.service.js';

const logger = new Logger('BulkAddToList');

/** postgres binds at most 65535 parameters, and a huge array is one slow
 *  statement rather than several quick ones */
const CHUNK = 5000;

type UpsertRow = { id: string; inserted: boolean };

/**
 * The same two set-based statements the synchronous path uses, chunked and run
 * off the request. Identity comes from the payload because the worker has no
 * ALS to read it from.
 */
export const bulkAddToList = ({
  appPrismaService,
}: {
  appPrismaService: AppPrismaService;
}): InngestFunction.Any =>
  inngest.createFunction(
    {
      id: 'bulk-add-to-list',
      ...INNGEST_OPTIONS,
      triggers: [EVENTS.LIST_BULK_ADD],
    },
    async ({ event, step }) => {
      const { listId, entityId, sourceKind, user } = event.data;

      /**
       * Resolving here rather than in the api keeps the event small and means a
       * "save everything matching" does not have to enumerate the set twice.
       */
      const sourceCrds = event.data.sourceCrds?.length
        ? event.data.sourceCrds
        : await resolveCrdsForFilter({
            appPrismaService,
            entityId,
            workspaceId: user.workspaceId,
            sourceKind,
            filter: filterTreeSchema
              .nullable()
              .parse(event.data.filter ?? null),
          });

      const chunks: string[][] = [];

      for (let i = 0; i < sourceCrds.length; i += CHUNK) {
        chunks.push(sourceCrds.slice(i, i + CHUNK));
      }

      let created = 0;
      let added = 0;

      for (const [index, chunk] of chunks.entries()) {
        /**
         * A step per chunk so a retry resumes rather than restarting. Both
         * statements are idempotent, so a replayed step is harmless.
         */
        const result = await step.run(`chunk-${index}`, async () => {
          const input = {
            listId,
            entityId,
            workspaceId: user.workspaceId,
            sourceKind,
            userId: user.userId,
            sourceCrds: chunk,
          };

          return appPrismaService.$transaction(async (tx) => {
            const upsert = buildUpsertRecords(input);
            const records = await tx.$queryRawUnsafe<UpsertRow[]>(
              upsert.sql,
              ...upsert.params,
            );
            const members = buildInsertMembers(
              input,
              records.map((r) => r.id),
            );
            const inserted = await tx.$queryRawUnsafe<{ record_id: string }[]>(
              members.sql,
              ...members.params,
            );

            return {
              created: records.filter((r) => r.inserted).length,
              added: inserted.length,
            };
          });
        });

        created += result.created;
        added += result.added;
      }

      logger.log(
        `list ${listId}: ${added} added, ${created} records created, from ${sourceCrds.length} crds`,
      );

      return { created, added, requested: sourceCrds.length };
    },
  );
