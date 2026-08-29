import type { AttributeRelationshipType, AttributeType } from '@orm/app';

export type AttributeMeta = {
  id: string;
  entityId: string;
  type: AttributeType;
  isMultiValue: boolean;
  relationshipType: AttributeRelationshipType | null;
  /** which side of a relationship pair owns the canonical edge row */
  isCanonicalSide: boolean | null;
  otherRelationshipSideAttributeId: string | null;
  /** set for reference attributes; resolved against the allowlist, never trusted raw */
  referenceColumn: string | null;
};

export type EdgeDispatch = {
  attrId: string | null;
  sourceCol: 'source_record_id' | 'target_record_id';
  targetCol: 'source_record_id' | 'target_record_id';
};

/**
 * Edges are stored once, on the canonical side. Reading from the non-canonical
 * side flips the columns and dispatches to the paired attribute id.
 */
export const relDispatch = (attr: AttributeMeta): EdgeDispatch => {
  if (attr.isCanonicalSide !== false) {
    return {
      attrId: attr.id,
      sourceCol: 'source_record_id',
      targetCol: 'target_record_id',
    };
  }

  return {
    attrId: attr.otherRelationshipSideAttributeId,
    sourceCol: 'target_record_id',
    targetCol: 'source_record_id',
  };
};

export type EdgeInput = {
  attributeId: string;
  sourceRecordId: string;
  targetRecordId: string;
  workspaceId: string;
  relationshipType: AttributeRelationshipType | null;
};

/** the subset of the client these helpers need, so they are trivially testable */
export type EdgeWriter = {
  entityAttribute: {
    findMany: (args: {
      where: { id: { in: string[] } };
      select: {
        id: true;
        isCanonicalSide: true;
        otherRelationshipSideAttributeId: true;
      };
    }) => Promise<
      {
        id: string;
        isCanonicalSide: boolean | null;
        otherRelationshipSideAttributeId: string | null;
      }[]
    >;
  };
  entityRecordRelationship: {
    createMany: (args: {
      data: Omit<EdgeInput, never>[];
      skipDuplicates: boolean;
    }) => Promise<{ count: number }>;
  };
};

export class EdgeCardinalityError extends Error {
  readonly code = 'RELATIONSHIP_CARDINALITY_VIOLATION';

  constructor(readonly attributeLabel: string) {
    super(
      `Cannot create relationship for "${attributeLabel}" — a record on one side is ` +
        'already linked through this attribute',
    );
    this.name = 'EdgeCardinalityError';
  }
}

/**
 * Postgres raises 23505 on the partial cardinality indexes; Prisma surfaces it
 * as P2002. Either way it is a conflict, not a server error.
 */
export const isCardinalityViolation = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = (error as { code?: string }).code;

  return code === 'P2002' || code === '23505';
};

/**
 * Edges are stored once, on the canonical side. A write arriving through the
 * non-canonical attribute is flipped to the canonical frame first — otherwise
 * the same link is storable twice and neither cardinality index sees both.
 */
export const canonicaliseEdges = async (
  client: EdgeWriter,
  edges: EdgeInput[],
): Promise<EdgeInput[]> => {
  if (edges.length === 0) {
    return [];
  }

  const attrs = await client.entityAttribute.findMany({
    where: { id: { in: [...new Set(edges.map((e) => e.attributeId))] } },
    select: {
      id: true,
      isCanonicalSide: true,
      otherRelationshipSideAttributeId: true,
    },
  });

  const byId = new Map(attrs.map((a) => [a.id, a]));

  return edges.map((edge) => {
    const attr = byId.get(edge.attributeId);

    if (!attr) {
      throw new Error(`Attribute ${edge.attributeId} not found`);
    }

    if (attr.isCanonicalSide !== false) {
      return edge;
    }

    if (!attr.otherRelationshipSideAttributeId) {
      throw new Error(
        `Non-canonical attribute ${edge.attributeId} has no paired side`,
      );
    }

    return {
      attributeId: attr.otherRelationshipSideAttributeId,
      sourceRecordId: edge.targetRecordId,
      targetRecordId: edge.sourceRecordId,
      workspaceId: edge.workspaceId,
      relationshipType: edge.relationshipType,
    };
  });
};

/** the only sanctioned writer for edges — canonicalise, insert, map conflicts */
export const writeCanonicalEdges = async (
  client: EdgeWriter,
  edges: EdgeInput[],
  attributeLabel: string,
): Promise<number> => {
  if (edges.length === 0) {
    return 0;
  }

  const canonical = await canonicaliseEdges(client, edges);

  try {
    const { count } = await client.entityRecordRelationship.createMany({
      data: canonical,
      skipDuplicates: true,
    });

    return count;
  } catch (error) {
    if (isCardinalityViolation(error)) {
      throw new EdgeCardinalityError(attributeLabel);
    }

    throw error;
  }
};
