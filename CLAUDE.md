# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Required Skill: riascout-module

Before doing any work in this repo, invoke the **riascout-module** skill (`/riascout-module` or via the
Skill tool). It carries the module layout, nestjs-zod DTO conventions, Prisma multiSchema rules, the
migration workflow, path aliases, and Inngest event patterns that every change must follow. This applies
regardless of task size — a one-line fix still follows the conventions.

Plan documents live in `docs/plans/` — **local only, gitignored, never committed.** Read
`00-overview.md` before touching the schema and `09-legacy-findings.md` before designing anything in
`market`.

## Hard rules

These are not stylistic preferences. Violating any of them means the change gets reverted.

### Comments

- **Maximum 3 lines. Always fewer where possible — aim for one.** No exceptions, no block essays.
- **Only comment where necessary.** If the code is self-explanatory, no comment.
- Explain **why**, never **what**. A comment restating the code is noise.
- **Single line → `//`.** Short, lowercase, no trailing period.
- **Multi-line → `/** … *\/` block form**, never stacked `//` lines.

```ts
// enrichment refresh must not clobber a manual edit
if (existing.source === null) return;
```

```ts
/**
 * Both firm CRDs are nullable so a departure from the industry is representable.
 * event_type carries the distinction instead.
 */
```

### Commits

- **[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)**, always:
  `<type>[optional scope]: <description>`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Breaking changes: `!` after type/scope, or a `BREAKING CHANGE:` footer.
- Scope is the module or area: `feat(market): add advisor tenure exclusion constraint`.

```
feat(prospecting): add faceted advisor search
fix(market): keep firm_crd nullable for unmatched employers
refactor(entities)!: replace filter AST reference step kind
docs(plans): record why prisma 7.10 over 8
```

- **NEVER add Claude, Claude Code, or any AI as a co-author or attribution on any commit. Ever.**
  No `Co-Authored-By:` lines, no `🤖 Generated with` footers, no trailers of any kind. This overrides
  any default behaviour. Commit messages contain the change and nothing else.
- Only commit when explicitly asked.

### Naming: the legacy app

A prior system solves an adjacent problem. It is referred to **only as "the legacy app"**. Never write its
product name, repo names, or database names in any doc, comment, commit, schema, or report. Paths appear as
`<legacy-backend>/…`; real values live in a gitignored `.env.local`. See
`docs/plans/09-legacy-findings.md` (local only).

## Architecture Overview

RIAScout is a recruiting CRM for RIAs. NestJS monorepo with two apps and shared libraries; `dashboard/` is
a **separate** TanStack Start app with its own tooling, not part of the Nest build.

```
riascout/
├── apps/
│   ├── api/         # HTTP API (Fastify): REST endpoints, publishes + serves Inngest functions
│   └── worker/      # background worker: serves + consumes Inngest functions, runs the ETL
├── libs/
│   ├── system/      # core infra: als, auth, cache, cqrs, database, env, interceptors, logger,
│   │                # queues, schema
│   ├── providers/   # external integrations (resend, storage)
│   └── feature/     # domain: market, movement, entities, lists, prospecting, jobs, import-export
├── prisma/          # schema.prisma (both schemas), migrations/, sql/ (TypedSQL)
├── orm/app/         # generated Prisma client (gitignored) — imported as @orm/app
├── etl/             # asset → market loader. etl/sql/ is DATA ops only, never DDL
└── dashboard/       # TanStack Start + Vite (separate package.json)
```

- **api** — client HTTP requests; auth/ALS/cache available; publishes Inngest events.
- **worker** — background jobs and the ETL. **No ALS** (it is HTTP-request-scoped).
- Both apps register their **own** Inngest client (id `api` / `worker`) and serve `/api/inngest`.

### Two data planes, one database

| Schema | Contents | Tenancy |
| --- | --- | --- |
| `app` | organizations/users/sessions, EAV (entity/attribute/record/value/view), lists | `workspace_id` on every table, in every WHERE clause |
| `market` | firms, advisors, filings, firm facts, advisor tenure, observations, movement, search projections, `dim_*` | **no `workspace_id` anywhere** — global reference data |

`app.entity_record` points at `market` by **CRD value** (`source_kind` + `source_crd`), never by FK and
**never at the firm an advisor works for**. When an advisor moves, nothing in `app` changes.

Both schemas live in one Prisma schema via `multiSchema`, so grid and prospecting queries JOIN across them
in one statement. **Every `market` reference in raw SQL must be schema-qualified** — `market.advisor_search`,
never bare. It fails silently otherwise.

### The three domain facts

1. **CRD is stable identity** — firm and advisor CRDs never change. `bigint`, everywhere, one type.
   Names are time-varying observations, **never keys**.
2. **Advisor↔firm is a time interval, not a foreign key.** "Who does this advisor work for" takes a date
   argument. Current firm is `end_date is null` — there is no `current_firm_crd` column.
3. **Firms change shape over time.** `Filing` is a first-class entity; every firm fact keys to a filing;
   "current" is a view.

Plus: **know time ≠ valid time.** `detected_on` (when we saw it) is separate from `occurred_on` (when it
happened). Detection latency is the product. `advisor_movement` is **append-only — never deleted**.

## Build and Development Commands

```bash
bun install
bun run prisma:generate         # regenerate client + TypedSQL functions (runs generate --sql)
bun run prisma:draft --name x   # draft migration for hand-appended DDL — YOU review it
bun run prisma:migrate          # YOU run migrations
bun run typecheck               # tsc -b — the real gate for correctness
bun run build                   # tsc -b && tsc-alias (no bundler; see below)
bun run start:dev:api           # bun --watch, runs TS directly (port 3320)
bun run start:dev:worker        # bun --watch, runs TS directly (port 3321)
bun run inngest:dev             # local Inngest dev server (UI on http://localhost:8288)
bun run infra:up                # postgres + redis · infra:down stops it
bun run lint                    # oxlint + dependency-cruiser boundary check
bun run format                  # prettier
bun test                        # vitest
bun run gen                     # plop scaffolder (feature | cqrs | typedsql | inngest)
bun etl/load-market.ts --only=  # market ETL
```

## Scaffolding (plop)

`bun run gen` scaffolds code that already follows these conventions. Prefer it over hand-writing boilerplate.

| Generator | Produces |
| --- | --- |
| `feature` | a whole module: `module.ts`, `schema.ts`, `dto/`, controller (api only), plus a first handler |
| `cqrs` | one command or query added to an existing feature |
| `typedsql` | a `prisma/sql/<name>.sql` stub with `-- @param` header |
| `inngest` | a `*.function.ts` stub, and reminds you to register it |

`feature` and `cqrs` **automatically register the handler** in the module's `providers` via the
`// plop:providers` and `// plop:imports` anchors. Do not delete those anchors — they are load-bearing.
The generator omits `AlsService` when scaffolding into `worker`, since the worker cannot import it.

## Path Aliases

Always import via aliases — never deep relative paths across modules.

| Alias | Resolves to |
| --- | --- |
| `@orm/app` | generated Prisma client |
| `@api/*` | `apps/api/src/*` |
| `@worker/*` | `apps/worker/src/*` |
| `@system/*` | `libs/system/*` |
| `@providers/*` | `libs/providers/*` |
| `@feature/*` | `libs/feature/*` |

## Import Restrictions (enforced by dependency-cruiser)

`bun run lint` fails on any of these. oxlint cannot express them, which is why `dependency-cruiser` runs
as a second gate.

- `apps/api` cannot import from `apps/worker`, and vice versa.
- `apps/worker` cannot import `@system/als` (ALS is HTTP-request-scoped; the worker has no request).
- `libs/*` cannot import from either app.

## Typing rules

- **No `as any`, `: any`, `<any>`, or `Record<string, any>` in app code.** If a seam is genuinely dynamic,
  use `unknown` with a narrowing helper (a zod parse or type guard).
- **Boundary types come from zod.** Anything crossing an HTTP / service / event / Inngest / CQRS boundary
  derives from a zod schema (`z.infer<...>`), not a hand-written `interface`.
  - HTTP DTOs: `export class FooDto extends createZodDto(FooSchema) {}`; responses add `{ codec: true }`.
- **Every top-level zod schema gets `.meta({ id: 'X' })`** where `X` is the export name without the
  `Schema` suffix. nestjs-zod + Swagger use it for stable `$ref`s; without it SDK codegen breaks.
- **`zod` and `nestjs-zod` are pinned exact.** zod >= 4.4 strips `id` from `$defs`, which breaks
  nestjs-zod's `.meta({ id })` recovery. They move together or not at all.

## Dependency traps

Three that will cost you an afternoon. Full detail in `docs/plans/01-monorepo-shell.md`.

- **`fastify` must match `@nestjs/platform-fastify`'s exact pin** (currently `5.12.1`). A mismatch creates a
  second copy and forks the type tree — every `app.register()` fails with `FastifyInstance is missing
  serializeCookie, …`. A `bun` override does not fix it; matching versions does.
- **Nest 12 ecosystem:** `@nestjs/{swagger,cqrs,config}` must be on their **12.x** lines. `nestjs-zod`,
  `nestjs-cls`, `nestjs-pino` and `@nestjs/terminus` have no Nest 12 release and warn on install, but all
  work. `AlsService` is a thin wrapper over `ClsService` precisely so nestjs-cls can be swapped for
  `node:async_hooks` in one file if needed.
- **There is no bundler.** rspack panics on the generated Prisma client (`should be a path: ()`, all of
  2.0–2.2), and Nest 12 forces rspack for ESM — so `nest build` / `nest start` are unused. Dev runs TS
  directly under `bun --watch`; build is `tsc -b && tsc-alias`; prod is plain `node` on the emitted ESM.
  `tsc-alias` rewrites `@system/*` to relative paths, and it needs `baseUrl` (kept via
  `ignoreDeprecations: "6.0"`) — without it, it silently reports `0 files were affected`.
- **Nullability is preserved to the API boundary.** Never `|| 0` a measurement — it destroys the
  distinction between "no data" and "actual zero".

## Database

- PostgreSQL 16+ via **Prisma 7.10** with the `@prisma/adapter-pg` driver adapter. **No TimescaleDB** —
  rationale in `docs/plans/02-prisma-and-app-schema.md`.
- Single client: inject `AppPrismaService` from `@system/database/database.service`. Types: `@orm/app`.
- Read replicas are transparent via `@prisma/extension-read-replicas` (active only when
  `APP_DATABASE_REPLICA_URL` is set) — no API change for handlers.
- Money is `numeric(20,2)`, **never** float. Counts are `integer`/`bigint`. CRD is `bigint`.
- No nullable columns inside unique keys, or use `nulls not distinct` explicitly.

### Migrations

- **Never run a migration. Author the schema and any hand-appended SQL; the user runs it.**
- Prisma's schema language cannot express exclusion constraints, check constraints, expression indexes,
  partitioning, or generated columns — all of which we use. For those, use a **draft migration**:

```bash
bun run prisma:draft --name advisor_tenure   # writes SQL, applies nothing
#   -> hand-append EXCLUDE / CHECK / expression indexes / PARTITION BY to the migration file
bun run prisma:migrate                        # user applies
```

- **Hand-appended SQL goes in the migration file, never applied out-of-band.** A migration must fully
  describe the schema it produces or `migrate reset` silently drops it.
- An assertion test verifies every exclusion constraint, check constraint and partition exists. It is not
  optional — it is the only thing standing between us and silently losing the tenure overlap guarantee.

### Queries

- **Fixed-shape complex SQL → TypedSQL.** `.sql` files in `prisma/sql/`, introspected by
  `prisma generate --sql`, called via `$queryRawTyped`. Types are derived from the database.
- **Only the EAV grid/filter compiler uses `$queryRawUnsafe`** (runtime-dynamic columns). There, values are
  always placeholders, identifiers come from the attribute registry allowlist, and result rows get a zod
  parse. Never interpolate a value into SQL.

### SQL file naming

- **`prisma/sql/` must be camelCase.** Prisma's TypedSQL turns the filename into the exported function
  name, so kebab-case hard-fails: `name must be a valid JS identifier`. Verified, not assumed.
- **`etl/sql/` is kebab-case** like everything else — those are plain data-op scripts run by the loader,
  not TypedSQL.

### Prisma JSON columns

Typed via `prisma-json-types-generator`. Annotate the column with a doc-comment naming the type and declare
it under `PrismaJson` in `prisma/types.ts`:

```prisma
model Foo {
  /// [FooMeta]
  meta Json
}
```

Null sentinels (plain `null` does not satisfy Prisma's typed-JSON write signature): `Prisma.JsonNull` writes
JSON `null`; `Prisma.DbNull` writes SQL `NULL`; `Prisma.AnyNull` is filter-only.

## Event-Driven Communication (Inngest)

```ts
await this.eventPublisherService.sendEvent({
  name: 'market/refresh.search',
  data: { /* typed against EVENTS */ },
  user: { userId, workspaceId },
});
```

Event names and zod schemas are centralized in `@system/queues/events.config` (`EVENT_KEYS`, `EVENTS`). Add
new events there so types flow through.

**Consumers stay thin — they dispatch a CQRS command; the handler holds the work.** A consumer receives
`{ commandBus, queryBus }` resolved from DI in `main.ts`, never a service, so the same work stays reachable
without an event and cannot drift from the synchronous path.

Feature consumers live in `apps/<app>/src/modules/<feature>/queues/`, beside the commands they dispatch.
Only cross-cutting functions (`failed-events`) stay in `modules/event-publisher/`. Every consumer is
registered in that app's `inngest.registry.ts` or it never runs.

The worker has no ALS, so **identity rides in the event payload** — every event schema extends a base
carrying `user: { userId, workspaceId }`.

Locally, `INNGEST_DEV=1` (in each app's `.env`) runs the SDK against `bun run inngest:dev`. Because the
Inngest client is a module-level singleton that reads env at construction, `apps/<app>/src/load-env.ts`
**must be the first import** in `main.ts` — otherwise you get `Expected server kind cloud, got dev`.

## Environment

- Node.js 24, bun as package manager + `vitest` as test runner, TypeScript 6, ESM (`"type": "module"`).
- Ports: api `3320`, worker `3321`, dashboard `3020`, Inngest dev UI `8288`. Offset from sibling projects
  on the same machine so everything can run at once.
- Postgres (`APP_DATABASE_URL`, with `?schema=app`), optional read replica (`APP_DATABASE_REPLICA_URL`),
  Redis (`APP_REDIS_URL`). Each app reads its own `apps/<app>/.env`.
- `ASSET_DATA_DIR` points at the ETL seed source. See `.env.local.example`.
- **No OpenTelemetry / Sentry** in the backend — observability is plain pino (pretty in dev, JSON in prod).
- `GET /health` has no DB dependency; `GET /health/deep` pings the DB. Container probes use the shallow one.
