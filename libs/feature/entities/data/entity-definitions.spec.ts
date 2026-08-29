import { describe, expect, it } from 'vitest';

import { REFERENCE_COLUMNS } from '../attribute-types/reference-columns.js';
import { ADVISOR_ENTITY, DEFAULT_ENTITIES, FIRM_ENTITY } from './entity-definitions.js';
import {
  ADVISOR_REFERENCE_ATTRIBUTES,
  ADVISOR_WORKFLOW_ATTRIBUTES,
  FIRM_REFERENCE_ATTRIBUTES,
  FIRM_WORKFLOW_ATTRIBUTES,
} from './system-attributes.js';

const allKeys = [
  ...Object.values(ADVISOR_REFERENCE_ATTRIBUTES),
  ...Object.values(FIRM_REFERENCE_ATTRIBUTES),
  ...Object.values(ADVISOR_WORKFLOW_ATTRIBUTES),
  ...Object.values(FIRM_WORKFLOW_ATTRIBUTES),
];

describe('system attribute keys', () => {
  it('are all uuid7', () => {
    // version nibble 7, variant 10xx — matches @default(uuid(7)) on our PKs
    const uuid7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const wrong = allKeys.filter((k) => !uuid7.test(k));

    expect(wrong).toEqual([]);
  });

  it('are unique across every entity', () => {
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });

  /**
   * A key is a workspace's permanent handle on a system attribute. Changing one
   * orphans every cell already written against it, in every workspace.
   */
  it('has one key per reference column, in both directions', () => {
    const referenceKeys = [
      ...Object.keys(ADVISOR_REFERENCE_ATTRIBUTES),
      ...Object.keys(FIRM_REFERENCE_ATTRIBUTES),
    ];

    expect(referenceKeys).toHaveLength(REFERENCE_COLUMNS.size);
  });
});

describe('default entities', () => {
  const seeded = DEFAULT_ENTITIES.flatMap((e) => e.attributes);

  it('seeds an attribute for every allowlisted reference column', () => {
    const seededRefs = new Set(
      seeded.filter((a) => a.referenceColumn !== null).map((a) => a.referenceColumn),
    );

    const missing = [...REFERENCE_COLUMNS.keys()].filter((k) => !seededRefs.has(k));

    expect(missing, 'allowlisted columns with no seeded attribute').toEqual([]);
  });

  it('seeds no reference attribute that is absent from the allowlist', () => {
    const stray = seeded
      .filter((a) => a.referenceColumn !== null)
      .filter((a) => !REFERENCE_COLUMNS.has(a.referenceColumn as string));

    expect(stray).toEqual([]);
  });

  it('marks every reference attribute non-editable', () => {
    const editable = seeded.filter((a) => a.referenceColumn !== null && a.isEditable);

    expect(editable).toEqual([]);
  });

  it('marks every workflow attribute editable', () => {
    const locked = seeded.filter((a) => a.referenceColumn === null && !a.isEditable);

    expect(locked).toEqual([]);
  });

  it('carries the array flag from the allowlist', () => {
    const mismatched = seeded
      .filter((a) => a.referenceColumn !== null)
      .filter((a) => {
        const ref = REFERENCE_COLUMNS.get(a.referenceColumn as string);

        return a.isMultiValue !== (ref?.isArray ?? false);
      });

    expect(mismatched).toEqual([]);
  });

  it('gives each entity a unique slug and a source kind', () => {
    expect(DEFAULT_ENTITIES.map((e) => e.slug)).toEqual(['advisor', 'firm']);
    expect(DEFAULT_ENTITIES.every((e) => e.sourceKind)).toBe(true);
  });

  it('gives every attribute a distinct key within its entity', () => {
    for (const entity of DEFAULT_ENTITIES) {
      const keys = entity.attributes.map((a) => a.key);

      expect(new Set(keys).size, `${entity.slug} has duplicate keys`).toBe(keys.length);
    }
  });

  it('gives the status attributes their choices', () => {
    const status = ADVISOR_ENTITY.attributes.find((a) => a.type === 'status');

    expect(status?.choices).toContain('Contacted');
    expect(FIRM_ENTITY.attributes.find((a) => a.type === 'status')?.choices?.length).toBeGreaterThan(
      0,
    );
  });
});
