import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LexoRank } from 'lexorank';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type {
  MoveViewFieldDto,
  MoveViewFieldResponseDto,
} from '../dto/entities.dto.js';

export class MoveViewFieldCommand extends Command<MoveViewFieldResponseDto> {
  constructor(public readonly dto: MoveViewFieldDto) {
    super();
  }
}

@CommandHandler(MoveViewFieldCommand)
export class MoveViewFieldCommandHandler implements ICommandHandler<MoveViewFieldCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  /**
   * The rank is computed here rather than in the browser: the client would need
   * the neighbours' positions to do it, which is the whole ordered column list
   * on every move.
   */
  async execute({
    dto,
  }: MoveViewFieldCommand): Promise<MoveViewFieldResponseDto> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    const fields = await this.appPrismaService.entityViewField.findMany({
      where: { viewId: dto.viewId, workspaceId, isVisible: true },
      select: { id: true, position: true },
      orderBy: { position: 'asc' },
    });

    const index = fields.findIndex((field) => field.id === dto.fieldId);

    if (index === -1) {
      throw new NotFoundException('Column not found on this view');
    }

    const step = dto.direction === 'left' ? -1 : 1;
    const target = index + step;

    // already at the edge — a no-op rather than an error the menu has to handle
    if (target < 0 || target >= fields.length) {
      return { position: fields[index]!.position };
    }

    const neighbour = fields[target]!;
    const beyond = fields[target + step];

    const neighbourRank = LexoRank.parse(neighbour.position);
    const position = (
      beyond
        ? neighbourRank.between(LexoRank.parse(beyond.position))
        : dto.direction === 'left'
          ? neighbourRank.genPrev()
          : neighbourRank.genNext()
    ).toString();

    await this.appPrismaService.entityViewField.updateMany({
      where: { id: dto.fieldId, viewId: dto.viewId, workspaceId },
      data: { position },
    });

    return { position };
  }
}
