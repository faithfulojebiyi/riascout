import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AttributeType } from '@orm/app';
import {
  REFERENCE_COLUMNS,
  type ReferenceColumn,
} from './reference-columns.js';

/**
 * The allowlist names market columns the filter compiler emits directly into
 * SQL. Nothing else checks those names exist, so without this test a rename in
 * the projection silently turns every filter on that column into a dropped
 * condition — a fail-soft compiler reports no error.
 */
describe('reference column allowlist', () => {
  type ColumnRow = { data_type: string; udt_name: string };

  let db: Client;
  let actual: Map<string, ColumnRow>;

  const SOURCE_TABLE: Record<ReferenceColumn['source'], string> = {
    advisor_search: 'advisor_search',
    firm_search: 'firm_search',
  };

  /** postgres types each attribute type may legitimately sit on */
  const COMPATIBLE: Partial<Record<AttributeType, ReadonlySet<string>>> = {
    text: new Set(['text', 'character varying', 'character']),
    number: new Set([
      'integer',
      'bigint',
      'smallint',
      'numeric',
      'double precision',
      'real',
    ]),
    currency: new Set(['numeric']),
    percentage: new Set(['numeric']),
    boolean: new Set(['boolean']),
    date: new Set([
      'date',
      'timestamp with time zone',
      'timestamp without time zone',
    ]),
  };

  /** array columns report data_type ARRAY; the element type is in udt_name */
  const ELEMENT_TYPE: Record<string, string> = {
    _text: 'text',
    _varchar: 'character varying',
    _int4: 'integer',
    _int8: 'bigint',
    _numeric: 'numeric',
    _bool: 'boolean',
    _date: 'date',
  };

  beforeAll(async () => {
    const connectionString = process.env.APP_DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'APP_DATABASE_URL is required to run reference column tests',
      );
    }

    db = new Client({ connectionString });
    await db.connect();

    const { rows } = await db.query<{ table_name: string } & ColumnRow>(
      `select table_name, column_name, data_type, udt_name
         from information_schema.columns
        where table_schema = 'market'
          and table_name in ('advisor_search', 'firm_search')`,
    );

    actual = new Map(
      rows.map((r) => [
        `${r.table_name}.${(r as unknown as { column_name: string }).column_name}`,
        { data_type: r.data_type, udt_name: r.udt_name },
      ]),
    );
  });

  afterAll(async () => {
    await db?.end();
  });

  const entries = [...REFERENCE_COLUMNS.entries()];

  it('is not empty', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('both projection tables exist', () => {
    expect(actual.size).toBeGreaterThan(0);
  });

  /**
   * One assertion per entry rather than an early return on a missing column —
   * a skipped type check reads as a pass, which is the failure mode this whole
   * test exists to prevent.
   */
  it.each(entries)('%s resolves to a compatible market column', (_key, ref) => {
    const qualified = `${SOURCE_TABLE[ref.source]}.${ref.column}`;
    const column = actual.get(qualified);

    const observed = column
      ? {
          isArray: column.data_type === 'ARRAY',
          type:
            column.data_type === 'ARRAY'
              ? (ELEMENT_TYPE[column.udt_name] ?? column.udt_name)
              : column.data_type,
        }
      : null;

    expect(observed, `market.${qualified} does not exist`).not.toBeNull();
    expect(
      observed?.isArray,
      `${qualified} array-ness disagrees with the allowlist`,
    ).toBe(ref.isArray ?? false);
    expect(
      [...(COMPATIBLE[ref.type] ?? [])],
      `${qualified} is ${observed?.type}, which ${ref.type} operators cannot emit against`,
    ).toContain(observed?.type);
  });

  it('every key is addressable through the resolver', () => {
    const unresolved = entries.filter(
      ([key]) => REFERENCE_COLUMNS.get(key) === undefined,
    );

    expect(unresolved).toEqual([]);
  });
});
