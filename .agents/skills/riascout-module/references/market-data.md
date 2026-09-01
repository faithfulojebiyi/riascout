# Market Data Reference

## Workspace boundary

- The Python distribution is `riascout-adv-data`, the import package is `riascout_adv_data`, and the CLI is
  `riascout-adv-data`.
- `market-data/` acquires SEC/IAPD evidence, builds and validates `data/analysis.duckdb`, and publishes versioned
  normalized Parquet releases. It does not own SaaS workspaces, dashboard configuration, or PostgreSQL projections.
- `etl/` is the TypeScript consumer boundary. `MARKET_DATA_DIR` points it to the validated market-data directory; do
  not bypass preflight or load an unpublished build.

## Evidence, provenance, and completeness

- Raw artifacts, manifests, and downloaded collection pages are immutable. Preserve artifact, collection, and field
  provenance through canonicalization and release export.
- Keep unknown distinct from false and zero. Do not infer dates, identities, registrations, employment, or firm links
  that the evidence does not establish.
- A current individual collection is complete only when planned and retrieved individual totals and page counts
  reconcile. Incomplete collections cannot drive current affiliations or movement.
- Registration-backed current links retain registration provenance and may carry an authentic start date.
  Observation-backed links retain collection/field provenance and keep start date and tenure null.
- Movement is the diff between complete collections. Process the first complete snapshot as a zero-event baseline;
  movement projections remain unknown/null until a second complete snapshot is processed.

## Publication and safety

- DuckDB permits one writer. Complete and validate canonical publication before exposing a release; concurrent readers
  use the last completed normalized release.
- The normalized release manifest and partitioned Parquet files are the stable handoff to downstream consumers.
- Send API keys only in authorization headers. Never put credentials in URLs, logs, fixtures, reports, manifests, or Git.
- Keep local data, methodology, reports, secrets, caches, and virtual environments ignored.

## Verification

From `market-data/`, run focused tests first, then:

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

Do not run acquisition, canonicalization, export, or ETL commands unless the task explicitly authorizes those data
operations.
