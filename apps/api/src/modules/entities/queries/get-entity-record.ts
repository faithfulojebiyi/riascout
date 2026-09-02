import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import {
  readCellsForRecords,
  readEdgesForRecords,
} from '@feature/entities/cells/page-hydrator.js';
import { readCodeVocabularies } from '@feature/entities/code-vocabularies.js';
import { resolveReferenceColumn } from '@feature/entities/attribute-types/reference-columns.js';
import { referenceProperty } from '@feature/entities/attribute-types/reference-property.js';
import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import { toJsonValue } from '../json-value.js';

import type {
  GetEntityRecordDto,
  GetEntityRecordResponseDto,
} from '../dto/entities.dto.js';

export class GetEntityRecordQuery extends Query<GetEntityRecordResponseDto> {
  constructor(public readonly dto: GetEntityRecordDto) {
    super();
  }
}

@QueryHandler(GetEntityRecordQuery)
export class GetEntityRecordQueryHandler
  implements IQueryHandler<GetEntityRecordQuery>
{
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({
    dto,
  }: GetEntityRecordQuery): Promise<GetEntityRecordResponseDto> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    // scoping by workspace here is what stops a cross-tenant read
    const record = await this.appPrismaService.entityRecord.findFirst({
      where: { id: dto.recordId, workspaceId },
      select: {
        id: true,
        entityId: true,
        sourceKind: true,
        sourceCrd: true,
        createdAt: true,
        updatedAt: true,
        entity: { select: { slug: true, name: true } },
      },
    });

    if (!record) {
      throw new NotFoundException('Record not found');
    }

    const attributes = await this.appPrismaService.entityAttribute.findMany({
      where: { entityId: record.entityId, workspaceId, isArchived: false },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        key: true,
        label: true,
        icon: true,
        type: true,
        group: true,
        position: true,
        referenceColumn: true,
        isPrimary: true,
        isEditable: true,
        isMultiValue: true,
        choices: {
          select: { id: true, name: true, color: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    /**
     * No attributeIds argument: the panel wants every cell on the record, which
     * is exactly what omitting it means.
     */
    const [optionsByKey, cells, edges, members] = await Promise.all([
      readCodeVocabularies(this.appPrismaService, attributes),
      readCellsForRecords(this.executor, [record.id], workspaceId),
      readEdgesForRecords(this.executor, [record.id], workspaceId),
      this.appPrismaService.listMember.findMany({
        where: { recordId: record.id, workspaceId },
        select: {
          addedAt: true,
          list: {
            select: { id: true, name: true, kind: true, visibility: true },
          },
        },
        orderBy: { addedAt: 'asc' },
      }),
    ]);

    const projection = await this.readProjection(
      record.sourceKind,
      record.sourceCrd,
    );

    return {
      recordId: record.id,
      entityId: record.entityId,
      entitySlug: record.entity.slug,
      entityName: record.entity.name,
      market: {
        sourceKind: record.sourceKind,
        sourceCrd:
          record.sourceCrd === null ? null : String(record.sourceCrd),
        hasProjection: projection !== null,
      },
      attributes: attributes.map((a) => ({
        attributeId: a.id,
        key: a.key,
        label: a.label,
        icon: a.icon,
        type: a.type,
        group: a.group,
        position: a.position,
        referenceColumn: a.referenceColumn,
        isPrimary: a.isPrimary,
        isEditable: a.isEditable,
        isMultiValue: a.isMultiValue,
        options: optionsByKey.get(a.referenceColumn ?? '') ?? [],
        choices: a.choices,
      })),
      cells: [
        ...(cells.get(record.id) ?? []),
        ...this.projectedCells(attributes, projection),
      ],
      edges: edges.get(record.id) ?? [],
      lists: members.map((m) => ({
        listId: m.list.id,
        name: m.list.name,
        kind: m.list.kind,
        visibility: m.list.visibility,
        addedAt: m.addedAt,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /** null when the record is hand-made, or names a firm that never filed */
  private async readProjection(
    sourceKind: 'advisor' | 'firm' | null,
    sourceCrd: bigint | null,
  ): Promise<Record<string, unknown> | null> {
    if (sourceCrd === null) {
      return null;
    }

    if (sourceKind === 'firm') {
      return this.appPrismaService.firmSearch.findUnique({
        where: { firmCrd: sourceCrd },
      });
    }

    if (sourceKind === 'advisor') {
      return this.appPrismaService.advisorSearch.findUnique({
        where: { advisorCrd: sourceCrd },
      });
    }

    return null;
  }

  /**
   * A projected value is read-only, so it carries no version to edit against.
   * A null column is omitted rather than sent as a null cell — absent means the
   * firm never reported it, which is not the same as reporting zero.
   */
  private projectedCells(
    attributes: readonly { id: string; referenceColumn: string | null }[],
    projection: Record<string, unknown> | null,
  ): { attributeId: string; value: unknown; source: string; version: number }[] {
    if (!projection) {
      return [];
    }

    return attributes.flatMap((a) => {
      const reference = resolveReferenceColumn(a.referenceColumn);

      if (!reference) {
        return [];
      }

      const value = projection[referenceProperty(reference.column)];

      return value === undefined || value === null
        ? []
        : [
            {
              attributeId: a.id,
              value: toJsonValue(value),
              source: 'market',
              version: 0,
            },
          ];
    });
  }

  /** adapts prisma's raw interface to the hydrator's narrow executor */
  private get executor() {
    return {
      query: async <T>(
        sql: string,
        params: unknown[],
      ): Promise<{ rows: T[] }> => ({
        rows: await this.appPrismaService.$queryRawUnsafe<T[]>(sql, ...params),
      }),
    };
  }
}
