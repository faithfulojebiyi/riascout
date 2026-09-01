---
name: riascout-module
description: Use when changing the RIAScout backend, schema, ETL, market-data workspace, adviser or firm data, migrations, or repository agent guidance; not for dashboard-only visual design.
---

# RIAScout Module

Read root `AGENTS.md` and `CLAUDE.md` before making changes.

- Read `.agents/skills/riascout-module/references/application.md` for NestJS, Prisma, PostgreSQL, CQRS,
  TypedSQL, tenancy, application verification, and generated migrations.
- Read `.agents/skills/riascout-module/references/market-data.md` for Python acquisition, DuckDB, provenance,
  completeness, normalized releases, and the TypeScript ETL boundary.
- Read both when a change crosses the release boundary.
- For work under `market-data/`, also read `market-data/AGENTS.md`.
