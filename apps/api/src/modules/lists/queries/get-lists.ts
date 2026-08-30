import { ForbiddenException } from '@nestjs/common';
import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { GetListsDto, GetListsResponseDto } from '../dto/lists.dto.js';

export class GetListsQuery extends Query<GetListsResponseDto> {
  constructor(public readonly dto: GetListsDto) {
    super();
  }
}

@QueryHandler(GetListsQuery)
export class GetListsQueryHandler implements IQueryHandler<GetListsQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({ dto }: GetListsQuery): Promise<GetListsResponseDto> {
    const workspaceId = this.alsService.ctx.get('workspaceId');
    const userId = this.alsService.ctx.get('userId');

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    const lists = await this.appPrismaService.list.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(dto.entityId ? { entityId: dto.entityId } : {}),
        // a private list belongs to its author; workspace lists are shared
        OR: [{ visibility: 'workspace' }, { userId: userId ?? '' }],
      },
      select: {
        id: true,
        name: true,
        entityId: true,
        kind: true,
        visibility: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      lists: lists.map(({ _count, ...list }) => ({
        ...list,
        memberCount: _count.members,
      })),
    };
  }
}
