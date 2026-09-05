import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { GetJobDto, GetJobResponseDto } from '../dto/jobs.dto.js';

export class GetJobQuery extends Query<GetJobResponseDto> {
  constructor(public readonly dto: GetJobDto) {
    super();
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

@QueryHandler(GetJobQuery)
export class GetJobQueryHandler implements IQueryHandler<GetJobQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({ dto }: GetJobQuery): Promise<GetJobResponseDto> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    const job = await this.appPrismaService.backgroundJob.findFirst({
      where: { id: dto.jobId, workspaceId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return {
      id: job.id,
      kind: job.kind,
      status: job.status,
      payload: isRecord(job.payload)
        ? {
            listId: optionalString(job.payload.listId),
            entityId: optionalString(job.payload.entityId),
            sourceKind: optionalString(job.payload.sourceKind),
          }
        : {},
      requested: job.requested,
      processed: job.processed,
      created: job.created,
      added: job.added,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }
}
