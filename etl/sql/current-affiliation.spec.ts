import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sqlPath = fileURLToPath(
  new URL('./044-current-affiliation.sql', import.meta.url),
);

function completenessPredicate(): string {
  const sql = readFileSync(sqlPath, 'utf8');
  const match =
    /Measured:[\s\S]*?\*\/\s*(?<predicate>[\s\S]*?)\s+from individual_collection_runs r/.exec(
      sql,
    );

  if (!match?.groups?.predicate) {
    throw new Error('Could not locate the production completeness predicate');
  }

  return match.groups.predicate;
}

function evaluatePredicate(predicate: string, values: string): boolean {
  const query = `
    select (${predicate}) as is_complete
    from (values ${values}) as r(
      status,
      collection_completed_at,
      expected_individual_count,
      retrieved_individual_count,
      expected_page_requests,
      completed_page_requests
    )
  `;
  const output = execFileSync(
    'duckdb',
    [':memory:', '-csv', '-noheader', query],
    {
      encoding: 'utf8',
    },
  );

  return output.trim() === 'true';
}

describe('current-affiliation collection completeness', () => {
  it.each([
    {
      name: 'accepts a published run with exact individual and page counts',
      values: "('published', timestamp '2026-09-01 12:00:00', 10, 10, 2, 2)",
      expected: true,
    },
    {
      name: 'rejects a running run with otherwise exact counts',
      values: "('running', timestamp '2026-09-01 12:00:00', 10, 10, 2, 2)",
      expected: false,
    },
    {
      name: 'rejects a published run with extra retrieved individuals',
      values: "('published', timestamp '2026-09-01 12:00:00', 10, 11, 2, 2)",
      expected: false,
    },
    {
      name: 'rejects a published run with extra completed pages',
      values: "('published', timestamp '2026-09-01 12:00:00', 10, 10, 2, 3)",
      expected: false,
    },
    {
      name: 'rejects a published run below either expected count',
      values: "('published', timestamp '2026-09-01 12:00:00', 10, 9, 2, 1)",
      expected: false,
    },
    {
      name: 'rejects a published run without a completion timestamp',
      values: "('published', null, 10, 10, 2, 2)",
      expected: false,
    },
  ])('$name', ({ values, expected }) => {
    expect(evaluatePredicate(completenessPredicate(), values)).toBe(expected);
  });
});
