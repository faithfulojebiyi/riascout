import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import {
  buildInsertMembers,
  buildUpsertRecords,
} from '@feature/lists/bulk-add.builder.js';
import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { AddToListDto, AddToListResponseDto } from '../dto/lists.dto.js';

export class AddToListCommand extends Command<AddToListResponseDto> {
  constructor(public readonly dto: AddToListDto) {
    super();
  }
}

type UpsertRow = { id: string; source_crd: bigint; inserted: boolean };

@CommandHandler(AddToListCommand)
export class AddToListCommandHandler implements ICommandHandler<AddToListCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({ dto }: AddToListCommand): Promise<AddToListResponseDto> {
    const workspaceId = this.alsService.ctx.get('workspaceId');
    const userId = this.alsService.ctx.get('userId');

    if (!workspaceId || !userId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    const list = await this.appPrismaService.list.findFirst({
      where: { id: dto.listId, workspaceId, deletedAt: null },
      select: { id: true, entityId: true },
    });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    const entity = await this.appPrismaService.entity.findFirst({
      where: { id: list.entityId, workspaceId },
      select: { sourceKind: true },
    });

    if (!entity?.sourceKind) {
      throw new NotFoundException(
        'This list is not backed by a market entity, so CRDs cannot be added',
      );
    }

    const input = {
      listId: list.id,
      entityId: list.entityId,
      workspaceId,
      sourceKind: entity.sourceKind,
      userId,
      sourceCrds: [...new Set(dto.sourceCrds)],
    };

    /**
     * One transaction: a record created without its membership would leave an
     * advisor in the CRM that nobody asked to save.
     */
    return this.appPrismaService.$transaction(async (tx) => {
      const upsert = buildUpsertRecords(input);
      const records = await tx.$queryRawUnsafe<UpsertRow[]>(
        upsert.sql,
        ...upsert.params,
      );

      const members = buildInsertMembers(
        input,
        records.map((r) => r.id),
      );
      const added = await tx.$queryRawUnsafe<{ record_id: string }[]>(
        members.sql,
        ...members.params,
      );

      return {
        recordsCreated: records.filter((r) => r.inserted).length,
        membersAdded: added.length,
        requested: input.sourceCrds.length,
      };
    });
  }
}
