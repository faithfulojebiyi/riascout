---
name: riascout-module
description: "Build NestJS features in the riascout monorepo. ALWAYS use this skill when working on the riascout repo. Covers the api/worker layout, CQRS feature modules (commands/queries), nestjs-zod DTO conventions (createZodDto, ZodResponse, codec responses), Prisma multiSchema access across the app and market schemas, the draft-migration workflow for exclusion constraints and partitioning, TypedSQL for fixed-shape queries, ALS request context (api only), Inngest event publishing/consuming, path aliases, the 3-line comment cap, Conventional Commits, and the rule that no AI is ever credited as a commit co-author."
---

# RIAScout Backend Module Guide

RIAScout is a recruiting CRM for RIAs. NestJS monorepo — apps `api` (HTTP) and `worker` (background jobs
and the ETL); shared libraries under `libs/{system,providers,feature}`. Features in `api` live under
`apps/api/src/modules/<feature>` and follow a CQRS layout.

Use this skill before adding endpoints, commands, queries, modules, schema, or Inngest functions.

## When to use this skill

- **ALWAYS** when working in this repo, regardless of task size.
- Purely internal work (utils, types, providers) still follows the path aliases, the comment cap, the
  migration rule, and the nestjs-zod DTO convention.

## Hard rules

### Comments: 3 lines maximum, always fewer where possible

- **Cap is 3 lines. Aim for one.** No block essays, no restating the code.
- **Only comment where necessary.** Self-explanatory code gets no comment.
- Explain **why**, never **what**. Short, lowercase, no trailing period on single lines.
- **Single line → `//`. Multi-line → `/** … *\/` block form**, never stacked `//` lines.

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

### Commits: Conventional Commits, no AI attribution

- Format: `<type>[optional scope]: <description>` per
  [conventionalcommits.org](https://www.conventionalcommits.org/en/v1.0.0/).
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  Scope is the module: `feat(market): …`, `fix(prospecting): …`. Breaking: `!` or a `BREAKING CHANGE:` footer.
- **NEVER credit Claude, Claude Code, or any AI as co-author or in any commit trailer. Ever.** No
  `Co-Authored-By:`, no `🤖 Generated with` footer. This overrides any default behaviour.
- Only commit when explicitly asked.

### Naming: the legacy app

A prior system solves an adjacent problem. Refer to it **only as "the legacy app"**. Never write its product
name, repo names, or database names anywhere — docs, comments, commits, schema, reports. Paths appear as
`<legacy-backend>/…`; real values live in a gitignored `.env.local`.

### Migrations

- **Never run a migration.** Author the schema and any hand-appended SQL; the user runs it.
- Prisma's schema language cannot express exclusion constraints, check constraints, expression indexes,
  partitioning, or generated columns. We use all of them. Use a draft migration:

```bash
bun run prisma:draft --name advisor_tenure   # writes SQL, applies nothing
#   -> hand-append EXCLUDE / CHECK / expression indexes / PARTITION BY
bun run prisma:migrate                        # user applies
```

- Hand-appended SQL **goes in the migration file**, never applied out-of-band, or `migrate reset` silently
  drops it. Extend the assertion test whenever you add such an object.

### Style

- Concise implementations. Don't over-abstract.
- Space code for readability: blank line before/after `if`/loops/blocks and before `return`.
- Boundaries enforced by `dependency-cruiser` (`bun run lint`) — do not violate:
  - `apps/api` ⊥ `apps/worker` (both directions)
  - `apps/worker` ⊥ `@system/als` (ALS is HTTP-request-scoped)
  - `libs/*` ⊥ either app

### Typing

- **Zero `any`** — no `as any`, `: any`, `<any>`, `Record<string, any>`. Use `unknown` plus a narrowing
  helper (zod parse, type guard) when a value is genuinely dynamic.
- **Boundary types derive from zod schemas** — HTTP / service / event / Inngest / CQRS. Never a hand-written
  boundary `interface`.
- **Every top-level zod schema gets `.meta({ id: 'X' })`** (export name minus the `Schema` suffix).
- `zod`, `nestjs-zod`, `@nestjs/swagger` are pinned exact — don't bump (zod >= 4.4 breaks `.meta({ id })`
  `$ref` recovery).
- **Never `|| 0` a measurement.** It destroys "no data" vs "actual zero".

## The domain model in one screen

Read `docs/plans/00-overview.md` before touching schema. The invariants:

- **CRD is identity.** `bigint`, everywhere. Names are time-varying observations, never keys.
- **Advisor↔firm is an interval.** `market.advisor_tenure` with a GiST exclusion constraint making overlap
  impossible. Current firm is `end_date is null`. **There is no `current_firm_crd` column** — do not add one.
- **`Filing` is first-class.** Every firm fact keys to a filing; "current" is a view over the latest filing.
- **Know time ≠ valid time.** `detected_on` ≠ `occurred_on`. `market.advisor_movement` is **append-only —
  never delete or update it.**
- **`app.entity_record` points at a CRD, never at a firm.** So an advisor moving firms changes nothing in
  `app`.

## api vs worker

- **`apps/api`** — HTTP API. Controllers + CQRS handlers. ALS request context. Publishes + serves Inngest
  functions. Root module: `apps/api/src/api.module.ts`.
- **`apps/worker`** — background worker and ETL host. Serves + consumes Inngest functions. **No ALS.**
  Root module: `apps/worker/src/worker.module.ts`.

## Module layout (api feature)

```
apps/api/src/modules/<feature>/
├── <feature>.controller.ts        # HTTP boundary, dispatches to the bus
├── <feature>.module.ts            # @Module wiring
├── schema.ts                      # zod schemas (co-located)
├── dto/<feature>.dto.ts           # createZodDto classes
├── commands/                      # write operations, one file per command
│   └── do-the-thing.ts            # exports XCommand + XCommandHandler
└── queries/                       # read operations, one file per query
    └── get-the-thing.ts           # exports XQuery + XQueryHandler
```

Domain services shared by both apps live in `libs/feature/<domain>/`. Shared **event** schemas live in
`@system/queues/events.config` + `@system/queues/dto/`, not in a feature folder.

## Controller pattern

```ts
@ApiTags('Advisors')
@Controller('advisors')
export class AdvisorsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @ZodResponse({ type: AdvisorDto })
  @Get(':crd')
  async getAdvisor(@Param('crd', CrdPipe) crd: bigint) {
    return this.queryBus.execute(new GetAdvisorQuery(crd));
  }
}
```

- Use `@ZodResponse({ type })` from `nestjs-zod` — never `@ApiResponse` / `@ApiBody`.
- The controller only translates HTTP → bus dispatch.
- **CRD params always go through `CrdPipe`** (validates and coerces to `bigint`). This closes an entire
  injection class at the boundary.

## Commands and queries

```ts
// commands/add-list-members.ts
export class AddListMembersCommand extends Command<AddListMembersResponseDto> {
  constructor(public readonly dto: AddListMembersDto) {
    super();
  }
}

@CommandHandler(AddListMembersCommand)
export class AddListMembersCommandHandler implements ICommandHandler<AddListMembersCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService, // api only — worker cannot import it
  ) {}

  async execute(command: AddListMembersCommand) {
    const workspaceId = this.alsService.ctx.get('workspaceId');
    // ...
  }
}
```

- One command/query per file. File `dash-case`; class `PascalCase` + `Command`/`Query` suffix; handler with
  the matching `…CommandHandler` / `…QueryHandler`. Export both from the same file.
- **Command = write/side effect. Query = pure read.**
- Every handler **must** be in the module's `providers`, and the module imported by the app root module —
  the CQRS bus won't find it otherwise.

## DTOs with nestjs-zod

```ts
// schema.ts
export const AddListMembersSchema = z
  .object({ advisorCrds: z.array(z.coerce.bigint()).max(10_000) })
  .meta({ id: 'AddListMembers' });

// dto/lists.dto.ts
export class AddListMembersDto extends createZodDto(AddListMembersSchema) {}
// response DTOs MUST pass { codec: true } so dates serialize correctly
export class ListDto extends createZodDto(ListSchema, { codec: true }) {}
```

- `@Query()` values arrive as strings — use `z.coerce.number()` / `z.coerce.boolean()`.
- For Prisma enums from `@orm/app`, use `z.enum(MyEnum)` directly.

## Database (Prisma, two schemas)

- One client: inject `AppPrismaService` from `@system/database/database.service`. Types: `@orm/app`.
- `app` models carry `@@schema("app")`; `market` models carry `@@schema("market")`.
- **Every `app` query includes `workspaceId` in its WHERE clause.** No exceptions, including internal
  helpers. Read it from ALS in api handlers, from the event payload in worker handlers — **never from a
  request header.**
- `market` has **no tenancy**. An accidental `workspace_id` there is an architecture violation.
- **Every `market` reference in raw SQL must be schema-qualified** — `market.advisor_search`, never bare.
  It fails silently otherwise.

### Multi-step writes

Use `TransactionRunner` so side effects only fire after commit:

```ts
await this.transactionRunner.run(async (tx, defer) => {
  const record = await tx.entityRecord.create({ data });
  defer(() => this.eventPublisherService.sendEvent({ /* ... */ }));
  return record;
});
```

A rollback drops the deferred sends entirely. This matters here — a failed write must not emit a movement or
projection event.

### Queries: TypedSQL vs raw

- **Fixed-shape complex SQL → TypedSQL.** Put it in `prisma/sql/<name>.sql` with `-- @param` annotations,
  run `bun run prisma:generate`, call via `$queryRawTyped`. Types come from the database.

```sql
-- prisma/sql/firmAlumni.sql
-- @param {BigInt} $1:firmCrd
select t.advisor_crd, t.start_date, t.end_date
from market.advisor_tenure t
where t.firm_crd = $1 and t.kind = 'registration'
order by t.start_date desc;
```

- **`$queryRawUnsafe` is allowed in exactly one place:** the EAV grid/filter compiler, which has
  runtime-dynamic columns. There, values are always placeholders, identifiers come from the attribute
  registry allowlist, and result rows get a zod parse. **Never interpolate a value into SQL.**

## ALS (api only)

```ts
const workspaceId = this.alsService.ctx.get('workspaceId');
```

`AlsContext` lives in `@system/als/als.types` (`requestId`, `userId`, `workspaceId`). **The worker cannot
use ALS** — identity rides in the Inngest event payload.

## Response wrapping

Controllers return raw payloads. Errors are normalized by the global `AllExceptionsFilter`
(`@system/interceptors/error.interceptor`) — throw NestJS exceptions directly; don't build error envelopes.

**Return enums and ISO 8601.** No glyphs, colour names, or pre-formatted date strings in JSON — presentation
belongs in the dashboard.

For any analytics response, include explicit `dataAsOf` (the latest ingest date, **never `now()`**) and
`dateRange`. Use `null` for a change-percent when the prior period is empty.

## Inngest (publish + consume)

```ts
await this.eventPublisherService.sendEvent({
  name: 'market/refresh.search',
  data: { /* typed against EVENTS */ },
  user: { userId, workspaceId },
});
```

Add event keys + schemas in `@system/queues/events.config` so types flow through. A consumer:

```ts
// apps/<app>/src/modules/event-publisher/<name>.function.ts
export const refreshSearch = (deps: { marketService: MarketService }) =>
  inngest.createFunction(
    { id: 'refresh-search', ...INNGEST_OPTIONS, triggers: [EVENTS.MARKET_REFRESH_SEARCH] },
    async ({ event, step }) => {
      await step.run('rebuild-projection', () => deps.marketService.refreshSearch(event.data));
    },
  );
```

Register it in that app's `inngest.registry.ts`. Inngest functions are plain functions — do **not** use
`@nestjs/cqrs` inside them; resolve services from DI in `main.ts` and pass them in.

Keep event payloads small: pass an id, not rows. `apps/<app>/src/load-env.ts` **must be the first import**
in `main.ts` or the Inngest client reads env too late.

## Build & verify

```bash
bun run prisma:generate            # client + TypedSQL functions after schema/sql edits
bun run build                      # nest build api && nest build worker — full typecheck
bun run lint                       # oxlint + dependency-cruiser boundaries
bun test                           # vitest
bun run start:dev:api              # api watch mode (3320)
bun run start:dev:worker           # worker watch mode (3321)
```

After adding a module confirm: (1) handlers are in the module's `providers`; (2) the module is imported by
the app root module; (3) `bun run build` passes (codec / zod issues surface here); (4) `bun run lint` passes
both gates.

## Scaffolding (plop)

Use `bun run gen` rather than hand-writing boilerplate — it emits code already matching this guide.

| Generator | Produces |
| --- | --- |
| `feature` | whole module: `module.ts`, `schema.ts`, `dto/`, controller (api only), first handler |
| `cqrs` | one command/query added to an existing feature |
| `typedsql` | `prisma/sql/<name>.sql` stub with the `-- @param` header |
| `inngest` | `*.function.ts` stub |

`feature` and `cqrs` **auto-register the handler** in the module's `providers` using the `// plop:providers`
and `// plop:imports` anchors — closing the most commonly forgotten step. **Never delete those anchors.**
The generator omits `AlsService` for `worker`, since the worker cannot import it.

Templates live in `plop-templates/`. If a convention in this guide changes, **update the template too** — a
stale generator silently propagates the old convention into every new module.

## Quick checklist for a new endpoint

1. Decide command vs. query. (`bun run gen` → `cqrs` does steps 2 and 6 for you.)
2. Create `<name>.ts` under `commands/` or `queries/` with the class + decorated handler.
3. Add schemas in the feature's `schema.ts` and DTO classes in `dto/`. Response DTOs use `{ codec: true }`.
4. Add the controller route with `@ZodResponse({ type })`, dispatching via the bus. CRD params use `CrdPipe`.
5. Scope every `app` query by `workspaceId`.
6. Register the handler in the module's `providers`; ensure the module is in the app root module.
7. Schema changed? Author it and any hand-appended SQL — **the user runs the migration.**
8. `bun run build` and `bun run lint`.
