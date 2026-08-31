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

/** the rank that lands a row between its two new neighbours, either absent */
const rankBetween = (before?: string, after?: string): string => {
  if (before && after) {
    return LexoRank.parse(before).between(LexoRank.parse(after)).toString();
  }

  if (after) {
    return LexoRank.parse(after).genPrev().toString();
  }

  if (before) {
    return LexoRank.parse(before).genNext().toString();
  }

  return LexoRank.middle().toString();
};

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

    /**
     * Pinned first, matching how ag-grid renders and how view settings lists
     * them — ordering by position alone here would make toIndex refer to a
     * different slot than the one the user dropped on.
     */
    const fields = await this.appPrismaService.entityViewField.findMany({
      where: { viewId: dto.viewId, workspaceId, isVisible: true },
      select: { id: true, position: true },
      orderBy: [{ isPinned: 'desc' }, { position: 'asc' }],
    });

    const from = fields.findIndex((field) => field.id === dto.fieldId);

    if (from === -1) {
      throw new NotFoundException('Column not found on this view');
    }

    /**
     * Both cases reduce to "insert at index N of the list without this field",
     * so direction only has to pick that index. Moving right by one means
     * landing where the right neighbour currently sits, which is from + 1.
     */
    const others = fields.filter((field) => field.id !== dto.fieldId);
    const requested =
      dto.toIndex ?? (dto.direction === 'left' ? from - 1 : from + 1);
    const at = Math.min(Math.max(requested, 0), others.length);

    // already there — a no-op rather than an error the menu has to handle
    if (at === from) {
      return { position: fields[from]!.position };
    }

    const position = rankBetween(
      others[at - 1]?.position,
      others[at]?.position,
    );

    await this.appPrismaService.entityViewField.updateMany({
      where: { id: dto.fieldId, viewId: dto.viewId, workspaceId },
      data: { position },
    });

    return { position };
  }
}
