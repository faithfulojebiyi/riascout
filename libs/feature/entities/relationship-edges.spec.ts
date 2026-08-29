import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  canonicaliseEdges,
  EdgeCardinalityError,
  isCardinalityViolation,
  relDispatch,
  writeCanonicalEdges,
  type AttributeMeta,
  type EdgeInput,
  type EdgeWriter,
} from './relationship-edges.js';

const attr = (
  over: Partial<AttributeMeta> & { id: string },
): AttributeMeta => ({
  entityId: 'e1',
  type: 'relationship',
  isMultiValue: false,
  relationshipType: 'manyToOne',
  isCanonicalSide: true,
  otherRelationshipSideAttributeId: null,
  referenceColumn: null,
  ...over,
});

/** stands in for the prisma client; records what would be written */
const fakeWriter = (
  attrs: {
    id: string;
    isCanonicalSide: boolean | null;
    otherRelationshipSideAttributeId: string | null;
  }[],
  onCreate?: () => never,
) => {
  const written: EdgeInput[][] = [];

  const client: EdgeWriter = {
    entityAttribute: { findMany: async () => attrs },
    entityRecordRelationship: {
      createMany: async ({ data }) => {
        if (onCreate) {
          onCreate();
        }

        written.push(data as EdgeInput[]);

        return { count: data.length };
      },
    },
  };

  return { client, written };
};

describe('relationship edges', () => {
  describe('relDispatch', () => {
    it('reads the canonical side directly', () => {
      expect(relDispatch(attr({ id: 'a' }))).toEqual({
        attrId: 'a',
        sourceCol: 'source_record_id',
        targetCol: 'target_record_id',
      });
    });

    it('flips columns and attribute id on the non-canonical side', () => {
      expect(
        relDispatch(
          attr({
            id: 'b',
            isCanonicalSide: false,
            otherRelationshipSideAttributeId: 'a',
          }),
        ),
      ).toEqual({
        attrId: 'a',
        sourceCol: 'target_record_id',
        targetCol: 'source_record_id',
      });
    });

    it('treats a null canonical flag as canonical', () => {
      expect(relDispatch(attr({ id: 'a', isCanonicalSide: null })).attrId).toBe(
        'a',
      );
    });
  });

  describe('canonicaliseEdges', () => {
    const edge = (attributeId: string): EdgeInput => ({
      attributeId,
      sourceRecordId: 'r-source',
      targetRecordId: 'r-target',
      workspaceId: 'w1',
      relationshipType: 'manyToOne',
    });

    it('leaves a canonical-side edge untouched', async () => {
      const { client } = fakeWriter([
        {
          id: 'a',
          isCanonicalSide: true,
          otherRelationshipSideAttributeId: 'b',
        },
      ]);

      await expect(canonicaliseEdges(client, [edge('a')])).resolves.toEqual([
        edge('a'),
      ]);
    });

    it('flips a non-canonical edge into the canonical frame', async () => {
      const { client } = fakeWriter([
        {
          id: 'b',
          isCanonicalSide: false,
          otherRelationshipSideAttributeId: 'a',
        },
      ]);

      await expect(canonicaliseEdges(client, [edge('b')])).resolves.toEqual([
        {
          attributeId: 'a',
          sourceRecordId: 'r-target',
          targetRecordId: 'r-source',
          workspaceId: 'w1',
          relationshipType: 'manyToOne',
        },
      ]);
    });

    it('rejects a non-canonical attribute with no paired side', async () => {
      const { client } = fakeWriter([
        {
          id: 'b',
          isCanonicalSide: false,
          otherRelationshipSideAttributeId: null,
        },
      ]);

      await expect(canonicaliseEdges(client, [edge('b')])).rejects.toThrow(
        /no paired side/,
      );
    });

    it('rejects an unknown attribute rather than writing it', async () => {
      const { client } = fakeWriter([]);

      await expect(
        canonicaliseEdges(client, [edge('missing')]),
      ).rejects.toThrow(/not found/);
    });

    it('short-circuits on an empty batch', async () => {
      const { client } = fakeWriter([]);

      await expect(canonicaliseEdges(client, [])).resolves.toEqual([]);
    });
  });

  describe('writeCanonicalEdges', () => {
    const edge: EdgeInput = {
      attributeId: 'a',
      sourceRecordId: 'r1',
      targetRecordId: 'r2',
      workspaceId: 'w1',
      relationshipType: 'manyToOne',
    };

    it('writes in the canonical frame', async () => {
      const { client, written } = fakeWriter([
        {
          id: 'a',
          isCanonicalSide: true,
          otherRelationshipSideAttributeId: null,
        },
      ]);

      await expect(
        writeCanonicalEdges(client, [edge], 'Employer'),
      ).resolves.toBe(1);
      expect(written[0]).toEqual([edge]);
    });

    it.each([['P2002'], ['23505']])(
      'maps %s to a cardinality error',
      async (code) => {
        const { client } = fakeWriter(
          [
            {
              id: 'a',
              isCanonicalSide: true,
              otherRelationshipSideAttributeId: null,
            },
          ],
          () => {
            throw Object.assign(new Error('unique violation'), { code });
          },
        );

        await expect(
          writeCanonicalEdges(client, [edge], 'Employer'),
        ).rejects.toBeInstanceOf(EdgeCardinalityError);
      },
    );

    it('rethrows an unrelated error unchanged', async () => {
      const { client } = fakeWriter(
        [
          {
            id: 'a',
            isCanonicalSide: true,
            otherRelationshipSideAttributeId: null,
          },
        ],
        () => {
          throw Object.assign(new Error('connection lost'), { code: '08006' });
        },
      );

      await expect(
        writeCanonicalEdges(client, [edge], 'Employer'),
      ).rejects.toThrow(/connection lost/);
    });

    it('does not query on an empty batch', async () => {
      const { client, written } = fakeWriter([]);

      await expect(writeCanonicalEdges(client, [], 'Employer')).resolves.toBe(
        0,
      );
      expect(written).toEqual([]);
    });
  });

  it('recognises both postgres and prisma conflict codes', () => {
    expect(isCardinalityViolation({ code: 'P2002' })).toBe(true);
    expect(isCardinalityViolation({ code: '23505' })).toBe(true);
    expect(isCardinalityViolation({ code: '08006' })).toBe(false);
    expect(isCardinalityViolation(null)).toBe(false);
  });
});

/**
 * The application check only matters if the database actually rejects the
 * second edge. These exercise the partial unique indexes directly.
 */
describe('cardinality is enforced by the database', () => {
  let db: Client;

  const ws = '77777777-7777-4777-8777-777777777777';
  const entity = '76767676-7676-4676-8676-767676767676';
  const attrId = '75757575-7575-4575-8575-757575757575';
  const rec = (n: number) => `7000000${n}-7777-4777-8777-777777777777`;

  beforeAll(async () => {
    const connectionString = process.env.APP_DATABASE_URL;

    if (!connectionString) {
      throw new Error('APP_DATABASE_URL is required');
    }

    db = new Client({ connectionString });
    await db.connect();
  });

  afterAll(async () => {
    await db?.end();
  });

  const seed = async (relType: string): Promise<void> => {
    // workspace_id is a FK to organization.id
    await db.query(
      `insert into app.organization (id, name, slug) values ($1, 'Test WS', $1)
       on conflict do nothing`,
      [ws],
    );
    await db.query(
      `insert into app.entity (id, workspace_id, name, slug)
       values ($1, $2, 'T', 'test-entity') on conflict do nothing`,
      [entity, ws],
    );
    await db.query(
      `insert into app.entity_attribute
         (id, entity_id, workspace_id, label, key, type, position, relationship_type, is_canonical_side)
       values ($1, $2, $3, 'Employer', 'employer', 'relationship', 'a0',
               $4::"app"."attribute_relationship_type", true)
       on conflict do nothing`,
      [attrId, entity, ws, relType],
    );

    for (const n of [1, 2, 3]) {
      await db.query(
        `insert into app.entity_record (id, entity_id, workspace_id)
         values ($1, $2, $3) on conflict do nothing`,
        [rec(n), entity, ws],
      );
    }
  };

  const insertEdge = (
    source: string,
    target: string,
    relType: string,
  ): Promise<unknown> =>
    db.query(
      `insert into app.entity_record_relationship
         (id, source_record_id, target_record_id, attribute_id, workspace_id, relationship_type)
       values (gen_random_uuid(), $1, $2, $3, $4, $5::"app"."attribute_relationship_type")`,
      [source, target, attrId, ws, relType],
    );

  it('rejects a second target on a manyToOne source', async () => {
    await db.query('begin');

    try {
      await seed('manyToOne');
      await insertEdge(rec(1), rec(2), 'manyToOne');

      await expect(insertEdge(rec(1), rec(3), 'manyToOne')).rejects.toThrow(
        /edge_many_to_one_source/,
      );
    } finally {
      await db.query('rollback');
    }
  });

  it('rejects a second source on a oneToMany target', async () => {
    await db.query('begin');

    try {
      await seed('oneToMany');
      await insertEdge(rec(1), rec(2), 'oneToMany');

      await expect(insertEdge(rec(3), rec(2), 'oneToMany')).rejects.toThrow(
        /edge_one_to_many_target/,
      );
    } finally {
      await db.query('rollback');
    }
  });

  it('rejects reuse of either side on oneToOne', async () => {
    await db.query('begin');

    try {
      await seed('oneToOne');
      await insertEdge(rec(1), rec(2), 'oneToOne');

      await expect(insertEdge(rec(1), rec(3), 'oneToOne')).rejects.toThrow(
        /edge_one_to_one/,
      );
    } finally {
      await db.query('rollback');
    }
  });

  it('allows manyToMany to fan out in both directions', async () => {
    await db.query('begin');

    try {
      await seed('manyToMany');
      await insertEdge(rec(1), rec(2), 'manyToMany');

      await expect(
        insertEdge(rec(1), rec(3), 'manyToMany'),
      ).resolves.toBeDefined();
      await expect(
        insertEdge(rec(3), rec(2), 'manyToMany'),
      ).resolves.toBeDefined();
    } finally {
      await db.query('rollback');
    }
  });

  it('still rejects an exact duplicate edge on manyToMany', async () => {
    await db.query('begin');

    try {
      await seed('manyToMany');
      await insertEdge(rec(1), rec(2), 'manyToMany');

      await expect(insertEdge(rec(1), rec(2), 'manyToMany')).rejects.toThrow(
        /unique|duplicate/i,
      );
    } finally {
      await db.query('rollback');
    }
  });
});
