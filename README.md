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

```bash
bun install
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp .env.local.example .env.local          # local paths, gitignored

bun run infra:up                          # postgres + redis
bun run start:dev:api                     # http://localhost:3320
bun run start:dev:worker                  # http://localhost:3321
```

`GET /health` is dependency-free (use it for container probes). `GET /health/deep` pings the database.
API docs at `/docs`, OpenAPI JSON at `/docs-json`.

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
