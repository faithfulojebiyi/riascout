# Market Data Instructions

## Boundary

This workspace acquires SEC/IAPD evidence, normalizes it in DuckDB, validates completeness and provenance, and publishes versioned releases. It does not model SaaS workspaces, facets, dashboards, or PostgreSQL projections.

## Hard rules

- raw artifacts and collection pages are immutable evidence
- use one DuckDB writer and publish only after validation succeeds
- preserve collection and field provenance
- incomplete collections cannot drive current affiliations or movement
- keep unknown distinct from false and zero; never invent dates or relationships
- send API keys only in authorization headers and never persist credentials
- local data, methodology, reports, secrets, caches, and virtual environments stay ignored

## Verification

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```
