from datetime import date

from riascout_adv_data.snapshots import interval_active, select_firm_snapshot


def test_select_firm_snapshot_uses_latest_filing_on_or_before_year_end() -> None:
    filings = [
        {"Info": {"FirmCrdNb": 361}, "Filing": [{"Dt": "2020-03-31"}], "id": "old"},
        {"Info": {"FirmCrdNb": 361}, "Filing": [{"Dt": "2020-11-15"}], "id": "year-end"},
        {"Info": {"FirmCrdNb": 361}, "Filing": [{"Dt": "2021-03-31"}], "id": "future"},
    ]

    result = select_firm_snapshot(filings, date(2020, 12, 31))

    assert result is not None
    assert result["id"] == "year-end"


def test_select_firm_snapshot_returns_none_without_prior_filing() -> None:
    filings = [{"Filing": [{"Dt": "2021-01-01"}], "id": "future"}]

    assert select_firm_snapshot(filings, date(2020, 12, 31)) is None


def test_interval_active_understands_month_precision_and_open_end() -> None:
    assert interval_active("04/2015", None, date(2020, 12, 31)) is True
    assert interval_active("01/2007", "06/2013", date(2020, 12, 31)) is False


def test_interval_active_treats_end_month_as_inclusive() -> None:
    assert interval_active("01/2020", "12/2020", date(2020, 12, 31)) is True
    assert interval_active("01/2020", "12/2020", date(2021, 1, 1)) is False
