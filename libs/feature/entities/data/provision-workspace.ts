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
      data: {
        workspaceId: string;
        name: string;
        slug: string;
        sourceKind: string;
      };
      select: { id: true };
    }) => Promise<{ id: string }>;
  };
  entityAttribute: {
    findMany: (args: {
      where: { entityId: string };
      select: Record<string, true>;
    }) => Promise<
      Array<{
        id: string;
        key: string;
        label: string;
        type: string;
        isMultiValue: boolean;
        referenceColumn: string | null;
        isEditable: boolean;
        isSystem: boolean;
        isPrimary: boolean;
        isUnique: boolean;
        isEnriched: boolean;
        icon: string | null;
        description: string | null;
        group: string | null;
      }>
    >;
    create: (args: {
      data: Record<string, unknown>;
      select: { id: true };
    }) => Promise<{
      id: string;
    }>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
      select: { id: true };
    }) => Promise<{ id: string }>;
  };
  entityAttributeChoice: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  entityView: {
    findFirst: (args: {
      where: { entityId: string; isDefault: boolean };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: {
      data: Record<string, unknown>;
      select: { id: true };
    }) => Promise<{
      id: string;
    }>;
  };
  entityViewField: {
    findMany: (args: {
      where: { viewId: string };
      select: { id: true; position: true };
    }) => Promise<{ id: string; position: string }[]>;
    create: (args: {
      data: Record<string, unknown>;
      select: { id: true };
    }) => Promise<{
      id: string;
    }>;
  };
  entityViewFieldPath: {
    findMany: (args: {
      where: { fieldId: { in: string[] } };
      select: { attributeId: true };
    }) => Promise<{ attributeId: string }[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

export type ProvisionResult = {
  entitiesCreated: number;
  attributesCreated: number;
  attributesUpdated: number;
  viewsCreated: number;
  fieldsCreated: number;
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
  let attributesUpdated = 0;
  let viewsCreated = 0;
  let fieldsCreated = 0;

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
      select: {
        id: true,
        key: true,
        label: true,
        type: true,
        isMultiValue: true,
        referenceColumn: true,
        isEditable: true,
        isSystem: true,
        isPrimary: true,
        isUnique: true,
        isEnriched: true,
        icon: true,
        description: true,
        group: true,
      },
    });

    const idByKey = new Map(existingAttributes.map((a) => [a.key, a.id]));
    const existingByKey = new Map(
      existingAttributes.map((attribute) => [attribute.key, attribute]),
    );

    // LexoRank keeps columns reorderable without renumbering the whole set
    let rank = LexoRank.middle();

    for (const attribute of definition.attributes) {
      rank = rank.genNext();

      const desiredMetadata = {
        label: attribute.label,
        type: attribute.type,
        isMultiValue: attribute.isMultiValue,
        referenceColumn: attribute.referenceColumn,
        isEditable: attribute.isEditable,
        isSystem: true,
        isPrimary: attribute.isPrimary,
        isUnique: attribute.isUnique ?? false,
        isEnriched: attribute.isEnriched ?? false,
        icon: attribute.icon ?? null,
        description: attribute.description ?? null,
        group: attribute.group,
      };
      const current = existingByKey.get(attribute.key);

      if (current) {
        const isStale = Object.entries(desiredMetadata).some(
          ([field, value]) =>
            current[field as keyof typeof desiredMetadata] !== value,
        );

        if (isStale) {
          await client.entityAttribute.update({
            where: { id: current.id },
            data: desiredMetadata,
            select: { id: true },
          });
          attributesUpdated += 1;
        }

        continue;
      }

      const created = await client.entityAttribute.create({
        data: {
          entityId: entity.id,
          workspaceId,
          key: attribute.key,
          ...desiredMetadata,
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

    const view =
      existingView ??
      (await client.entityView.create({
        data: {
          entityId: entity.id,
          workspaceId,
          name: `All ${definition.name}s`,
          type: 'table',
          isDefault: true,
        },
        select: { id: true },
      }));

    if (!existingView) {
      viewsCreated += 1;
    }

    /**
     * Fields are backfilled, not only created with the view. A column added to
     * the allowlist after a workspace exists otherwise has no field, so it never
     * appears in grid settings and cannot be switched on.
     */
    const fields = await client.entityViewField.findMany({
      where: { viewId: view.id },
      select: { id: true, position: true },
    });

    const paths =
      fields.length > 0
        ? await client.entityViewFieldPath.findMany({
            where: { fieldId: { in: fields.map((f) => f.id) } },
            select: { attributeId: true },
          })
        : [];

    const fielded = new Set(paths.map((p) => p.attributeId));

    let fieldRank = fields.reduce(
      (highest, field) =>
        field.position > highest.toString()
          ? LexoRank.parse(field.position)
          : highest,
      LexoRank.middle(),
    );

    for (const attribute of definition.attributes) {
      const attributeId = idByKey.get(attribute.key);

      if (!attributeId || fielded.has(attributeId)) {
        continue;
      }

      fieldRank = fieldRank.genNext();

      const field = await client.entityViewField.create({
        data: {
          viewId: view.id,
          workspaceId,
          position: fieldRank.toString(),
          // a backfilled column stays off: turning it on would rearrange a grid
          // the user has already arranged
          isVisible: existingView ? false : attribute.visible,
          isPinned: existingView ? false : attribute.pinned,
        },
        select: { id: true },
      });

      await client.entityViewFieldPath.create({
        data: { fieldId: field.id, position: 0, attributeId, workspaceId },
      });

      fieldsCreated += 1;
    }
  }

  return {
    entitiesCreated,
    attributesCreated,
    attributesUpdated,
    viewsCreated,
    fieldsCreated,
  };
};
