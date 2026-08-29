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
};

export type ProvisionResult = {
  entitiesCreated: number;
  attributesCreated: number;
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

    const present = new Set(
      (
        await client.entityAttribute.findMany({
          where: { entityId: entity.id },
          select: { id: true, key: true },
        })
      ).map((a) => a.key),
    );

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

      for (const [index, name] of (attribute.choices ?? []).entries()) {
        await client.entityAttributeChoice.create({
          data: { attributeId: created.id, workspaceId, name, position: index },
        });
      }
    }
  }

  return { entitiesCreated, attributesCreated };
};
