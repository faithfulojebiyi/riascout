import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { UpdateViewFieldDto } from '../dto/entities.dto.js';

export class UpdateViewFieldCommand extends Command<void> {
  constructor(public readonly dto: UpdateViewFieldDto) {
    super();
  }
}

@CommandHandler(UpdateViewFieldCommand)
export class UpdateViewFieldCommandHandler implements ICommandHandler<UpdateViewFieldCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({ dto }: UpdateViewFieldCommand): Promise<void> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    const { viewId, fieldId, ...changes } = dto;

    /**
     * updateMany rather than update: it takes workspaceId in the where clause,
     * so a field id from another workspace matches nothing instead of throwing
     * a not-found that confirms the row exists.
     */
    const { count } = await this.appPrismaService.entityViewField.updateMany({
      where: { id: fieldId, viewId, workspaceId },
      data: changes,
    });

    if (count === 0) {
      throw new NotFoundException('Column not found on this view');
    }
  }
}
