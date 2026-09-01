import pytest

from riascout_adv_data.field_mapping import AmbiguousColumnError, ColumnResolver, MissingColumnError


def test_column_resolver_handles_sec_punctuation_without_fuzzy_guessing() -> None:
    resolver = ColumnResolver(["Filing ID", "1F1-Country", "5K (1) (a) (i) EOY"])

    assert resolver.require("filing_id", ("FilingID", "Filing ID")) == "Filing ID"
    assert resolver.optional("asset_equity_eoy", ("5K(1)(a)(i)EOY",)) == "5K (1) (a) (i) EOY"


def test_column_resolver_rejects_ambiguous_normalized_columns() -> None:
    resolver = ColumnResolver(["FilingID", "Filing ID"])

    with pytest.raises(AmbiguousColumnError, match="filing_id"):
        resolver.require("filing_id", ("FilingID", "Filing ID"))


def test_column_resolver_reports_missing_required_field() -> None:
    resolver = ColumnResolver(["1E1"])

    with pytest.raises(MissingColumnError, match="filing_id"):
        resolver.require("filing_id", ("FilingID", "Filing ID"))


def test_column_resolver_does_not_apply_edit_distance() -> None:
    resolver = ColumnResolver(["FilingIdentifier"])

    assert resolver.optional("filing_id", ("FilingID", "Filing ID")) is None
