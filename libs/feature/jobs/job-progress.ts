import type { AppPrismaService } from '@system/database/database.service.js';

export type JobChunk = { processed: number; created: number; added: number };

/**
 * Writes a background_job row's lifecycle. Counters use atomic increments so
 * parallel consumers of the same job cannot lose an update; start() resets
 * them because a retried function replays the whole job.
 */
export class JobProgress {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    readonly jobId: string,
  ) {}

  start(requested: number): Promise<unknown> {
    return this.appPrismaService.backgroundJob.update({
      where: { id: this.jobId },
      data: {
        status: 'running',
        requested,
        processed: 0,
        created: 0,
        added: 0,
        error: null,
        startedAt: new Date(),
        finishedAt: null,
      },
    });
  }

  advance(chunk: JobChunk): Promise<unknown> {
    return this.appPrismaService.backgroundJob.update({
      where: { id: this.jobId },
      data: {
        processed: { increment: chunk.processed },
        created: { increment: chunk.created },
        added: { increment: chunk.added },
      },
    });
  }

  complete(): Promise<unknown> {
    return this.appPrismaService.backgroundJob.update({
      where: { id: this.jobId },
      data: { status: 'completed', finishedAt: new Date() },
    });
  }

  fail(message: string): Promise<unknown> {
    return (
      this.appPrismaService.backgroundJob
        .update({
          where: { id: this.jobId },
          data: { status: 'failed', error: message, finishedAt: new Date() },
        })
        // the original error is what the caller needs to see, not this one
        .catch(() => undefined)
    );
  }
}
