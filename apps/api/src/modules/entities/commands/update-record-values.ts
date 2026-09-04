import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import {
  writeCell,
  type CellExecutor,
} from '@feature/entities/cells/cell-writer.js';
import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';
import {
  TransactionRunner,
  type AppPrismaTx,
} from '@system/database/transaction-runner.service.js';

import type {
  UpdateRecordValuesDto,
  UpdateRecordValuesResponseDto,
} from '../dto/entities.dto.js';

export class UpdateRecordValuesCommand extends Command<UpdateRecordValuesResponseDto> {
  constructor(public readonly dto: UpdateRecordValuesDto) {
    super();
  }
}

@CommandHandler(UpdateRecordValuesCommand)
export class UpdateRecordValuesCommandHandler implements ICommandHandler<UpdateRecordValuesCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute({
    dto,
  }: UpdateRecordValuesCommand): Promise<UpdateRecordValuesResponseDto> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    const record = await this.appPrismaService.entityRecord.findFirst({
      where: { id: dto.recordId, workspaceId },
      select: { id: true, entityId: true },
    });

    if (!record) {
      throw new NotFoundException('Record not found');
    }

    const attributes = await this.appPrismaService.entityAttribute.findMany({
      where: {
        id: { in: dto.values.map((v) => v.attributeId) },
        entityId: record.entityId,
        workspaceId,
      },
      select: {
        id: true,
        type: true,
        isMultiValue: true,
        referenceColumn: true,
        isEditable: true,
      },
    });

    const byId = new Map(attributes.map((a) => [a.id, a]));
    const unknown = dto.values.filter((v) => !byId.has(v.attributeId));

    if (unknown.length > 0) {
      throw new NotFoundException(
        `Unknown attribute(s) for this entity: ${unknown.map((u) => u.attributeId).join(', ')}`,
      );
    }

    const projected = attributes.filter(
      (a) => a.referenceColumn !== null || !a.isEditable,
    );

    if (projected.length > 0) {
      throw new ForbiddenException(
        `Attribute(s) are projected from market and cannot be edited: ${projected
          .map((a) => a.id)
          .join(', ')}`,
      );
    }

    /**
     * One transaction for the whole batch: a conflict on any cell rolls back
     * every cell written before it, so the caller never sees a half-saved
     * record behind a 409.
     */
    return this.transactionRunner.run(async (tx) => {
      const executor = this.executorFor(tx);
      const results: UpdateRecordValuesResponseDto['results'] = [];

      for (const write of dto.values) {
        const attribute = byId.get(write.attributeId);

        if (!attribute) {
          continue;
        }

        const result = await writeCell(executor, {
          recordId: record.id,
          attributeId: write.attributeId,
          workspaceId,
          type: attribute.type,
          isMultiValue: attribute.isMultiValue,
          value: write.value,
          // a request through this endpoint is a human edit, never a machine one
          source: null,
          expectedVersion: write.expectedVersion,
        });

        results.push({
          attributeId: write.attributeId,
          status: result.status,
          version: result.status === 'written' ? result.version : null,
        });
      }

      if (results.some((r) => r.status === 'conflict')) {
        // thrown inside the transaction, so the writes above are rolled back
        throw new ConflictException({
          message: 'One or more cells changed underneath this edit',
          code: 'CELL_VERSION_CONFLICT',
          results,
        });
      }

      return { results };
    });
  }

  private executorFor(tx: AppPrismaTx): CellExecutor {
    return {
      query: async <T>(
        sql: string,
        params: unknown[],
      ): Promise<{ rows: T[] }> => ({
        rows: await tx.$queryRawUnsafe<T[]>(sql, ...params),
      }),
    };
  }
}
