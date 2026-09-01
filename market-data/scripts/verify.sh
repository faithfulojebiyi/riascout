#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy src
uv run riascout-adv-data --help >/dev/null

if rg -n -i 'adv_history|adv-history|probe-current|inspect-historical-sample|check-dataset-catalog' \
  src tests README.md pyproject.toml; then
  echo "retired package or feasibility surface remains" >&2
  exit 1
fi
