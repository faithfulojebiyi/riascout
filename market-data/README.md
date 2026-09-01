# RIAScout Market Data

This Python workspace acquires SEC/IAPD evidence, builds the canonical DuckDB dataset, validates provenance and completeness, and exports normalized releases consumed by RIAScout's TypeScript ETL.

## Responsibilities

- immutable official SEC and current SEC/IAPD evidence
- firm, filing, fund, custodian, adviser, registration, employment, and disclosure-flag normalization
- explicit coverage and validation gates
- versioned normalized releases

## Safety

Local `data/`, `docs/`, `.env.local`, generated reports, caches, and virtual environments are ignored. Keep unknown values null, do not invent dates or relationships, and never place credentials in URLs, fixtures, reports, or Git.

## Development

```bash
uv sync --extra dev
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```
