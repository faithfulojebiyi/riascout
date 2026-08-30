import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { performBulkAdd } from '@feature/lists/perform-bulk-add.js';
import { AlsService } from '@system/als/als.service.js';
import { EVENT_KEYS } from '@system/queues/events.config.js';

import { EventPublisherService } from '../../event-publisher/event-publisher.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { AddToListDto, AddToListResponseDto } from '../dto/lists.dto.js';
import { SYNC_ADD_MAX } from '../schema.js';

export class AddToListCommand extends Command<AddToListResponseDto> {
  constructor(public readonly dto: AddToListDto) {
    super();
  }
}

@CommandHandler(AddToListCommand)
export class AddToListCommandHandler implements ICommandHandler<AddToListCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
    private readonly eventPublisherService: EventPublisherService,
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
      sourceCrds: [...new Set(dto.sourceCrds ?? [])],
    };

    /** the filter's size is unknown until it runs, so it never blocks a request */
    if (dto.filter) {
      await this.eventPublisherService.sendEvent({
        name: EVENT_KEYS.LIST_BULK_ADD,
        data: {
          listId: input.listId,
          entityId: input.entityId,
          sourceKind: input.sourceKind,
          filter: dto.filter,
        },
        user: { userId, workspaceId },
      });

      return {
        completed: false,
        recordsCreated: 0,
        membersAdded: 0,
        requested: 0,
      };
    }

    /**
     * A save from a filtered search can be tens of thousands of advisors, which
     * has no business holding a request open. Below the threshold the caller
     * gets real counts back; above it the work moves to the worker and the
     * counts arrive when the list refreshes.
     */
    if (input.sourceCrds.length > SYNC_ADD_MAX) {
      await this.eventPublisherService.sendEvent({
        name: EVENT_KEYS.LIST_BULK_ADD,
        data: {
          listId: input.listId,
          entityId: input.entityId,
          sourceKind: input.sourceKind,
          sourceCrds: input.sourceCrds,
        },
        user: { userId, workspaceId },
      });

      return {
        completed: false,
        recordsCreated: 0,
        membersAdded: 0,
        requested: input.sourceCrds.length,
      };
    }

    const result = await performBulkAdd(this.appPrismaService, input);

    return {
      completed: true,
      recordsCreated: result.created,
      membersAdded: result.added,
      requested: result.requested,
    };
  }
}
