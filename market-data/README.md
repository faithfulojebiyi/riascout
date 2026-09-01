# RIAScout Market Data

This Python workspace acquires SEC/IAPD evidence, builds the canonical DuckDB dataset, validates provenance and completeness, and exports normalized releases consumed by RIAScout's TypeScript ETL.

## Coverage and data model

- 2020–2024 firm history comes from official historical filing archives.
- 2025–2026 firm history comes from official monthly filing archives available in the local collection.
- Current individual data is a complete collection only when planned and retrieved individual counts and page counts reconcile.
- Current profiles can contain historical registration and employment intervals, but they are not a complete historical U4/U5 population.
- Missing state-registration or geography evidence remains unknown; it is never converted to `false`.

Raw evidence is immutable, DuckDB is the canonical write surface, and versioned normalized Parquet releases are the concurrent read surface. Normalized individual history derived from current profiles is explicitly labelled as a partial current-population backcast.

## Installation

Python 3.12 or newer and `uv` are required:

```bash
uv sync --extra dev
cp .env.example .env.local
chmod 600 .env.local
```

Set an identified SEC user agent before live SEC access:

```dotenv
SEC_USER_AGENT=Your Organization data-contact@example.com
SEC_API_KEY=your-api-key
```

`SEC_USER_AGENT` identifies the caller to the SEC. `SEC_API_KEY` authorizes the current-individual API. The API key is sent in the HTTPS `Authorization` header, never in the URL.

## Official firm pipeline

Inspect the official report catalog:

```bash
uv run riascout-adv-data list-official --year 2025 --month 12
```

Download immutable official sources. Historical archives can be large, so review disk space before starting a transfer:

```bash
uv run riascout-adv-data download-official --historical --data-dir data
uv run riascout-adv-data download-official --filing-history --years 2025:2026 --data-dir data
uv run riascout-adv-data download-official --year 2025 --month 12 --data-dir data
uv run riascout-adv-data download-official --latest-2026 --data-dir data
```

Run the offline ingestion, snapshot, validation, and coverage stages:

```bash
uv run riascout-adv-data ingest-official --data-dir data
uv run riascout-adv-data build-snapshots --years 2020:2026 --data-dir data
uv run riascout-adv-data validate-snapshots --years 2020:2026 --data-dir data
uv run riascout-adv-data report-official --years 2020:2026 --data-dir data --report-dir reports
```

Validation exits with status 1 for acceptance failures. Expected source limitations are warnings.

## Current individual pipeline

First create a bounded request plan. Planning retrieves counts only and prints expected individuals, shards, probe requests, page requests, and total requests:

```bash
uv run riascout-adv-data plan-individual-download \
  --run-id individual-current-20260826 \
  --data-dir data \
  --env-file .env.local
```

Review the estimate, then run the exact saved plan:

```bash
uv run riascout-adv-data download-individuals \
  --plan data/raw/sec_api_individuals/2026-08-26/collection-individual-current-20260826-plan.json \
  --data-dir data \
  --env-file .env.local
```

Run the offline stages after every planned page and individual count reconciles:

```bash
uv run riascout-adv-data ingest-individuals \
  --collection-id individual-current-20260826 --data-dir data
uv run riascout-adv-data build-individual-snapshots \
  --collection-id individual-current-20260826 --years 2020:2026 --data-dir data
uv run riascout-adv-data validate-individuals \
  --collection-id individual-current-20260826 --years 2020:2026 \
  --data-dir data --report-dir reports
uv run riascout-adv-data export-normalized \
  --collection-id individual-current-20260826 \
  --release-id normalized-individual-current-20260826 \
  --years 2020:2026 --data-dir data
```

The publication flow is:

```text
data/raw/ immutable payloads and manifests
  -> data/analysis.duckdb canonical identities, filings, intervals, and snapshots
  -> reports/ coverage and validation evidence
  -> data/normalized/<release-id>/ partitioned Parquet and manifest.json
```

DuckDB permits one writer. Analysts can continue reading the last completed Parquet release while a new canonical build is in progress.

## Snapshot rules

- For 2020–2024, select the latest valid filing effective or submitted on or before December 31.
- Join filing sections through the selected filing ID, never by CRD and year alone.
- Apply explicit ADV-W and ERA final-report events at their effective dates.
- Use only complete monthly archive pairs for 2025–2026.
- Never look forward when carrying an earlier explicit country into a later observation.
- Keep workplace geography separate from employer geography, and keep unknown separate from false.

## Development verification

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy src
uv run riascout-adv-data --help
```

The test suite uses synthetic local data and mocked HTTP; it performs no live download.
