from datetime import date

import pytest

from riascout_adv_data.geography import (
    CountryChoice,
    DatedCountry,
    choose_country_as_of,
    derive_us_based,
    normalize_country,
    normalize_us_state,
)


@pytest.mark.parametrize(
    ("raw", "code", "is_us"),
    [
        ("UNITED STATES", "US", True),
        ("USA", "US", True),
        ("Puerto Rico", "PR", True),
        ("CAYMAN ISLANDS", "KY", False),
        ("Korea, South", "KR", False),
        ("Bahamas, The", "BS", False),
        ("Taiwan,  Republic of China", "TW", False),
        ("Turkey", "TR", False),
        ("Georgia/Gruzinskaya", "GE", False),
        ("Macau", "MO", False),
        ("", None, None),
        ("UNRECOGNIZED COUNTRY", None, None),
    ],
)
def test_country_and_us_derivation(raw: str, code: str | None, is_us: bool | None) -> None:
    normalized = normalize_country(raw)

    assert normalized.code == code
    assert derive_us_based(normalized.code) is is_us


def test_other_country_is_a_recognized_explicit_unknown() -> None:
    normalized = normalize_country("Other")

    assert normalized.raw == "Other"
    assert normalized.code is None
    assert normalized.recognized is True


def test_country_carry_forward_never_looks_into_the_future() -> None:
    chosen = choose_country_as_of(
        as_of=date(2025, 12, 31),
        values=[DatedCountry(date(2025, 11, 30), "US"), DatedCountry(date(2026, 1, 31), "GB")],
    )

    assert chosen == CountryChoice("US", date(2025, 11, 30), carried_forward=True)


def test_country_on_snapshot_date_is_not_marked_carried_forward() -> None:
    chosen = choose_country_as_of(
        as_of=date(2025, 12, 31),
        values=[DatedCountry(date(2025, 12, 31), "US")],
    )

    assert chosen == CountryChoice("US", date(2025, 12, 31), carried_forward=False)


def test_state_is_normalized_only_for_us_based_address() -> None:
    assert normalize_us_state("new york", country_code="US") == "NY"
    assert normalize_us_state("CA", country_code="CA") is None
    assert normalize_us_state("", country_code="PR") == "PR"
