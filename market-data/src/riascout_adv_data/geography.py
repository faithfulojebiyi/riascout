"""Country, U.S. state, and point-in-time geography derivation."""

from dataclasses import dataclass
from datetime import date

import pycountry

US_BASED_CODES = frozenset({"US", "PR", "GU", "VI", "AS", "MP", "UM"})

COUNTRY_ALIASES = {
    "U.S.": "US",
    "U.S.A.": "US",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    "USA": "US",
    "US": "US",
    "UK": "GB",
    "UNITED KINGDOM": "GB",
    "CAYMAN ISLANDS": "KY",
    "HONG KONG": "HK",
    "KOREA, SOUTH": "KR",
    "SOUTH KOREA": "KR",
    "REPUBLIC OF KOREA": "KR",
    "BAHAMAS, THE": "BS",
    "RUSSIA": "RU",
    "TAIWAN": "TW",
    "TAIWAN, REPUBLIC OF CHINA": "TW",
    "TURKEY": "TR",
    "GEORGIA/GRUZINSKAYA": "GE",
    "MACAU": "MO",
    "VIETNAM": "VN",
}

EXPLICIT_UNKNOWN_COUNTRIES = frozenset({"OTHER"})

US_STATES = {
    "ALABAMA": "AL",
    "ALASKA": "AK",
    "ARIZONA": "AZ",
    "ARKANSAS": "AR",
    "CALIFORNIA": "CA",
    "COLORADO": "CO",
    "CONNECTICUT": "CT",
    "DELAWARE": "DE",
    "DISTRICT OF COLUMBIA": "DC",
    "FLORIDA": "FL",
    "GEORGIA": "GA",
    "HAWAII": "HI",
    "IDAHO": "ID",
    "ILLINOIS": "IL",
    "INDIANA": "IN",
    "IOWA": "IA",
    "KANSAS": "KS",
    "KENTUCKY": "KY",
    "LOUISIANA": "LA",
    "MAINE": "ME",
    "MARYLAND": "MD",
    "MASSACHUSETTS": "MA",
    "MICHIGAN": "MI",
    "MINNESOTA": "MN",
    "MISSISSIPPI": "MS",
    "MISSOURI": "MO",
    "MONTANA": "MT",
    "NEBRASKA": "NE",
    "NEVADA": "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    "OHIO": "OH",
    "OKLAHOMA": "OK",
    "OREGON": "OR",
    "PENNSYLVANIA": "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    "TENNESSEE": "TN",
    "TEXAS": "TX",
    "UTAH": "UT",
    "VERMONT": "VT",
    "VIRGINIA": "VA",
    "WASHINGTON": "WA",
    "WEST VIRGINIA": "WV",
    "WISCONSIN": "WI",
    "WYOMING": "WY",
    "PUERTO RICO": "PR",
    "GUAM": "GU",
    "U.S. VIRGIN ISLANDS": "VI",
    "US VIRGIN ISLANDS": "VI",
    "AMERICAN SAMOA": "AS",
    "NORTHERN MARIANA ISLANDS": "MP",
    "U.S. MINOR OUTLYING ISLANDS": "UM",
}
US_STATE_CODES = frozenset(US_STATES.values())


@dataclass(frozen=True)
class NormalizedCountry:
    """Raw and ISO-normalized country result."""

    raw: str | None
    code: str | None
    recognized: bool


@dataclass(frozen=True)
class DatedCountry:
    """A country code observed in an official source on a specific date."""

    observation_date: date
    code: str | None


@dataclass(frozen=True)
class CountryChoice:
    """Point-in-time country choice and carry-forward provenance."""

    code: str
    source_date: date
    carried_forward: bool


def normalize_country(value: str | None) -> NormalizedCountry:
    """Normalize an explicit country value to ISO alpha-2 without guessing unknown names."""
    raw = value.strip() if value else ""
    if not raw:
        return NormalizedCountry(raw=None, code=None, recognized=False)
    upper = " ".join(raw.upper().split())
    if upper in EXPLICIT_UNKNOWN_COUNTRIES:
        return NormalizedCountry(raw=raw, code=None, recognized=True)
    alias = COUNTRY_ALIASES.get(upper)
    if alias is not None:
        return NormalizedCountry(raw=raw, code=alias, recognized=True)
    try:
        match = pycountry.countries.lookup(raw)
    except LookupError:
        return NormalizedCountry(raw=raw, code=None, recognized=False)
    return NormalizedCountry(raw=raw, code=str(match.alpha_2), recognized=True)


def derive_us_based(country_code: str | None) -> bool | None:
    """Return nullable U.S.-based status from an explicit normalized country code."""
    if country_code is None:
        return None
    return country_code.upper() in US_BASED_CODES


def normalize_us_state(value: str | None, *, country_code: str | None) -> str | None:
    """Normalize a state/territory only after the principal country is established as U.S.-based."""
    normalized_country = country_code.upper() if country_code else None
    if normalized_country not in US_BASED_CODES:
        return None
    raw = " ".join((value or "").upper().split())
    if raw in US_STATE_CODES:
        return raw
    if raw in US_STATES:
        return US_STATES[raw]
    if not raw and normalized_country in US_STATE_CODES - {"US"}:
        return normalized_country
    return None


def choose_country_as_of(*, as_of: date, values: list[DatedCountry]) -> CountryChoice | None:
    """Choose the latest explicit country on or before a snapshot date."""
    eligible = [value for value in values if value.code is not None and value.observation_date <= as_of]
    if not eligible:
        return None
    chosen = max(eligible, key=lambda value: value.observation_date)
    assert chosen.code is not None
    return CountryChoice(
        code=chosen.code,
        source_date=chosen.observation_date,
        carried_forward=chosen.observation_date < as_of,
    )


__all__ = [
    "CountryChoice",
    "DatedCountry",
    "NormalizedCountry",
    "choose_country_as_of",
    "derive_us_based",
    "normalize_country",
    "normalize_us_state",
]
