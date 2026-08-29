import { ForbiddenException } from '@nestjs/common';
import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { GetEntitiesDto, GetEntitiesResponseDto } from '../dto/entities.dto.js';

export class GetEntitiesQuery extends Query<GetEntitiesResponseDto> {
  constructor(public readonly dto: GetEntitiesDto) {
    super();
  }
}

@QueryHandler(GetEntitiesQuery)
export class GetEntitiesQueryHandler implements IQueryHandler<GetEntitiesQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute(): Promise<GetEntitiesResponseDto> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    const entities = await this.appPrismaService.entity.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        sourceKind: true,
        views: {
          where: { workspaceId },
          select: { id: true, name: true, isDefault: true },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        },
        _count: { select: { records: true, attributes: { where: { isArchived: false } } } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      entities: entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        sourceKind: entity.sourceKind,
        recordCount: entity._count.records,
        attributeCount: entity._count.attributes,
        views: entity.views,
      })),
    };
  }
}
