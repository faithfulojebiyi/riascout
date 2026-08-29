import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { writeCell, type CellExecutor } from '@feature/entities/cells/cell-writer.js';
import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type {
  CreateEntityRecordDto,
  CreateEntityRecordResponseDto,
} from '../dto/entities.dto.js';

export class CreateEntityRecordCommand extends Command<CreateEntityRecordResponseDto> {
  constructor(public readonly dto: CreateEntityRecordDto) {
    super();
  }
}

@CommandHandler(CreateEntityRecordCommand)
export class CreateEntityRecordCommandHandler
  implements ICommandHandler<CreateEntityRecordCommand>
{
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({ dto }: CreateEntityRecordCommand): Promise<CreateEntityRecordResponseDto> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    const entity = await this.appPrismaService.entity.findFirst({
      where: { id: dto.entityId, workspaceId },
      select: { id: true, sourceKind: true },
    });

    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    if (dto.sourceKind !== null && dto.sourceKind !== entity.sourceKind) {
      throw new BadRequestException(
        `Entity accepts ${entity.sourceKind ?? 'no'} records, not ${dto.sourceKind}`,
      );
    }

    if ((dto.sourceCrd === null) !== (dto.sourceKind === null)) {
      throw new BadRequestException('sourceKind and sourceCrd must be set together');
    }

    /**
     * Saving the same advisor twice is idempotent, not an error — a recruiter
     * re-adding someone from search must not create a duplicate pipeline record.
     */
    const existing = dto.sourceCrd
      ? await this.appPrismaService.entityRecord.findFirst({
          where: {
            entityId: entity.id,
            workspaceId,
            sourceKind: dto.sourceKind,
            sourceCrd: BigInt(dto.sourceCrd),
          },
          select: { id: true },
        })
      : null;

    const record =
      existing ??
      (await this.appPrismaService.entityRecord.create({
        data: {
          entityId: entity.id,
          workspaceId,
          sourceKind: dto.sourceKind,
          sourceCrd: dto.sourceCrd === null ? null : BigInt(dto.sourceCrd),
        },
        select: { id: true },
      }));

    if (dto.values.length > 0) {
      const attributes = await this.appPrismaService.entityAttribute.findMany({
        where: {
          id: { in: dto.values.map((v) => v.attributeId) },
          entityId: entity.id,
          workspaceId,
          referenceColumn: null,
          isEditable: true,
        },
        select: { id: true, type: true, isMultiValue: true },
      });

      const byId = new Map(attributes.map((a) => [a.id, a]));

      for (const write of dto.values) {
        const attribute = byId.get(write.attributeId);

        if (!attribute) {
          throw new NotFoundException(`Unknown or non-editable attribute ${write.attributeId}`);
        }

        await writeCell(this.executor, {
          recordId: record.id,
          attributeId: write.attributeId,
          workspaceId,
          type: attribute.type,
          isMultiValue: attribute.isMultiValue,
          value: write.value,
          source: null,
        });
      }
    }

    return { id: record.id, created: existing === null };
  }

  private get executor(): CellExecutor {
    return {
      query: async <T>(sql: string, params: unknown[]): Promise<{ rows: T[] }> => ({
        rows: await this.appPrismaService.$queryRawUnsafe<T[]>(sql, ...params),
      }),
    };
  }
}
