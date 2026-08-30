import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { CreateListDto, CreateListResponseDto } from '../dto/lists.dto.js';

export class CreateListCommand extends Command<CreateListResponseDto> {
  constructor(public readonly dto: CreateListDto) {
    super();
  }
}

@CommandHandler(CreateListCommand)
export class CreateListCommandHandler implements ICommandHandler<CreateListCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({ dto }: CreateListCommand): Promise<CreateListResponseDto> {
    const workspaceId = this.alsService.ctx.get('workspaceId');
    const userId = this.alsService.ctx.get('userId');

    if (!workspaceId || !userId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    const entity = await this.appPrismaService.entity.findFirst({
      where: { id: dto.entityId, workspaceId },
      select: { id: true },
    });

    if (!entity) {
      throw new NotFoundException('Entity not found in this workspace');
    }

    const list = await this.appPrismaService.list.create({
      data: {
        workspaceId,
        userId,
        entityId: dto.entityId,
        name: dto.name,
        visibility: dto.visibility,
      },
      select: { id: true, name: true },
    });

    return list;
  }
}
