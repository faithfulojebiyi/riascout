import { describe, expect, it } from 'vitest';

import { REFERENCE_COLUMNS } from '../attribute-types/reference-columns.js';
import { ATTRIBUTE_GROUPS, iconFor } from './column-meta.js';
import { ADVISOR_ENTITY, DEFAULT_ENTITIES } from './entity-definitions.js';
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
    const uuid7 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
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

    // >= not ==: a column removed from the allowlist keeps its key, because
    // reusing a retired uuid7 for a different column would rebind live cells
    expect(referenceKeys.length).toBeGreaterThanOrEqual(REFERENCE_COLUMNS.size);
  });
});

describe('default entities', () => {
  const seeded = DEFAULT_ENTITIES.flatMap((e) => e.attributes);

  it('seeds an attribute for every allowlisted reference column', () => {
    const seededRefs = new Set(
      seeded
        .filter((a) => a.referenceColumn !== null)
        .map((a) => a.referenceColumn),
    );

    const missing = [...REFERENCE_COLUMNS.keys()].filter(
      (k) => !seededRefs.has(k),
    );

    expect(missing, 'allowlisted columns with no seeded attribute').toEqual([]);
  });

  it('seeds no reference attribute that is absent from the allowlist', () => {
    const stray = seeded
      .filter((a) => a.referenceColumn !== null)
      .filter((a) => !REFERENCE_COLUMNS.has(a.referenceColumn as string));

    expect(stray).toEqual([]);
  });

  it('marks every reference attribute non-editable', () => {
    const editable = seeded.filter(
      (a) => a.referenceColumn !== null && a.isEditable,
    );

    expect(editable).toEqual([]);
  });

  it('marks every workflow attribute editable', () => {
    const locked = seeded.filter(
      (a) => a.referenceColumn === null && !a.isEditable,
    );

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

      expect(new Set(keys).size, `${entity.slug} has duplicate keys`).toBe(
        keys.length,
      );
    }
  });

  it('groups every attribute into a declared group', () => {
    const stray = seeded.filter((a) => !ATTRIBUTE_GROUPS.includes(a.group));

    expect(stray).toEqual([]);
  });

  it('orders attributes by group, so the record panel reads top to bottom', () => {
    for (const entity of DEFAULT_ENTITIES) {
      const order = entity.attributes.map((a) =>
        ATTRIBUTE_GROUPS.indexOf(a.group),
      );

      expect(
        [...order].sort((x, y) => x - y),
        `${entity.slug} is not grouped`,
      ).toEqual(order);
    }
  });

  /** 63 columns is not a usable default grid */
  it('keeps the default grid to a workable number of columns', () => {
    for (const entity of DEFAULT_ENTITIES) {
      const visible = entity.attributes.filter((a) => a.visible).length;

      // a usable opening grid, not a wall of columns
      expect(visible, `${entity.slug} default columns`).toBeLessThanOrEqual(12);
      expect(visible).toBeGreaterThan(5);
    }
  });

  it('pins exactly one column per entity', () => {
    for (const entity of DEFAULT_ENTITIES) {
      expect(entity.attributes.filter((a) => a.pinned)).toHaveLength(1);
    }
  });

  it('shows the identity columns by default', () => {
    const advisor = ADVISOR_ENTITY.attributes
      .filter((a) => a.visible)
      .map((a) => a.label);

    expect(advisor).toContain('Full Name');
    expect(advisor).toContain('Advisor CRD');
  });

  describe('contact channels', () => {
    const contact = ADVISOR_ENTITY.attributes.filter(
      (a) => a.group === 'Contact',
    );

    it('exist before the enrichment module does', () => {
      expect(contact.map((a) => a.label)).toEqual(
        expect.arrayContaining(['LinkedIn', 'Personal Email', 'Mobile Phone']),
      );
    });

    /** a recruiter types these today; enrichment writes the same cells later */
    it('are editable eav cells, not projected columns', () => {
      expect(
        contact.every((a) => a.isEditable && a.referenceColumn === null),
      ).toBe(true);
    });
  });

  it('marks exactly one primary attribute per entity', () => {
    for (const entity of DEFAULT_ENTITIES) {
      const primary = entity.attributes.filter((a) => a.isPrimary);

      expect(primary, `${entity.slug} primary`).toHaveLength(1);
      expect(primary[0]?.visible).toBe(true);
    }
  });

  /** the paste-into-IAPD identifier; hiding it on one entity and not the other reads as a bug */
  it('shows the CRD on both entities', () => {
    for (const entity of DEFAULT_ENTITIES) {
      const crd = entity.attributes.find(
        (a) => a.label.endsWith(' CRD') && a.visible,
      );

      expect(crd, `${entity.slug} has no visible CRD`).toBeDefined();
    }
  });

  it('surfaces experience in years, not months', () => {
    const visible = ADVISOR_ENTITY.attributes
      .filter((a) => a.visible)
      .map((a) => a.label);

    expect(visible).toContain('Years of Experience');
    expect(visible).toContain('Tenure (Years)');
    // months stay allowlisted for precise filtering, just not as a column
    expect(visible).not.toContain('Experience (Months)');
  });

  describe('social and contact channels', () => {
    const contact = ADVISOR_ENTITY.attributes.filter(
      (a) => a.group === 'Contact',
    );
    const labels = contact.map((a) => a.label);

    it('covers every channel ghost carries, plus a personal site', () => {
      expect(labels).toEqual(
        expect.arrayContaining([
          'LinkedIn',
          'X / Twitter',
          'Facebook',
          'Instagram',
          'Personal Email',
          'Mobile Phone',
        ]),
      );
    });

    it('types profiles as url and addresses by their own type', () => {
      const byLabel = new Map(contact.map((a) => [a.label, a]));

      expect(byLabel.get('Instagram')?.type).toBe('url');
      expect(byLabel.get('Personal Email')?.type).toBe('email');
      expect(byLabel.get('Mobile Phone')?.type).toBe('phone');
    });

    it('marks them enriched and unique, so the waterfall knows its targets', () => {
      expect(contact.every((a) => a.isEnriched)).toBe(true);
      expect(contact.every((a) => a.isUnique)).toBe(true);
    });

    /** five social columns would crowd out the facts that decide a call */
    it('shows only LinkedIn by default', () => {
      expect(contact.filter((a) => a.visible).map((a) => a.label)).toEqual([
        'LinkedIn',
      ]);
    });

    it('separates work email from personal, since only one is an outreach channel', () => {
      expect(labels).toContain('Work Email');
      expect(labels).toContain('Personal Email');
    });
  });

  describe('icons', () => {
    it('gives every attribute one', () => {
      const missing = seeded.filter((a) => !a.icon);

      expect(missing.map((a) => a.label)).toEqual([]);
    });

    /** derived from type, so a new column cannot be forgotten */
    it('falls back to the type icon when there is no override', () => {
      expect(iconFor('advisor.made_up_column', 'currency')).toBe('currency');
      expect(iconFor('advisor.made_up_column', 'email')).toBe('email');
    });

    it('prefers a semantic override over the type default', () => {
      // a CRD is a number, but 'hash' says less than 'badge'
      expect(iconFor('advisor.advisor_crd', 'number')).toBe('badge');
      expect(iconFor('advisor.state', 'text')).toBe('location');
    });

    it('never returns an empty icon, unlike the reference implementation', () => {
      expect(iconFor('nothing.at.all', 'unknown-type')).toBe('text');
    });
  });
});
