import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const productionSql = readFileSync(
  fileURLToPath(new URL('./046-firm-derived.sql', import.meta.url)),
  'utf8',
);

describe('firm account ratios and comparable-population percentiles', () => {
  it('uses account and linked-adviser denominators without ranking null metrics', () => {
    const query = `
      create schema market;
      create table market.firm_current_filing (firm_crd bigint, filing_id text);
      create table market.advisor_registration (
        employer_firm_crd bigint, advisor_crd bigint, end_date date
      );
      create table market.firm_fact_affiliation (
        filing_id text, related_sec_number text
      );
      create table market.firm_fact_metrics (
        filing_id text, regulatory_aum numeric, account_count bigint,
        employee_count bigint
      );
      create table market.firm_fact_registration (filing_id text, is_era boolean);
      create table market.dim_aum_band (code text, lower_aum numeric, upper_aum numeric);
      create table market.firm_fact_derived (
        filing_id text, advisor_count integer,
        aum_per_advisor numeric, aum_per_account numeric,
        aum_per_employee numeric, accounts_per_advisor numeric,
        aum_percentile integer, aum_per_advisor_percentile integer,
        aum_per_account_percentile integer, channel_code text, aum_band_code text
      );

      insert into market.firm_current_filing values
        (1, 'F-A'), (2, 'F-B'), (3, 'F-C'), (4, 'F-D');
      insert into market.firm_fact_metrics values
        ('F-A', 100, 10, 5),
        ('F-B', 200, 20, 10),
        ('F-C', null, 30, 15),
        ('F-D', 400, null, 20);
      insert into market.firm_fact_registration values
        ('F-A', false), ('F-B', false), ('F-C', false), ('F-D', false);
      insert into market.advisor_registration values
        (1, 101, null), (1, 102, null),
        (3, 301, null),
        (4, 401, null), (4, 402, null), (4, 403, null), (4, 404, null);

      ${productionSql}

      select filing_id, advisor_count, aum_per_advisor, aum_per_account,
             accounts_per_advisor, aum_percentile,
             aum_per_advisor_percentile, aum_per_account_percentile
      from market.firm_fact_derived
      order by filing_id;
    `;

    const output = execFileSync(
      'duckdb',
      [':memory:', '-csv', '-noheader', query],
      { encoding: 'utf8' },
    );

    expect(output.trim().split('\n')).toEqual([
      'F-A,2,50.000,10.000,5.000,0,0,0',
      'F-B,NULL,NULL,10.000,NULL,50,NULL,0',
      'F-C,1,NULL,NULL,30.000,NULL,NULL,NULL',
      'F-D,4,100.000,NULL,NULL,100,100,NULL',
    ]);
  });
});
