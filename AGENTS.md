# RIAScout Repository Instructions

## Scope and routing

- Read this file for every task in the repository.
- Read `market-data/AGENTS.md` before Python acquisition, DuckDB, evidence, normalization, or release work.
- Use `.agents/skills/riascout-module` for application or market-data changes. Read its application reference,
  market-data reference, or both when a change crosses the release boundary.

## Architecture

- `market-data/` owns SEC/IAPD evidence, the canonical DuckDB build, validation, and versioned normalized releases.
- `etl/` validates and loads a published market-data release into PostgreSQL.
- Application code consumes global `market` projections; SaaS workspace data remains in the tenant-scoped `app` schema.
- Every `app` query is scoped by `workspace_id`. The `market` schema never contains workspace tenancy.

## Data invariants

- Adviser and firm CRDs are stable `bigint` identities. Names are observations, never identifiers.
- Unknown remains distinct from false and zero; do not invent dates, measurements, or relationships.
- Raw evidence is immutable, and collection completeness gates current affiliations and movement.
- Current affiliations may be registration-backed or observation-backed. Observation-only links keep
  `current_firm_since` and tenure null, and incomplete collections cannot drive current state.
- Movement is diffed between complete collections. The first complete snapshot is a processed zero-event baseline;
  projection movement fields remain unknown/null until a second complete collection is processed.

## Migrations

- Use Prisma-generated migrations only.
- Maintained non-Prisma DDL lives in `prisma/ddl/`; `bun run db:ddl:sync` generates its migration.
- Never handwrite a generated timestamped migration.
- After the user explicitly authorizes a local reset/rebuild, run these commands in order:
  1. `bun run prisma:reset`
  2. `bun run db:ddl:sync`
  3. `bun run prisma:migrate` — apply the pending generated DDL migration through the local development workflow
  4. `bun run prisma:seed`
  5. `bun etl/load-market.ts` as a full load, without `--only`
- Skipping DDL sync/deploy can leave Prisma-inexpressible views, functions, constraints, expression indexes, or
  `NULLS NOT DISTINCT` semantics absent.
- Never apply or reset migrations or run ETL without explicit user approval.

## Credentials

- Send API keys only in authorization headers.
- Never put credentials in URLs, logs, fixtures, reports, or Git.

## Code and comments

- NestJS boundaries use CQRS and zod-derived types. Keep `apps/api`, `apps/worker`, and `libs` dependency boundaries intact.
- Never use `any`; narrow `unknown` with zod or a type guard. Preserve nullability through the API boundary.
- Comments explain the technical reason directly, not what the code already says. Keep comments to at most three lines.
- Do not explain code or design by contrasting it with another product or repository; state the technical reason directly.
- Use `//` for one line and `/** ... */` for multiple lines.

## Verification and commits

- Run the focused checks for the area changed, then the relevant repository test, typecheck, and lint gates.
- Commit only verified milestones with Conventional Commits.
- Never add agent attribution, generated-with footers, or co-author trailers.
