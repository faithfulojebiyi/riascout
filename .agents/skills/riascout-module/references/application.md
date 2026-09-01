# Application Reference

## Architecture and boundaries

- `apps/api` is the Fastify HTTP boundary with request-scoped ALS. `apps/worker` runs background jobs and ETL and
  must not import ALS. Shared code lives under `libs/{system,providers,feature}`.
- PostgreSQL uses a tenant-scoped `app` schema and a global `market` schema. Every `app` query includes
  `workspace_id`; the worker receives identity in its event payload. Never add workspace tenancy to `market`.
- `app.entity_record` references a market entity by `source_kind` plus CRD, without a cross-schema foreign key.
  Application records do not change when an adviser changes firms.
- Schema-qualify every `market` relation in raw SQL. Use TypedSQL in `prisma/sql/` for fixed-shape complex queries;
  `etl/sql/` contains data operations, not DDL.

## Domain and null discipline

- Adviser and firm CRDs are stable `bigint` identities. Names are time-varying observations, never keys.
- Current affiliation preserves its evidence source: registration-backed links may carry an authentic start date and
  tenure; observation-backed links record observation provenance and keep `current_firm_since` and tenure null.
- Only complete collections can drive observation-backed current state. Unknown values stay null rather than becoming
  false, zero, an inferred date, or an invented relationship.
- Movement is derived from diffs between complete collections. The first complete snapshot is processed with zero
  events, while movement projection fields stay unknown/null until a second complete snapshot is processed.

## NestJS and TypeScript

- Controllers translate HTTP to CQRS dispatch. Commands write; queries read. Register every handler in its module and
  import the module from the owning app.
- Boundary types derive from zod. HTTP DTOs use `createZodDto`; responses use `ZodResponse`, and response DTOs use
  `{ codec: true }`. Give every top-level zod schema a stable `.meta({ id: 'Name' })`.
- Do not use `any`. Narrow `unknown` with zod or a type guard, and preserve database nullability at API boundaries.
- Respect path aliases and dependency-cruiser boundaries. The API and worker do not import each other, the worker does
  not import ALS, and `libs` do not import application entrypoints.
- Keep comments necessary and direct: explain the technical reason in at most three lines.

## Migrations

- Use Prisma-generated migrations for Prisma schema changes.
- Maintain constraints, expression indexes, views, functions, and other non-Prisma DDL in `prisma/ddl/`.
- Run `bun run db:ddl:sync` to generate the migration for maintained DDL. Never handwrite or hand-edit a generated
  timestamped migration.
- After the user explicitly authorizes a local reset/rebuild, run these commands in order:
  1. `bun run prisma:reset`
  2. `bun run db:ddl:sync`
  3. `bun run prisma:migrate` — apply the pending generated DDL migration through the local development workflow
  4. `bun run prisma:seed`
  5. `bun etl/load-market.ts` as a full load, without `--only`
- Skipping DDL sync/deploy can leave Prisma-inexpressible views, functions, constraints, expression indexes, or
  `NULLS NOT DISTINCT` semantics absent.
- Never apply or reset migrations or run ETL without explicit user approval.

## Verification

Run focused tests first, then the applicable gates:

```bash
bun test
bun run typecheck
bun run lint
bun run build
```

After schema or TypedSQL changes, run `bun run prisma:generate`. Use Conventional Commits only after verification,
without agent attribution or trailers.
