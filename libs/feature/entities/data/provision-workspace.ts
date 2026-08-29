import { LexoRank } from 'lexorank';

import { DEFAULT_ENTITIES, type SeedEntity } from './entity-definitions.js';

/** the prisma surface provisioning needs, so it can run under a transaction */
export type ProvisionClient = {
  entity: {
    findFirst: (args: {
      where: { workspaceId: string; slug: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: {
      data: { workspaceId: string; name: string; slug: string; sourceKind: string };
      select: { id: true };
    }) => Promise<{ id: string }>;
  };
  entityAttribute: {
    findMany: (args: {
      where: { entityId: string };
      select: { id: true; key: true };
    }) => Promise<{ id: string; key: string }[]>;
    create: (args: { data: Record<string, unknown>; select: { id: true } }) => Promise<{
      id: string;
    }>;
  };
  entityAttributeChoice: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  entityView: {
    findFirst: (args: {
      where: { entityId: string; isDefault: boolean };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: { data: Record<string, unknown>; select: { id: true } }) => Promise<{
      id: string;
    }>;
  };
  entityViewField: {
    create: (args: { data: Record<string, unknown>; select: { id: true } }) => Promise<{
      id: string;
    }>;
  };
  entityViewFieldPath: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

export type ProvisionResult = {
  entitiesCreated: number;
  attributesCreated: number;
  viewsCreated: number;
};

/**
 * Idempotent: an entity is matched by slug and an attribute by its stable key,
 * so re-running after a release that adds attributes backfills only the new
 * ones. Safe to call on every sign-in if we ever want to.
 */
export const provisionWorkspace = async (
  client: ProvisionClient,
  workspaceId: string,
  entities: SeedEntity[] = DEFAULT_ENTITIES,
): Promise<ProvisionResult> => {
  let entitiesCreated = 0;
  let attributesCreated = 0;
  let viewsCreated = 0;

  for (const definition of entities) {
    const existing = await client.entity.findFirst({
      where: { workspaceId, slug: definition.slug },
      select: { id: true },
    });

    const entity =
      existing ??
      (await client.entity.create({
        data: {
          workspaceId,
          name: definition.name,
          slug: definition.slug,
          sourceKind: definition.sourceKind,
        },
        select: { id: true },
      }));

    if (!existing) {
      entitiesCreated += 1;
    }

    const existingAttributes = await client.entityAttribute.findMany({
      where: { entityId: entity.id },
      select: { id: true, key: true },
    });

    const idByKey = new Map(existingAttributes.map((a) => [a.key, a.id]));
    const present = new Set(idByKey.keys());

    // LexoRank keeps columns reorderable without renumbering the whole set
    let rank = LexoRank.middle();

    for (const attribute of definition.attributes) {
      rank = rank.genNext();

      if (present.has(attribute.key)) {
        continue;
      }

      const created = await client.entityAttribute.create({
        data: {
          entityId: entity.id,
          workspaceId,
          key: attribute.key,
          label: attribute.label,
          type: attribute.type,
          isMultiValue: attribute.isMultiValue,
          referenceColumn: attribute.referenceColumn,
          isEditable: attribute.isEditable,
          isSystem: true,
          position: rank.toString(),
        },
        select: { id: true },
      });

      attributesCreated += 1;
      idByKey.set(attribute.key, created.id);

      for (const [index, name] of (attribute.choices ?? []).entries()) {
        await client.entityAttributeChoice.create({
          data: { attributeId: created.id, workspaceId, name, position: index },
        });
      }
    }

    /**
     * All 63 columns would be unusable as a default grid, so the view decides
     * what shows. Every attribute still gets a field row, so switching one on
     * in grid settings is a flag flip rather than a create.
     */
    const existingView = await client.entityView.findFirst({
      where: { entityId: entity.id, isDefault: true },
      select: { id: true },
    });

    if (!existingView) {
      const view = await client.entityView.create({
        data: {
          entityId: entity.id,
          workspaceId,
          name: `All ${definition.name}s`,
          type: 'table',
          isDefault: true,
        },
        select: { id: true },
      });

      viewsCreated += 1;

      let fieldRank = LexoRank.middle();

      for (const attribute of definition.attributes) {
        const attributeId = idByKey.get(attribute.key);

        if (!attributeId) {
          continue;
        }

        fieldRank = fieldRank.genNext();

        const field = await client.entityViewField.create({
          data: {
            viewId: view.id,
            workspaceId,
            position: fieldRank.toString(),
            isVisible: attribute.visible,
            isPinned: attribute.pinned,
          },
          select: { id: true },
        });

        await client.entityViewFieldPath.create({
          data: { fieldId: field.id, position: 0, attributeId, workspaceId },
        });
      }
    }
  }

  return { entitiesCreated, attributesCreated, viewsCreated };
};
