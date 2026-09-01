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
    /Measured:[\s\S]*?\*\/\s*(?<predicate>[\s\S]*?)(?=\s+(?:as is_complete\s+)?from individual_collection_runs r)/.exec(
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

interface ObservationLoaderSql {
  eligibility: string;
  loaders: string;
  append: string;
}

function observationLoaderSql(): ObservationLoaderSql {
  const sql = readFileSync(sqlPath, 'utf8');
  const eligibility =
    /(?<fragment>create or replace temp table eligible_individual_collection_runs[\s\S]*?\nwhere is_complete;)/i.exec(
      sql,
    )?.groups?.fragment ?? '';
  const loaders =
    /(?<fragment>insert into pg\.market\.advisor_firm_observation__load[\s\S]*?)\ncommit;/.exec(
      sql,
    )?.groups?.fragment;
  const append =
    /(?<fragment>insert into market\.advisor_firm_observation \([\s\S]*?on conflict do nothing;)/.exec(
      sql,
    )?.groups?.fragment;

  if (!loaders || !append) {
    throw new Error('Could not locate the production observation loaders');
  }

  return { eligibility, loaders, append };
}

function runObservationLoadCycle(sql: ObservationLoaderSql): string {
  return `
    ${sql.eligibility}
    delete from pg.market.advisor_firm_observation__load;
    ${sql.loaders}
    use pg;
    ${sql.append}
    use memory;
  `;
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

  it('persists observations only after the collection becomes eligible', () => {
    const productionSql = observationLoaderSql();
    const query = `
      attach ':memory:' as pg;
      create schema pg.market;
      create table individuals (individual_crd bigint primary key);
      create table individual_collection_runs (
        collection_id text primary key,
        status text,
        collection_started_at timestamp,
        collection_completed_at timestamp,
        expected_individual_count integer,
        retrieved_individual_count integer,
        expected_page_requests integer,
        completed_page_requests integer
      );
      create table individual_current_registrations (
        individual_crd bigint,
        employer_firm_crd bigint,
        jurisdiction text,
        collection_id text,
        registration_category text,
        status text
      );
      create table pg.market.dim_registration_status (
        code text primary key,
        registration_current boolean,
        can_conduct_business boolean
      );
      create table pg.market.firm (firm_crd bigint primary key);
      create table pg.market.advisor_firm_observation__load (
        advisor_crd bigint,
        observed_on date,
        firm_crd bigint,
        jurisdiction text,
        collection_id text,
        registration_category text,
        source_code text,
        status_code text,
        registration_current boolean,
        can_conduct_business boolean
      );
      create table pg.market.advisor_firm_observation (
        advisor_crd bigint,
        observed_on date,
        firm_crd bigint,
        jurisdiction text,
        collection_id text,
        registration_category text,
        source_code text,
        status_code text,
        registration_current boolean,
        can_conduct_business boolean,
        unique (advisor_crd, collection_id, firm_crd, jurisdiction)
      );

      insert into individuals values (100), (101);
      insert into individual_collection_runs values
        ('guard-running', 'running', timestamp '2026-08-31 09:00:00',
         timestamp '2026-08-31 10:00:00', 2, 2, 1, 1),
        ('publish-later', 'running', timestamp '2026-09-01 09:00:00',
         timestamp '2026-09-01 10:00:00', 2, 2, 1, 1);
      insert into pg.market.dim_registration_status values
        ('REVOKED', false, false),
        ('APPROVED', true, true);
      insert into pg.market.firm values (200), (300);
      insert into individual_current_registrations values
        (101, 200, 'CA', 'guard-running', 'STATE', 'REVOKED');

      ${runObservationLoadCycle(productionSql)}

      update individual_collection_runs
      set status = 'published'
      where collection_id = 'publish-later';
      insert into individual_current_registrations values
        (100, 300, 'TX', 'publish-later', 'STATE', 'APPROVED');

      ${runObservationLoadCycle(productionSql)}

      select
        count(*) filter (
          where advisor_crd = 100 and collection_id = 'publish-later'
            and firm_crd = 300 and jurisdiction = 'TX'
            and status_code = 'APPROVED' and can_conduct_business
        ),
        count(*) filter (
          where advisor_crd = 100 and collection_id = 'publish-later'
            and firm_crd is null
        ),
        count(*) filter (where collection_id = 'guard-running'),
        count(*) filter (
          where advisor_crd = 100 and collection_id = 'publish-later'
        )
      from pg.market.advisor_firm_observation;
    `;
    const output = execFileSync(
      'duckdb',
      [':memory:', '-csv', '-noheader', query],
      { encoding: 'utf8' },
    );
    const [realFirmRows, staleAbsenceRows, incompleteRunRows, advisorRows] =
      output.trim().split(',').map(Number);

    expect(realFirmRows).toBe(1);
    expect(staleAbsenceRows).toBe(0);
    expect(incompleteRunRows).toBe(0);
    expect(advisorRows).toBe(1);
  });
});
