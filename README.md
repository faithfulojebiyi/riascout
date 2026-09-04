# RIAScout

A recruiting CRM for RIAs (Registered Investment Advisers). Recruiters search a database of firms and
advisors, save results into lists, add their own columns, and work them as a pipeline. An assistant on
the home page turns a sentence into a search and answers questions about a firm or adviser.

## Screenshots

**Assistant home.** The first thing a recruiter sees: ask for a shortlist, a firm, or who moved.

![Assistant home page with greeting, composer, suggested prompts and recent conversations](.github/screenshots/assistant-home.png)

**A conversation.** The assistant runs the real search and shows the matches with CRDs before it answers.

![Assistant conversation showing a searched-advisers result table and a written answer](.github/screenshots/assistant-conversation.png)

**Prospecting.** Pick advisers or firms; the filters follow from the choice.

![Prospecting source picker with adviser, firm and custodian cards](.github/screenshots/prospecting-picker.png)

![Firm prospecting with the filter rail and the result grid](.github/screenshots/prospecting-firms.png)

**Records.** Saved firms as a grid with the workspace's own columns and view settings.

![Firm records grid with the view settings panel open](.github/screenshots/records-grid.png)

**A firm.** Assets, accounts and headcount over time, from every filing the firm has made.

![Firm record page with AUM, accounts and employee charts and the attribute panel](.github/screenshots/firm-record.png)

## Architecture

One Postgres, two schemas:

| Schema | Contents | Tenancy |
| --- | --- | --- |
| `app` | organizations/users/sessions, EAV (entity/attribute/record/value/view), lists | `workspace_id` on every table |
| `market` | firms, advisors, filings, firm facts, advisor tenure, observations, movement, search projections | none — global reference data |

Both live in one Prisma schema via `multiSchema`, so grid and prospecting queries join across them in a
single statement.

Three domain facts drive the design:

1. **CRD is stable identity** — firm and advisor CRDs never change. Names are time-varying observations,
   never keys.
2. **Advisor↔firm is a time interval**, not a foreign key. Current firm is `end_date is null`; there is no
   `current_firm_crd` column. A GiST exclusion constraint makes overlapping tenures impossible.
3. **Firms change shape over time.** `Filing` is a first-class entity, every firm fact keys to a filing, and
   "current" is a view.

Plus: **know time ≠ valid time.** `detected_on` (when we saw a move) is separate from `occurred_on` (when it
happened). Movement history is append-only and never deleted.

Full detail lives in `docs/plans/`, which is kept local and gitignored — start with `00-overview.md`.

## Layout

```
apps/api/         HTTP API (Fastify), port 3320
apps/worker/      background jobs + ETL, port 3321
dashboard/        TanStack Start + Vite, port 3020 (separate package.json)
libs/system/      als, auth, cache, cqrs, database, env, interceptors, logger, queues, schema
libs/feature/     market, movement, entities, lists, prospecting, jobs, import-export
libs/providers/   external integrations
prisma/           schema.prisma (both schemas), migrations/, sql/ (TypedSQL)
etl/              seed loader for the market schema
```

## Getting started

### Migrations are not committed yet

`prisma/migrations/` is gitignored on purpose. The schema is still changing daily and local databases
are reset often, so committing a migration history now would mean rewriting it every few days. Until the
schema settles and a first migration is cut and committed, every developer generates the initial
migration locally with the steps below. Do not hand-write or edit migration files; if your local history
drifts, reset and regenerate it.

### Prerequisites

- bun 1.3 or newer and Node 24 or newer
- Docker, for the local Postgres and Redis
- Python 3.12 and `uv`, only if you build the market-data release yourself

### 1. Install and configure

```bash
git clone <repo-url> riascout && cd riascout
bun install
cd dashboard && bun install && cd ..

cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp .env.local.example .env.local
```

Edit the copied files. The values that must be set:

| Variable | Where | Value for local development |
| --- | --- | --- |
| `APP_DATABASE_URL` | `apps/api/.env`, `apps/worker/.env` | `postgresql://riascout:riascout@localhost:5442/riascout?schema=app` (the compose database) |
| `BETTER_AUTH_SECRET` | `.env.local` | `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | `.env.local` | `http://localhost:3320` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `.env.local` | `http://localhost:3020` |
| `ANTHROPIC_API_KEY` | `apps/api/.env` | your key; the assistant on the home page needs it and the API refuses to boot without it |
| `MAIL_TRANSPORT` | `apps/api/.env` | `log`, so sign-in codes print in the API console instead of being emailed |
| `STORAGE_DRIVER` | `apps/api/.env` | `local`, so no object-store credentials are needed |
| `MARKET_DATA_DIR` | `.env.local`, `apps/worker/.env` | absolute path to the market-data `data/` directory (step 4) |

Each app loads its own `apps/<app>/.env` explicitly. The root `.env.local` is picked up by bun for every
script it runs, which is how the Better Auth values and `MARKET_DATA_DIR` reach the API and the ETL.

### 2. Start the databases

```bash
bun run infra:up      # Postgres 16 on localhost:5442, Redis on localhost:6389
```

### 3. Create the schema

Run these in order. The second command asks for a migration name because no migration exists yet;
`init` is fine. The DDL sync generates a second migration for the views, functions, constraints and
expression indexes Prisma cannot express, and the following migrate applies it.

```bash
bun run prisma:generate                 # Prisma client + TypedSQL
bunx prisma migrate dev --name init     # creates and applies your local initial migration
bun run db:ddl:sync                     # writes prisma/ddl/*.sql into a migration
bun run prisma:migrate                  # applies it (name it ddl_sync when asked)
bun run prisma:seed                     # controlled vocabularies (client types, exams, ...)
```

Skipping the DDL sync leaves the `market` views and constraints missing, and the app fails in
confusing ways later. The assistant's tables live in a separate `agent` schema that Mastra creates on
the first API boot; Prisma neither manages nor migrates it.

### 4. Load the market data

The ETL reads the canonical DuckDB file the `market-data/` workspace produces and loads the `market`
schema from it. Either obtain a built `data/` directory from a teammate, or build it yourself with the
pipeline in [market-data/README.md](./market-data/README.md) (official firm archives, then the current
individual collection, then the normalized export). Point `MARKET_DATA_DIR` at that directory, then:

```bash
bun etl/load-market.ts                  # full load; takes a while on the first run
bun etl/load-market.ts --list           # shows the stages if you need to re-run one
```

### 5. Run the apps

```bash
bun run start:dev:api                   # http://localhost:3320
bun run start:dev:worker                # http://localhost:3321
cd dashboard && bun run dev             # http://localhost:3020
```

Open the dashboard, sign up, and read the six-digit code from the API console (`MAIL_TRANSPORT=log`).
The first sign-up creates your workspace and provisions its entities and columns.

`GET /health` is dependency-free (use it for container probes). `GET /health/deep` pings the database.
API docs at `/docs`, OpenAPI JSON at `/docs-json`.

### Resetting your local database

When the schema changes under you, rebuild rather than patch. Same order as above, after the reset:

```bash
bun run prisma:reset                    # drops and recreates from your local migrations
bun run db:ddl:sync
bun run prisma:migrate
bun run prisma:seed
bun etl/load-market.ts
bun run db:reset:agent                  # optional: also drop the assistant's threads
```

## Commands

```bash
bun run typecheck    # tsc -b — the real gate; nest build does NOT typecheck
bun run build        # nest build api && nest build worker
bun run lint         # oxlint + dependency-cruiser module boundaries
bun run test         # vitest
bun run gen          # plop scaffolder (feature | cqrs | typedsql | inngest)
bun run format       # prettier
```

## Contributing

Read [CLAUDE.md](./CLAUDE.md) before making changes. In short:

- Comments cap at 3 lines, only where necessary; multi-line uses `/** … */`.
- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
- Zero `any`; boundary types derive from zod schemas.
- Never run migrations — author the schema and any hand-appended SQL, and let a human apply it.
- Module boundaries are enforced by `dependency-cruiser`, not convention.
