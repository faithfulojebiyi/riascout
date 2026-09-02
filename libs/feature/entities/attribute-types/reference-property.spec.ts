import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REFERENCE_COLUMNS } from './reference-columns.js';
import { referenceProperty } from './reference-property.js';

/**
 * The record page reads projected values off a prisma row by property name, and
 * a miss yields undefined rather than an error — the panel field just goes
 * blank. reference-columns.spec.ts proves the column exists in postgres; this
 * proves the name we read it by in typescript resolves to that same column.
 */
describe('reference property mapping', () => {
  const MODEL: Record<string, string> = {
    advisor_search: 'AdvisorSearch',
    firm_search: 'FirmSearch',
  };

  const schema = readFileSync(
    join(import.meta.dirname, '../../../../prisma/schema.prisma'),
    'utf8',
  );

  /** property name -> the postgres column it maps to, per model */
  const fieldsOf = (model: string): Map<string, string> => {
    const body = new RegExp(`^model ${model} \\{$([\\s\\S]*?)^\\}$`, 'm').exec(
      schema,
    )?.[1];

    if (!body) {
      throw new Error(`model ${model} not found in schema.prisma`);
    }

    const fields = new Map<string, string>();

    for (const line of body.split('\n')) {
      const field = /^\s{2}(\w+)\s+\S/.exec(line);

      if (!field) {
        continue;
      }

      const mapped = /@map\("([^"]+)"\)/.exec(line);

      fields.set(field[1], mapped?.[1] ?? field[1]);
    }

    return fields;
  };

  const models = new Map(
    Object.entries(MODEL).map(([source, model]) => [source, fieldsOf(model)]),
  );

  for (const [key, reference] of REFERENCE_COLUMNS) {
    it(`${key} resolves to a prisma property on ${MODEL[reference.source]}`, () => {
      const fields = models.get(reference.source);
      const property = referenceProperty(reference.column);

      expect(fields?.has(property)).toBe(true);
      expect(fields?.get(property)).toBe(reference.column);
    });
  }
});
