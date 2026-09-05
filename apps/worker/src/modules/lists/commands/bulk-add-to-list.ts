import { Logger } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { filterTreeSchema } from '@feature/entities/filter-sort/ast.js';
import {
  performBulkAdd,
  type BulkAddResult,
} from '@feature/lists/perform-bulk-add.js';
import { resolveCrdsForFilter } from '@feature/lists/resolve-crds.js';
import { JobProgress } from '@feature/jobs/job-progress.js';
import { AppPrismaService } from '@system/database/database.service.js';
import type { BulkAddToListDto } from '@system/queues/dto/lists.dto.js';

export class BulkAddToListCommand extends Command<BulkAddResult> {
  constructor(public readonly payload: BulkAddToListDto) {
    super();
  }
}

/**
 * The work behind the queued save. It lives in a handler rather than in the
 * inngest function so the consumer stays thin and the logic is reachable
 * without an event — the same reason the api's synchronous path can share it.
 */
@CommandHandler(BulkAddToListCommand)
export class BulkAddToListCommandHandler implements ICommandHandler<BulkAddToListCommand> {
  constructor(private readonly appPrismaService: AppPrismaService) {}

  private readonly logger = new Logger(BulkAddToListCommandHandler.name);

  async execute({ payload }: BulkAddToListCommand): Promise<BulkAddResult> {
    const { listId, entityId, sourceKind, user } = payload;
    const job = payload.jobId
      ? new JobProgress(this.appPrismaService, payload.jobId)
      : null;

    try {
      return await this.run(payload, job);
    } catch (error) {
      await job?.fail(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async run(
    payload: BulkAddToListDto,
    job: JobProgress | null,
  ): Promise<BulkAddResult> {
    const { listId, entityId, sourceKind, user } = payload;

    /**
     * Resolving here rather than in the api keeps the event small and avoids
     * enumerating the set twice.
     */
    const sourceCrds = payload.sourceCrds?.length
      ? payload.sourceCrds
      : await resolveCrdsForFilter({
          appPrismaService: this.appPrismaService,
          entityId,
          workspaceId: user.workspaceId,
          sourceKind,
          filter: filterTreeSchema.nullable().parse(payload.filter ?? null),
        });

    // a retry starts the counters over rather than double counting
    await job?.start(sourceCrds.length);

    const result = await performBulkAdd(
      this.appPrismaService,
      {
        listId,
        entityId,
        workspaceId: user.workspaceId,
        sourceKind,
        userId: user.userId,
        sourceCrds,
      },
      (chunk) => job?.advance(chunk) ?? Promise.resolve(),
    );

    await job?.complete();

    this.logger.log(
      `list ${listId}: ${result.added} added, ${result.created} records created, from ${result.requested} crds`,
    );

    return result;
  }
}
