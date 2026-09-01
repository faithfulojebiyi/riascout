# CLAUDE.md

This file provides repository guidance to Claude Code.

## Required skill and scope

Invoke `riascout-module` before working in this repository. Read root `AGENTS.md` for every task and
`market-data/AGENTS.md` for Python acquisition, DuckDB, evidence, normalization, or release work. The shared detailed
references live under `.agents/skills/riascout-module/references/`; read `application.md`, `market-data.md`, or both
when a change crosses the release boundary.

Plans, local data, methodology, reports, secrets, caches, and virtual environments are ignored and never committed.

## Architecture

RIAScout is a recruiting CRM for RIAs:

- `apps/api` is the Fastify HTTP API with request-scoped ALS.
- `apps/worker` runs background jobs and the ETL; it has no request-scoped ALS.
- `libs/system`, `libs/providers`, and `libs/feature` contain shared infrastructure and domain code.
- `market-data/` owns SEC/IAPD evidence, canonical DuckDB state, validation, and normalized releases.
- `etl/` validates a release selected by `MARKET_DATA_DIR` and loads PostgreSQL.
- `dashboard/` is a separate TanStack Start application with its own tooling.

PostgreSQL has two data planes:

| Schema | Contents | Tenancy |
| --- | --- | --- |
| `app` | organizations, users, EAV entities, lists | every query includes `workspace_id` |
| `market` | firms, advisers, observations, movement, projections | global; never add `workspace_id` |

`app.entity_record` points to a market entity by `source_kind` plus CRD, not to an adviser's current firm. Schema-qualify
every `market` reference in raw SQL.

## Domain invariants

- Adviser and firm CRDs are stable `bigint` identities. Names are observations, never keys.
- Unknown is distinct from false and zero. Never invent dates, measurements, identities, or relationships.
- Raw evidence is immutable, with collection and field provenance preserved through publication.
- Current affiliation supports registration-backed and observation-backed provenance. Observation-only links retain
  their observation date and keep `current_firm_since` and tenure null.
- Incomplete collections cannot drive current affiliations or movement.
- Movement is diffed between complete collections. The first complete snapshot is a processed zero-event baseline;
  projection movement fields remain unknown/null until a second complete collection is processed.
- Know time (`detected_on`) remains separate from valid time (`occurred_on`).

## Hard rules

### Comments

- Keep comments to at most three lines and use fewer where possible.
- Comment only when the technical reason is not evident from the code. Do not restate behavior.
- Use `//` for one line and `/** ... */` for multiple lines.

### Commits

- Use Conventional Commits: `<type>[optional scope]: <description>`.
- Commit only when explicitly requested and after the relevant verification passes.
- Never add agent attribution, generated-with footers, co-author lines, or other attribution trailers.

### Credentials

- Send API keys only in authorization headers.
- Never put credentials in URLs, logs, fixtures, reports, manifests, or Git.

## NestJS, CQRS, and typing

- Controllers translate HTTP to command/query bus dispatch. Commands write; queries read.
- Register every handler in its feature module and import the module from the owning application.
- The API reads workspace identity from ALS. The worker receives identity in the event payload and must not import ALS.
- Boundary types derive from zod. HTTP DTOs use `createZodDto`; responses use `ZodResponse`, and response DTOs use
  `{ codec: true }`.
- Every top-level zod schema has a stable `.meta({ id: 'Name' })`.
- Do not use `any`. Narrow `unknown` with zod or a type guard, and preserve nullability through the API boundary.
- Use path aliases. `apps/api` and `apps/worker` do not import each other; `libs` do not import application entrypoints.

## Database and migrations

- Inject `AppPrismaService`; use generated types from `@orm/app`.
- Use TypedSQL in `prisma/sql/` for fixed-shape complex SQL. Only the allowlisted EAV grid/filter compiler may use
  `$queryRawUnsafe`, with placeholder values, registry-approved identifiers, and zod-parsed rows.
- Use Prisma-generated migrations only. Never handwrite or hand-edit generated timestamped migrations.
- Maintained non-Prisma DDL lives in `prisma/ddl/`; run `bun run db:ddl:sync` to generate its migration.
- Never apply or reset migrations without explicit user approval.

## Events

Inngest event names and zod schemas live in `@system/queues/events.config`. Keep consumers thin: they dispatch CQRS work,
carry `userId` and `workspaceId` in worker payloads, and are registered in the owning app's Inngest registry. Keep
`apps/<app>/src/load-env.ts` as the first import in `main.ts` so environment configuration exists at client construction.

## Commands

```bash
bun install
bun run prisma:generate
bun run db:ddl:sync
bun run typecheck
bun run build
bun run lint
bun test
bun run format
bun run start:dev:api
bun run start:dev:worker
bun run inngest:dev
bun run gen
```

Do not run migration apply/reset, market-data acquisition/publication, ETL, or database mutation without the authorization
required for that operation.
