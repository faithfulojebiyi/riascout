# Firm AUM, Account, and Client Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct AUM, account, reported-client, client-category, and percentile semantics across canonical DuckDB, PostgreSQL, APIs, system attributes, and the firm dashboard.

**Architecture:** Treat Form ADV Item 5.F accounts and Item 5.D clients as different filing-grained facts. Canonical DuckDB preserves the raw account components, all 14 client categories, nullable fewer-than-five evidence, and a range-native reported-client total; ETL mirrors that contract into PostgreSQL and derives ratios and percentiles from explicitly eligible populations. Existing system-attribute UUIDs keep pointing to the same account measures under corrected names, while new reported-client range fields remain hidden in generic grids and are composed by the firm profile API.

**Tech Stack:** Python 3.12, DuckDB, pytest, Ruff, mypy, Bun 1.3+, TypeScript 6, Prisma 7/PostgreSQL, NestJS CQRS, zod, TypedSQL, React 19, TanStack Query, Recharts, Vitest, Orval.

**Spec:** `docs/superpowers/specs/2026-09-02-firm-aum-account-client-corrections-design.md`

## Global Constraints

- Adviser and firm CRDs remain stable `bigint` identities; names remain observations, never identifiers.
- Unknown, explicit false, reported zero, bounded count, and unavailable remain distinct at every boundary.
- Raw SEC evidence is immutable. Change interpretation only and bump `TRANSFORMATION_VERSION` from `official-v4` to `official-v5`.
- Item 5.F accounts never populate a field named client, and Item 5.D clients never become an account denominator.
- Accounts remain the only sortable/filterable population field in this release; do not add reported-client range filters or sorting.
- `aum_per_advisor` continues to use distinct advisers with an open IAPD registration. Label it `AUM per Linked Active Adviser` and disclose the mixed time basis.
- Percentiles are integer values from 0 through 100 and rank only rows with the metric being ranked.
- Preserve the existing UUIDs for renamed account attributes; use the exact new UUIDs assigned in Task 6 for range attributes.
- Use Prisma-generated timestamped migrations only. Maintain non-Prisma checks in `prisma/ddl/010-constraints.sql`; never hand-edit a generated migration.
- Do not rebuild canonical data, export a production normalized release, apply migrations, reset a database, seed, provision workspaces, or run ETL without explicit user authorization.
- After authorization, the local reset/rebuild order is exactly: `bun run prisma:reset`, `bun run db:ddl:sync`, `bun run prisma:migrate`, `bun run prisma:seed`, then `bun etl/load-market.ts` without `--only`.
- Do not touch the unrelated `.vscode/settings.json` worktree change.

---

### Task 1: Canonicalize accounts and all fourteen client categories

**Files:**

- Modify: `market-data/src/riascout_adv_data/canonicalize.py:16-67,420-475,927-960`
- Modify: `market-data/src/riascout_adv_data/sql/official_schema.sql:93-121,315-322`
- Modify: `market-data/tests/test_canonicalize.py:20-210`

**Interfaces:**

- Consumes: raw ADV aliases `5F2d`, `5F2e`, `5F2f`, `5D1a` through `5D1n`, `5D2a` through `5D2n` when present, and `5D3a` through `5D3n`.
- Produces: `firm_metrics.discretionary_account_count`, `non_discretionary_account_count`, and `account_count`; `filing_client_types(filing_id, client_type, client_count, fewer_than_five, regulatory_aum, artifact_id, source_member, source_row_number)`; `TRANSFORMATION_VERSION = "official-v5"`.

- [ ] **Step 1: Add a failing canonical fixture covering account components, corrected suffixes, `Other`, true/false/unavailable flags, and blank rows**

Add this member to `_history_members()` and assert the exact canonical rows:

```python
"IA_ADV_Base_A_accounts_clients.csv": (
    "FilingID,DateSubmitted,1E1,1D,1A,5F2d,5F2e,5F2f,"
    "5D1i,5D2i,5D3i,5D1j,5D2j,5D3j,5D1k,5D2k,5D3k,"
    "5D1l,5D2l,5D3l,5D1m,5D2m,5D3m,5D1n,5D2n,5D3n\n"
    "F-CLIENTS,03/31/2025,149777,801-1,Mapping Adviser,10,20,30,"
    "2,N,200,3,N,300,4,Y,400,,Y,500,6,N,600,7,N,700\n"
),
```

```python
def test_canonicalizer_separates_accounts_and_preserves_client_evidence(tmp_path: Path) -> None:
    database = _database_with_history(tmp_path)
    HistoricalCanonicalizer(database).publish(["history:abc", "advw:def"])

    with database.connection() as connection:
        accounts = connection.execute(
            """
            SELECT discretionary_account_count, non_discretionary_account_count, account_count
            FROM firm_metrics WHERE filing_id = 'F-CLIENTS'
            """
        ).fetchone()
        clients = connection.execute(
            """
            SELECT client_type, client_count, fewer_than_five, regulatory_aum
            FROM filing_client_types WHERE filing_id = 'F-CLIENTS'
            ORDER BY client_type
            """
        ).fetchall()

    assert accounts == (10, 20, 30)
    assert clients == [
        ("Corporations_or_Other_Businesses", 6, False, Decimal("600.00")),
        ("Insurance_Companies", None, True, Decimal("500.00")),
        ("Other", 7, False, Decimal("700.00")),
        ("Other_Investment_Advisers", 3, False, Decimal("300.00")),
        ("State_or_Municipal_Governments", 2, False, Decimal("200.00")),
        ("Sovereign_Wealth_Funds", 4, True, Decimal("400.00")),
    ]
```

- [ ] **Step 2: Run the focused test and confirm the old contract fails**

Run: `cd market-data && uv run pytest tests/test_canonicalize.py::test_canonicalizer_separates_accounts_and_preserves_client_evidence -v`

Expected: FAIL because `firm_metrics` still exposes `client_count`, `filing_client_types` lacks `fewer_than_five`, suffixes `i-m` are shifted, and suffix `n` is absent.

- [ ] **Step 3: Rename the canonical account fields and correct the client mapping**

Use these exact mappings:

```python
TRANSFORMATION_VERSION = "official-v5"

BASE_FIELDS = {
    # existing identity, address, AUM, and employee aliases stay unchanged
    "discretionary_account_count": ("5F2d",),
    "non_discretionary_account_count": ("5F2e",),
    "account_count": ("5F2f",),
}

CLIENT_TYPES = {
    "Individuals": ("5D1a", "5D2a", "5D3a"),
    "High_Net_Worth_Individuals": ("5D1b", "5D2b", "5D3b"),
    "Banking_or_Thrift": ("5D1c", "5D2c", "5D3c"),
    "Investment_Companies": ("5D1d", "5D2d", "5D3d"),
    "Business_Development_Companies": ("5D1e", "5D2e", "5D3e"),
    "Pooled_Investment_Vehicles": ("5D1f", "5D2f", "5D3f"),
    "Pension_and_Profit_Sharing": ("5D1g", "5D2g", "5D3g"),
    "Charitable_Organizations": ("5D1h", "5D2h", "5D3h"),
    "State_or_Municipal_Governments": ("5D1i", "5D2i", "5D3i"),
    "Other_Investment_Advisers": ("5D1j", "5D2j", "5D3j"),
    "Insurance_Companies": ("5D1k", "5D2k", "5D3k"),
    "Sovereign_Wealth_Funds": ("5D1l", "5D2l", "5D3l"),
    "Corporations_or_Other_Businesses": ("5D1m", "5D2m", "5D3m"),
    "Other": ("5D1n", "5D2n", "5D3n"),
}
```

Update `firm_metrics` to contain the three account columns in that order and update the insert parameter list accordingly. Do not retain `client_count` as an alias.

- [ ] **Step 4: Preserve three-valued fewer-than-five evidence and section applicability**

Add a parser that distinguishes `Y`, `N`, and absence:

```python
def _yes_no(value: str | None) -> bool | None:
    normalized = (value or "").strip().upper()
    if normalized == "Y":
        return True
    if normalized == "N":
        return False
    return None
```

In `_publish_base_children`, resolve count, flag, and AUM columns for every category. If no Item 5.D column exists anywhere on the table, publish no client rows. If the section exists, publish a row for each category with at least one available source column, including an explicit `N` and numeric zero. Use this insert order:

```python
connection.execute(
    "INSERT INTO filing_client_types VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [filing_id, client_type, count, fewer_than_five, aum,
     table.artifact_id, table.member_name, source_row],
)
```

- [ ] **Step 5: Run canonical tests**

Run: `cd market-data && uv run pytest tests/test_canonicalize.py -v`

Expected: all canonicalization tests PASS, including scientific-notation AUM and the new account/client contract.

- [ ] **Step 6: Commit the canonical contract**

```bash
git add market-data/src/riascout_adv_data/canonicalize.py market-data/src/riascout_adv_data/sql/official_schema.sql market-data/tests/test_canonicalize.py
git commit -m "fix(market): separate accounts from client evidence"
```

---

### Task 2: Derive reported-client ranges and classify data-quality findings

**Files:**

- Modify: `market-data/src/riascout_adv_data/sql/official_schema.sql:111-121,315-322`
- Modify: `market-data/src/riascout_adv_data/official_validation.py:42-175,272-312`
- Modify: `market-data/tests/test_canonicalize.py`
- Modify: `market-data/tests/test_official_validation.py`

**Interfaces:**

- Consumes: Task 1 `filing_client_types.client_count`, `.fewer_than_five`, and `.regulatory_aum`.
- Produces: DuckDB view `filing_reported_client_totals(filing_id, reported_client_count_min, reported_client_count_max, reported_client_count_quality)` with quality `reported_number | bounded_range | unavailable`; blocking failure codes and non-blocking warning codes listed below.

- [ ] **Step 1: Add failing range-derivation tests**

Create a compact fixture with these exact rows:

```python
def _database_with_client_total_cases(tmp_path: Path) -> OfficialDatabase:
    database = OfficialDatabase(tmp_path / "analysis.duckdb")
    database.install_schema()
    source = tmp_path / "client-totals.zip"
    _write_zip(
        source,
        {
            "IA_ADV_Base_A_client_totals.csv": (
                "FilingID,DateSubmitted,1E1,1D,1A,5D1a,5D2a,5D3a,5D1b,5D2b,5D3b\n"
                "F-EXACT,03/31/2025,1001,801-1001,Exact,12,N,1200,0,N,0\n"
                "F-RANGE,03/31/2025,1002,801-1002,Range,12,N,1200,,Y,0\n"
                "F-ZERO,03/31/2025,1003,801-1003,Zero,0,N,0,0,N,0\n"
                "F-UNAVAILABLE,03/31/2025,1004,801-1004,Unavailable,,,100,,,0\n"
            ),
            "ADV_Filing_Types_client_totals.csv": (
                "FilingID,FilingType\n"
                "F-EXACT,Annual Updating Amendment\n"
                "F-RANGE,Annual Updating Amendment\n"
                "F-ZERO,Annual Updating Amendment\n"
                "F-UNAVAILABLE,Annual Updating Amendment\n"
            ),
        },
    )
    _record_and_ingest(database, source, artifact_id="client-totals:abc", dataset_kind="adv_part1")
    HistoricalCanonicalizer(database).publish(["client-totals:abc"])
    return database
```

Then assert all three quality states:

```python
def test_reported_client_totals_are_range_native(tmp_path: Path) -> None:
    database = _database_with_client_total_cases(tmp_path)

    with database.connection() as connection:
        rows = connection.execute(
            """
            SELECT filing_id, reported_client_count_min,
                   reported_client_count_max, reported_client_count_quality
            FROM filing_reported_client_totals
            WHERE filing_id IN ('F-EXACT', 'F-RANGE', 'F-ZERO', 'F-UNAVAILABLE')
            ORDER BY filing_id
            """
        ).fetchall()

    assert rows == [
        ("F-EXACT", 12, 12, "reported_number"),
        ("F-RANGE", 13, 16, "bounded_range"),
        ("F-UNAVAILABLE", None, None, "unavailable"),
        ("F-ZERO", 0, 0, "reported_number"),
    ]
```

Fixture semantics: `F-EXACT` has numeric 12; `F-RANGE` has numeric 12 plus a true flag with blank count; `F-ZERO` has an applicable closed section with zeros/false; `F-UNAVAILABLE` has positive category AUM with neither a positive count nor true flag.

- [ ] **Step 2: Run the derivation test and confirm the view is missing**

Run: `cd market-data && uv run pytest tests/test_canonicalize.py::test_reported_client_totals_are_range_native -v`

Expected: FAIL with `Catalog Error: Table with name filing_reported_client_totals does not exist`.

- [ ] **Step 3: Implement the canonical view with the approved contribution rules**

Add this shape to `official_schema.sql`:

```sql
CREATE OR REPLACE VIEW filing_reported_client_totals AS
WITH per_filing AS (
  SELECT filing_id,
         count(*) AS applicable_category_count,
         bool_or(client_count < 0) AS has_negative_count,
         bool_or(fewer_than_five IS TRUE AND client_count > 4) AS has_invalid_fewer_count,
         bool_or(regulatory_aum > 0
                 AND coalesce(client_count, 0) <= 0
                 AND fewer_than_five IS NOT TRUE) AS has_unresolved_positive_aum,
         sum(CASE WHEN client_count > 0 THEN client_count
                  WHEN fewer_than_five IS TRUE THEN 1 ELSE 0 END) AS count_min,
         sum(CASE WHEN client_count > 0 THEN client_count
                  WHEN fewer_than_five IS TRUE THEN 4 ELSE 0 END) AS count_max
    FROM filing_client_types
   GROUP BY filing_id
)
SELECT filing_id,
       CASE WHEN has_negative_count OR has_invalid_fewer_count OR has_unresolved_positive_aum
            THEN NULL ELSE count_min END AS reported_client_count_min,
       CASE WHEN has_negative_count OR has_invalid_fewer_count OR has_unresolved_positive_aum
            THEN NULL ELSE count_max END AS reported_client_count_max,
       CASE
         WHEN applicable_category_count = 0 OR has_negative_count
           OR has_invalid_fewer_count OR has_unresolved_positive_aum THEN 'unavailable'
         WHEN count_min = count_max THEN 'reported_number'
         ELSE 'bounded_range'
       END AS reported_client_count_quality
  FROM per_filing;
```

A filing absent from the view means Item 5.D is unavailable. Downstream loaders must left join and convert that absence to nullable bounds plus `unavailable`.

- [ ] **Step 4: Add failing failure/warning classification tests**

Add tests that assert these exact codes and severity:

```python
assert "negative_client_count" in {issue.code for issue in result.failures}
assert "invalid_fewer_than_five_count" in {issue.code for issue in result.failures}
assert "inverted_reported_client_bound" in {issue.code for issue in result.failures}
assert "missing_item_5d_other_mapping" in {issue.code for issue in result.failures}
assert "account_component_reconciliation" in {issue.code for issue in result.warnings}
assert "client_aum_reconciliation" in {issue.code for issue in result.warnings}
assert "client_count_missing_for_positive_aum" in {issue.code for issue in result.warnings}
```

Use minimal inserted filings so each test isolates one condition. The `missing_item_5d_other_mapping` test inserts raw `5D1n`/`5D3n` evidence and verifies the canonical `Other` row; a missing transformed row is a blocker. The two reconciliation differences retain their filed values and are warnings.

- [ ] **Step 5: Implement exact validation queries**

Append blocking issues for negative counts, true flags paired with counts over four, null/inverted bounds, and positive raw Item 5.D.n evidence missing from canonical `Other`. Append warnings for:

```sql
-- account total differs when all components are reported
discretionary_account_count IS NOT NULL
AND non_discretionary_account_count IS NOT NULL
AND account_count IS NOT NULL
AND discretionary_account_count + non_discretionary_account_count <> account_count

-- category AUM differs from RAUM when both are reported
regulatory_aum IS NOT NULL
AND client_type_aum IS NOT NULL
AND client_type_aum <> regulatory_aum

-- a positive category AUM has no supported client count
regulatory_aum > 0
AND coalesce(client_count, 0) <= 0
AND fewer_than_five IS NOT TRUE
```

Messages must say `source-reported reconciliation difference` for warnings so the release report does not imply a transform defect.

- [ ] **Step 6: Run canonical and official validation tests**

Run: `cd market-data && uv run pytest tests/test_canonicalize.py tests/test_official_validation.py -v`

Expected: PASS; transform defects populate `failures`, source reconciliation exceptions populate `warnings`, and `OfficialValidationResult.is_valid` remains true when only warnings exist.

- [ ] **Step 7: Commit the range and quality contract**

```bash
git add market-data/src/riascout_adv_data/sql/official_schema.sql market-data/src/riascout_adv_data/official_validation.py market-data/tests/test_canonicalize.py market-data/tests/test_official_validation.py
git commit -m "feat(market): derive reported client ranges"
```

---

### Task 3: Publish the corrected filing facts in normalized releases

**Files:**

- Modify: `market-data/src/riascout_adv_data/normalized_export.py:178-205`
- Modify: `market-data/tests/test_normalized_export.py:1-75`

**Interfaces:**

- Consumes: canonical `firm_metrics`, `filing_client_types`, and `filing_reported_client_totals` from Tasks 1-2.
- Produces: `firm_metrics.parquet`, `filing_client_types.parquet`, and `filing_reported_client_totals.parquet` plus manifest row counts and digests.

- [ ] **Step 1: Add a failing release-contract assertion**

Extend the export test:

```python
expected = {
    "firm_metrics.parquet",
    "filing_client_types.parquet",
    "filing_reported_client_totals.parquet",
}
paths = {item["path"] for item in manifest["files"]}
assert expected <= paths

with duckdb.connect() as connection:
    columns = {
        row[0]
        for row in connection.execute(
            "DESCRIBE SELECT * FROM read_parquet(?)",
            [str(release.path / "filing_client_types.parquet")],
        ).fetchall()
    }
assert "fewer_than_five" in columns
```

Seed the `_valid_database` fixture with one client-type row and one firm-metrics row so each new Parquet file is queryable.

- [ ] **Step 2: Run the export test and confirm the three files are absent**

Run: `cd market-data && uv run pytest tests/test_normalized_export.py::test_export_writes_queryable_partitioned_parquet_and_manifest -v`

Expected: FAIL because the manifest does not contain the new canonical exports.

- [ ] **Step 3: Add the three deterministic base exports**

Prepend these entries in `_base_exports` after `firms.parquet`:

```python
(
    Path("firm_metrics.parquet"),
    "SELECT * FROM firm_metrics ORDER BY filing_id",
    [],
),
(
    Path("filing_client_types.parquet"),
    "SELECT * FROM filing_client_types ORDER BY filing_id, client_type",
    [],
),
(
    Path("filing_reported_client_totals.parquet"),
    "SELECT * FROM filing_reported_client_totals ORDER BY filing_id",
    [],
),
```

Do not include raw table names, source URLs, or credentials beyond the provenance columns already approved for internal normalized output.

- [ ] **Step 4: Run export and atomicity tests**

Run: `cd market-data && uv run pytest tests/test_normalized_export.py -v`

Expected: PASS; every new file has a manifest row count/SHA-256 and a simulated failed export still leaves the prior release untouched.

- [ ] **Step 5: Commit normalized release coverage**

```bash
git add market-data/src/riascout_adv_data/normalized_export.py market-data/tests/test_normalized_export.py
git commit -m "feat(market): export account and client facts"
```

---

### Task 4: Change the PostgreSQL schema and maintained constraints

**Files:**

- Modify: `prisma/schema.prisma:319-405,1050-1120,1130-1225`
- Modify: `prisma/ddl/010-constraints.sql:47-61`
- Modify: `prisma/seed/dimensions.ts:9-25`
- Generate: one timestamped `prisma/migrations/*_firm_account_client_metrics/migration.sql` using Prisma only

**Interfaces:**

- Consumes: the canonical field names and quality enum from Tasks 1-2.
- Produces: Prisma properties and PostgreSQL columns `account_count`, `reported_client_count_min`, `reported_client_count_max`, `reported_client_count_quality`, `aum_per_account`, `accounts_per_advisor`, and `aum_per_account_percentile`; client-type `fewer_than_five`.

- [ ] **Step 1: Update Prisma models before generating code**

Use these exact fields:

```prisma
model FirmFactMetrics {
  // existing AUM and employee fields remain
  discretionaryAccountCount    BigInt? @map("discretionary_account_count")
  nonDiscretionaryAccountCount BigInt? @map("non_discretionary_account_count")
  accountCount                 BigInt? @map("account_count")
  accountCountRaw              BigInt? @map("account_count_raw")
  accountCountQuality          String? @map("account_count_quality")
  reportedClientCountMin       BigInt? @map("reported_client_count_min")
  reportedClientCountMax       BigInt? @map("reported_client_count_max")
  reportedClientCountQuality   String  @default("unavailable") @map("reported_client_count_quality")
}

model FirmFactDerived {
  aumPerAccount            Decimal? @map("aum_per_account") @db.Decimal(20, 2)
  accountsPerAdvisor       Decimal? @map("accounts_per_advisor") @db.Decimal(12, 2)
  aumPerAccountPercentile  Int?     @map("aum_per_account_percentile")
}

model FirmFactClientType {
  fewerThanFive Boolean? @map("fewer_than_five")
}
```

Rename the matching `AdvisorSearch` and `FirmSearch` properties/columns. Both projections receive discretionary, non-discretionary, and total account counts plus reported-client min/max/quality; adviser fields use the `firm_` prefix. Keep counts as `Int?` in search tables because current source magnitudes fit PostgreSQL integer and the API serializer already guards JavaScript counts.

- [ ] **Step 2: Add `Other` to the client-type dimension**

Append:

```ts
['Other', 'Other'],
```

Keep all canonical codes exactly identical to `CLIENT_TYPES` in Task 1.

- [ ] **Step 3: Update maintained DDL checks**

Replace the derived percentile check with `aum_per_account_percentile`, then add:

```sql
ALTER TABLE "market"."firm_fact_metrics"
  DROP CONSTRAINT IF EXISTS "firm_fact_metrics_reported_client_bounds";
ALTER TABLE "market"."firm_fact_metrics"
  ADD CONSTRAINT "firm_fact_metrics_reported_client_bounds"
  CHECK (
    "reported_client_count_quality" IN ('reported_number', 'bounded_range', 'unavailable')
    AND ("reported_client_count_min" IS NULL OR "reported_client_count_min" >= 0)
    AND ("reported_client_count_max" IS NULL OR "reported_client_count_max" >= "reported_client_count_min")
    AND (
      ("reported_client_count_quality" = 'unavailable'
       AND "reported_client_count_min" IS NULL AND "reported_client_count_max" IS NULL)
      OR
      ("reported_client_count_quality" = 'reported_number'
       AND "reported_client_count_min" = "reported_client_count_max")
      OR
      ("reported_client_count_quality" = 'bounded_range'
       AND "reported_client_count_min" < "reported_client_count_max")
    )
  );
```

- [ ] **Step 4: Stop for explicit authorization before migration generation**

Ask for permission to run the Prisma migration generator. This step does not authorize applying the migration, resetting a database, seeding, or loading ETL.

- [ ] **Step 5: Generate and review the Prisma migration after authorization**

Run: `bun run prisma:draft -- --name firm_account_client_metrics`

Expected: one new generated timestamped migration containing the schema renames/additions. Inspect it with `git diff -- prisma/migrations prisma/schema.prisma`; do not edit its SQL by hand.

- [ ] **Step 6: Generate Prisma and TypedSQL clients**

Run: `bun run prisma:generate`

Expected: exit 0 and regenerated ORM/TypedSQL artifacts compile against the renamed schema.

- [ ] **Step 7: Validate the generated Prisma surface**

Run: `bunx prisma validate`

Expected: `The schema at prisma/schema.prisma is valid` and exit 0. Task 6 updates the reference allowlist before the repository TypeScript gates run.

- [ ] **Step 8: Commit the generated schema milestone**

```bash
git add prisma/schema.prisma prisma/ddl/010-constraints.sql prisma/seed/dimensions.ts prisma/migrations
git commit -m "feat(db): model account and reported client facts"
```

---

### Task 5: Load facts, derive ratios, and rank comparable populations

**Files:**

- Modify: `etl/sql/030-firm-facts.sql:23-79`
- Modify: `etl/sql/046-firm-derived.sql:13-105`
- Modify: `etl/sql/050-search-projections.sql:112-275`
- Modify: `etl/sql/051-firm-search.sql:14-370`
- Modify: `etl/sql/090-quality.sql:12-22`
- Modify: `etl/sql/091-aum-magnitude-check.sql`
- Create: `etl/sql/092-firm-account-client-acceptance.sql`
- Create: `etl/sql/firm-account-client-contract.spec.ts`

**Interfaces:**

- Consumes: Task 4 PostgreSQL columns and Task 1-2 canonical DuckDB tables/views.
- Produces: current-filing account and reported-client facts, account ratios, filtered-population percentiles, and corrected adviser/firm projections.

- [ ] **Step 1: Add a failing SQL contract test for names and percentile eligibility**

Create a Vitest that reads the production SQL and asserts the obsolete destinations are absent and filtered percentile CTEs are present:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sql = (name: string) =>
  readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

describe('firm account and client SQL contract', () => {
  it('never loads Item 5F accounts into client-named destinations', () => {
    const text = [sql('./030-firm-facts.sql'), sql('./046-firm-derived.sql'),
      sql('./050-search-projections.sql'), sql('./051-firm-search.sql')].join('\n');
    expect(text).not.toMatch(/\bclient_count_raw\b|\baum_per_client\b|\bclients_per_advisor\b/);
    expect(text).toContain('account_count');
    expect(text).toContain('reported_client_count_min');
  });

  it('ranks each metric in a filtered relation', () => {
    const text = sql('./046-firm-derived.sql');
    expect(text).toContain('aum_population as');
    expect(text).toContain('aum_per_advisor_population as');
    expect(text).toContain('aum_per_account_population as');
  });
});
```

- [ ] **Step 2: Run the contract test and confirm old names fail it**

Run: `bun run test -- etl/sql/firm-account-client-contract.spec.ts`

Expected: FAIL because old client-named account destinations remain and the filtered percentile relations do not exist.

- [ ] **Step 3: Load accounts, client ranges, and fewer-than-five evidence**

Change the metrics insert to map canonical account columns and left join the totals view:

```sql
select m.filing_id, m.regulatory_aum, m.discretionary_aum, m.non_discretionary_aum,
       -- existing employee quality gate
       m.discretionary_account_count, m.non_discretionary_account_count,
       case when m.account_count > 100000000 then null else m.account_count end,
       m.account_count,
       case when m.account_count > 100000000 then 'invalid_source_value' end,
       totals.reported_client_count_min,
       totals.reported_client_count_max,
       coalesce(totals.reported_client_count_quality, 'unavailable'),
       m.advisory_employee_count, m.office_count
  from firm_metrics m
  left join filing_reported_client_totals totals using (filing_id)
 where exists (select 1 from pg.market.filing f where f.filing_id = m.filing_id);
```

Include `fewer_than_five` in the client-type insert and aggregation. Keep an explicit false distinct from null with `bool_or(c.fewer_than_five)`, which returns null when every source value is null, false for explicit false-only evidence, and true when any duplicate source row is true.

- [ ] **Step 4: Replace conditional windows with three eligible-population CTEs**

Build ratios in `base`, then rank separately:

```sql
ratios as (
  select b.*,
         b.regulatory_aum / nullif(b.advisor_count, 0) as aum_per_advisor,
         b.regulatory_aum / nullif(b.account_count, 0) as aum_per_account,
         b.regulatory_aum / nullif(b.employee_count, 0) as aum_per_employee,
         b.account_count::numeric / nullif(b.advisor_count, 0) as accounts_per_advisor
    from base b
),
aum_population as (
  select filing_id,
         round(percent_rank() over (order by regulatory_aum) * 100)::int as percentile
    from ratios where regulatory_aum is not null
),
aum_per_advisor_population as (
  select filing_id,
         round(percent_rank() over (order by aum_per_advisor) * 100)::int as percentile
    from ratios where aum_per_advisor is not null
),
aum_per_account_population as (
  select filing_id,
         round(percent_rank() over (order by aum_per_account) * 100)::int as percentile
    from ratios where aum_per_account is not null
)
```

Join each relation to the full current population by `filing_id`. Do not put null rows inside any percentile window.

- [ ] **Step 5: Rename both search projections atomically**

Project `firm_discretionary_account_count`, `firm_non_discretionary_account_count`, `firm_account_count`, `firm_aum_per_account`, and the three prefixed reported-client fields into `advisor_search`. Project `discretionary_account_count`, `non_discretionary_account_count`, `account_count`, `aum_per_account`, and reported-client min/max/quality into `firm_search`. Update both named `INSERT` column lists and final `SELECT` lists; no positional `SELECT *`.

- [ ] **Step 6: Replace quality checks with account/client-specific checks**

In `090-quality.sql`, replace `firm client_count > 100M` with `firm account_count > 100M`, then add rows for account component reconciliation, client AUM reconciliation, positive-AUM/no-client evidence, invalid range quality, and ratio equality. Use `abs(actual - expected) > 0.01` for decimal ratio comparisons.

In `091-aum-magnitude-check.sql`, retain the existing AUM exponent checks and add a Morgan query row for CRD `149777` returning RAUM, accounts, AUM/account, reported-client min/max/quality, AUM percentile, and AUM/adviser percentile.

Create `092-firm-account-client-acceptance.sql` as one current-firm query with this projection:

```sql
select fs.firm_crd, fs.firm_name, fs.regulatory_aum,
       fs.discretionary_aum, fs.non_discretionary_aum,
       fs.discretionary_account_count, fs.non_discretionary_account_count,
       fs.account_count, fs.reported_client_count_min,
       fs.reported_client_count_max, fs.reported_client_count_quality,
       coalesce(ct.client_type_count_sum, 0) as client_type_count_sum,
       ct.client_type_aum_sum,
       fs.advisor_count as linked_active_advisor_count,
       fs.aum_per_account,
       fs.aum_per_advisor as aum_per_linked_active_advisor,
       fs.aum_per_employee, fs.aum_percentile,
       fs.aum_per_advisor_percentile,
       fd.aum_per_account_percentile,
       case
         when fs.discretionary_account_count is null
           or fs.non_discretionary_account_count is null
           or fs.account_count is null then 'not_comparable'
         when fs.discretionary_account_count + fs.non_discretionary_account_count
           = fs.account_count then 'reconciled'
         else 'source_difference'
       end as account_reconciliation_status,
       case
         when fs.regulatory_aum is null or ct.client_type_aum_sum is null
           then 'not_comparable'
         when fs.regulatory_aum = ct.client_type_aum_sum then 'reconciled'
         else 'source_difference'
       end as client_aum_reconciliation_status
  from market.firm_search fs
  join market.firm_current_filing cf on cf.firm_crd = fs.firm_crd
  left join market.firm_fact_derived fd on fd.filing_id = cf.filing_id
  left join lateral (
    select sum(t.client_count) filter (where t.client_count > 0) as client_type_count_sum,
           sum(t.regulatory_aum) as client_type_aum_sum
      from market.firm_fact_client_type t
     where t.filing_id = cf.filing_id
  ) ct on true
 order by fs.firm_crd;
```

- [ ] **Step 7: Run the SQL contract test**

Run: `bun run test -- etl/sql/firm-account-client-contract.spec.ts`

Expected: PASS; no account measure has a client-named SQL destination and each percentile has a named eligible population.

- [ ] **Step 8: Commit the ETL and projection changes**

```bash
git add etl/sql/030-firm-facts.sql etl/sql/046-firm-derived.sql etl/sql/050-search-projections.sql etl/sql/051-firm-search.sql etl/sql/090-quality.sql etl/sql/091-aum-magnitude-check.sql etl/sql/092-firm-account-client-acceptance.sql etl/sql/firm-account-client-contract.spec.ts
git commit -m "fix(etl): align AUM ratios with account semantics"
```

---

### Task 6: Preserve saved views while synchronizing corrected system attributes

**Files:**

- Modify: `libs/feature/entities/attribute-types/reference-columns.ts:55-142`
- Modify: `libs/feature/entities/data/system-attributes.ts:45-115`
- Modify: `libs/feature/entities/data/column-meta.ts:110-230`
- Modify: `libs/feature/entities/data/entity-definitions.ts:45-118`
- Modify: `libs/feature/entities/data/entity-definitions.spec.ts`
- Modify: `libs/feature/entities/data/provision-workspace.ts:7-78,98-170,249`
- Create: `libs/feature/entities/data/provision-workspace.spec.ts`
- Modify: `prisma/seed/provision.ts:29-55`

**Interfaces:**

- Consumes: Task 5 `advisor_search`/`firm_search` column names.
- Produces: corrected reference keys/labels/descriptions, six new hidden range attributes, and idempotent updates for existing system attributes without changing their UUID keys.

- [ ] **Step 1: Rename existing constants without changing their UUID values**

Apply these exact substitutions:

```ts
// existing UUIDs, renamed properties
firmAccountCount: '01a04af1-e874-7707-aa95-c721825ed984',
firmAumPerAccount: '01a04b01-33a6-782c-8d73-2f8327cb645c',
accountCount: '01a04af1-e885-7ee6-8bc6-ae10c013d04f',
aumPerAccount: '01a04af1-e889-7f5f-8bb8-ab8bad855866',
```

Add these exact new UUIDv7 values:

```ts
// advisor projection
firmDiscretionaryAccountCount: '01a06227-fc31-7b2e-accc-d0ddcc7cb848',
firmNonDiscretionaryAccountCount: '01a06227-fc31-7920-8020-022ccc4ca426',
firmReportedClientCountMin: '01a06220-25f0-76bd-a12c-d1a46a127dc4',
firmReportedClientCountMax: '01a06220-25f0-7a3d-9877-c904e2e7fbb0',
firmReportedClientCountQuality: '01a06220-25f0-7cde-ae91-f59411ce5158',

// firm projection
discretionaryAccountCount: '01a06227-fc31-7802-ab27-0baa8494779d',
nonDiscretionaryAccountCount: '01a06227-fc31-7fee-9693-0c9060e28dc7',
reportedClientCountMin: '01a06220-25f0-7767-bbb3-1028755d3680',
reportedClientCountMax: '01a06220-25f0-7c0e-9e0c-998661640974',
reportedClientCountQuality: '01a06220-25f0-7a0b-829f-c96b8084cc98',
```

- [ ] **Step 2: Add failing definition and provisioner tests**

Assert the old UUIDs now resolve to account references and labels, new range fields are hidden, and an existing attribute is updated:

```ts
expect(byKey.get(FIRM_REFERENCE_ATTRIBUTES.accountCount)).toMatchObject({
  label: 'Account Count',
  referenceColumn: 'firm.account_count',
});
expect(byKey.get(FIRM_REFERENCE_ATTRIBUTES.reportedClientCountMin)?.visible).toBe(false);
```

For `provisionWorkspace`, use a mock existing attribute keyed by the account UUID but carrying `label: 'Client Count'` and `referenceColumn: 'firm.client_count'`; expect `entityAttribute.update` with `label: 'Account Count'` and `referenceColumn: 'firm.account_count'`, and expect no replacement attribute creation.

- [ ] **Step 3: Run the focused tests and confirm update support is missing**

Run: `bun run test -- libs/feature/entities/data/entity-definitions.spec.ts libs/feature/entities/data/provision-workspace.spec.ts`

Expected: FAIL because the allowlist still uses client names and `ProvisionClient.entityAttribute` has no `update` method.

- [ ] **Step 4: Rename allowlisted columns and add hidden range columns**

Use `firm_discretionary_account_count`, `firm_non_discretionary_account_count`, `firm_account_count`, `firm_aum_per_account`, `discretionary_account_count`, `non_discretionary_account_count`, `account_count`, and `aum_per_account`. Add account components and min/max as `number`, and quality as `text`, on both projections. Update `COLUMN_META` and `ICON_OVERRIDES` from client-named account keys to account keys; omit `visible: true` on account components and all range fields.

- [ ] **Step 5: Add explicit AUM descriptions**

Add a `DESCRIPTION_OVERRIDES` record used by `referenceAttributes`. Include exact descriptions:

```ts
const DESCRIPTION_OVERRIDES: Readonly<Record<string, string>> = {
  'firm.regulatory_aum': 'Total regulatory AUM reported in Form ADV Item 5.F; includes discretionary and non-discretionary AUM.',
  'firm.discretionary_aum': 'Regulatory AUM managed on a discretionary basis; a component of total regulatory AUM.',
  'firm.non_discretionary_aum': 'Regulatory AUM managed on a non-discretionary basis; a component of total regulatory AUM.',
  'firm.aum_per_account': 'Total regulatory AUM divided by total reported Form ADV accounts.',
  'firm.aum_per_advisor': 'Total regulatory AUM divided by linked active advisers; filing and adviser evidence can have different observation dates.',
  'firm.aum_per_employee': 'Total regulatory AUM divided by the firm-reported employee count.',
};
```

Add adviser-side equivalents for `advisor.firm_aum`, `advisor.firm_aum_per_account`, and `advisor.firm_aum_per_advisor`.

- [ ] **Step 6: Make provisioning update existing system metadata idempotently**

Extend the selected existing fields to include all synchronized metadata, add `entityAttribute.update`, compare each existing system attribute with its definition, and update only changed values. Add `attributesUpdated` to `ProvisionResult` and `prisma/seed/provision.ts` reporting. Do not change keys, entity IDs, attribute IDs, view fields, or user-authored cells.

The update payload is:

```ts
{
  label: attribute.label,
  type: attribute.type,
  isMultiValue: attribute.isMultiValue,
  referenceColumn: attribute.referenceColumn,
  isEditable: attribute.isEditable,
  isSystem: true,
  isPrimary: attribute.isPrimary,
  icon: attribute.icon ?? null,
  description: attribute.description ?? null,
  group: attribute.group,
}
```

- [ ] **Step 7: Run entity and provisioner tests**

Run: `bun run test -- libs/feature/entities/data/entity-definitions.spec.ts libs/feature/entities/data/provision-workspace.spec.ts libs/feature/entities/attribute-types/reference-columns.spec.ts`

Expected: PASS; the four old UUIDs are unchanged, new UUIDs are valid and unique, range fields are hidden, and repeated provisioning performs zero updates on the second run.

- [ ] **Step 8: Commit compatibility and synchronization**

```bash
git add libs/feature/entities/attribute-types/reference-columns.ts libs/feature/entities/data/system-attributes.ts libs/feature/entities/data/column-meta.ts libs/feature/entities/data/entity-definitions.ts libs/feature/entities/data/entity-definitions.spec.ts libs/feature/entities/data/provision-workspace.ts libs/feature/entities/data/provision-workspace.spec.ts prisma/seed/provision.ts
git commit -m "fix(entities): relabel account system attributes"
```

---

### Task 7: Expose account history and reported-client ranges through the API

**Files:**

- Modify: `apps/api/src/modules/firms/schema.ts:14-105`
- Modify: `apps/api/src/modules/firms/queries/get-firm-metrics-series.ts:32-48`
- Modify: `apps/api/src/modules/firms/queries/get-firm-profile.ts:14-60`
- Create: `apps/api/src/modules/firms/queries/get-firm-metrics-series.spec.ts`
- Create: `apps/api/src/modules/firms/queries/get-firm-profile.spec.ts`
- Modify: `prisma/sql/firmMetricsSeries.sql`
- Modify: `prisma/sql/firmProfileFacets.sql`
- Create: `prisma/sql/firmReportedClients.sql`
- Verify unchanged adapter: `apps/api/src/modules/firms/dto/firms.dto.ts`
- Regenerate: `orm/app/sql/firmMetricsSeries.ts`, `orm/app/sql/firmProfileFacets.ts`, `orm/app/sql/firmReportedClients.ts`

**Interfaces:**

- Consumes: Task 4-5 PostgreSQL fact and projection names.
- Produces: `FirmMetricsPoint.accountCount`; profile `reportedClients: {min, max, quality}`; `FirmFacet.fewerThanFive`.

- [ ] **Step 1: Add failing schema and handler tests**

Mock typed-query rows and assert exact serialization:

```ts
expect(result.points[0]).toMatchObject({ accountCount: 2_703_720 });
expect(result.points[0]).not.toHaveProperty('clientCount');

expect(result.reportedClients).toEqual({
  min: 112,
  max: 115,
  quality: 'bounded_range',
});
expect(result.clientTypes[0]).toMatchObject({
  code: 'Other',
  clientCount: 112,
  fewerThanFive: false,
  regulatoryAum: '58408392.00',
});
```

Also cover no current filing: `{min: null, max: null, quality: 'unavailable'}` and `filingId: null`.

- [ ] **Step 2: Run the focused tests and confirm old API names fail**

Run: `bun run test -- apps/api/src/modules/firms/queries/get-firm-metrics-series.spec.ts apps/api/src/modules/firms/queries/get-firm-profile.spec.ts`

Expected: FAIL because `clientCount` still names accounts and the profile lacks both the range object and `fewerThanFive`.

- [ ] **Step 3: Change zod schemas to the range-native contract**

Add:

```ts
const ReportedClientQualitySchema = z.enum([
  'reported_number',
  'bounded_range',
  'unavailable',
]);

const ReportedClientsSchema = z.object({
  min: count,
  max: count,
  quality: ReportedClientQualitySchema,
});
```

Rename `FirmMetricsPointSchema.clientCount` to `accountCount`, add `fewerThanFive: z.boolean().nullable()` to `FirmFacetSchema`, and add `reportedClients: ReportedClientsSchema` to the profile response.

- [ ] **Step 4: Update TypedSQL queries**

Rename `m.client_count` to `m.account_count` and every `prev_clients` alias to `prev_accounts` in `firmMetricsSeries.sql`.

Add `t.fewer_than_five` to the client-type branch of `firmProfileFacets.sql`; return `null::boolean` in the service and fee branches.

Create `firmReportedClients.sql`:

```sql
-- @param {BigInt} $1:firmCrd
select m.reported_client_count_min,
       m.reported_client_count_max,
       m.reported_client_count_quality
  from market.firm_current_filing cf
  join market.firm_fact_metrics m on m.filing_id = cf.filing_id
 where cf.firm_crd = $1;
```

- [ ] **Step 5: Update query handlers and regenerate server types**

Make the profile handler execute facets, current filing, and reported clients in one `Promise.all`. Parse the quality with a narrow type guard or the zod enum; do not cast arbitrary strings. Default a missing row to `unavailable` with null bounds.

Run: `bun run prisma:generate`

Expected: exit 0 with TypedSQL modules for all three queries.

Run: `bun run build:api`

Expected: exit 0 and DTO output reflects `accountCount`, `reportedClients`, and `fewerThanFive`.

- [ ] **Step 6: Run API tests**

Run: `bun run test -- apps/api/src/modules/firms/queries/get-firm-metrics-series.spec.ts apps/api/src/modules/firms/queries/get-firm-profile.spec.ts`

Expected: PASS for exact counts, bounded ranges, unavailable ranges, true/false/null flags, and money strings.

- [ ] **Step 7: Commit the API contract**

```bash
git add apps/api/src/modules/firms prisma/sql orm/app/sql
git commit -m "feat(api): expose accounts and reported client ranges"
```

---

### Task 8: Render Accounts and Reported clients separately in the dashboard

**Files:**

- Modify: `dashboard/src/modules/records/tabs/overview-tab.tsx:20-125`
- Modify: `dashboard/src/modules/records/tabs/metrics-tab.tsx:65-140`
- Modify: `dashboard/src/modules/records/components/trend-chart.tsx:8-30`
- Modify: `dashboard/src/modules/records/tabs/custodians-tab.tsx:75-140`
- Create: `dashboard/src/modules/records/client-display.ts`
- Create: `dashboard/src/modules/records/client-display.spec.ts`
- Regenerate: `dashboard/src/api/generated/rIAScoutAPI.schemas.ts`
- Regenerate: `dashboard/src/api/generated/firms/firms.ts`

**Interfaces:**

- Consumes: Task 7 generated API fields `accountCount`, `reportedClients`, and `fewerThanFive`, plus record attribute `firm.account_count`.
- Produces: separate account narrative/history and reported-client range display; client-type rows visible for count, flag, or AUM evidence.

- [ ] **Step 1: Add failing pure display tests**

Create helpers and tests for exact, bounded, unavailable, flagged, and positive-AUM/no-count states:

```ts
expect(formatReportedClients({ min: 12, max: 12, quality: 'reported_number' }))
  .toBe('12');
expect(formatReportedClients({ min: 12, max: 15, quality: 'bounded_range' }))
  .toBe('12–15');
expect(formatReportedClients({ min: null, max: null, quality: 'unavailable' }))
  .toBe('Not reported');
expect(clientCountMeta({ clientCount: null, fewerThanFive: true, regulatoryAum: '10.00' }))
  .toBe('<5 clients');
expect(clientCountMeta({ clientCount: null, fewerThanFive: null, regulatoryAum: '10.00' }))
  .toBe('Client count not reported');
expect(hasClientTypeEvidence({ clientCount: null, fewerThanFive: null, regulatoryAum: '10.00' }))
  .toBe(true);
```

- [ ] **Step 2: Run the helper test and confirm the module is absent**

Run: `bun run test -- dashboard/src/modules/records/client-display.spec.ts`

Expected: FAIL because `client-display.ts` does not exist.

- [ ] **Step 3: Implement the pure formatting helpers**

Use exact rules:

```ts
export const formatReportedClients = (value: ReportedClients): string => {
  if (value.quality === 'unavailable' || value.min === null || value.max === null) {
    return 'Not reported';
  }
  return value.min === value.max
    ? value.min.toLocaleString()
    : `${value.min.toLocaleString()}–${value.max.toLocaleString()}`;
};

export const hasClientTypeEvidence = (value: ClientTypeEvidence): boolean =>
  (value.clientCount ?? 0) > 0 ||
  value.fewerThanFive === true ||
  Number(value.regulatoryAum ?? 0) > 0;
```

`clientCountMeta` returns the positive numeric count first, then `<5 clients`, then `Client count not reported` for positive AUM, else null.

- [ ] **Step 4: Regenerate the dashboard API client**

Run: `bun run api:generate`

Expected: Orval exits 0; generated schemas contain `FirmMetricsPoint.accountCount`, `GetFirmProfileResponse.reportedClients`, and `FirmFacet.fewerThanFive`, with no `FirmMetricsPoint.clientCount`.

- [ ] **Step 5: Update overview copy and visibility**

Read `firm.account_count` in the narrative and render `Reports N accounts.`. Under the narrative, render:

```tsx
<p className={prose}>
  Reported clients: {formatReportedClients(query.data.reportedClients)}
  {query.data.reportedClients.quality === 'unavailable' ? null : (
    <span className={muted}> Approximate, as reported on Form ADV.</span>
  )}
</p>
```

Filter client categories with `hasClientTypeEvidence`, use `clientCountMeta`, and add the caption: `Regulatory AUM allocated by client type; reported categories partition total regulatory AUM and are not additional assets.`

- [ ] **Step 6: Rename history chart and clarify AUM relationships**

Change `TrendKey` to `'accountCount' | 'employeeCount' | 'officeCount'`. Change heading, label, data key, table header, and table cell from Clients/clientCount to Accounts/accountCount.

Add concise captions:

- Metrics: `Regulatory AUM is the total; discretionary and non-discretionary AUM are its components.`
- Custodians: `Custodian AUM describes separately managed account custody relationships and can overlap regulatory AUM; do not add it to total AUM.`
- Private funds: `Gross asset value is reported per private fund and is not an additive component of firm regulatory AUM.`

- [ ] **Step 7: Run display tests, dashboard typecheck, and dashboard build**

Run: `bun run test -- dashboard/src/modules/records/client-display.spec.ts`

Expected: PASS.

Run: `bun --cwd dashboard typecheck`

Expected: exit 0 with no stale `clientCount` references in the metrics UI.

Run: `bun --cwd dashboard build`

Expected: Vite production build exits 0.

- [ ] **Step 8: Commit the dashboard contract**

```bash
git add dashboard/src/modules/records dashboard/src/api/generated
git commit -m "fix(dashboard): separate accounts from reported clients"
```

---

### Task 9: Run non-mutating gates and remove stale terminology

**Files:**

- Modify only files implicated by failures from the commands below.

**Interfaces:**

- Consumes: all implementation tasks.
- Produces: a verified codebase before any data mutation or release operation.

- [ ] **Step 1: Scan for obsolete account-as-client destinations**

Run:

```bash
rg -n "clientCount|client_count|aumPerClient|aum_per_client|clientsPerAdvisor|clients_per_advisor|firmClientCount|firm_client_count|firmAumPerClient|firm_aum_per_client" market-data/src etl prisma/schema.prisma prisma/ddl prisma/sql apps/api/src libs/feature dashboard/src --glob '!**/generated/**'
```

Expected: matches remain only for true Item 5.D client-category fields (`filing_client_types.client_count`, `FirmFacet.clientCount`) and reported-client names. No Item 5.F metric, ratio, projection, reference column, chart, or narrative uses an obsolete name.

- [ ] **Step 2: Run full market-data gates**

Run:

```bash
cd market-data
uv run pytest
uv run ruff check .
uv run mypy src
```

Expected: all tests PASS; Ruff and mypy exit 0.

- [ ] **Step 3: Run full repository gates**

Run:

```bash
bun run test
bun run typecheck
bun run lint
bun run build
bun --cwd dashboard typecheck
bun --cwd dashboard build
```

Expected: every command exits 0. Fix only failures caused by this change; preserve unrelated worktree edits.

- [ ] **Step 4: Inspect the final implementation diff**

Run: `git diff --check && git status --short && git log --oneline -10`

Expected: no whitespace errors; only scoped implementation files plus the pre-existing `.vscode/settings.json` modification are present; each milestone has a Conventional Commit.

- [ ] **Step 5: Commit any gate-driven corrections**

Stage only files changed to resolve scoped failures, then:

```bash
git commit -m "test(market): verify account and client corrections"
```

Skip this commit if the gates required no corrections.

---

### Task 10: Approval-gated rebuild and all-firm regression report

**Files:**

- Create: `market-data/reports/firm-account-client-corrections-2026-09-02.md`
- Create: `market-data/reports/firm-account-client-corrections-2026-09-02.csv`
- Modify: production/canonical data only through the approved repository commands.

**Interfaces:**

- Consumes: verified code from Tasks 1-9 and explicit user authorization.
- Produces: rebuilt local canonical/PostgreSQL data and a before/after report covering all current firms, source warnings, ratio equality, percentile eligibility, and Morgan Stanley CRD 149777.

- [ ] **Step 1: Stop and request explicit authorization for every data operation**

Request one clear approval covering canonical rebuild, normalized release export if requested, migration application/reset, seeding, workspace provisioning, and full ETL. If authorization excludes any item, omit it and state which acceptance checks cannot be completed.

- [ ] **Step 2: Rebuild and validate canonical DuckDB only after authorization**

Use the existing immutable artifacts; do not run a download command:

```bash
cd market-data
uv run riascout-adv-data ingest-official --data-dir data --report-dir reports
uv run riascout-adv-data build-snapshots --years 2020:2026 --data-dir data --report-dir reports
uv run riascout-adv-data validate-snapshots --years 2020:2026 --data-dir data --report-dir reports
uv run riascout-adv-data report-official --run-id account-client-corrections-20260902 --years 2020:2026 --data-dir data --report-dir reports
```

Expected: transform `failures` count is 0; source-reported account/client-AUM reconciliation differences appear under `warnings` with their filed values retained.

If normalized production export was included in the authorization, run:

```bash
uv run riascout-adv-data export-normalized \
  --collection-id individual-current-20260826 \
  --release-id normalized-account-client-corrections-20260902 \
  --years 2020:2026 --data-dir data
```

Expected: an atomic release directory with a verified manifest containing `firm_metrics.parquet`, `filing_client_types.parquet`, and `filing_reported_client_totals.parquet`.

- [ ] **Step 3: Follow the mandated local database sequence exactly**

Run one command at a time:

```bash
bun run prisma:reset
bun run db:ddl:sync
bun run prisma:migrate
bun run prisma:seed
bun etl/load-market.ts
```

Expected: each exits 0; the ETL is full and has no `--only` argument. Then run `bun run prisma:provision` so existing workspace system attributes receive corrected labels/references and new hidden fields.

- [ ] **Step 4: Query all-firm acceptance metrics**

From the repository root, produce the CSV with one row per current firm:

```bash
psql "$APP_DATABASE_URL" -X --csv -v ON_ERROR_STOP=1 \
  -f etl/sql/092-firm-account-client-acceptance.sql \
  > market-data/reports/firm-account-client-corrections-2026-09-02.csv
```

Expected header and column order:

```text
firm_crd,firm_name,regulatory_aum,discretionary_aum,non_discretionary_aum,
discretionary_account_count,non_discretionary_account_count,account_count,
reported_client_count_min,reported_client_count_max,reported_client_count_quality,
client_type_count_sum,client_type_aum_sum,linked_active_advisor_count,
aum_per_account,aum_per_linked_active_advisor,aum_per_employee,
aum_percentile,aum_per_advisor_percentile,aum_per_account_percentile,
account_reconciliation_status,client_aum_reconciliation_status
```

The Markdown report summarizes current-firm population, null coverage, exact/range/unavailable counts, each reconciliation warning count, each ratio mismatch count at a $0.01 tolerance, percentile min/max/population size, and before/after issue counts from the approved spec.

- [ ] **Step 5: Assert the Morgan Stanley regression row**

For CRD `149777`, assert:

```text
account_count = 2703720
aum_per_account rounds to 725625
Other client_count = 112
Other client_type_aum = 58408392
sum(client_type_aum) = regulatory_aum = 1961887313229
aum_percentile is near 100 and is computed only among non-null AUM rows
aum_per_advisor_percentile is computed only among non-null AUM/adviser rows
```

Also assert no positive-AUM client-type row is excluded by the API/UI evidence predicate.

- [ ] **Step 6: Run post-rebuild quality and API smoke checks**

Run the repository quality queries, then call the local firm metrics/profile endpoints for CRD 149777. Expected JSON uses `accountCount`, includes `reportedClients`, includes the `Other` facet, and serializes `fewerThanFive` as boolean/null without inventing a point estimate.

- [ ] **Step 7: Commit the reviewed report, not generated data**

```bash
git add market-data/reports/firm-account-client-corrections-2026-09-02.md market-data/reports/firm-account-client-corrections-2026-09-02.csv
git commit -m "docs(market): report account and client corrections"
```

Do not commit DuckDB files, Parquet releases, PostgreSQL dumps, credentials, or raw evidence.
