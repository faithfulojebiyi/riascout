import re
import subprocess
import sys
from importlib.util import find_spec
from types import SimpleNamespace

import pytest

from riascout_adv_data.cli import _build_parser, main

RETAINED_COMMANDS = {
    "list-official",
    "download-official",
    "ingest-official",
    "build-snapshots",
    "validate-snapshots",
    "report-official",
    "plan-individual-download",
    "download-individuals",
    "ingest-individuals",
    "build-individual-snapshots",
    "validate-individuals",
    "export-normalized",
}

REMOVED_COMMANDS = {
    "-".join(("probe", "current")),
    "-".join(("inspect", "historical", "sample")),
    "-".join(("validate", "official")),
    "report",
    "-".join(("check", "dataset", "catalog")),
}


def test_module_help_exposes_only_production_commands() -> None:
    completed = subprocess.run(
        [sys.executable, "-m", "riascout_adv_data", "--help"],
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0
    choices = re.search(r"\{([^}]+)\}", completed.stdout)
    assert choices is not None
    available_commands = set(choices.group(1).split(","))
    assert available_commands == RETAINED_COMMANDS
    for command in REMOVED_COMMANDS:
        assert command not in available_commands


def test_feasibility_only_modules_are_not_packaged() -> None:
    for name in (
        "analysis",
        "catalog",
        "inspector",
        "probes",
        "queries",
        "reporting",
        "validation",
    ):
        assert find_spec(f"riascout_adv_data.{name}") is None


@pytest.mark.parametrize(
    ("argv", "command"),
    [
        (
            ["plan-individual-download", "--run-id", "individual-current-20260826", "--data-dir", "data"],
            "plan-individual-download",
        ),
        (
            [
                "download-individuals",
                "--plan",
                "data/raw/sec_api_individuals/2026-08-26/collection-individual-current-20260826-plan.json",
                "--data-dir",
                "data",
            ],
            "download-individuals",
        ),
        (
            ["ingest-individuals", "--collection-id", "individual-current-20260826", "--data-dir", "data"],
            "ingest-individuals",
        ),
        (
            [
                "build-individual-snapshots",
                "--collection-id",
                "individual-current-20260826",
                "--years",
                "2020:2026",
                "--data-dir",
                "data",
            ],
            "build-individual-snapshots",
        ),
        (
            [
                "validate-individuals",
                "--collection-id",
                "individual-current-20260826",
                "--years",
                "2020:2026",
                "--data-dir",
                "data",
            ],
            "validate-individuals",
        ),
        (
            [
                "export-normalized",
                "--collection-id",
                "individual-current-20260826",
                "--release-id",
                "normalized-individual-current-20260826",
                "--years",
                "2020:2026",
                "--data-dir",
                "data",
            ],
            "export-normalized",
        ),
    ],
)
def test_individual_command_invocations_parse(argv: list[str], command: str) -> None:
    arguments = _build_parser().parse_args(argv)

    assert arguments.command == command


def test_filing_history_download_invocation_parses_requested_years() -> None:
    arguments = _build_parser().parse_args(
        [
            "download-official",
            "--filing-history",
            "--years",
            "2025:2026",
            "--data-dir",
            "data",
        ]
    )

    assert arguments.command == "download-official"
    assert arguments.filing_history is True
    assert arguments.years == [2025, 2026]


def test_validate_individuals_dispatch_returns_nonzero_on_failures(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    result = SimpleNamespace(
        is_valid=False,
        failures=(SimpleNamespace(code="broken", message="Broken invariant", count=2),),
        warnings=(SimpleNamespace(code="partial", message="Known limitation", count=1),),
    )
    monkeypatch.setattr("riascout_adv_data.cli.validate_individuals", lambda **_: result)

    exit_code = main(
        [
            "validate-individuals",
            "--collection-id",
            "collection-test",
            "--years",
            "2020:2026",
            "--data-dir",
            "data",
        ]
    )

    assert exit_code == 1
    output = capsys.readouterr().out
    assert "FAIL broken: Broken invariant (2)" in output
    assert "WARN partial: Known limitation (1)" in output
