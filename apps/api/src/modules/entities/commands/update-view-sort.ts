import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { UpdateViewSortDto } from '../dto/entities.dto.js';

export class UpdateViewSortCommand extends Command<void> {
  constructor(public readonly dto: UpdateViewSortDto) {
    super();
  }
}

@CommandHandler(UpdateViewSortCommand)
export class UpdateViewSortCommandHandler implements ICommandHandler<UpdateViewSortCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  /**
   * Single-column sort: picking a column replaces the sort rather than adding
   * to it, which is what the header menu offers. Multi-column belongs to view
   * settings, where the order between columns can actually be expressed.
   */
  async execute({ dto }: UpdateViewSortCommand): Promise<void> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    const sort =
      dto.direction === null
        ? []
        : [
            {
              path: [{ attributeId: dto.attributeId }],
              direction: dto.direction,
            },
          ];

    const { count } = await this.appPrismaService.entityView.updateMany({
      where: { id: dto.viewId, workspaceId },
      data: { sort },
    });

    if (count === 0) {
      throw new NotFoundException('View not found in this workspace');
    }
  }
}
