"""Official SEC source catalog and report-index discovery."""

import calendar
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from html.parser import HTMLParser
from typing import Any, Literal
from urllib.parse import urljoin, urlparse

ADV_PART1_PART1 = "https://www.sec.gov/files/adv-filing-data-20111105-20241231-part1.zip"
ADV_PART1_PART2 = "https://www.sec.gov/files/adv-filing-data-20111105-20241231-part2.zip"
ADVW_HISTORY = "https://www.sec.gov/files/advw-20001019-20241231.zip"
REPORT_INDEX = (
    "https://www.sec.gov/data-research/sec-markets-data/"
    "information-about-registered-investment-advisers-exempt-reporting-advisers"
)
FORM_ADV_REPORTS_METADATA = "https://reports.adviserinfo.sec.gov/reports/foia/reports_metadata.json"
FORM_ADV_REPORTS_ROOT = "https://reports.adviserinfo.sec.gov/reports/foia"

DatasetKind = Literal["adv_part1", "advw", "ria_report", "era_report"]
SnapshotStatus = Literal["historical_filings", "year_end", "provisional"]
ContainerKind = Literal["zip", "xlsx"]


@dataclass(frozen=True)
class OfficialSourceSpec:
    """One downloadable official SEC source artifact."""

    key: str
    url: str
    dataset_kind: DatasetKind
    observation_date: date | None
    snapshot_status: SnapshotStatus
    expected_container: ContainerKind


def fixed_historical_sources() -> tuple[OfficialSourceSpec, ...]:
    """Return the official historical Part 1 and ADV-W archive specifications."""
    return (
        OfficialSourceSpec(
            key="adv-part1-part1",
            url=ADV_PART1_PART1,
            dataset_kind="adv_part1",
            observation_date=date(2024, 12, 31),
            snapshot_status="historical_filings",
            expected_container="zip",
        ),
        OfficialSourceSpec(
            key="adv-part1-part2",
            url=ADV_PART1_PART2,
            dataset_kind="adv_part1",
            observation_date=date(2024, 12, 31),
            snapshot_status="historical_filings",
            expected_container="zip",
        ),
        OfficialSourceSpec(
            key="advw-history",
            url=ADVW_HISTORY,
            dataset_kind="advw",
            observation_date=date(2024, 12, 31),
            snapshot_status="historical_filings",
            expected_container="zip",
        ),
    )


def parse_form_adv_reports_metadata(
    payload: Mapping[str, Any],
    *,
    years: range | tuple[int, ...] | list[int],
) -> tuple[OfficialSourceSpec, ...]:
    """Parse monthly Part 1 filing and ADV-W archives from the official IAPD catalog."""
    requested_years = set(years)
    sections = (
        ("advFilingData", "adv_part1", "adv-filing-data", r"ADV_Filing_Data_(\d{8})_(\d{8})\.zip"),
        ("advW", "advw", "advw", r"ADVW_(\d{8})_(\d{8})\.zip"),
    )
    specs: list[OfficialSourceSpec] = []
    for section_key, dataset_kind, key_prefix, filename_pattern in sections:
        section = payload.get(section_key)
        if not isinstance(section, Mapping):
            continue
        for year in sorted(requested_years):
            year_payload = section.get(str(year))
            if not isinstance(year_payload, Mapping):
                continue
            files = year_payload.get("files")
            if not isinstance(files, list):
                continue
            for file_payload in files:
                if not isinstance(file_payload, Mapping):
                    continue
                filename = file_payload.get("fileName")
                if not isinstance(filename, str):
                    continue
                match = re.fullmatch(filename_pattern, filename)
                if match is None:
                    continue
                try:
                    observation_date = date.fromisoformat(
                        f"{match.group(2)[:4]}-{match.group(2)[4:6]}-{match.group(2)[6:]}"
                    )
                except ValueError:
                    continue
                if observation_date.year != year:
                    continue
                specs.append(
                    OfficialSourceSpec(
                        key=f"{key_prefix}-{observation_date:%Y-%m}",
                        url=f"{FORM_ADV_REPORTS_ROOT}/{section_key}/{year}/{filename}",
                        dataset_kind=dataset_kind,  # type: ignore[arg-type]
                        observation_date=observation_date,
                        snapshot_status="historical_filings",
                        expected_container="zip",
                    )
                )
    return tuple(sorted(specs, key=lambda spec: (spec.observation_date or date.min, spec.key)))


def parse_information_report_index(html: str) -> tuple[OfficialSourceSpec, ...]:
    """Parse official monthly RIA and ERA download links from the SEC index page."""
    parser = _LinkParser()
    parser.feed(html)
    discovered: dict[tuple[DatasetKind, date], OfficialSourceSpec] = {}
    for href, label in parser.links:
        dataset_kind = _report_kind(label)
        observation_date = _observation_date(href, label)
        if dataset_kind is None or observation_date is None:
            continue
        url = urljoin(REPORT_INDEX, href)
        if urlparse(url).hostname not in {"sec.gov", "www.sec.gov"}:
            continue
        suffix = urlparse(url).path.lower().rsplit(".", 1)[-1]
        if suffix not in {"zip", "xlsx"}:
            continue
        container: ContainerKind = "zip" if suffix == "zip" else "xlsx"
        status: SnapshotStatus = "year_end" if observation_date == date(2025, 12, 31) else "provisional"
        category = "ria" if dataset_kind == "ria_report" else "era"
        discovered[(dataset_kind, observation_date)] = OfficialSourceSpec(
            key=f"{category}-{observation_date.isoformat()}",
            url=url,
            dataset_kind=dataset_kind,
            observation_date=observation_date,
            snapshot_status=status,
            expected_container=container,
        )
    return tuple(sorted(discovered.values(), key=lambda spec: (spec.observation_date or date.min, spec.key)))


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attributes = dict(attrs)
        self._href = attributes.get("href")
        self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "a" or self._href is None:
            return
        label = " ".join("".join(self._text).split())
        self.links.append((self._href, label))
        self._href = None
        self._text = []


def _report_kind(label: str) -> DatasetKind | None:
    normalized = " ".join(label.lower().split())
    if normalized.startswith("registered investment advisers"):
        return "ria_report"
    if normalized.startswith(("exempt investment advisers", "exempt reporting advisers")):
        return "era_report"
    return None


def _observation_date(href: str, label: str) -> date | None:
    match = re.search(r"ia(?P<digits>\d{8}|\d{6})", href.lower())
    if match:
        digits = match.group("digits")
        try:
            if len(digits) == 8:
                return date(int(digits[4:]), int(digits[:2]), int(digits[2:4]))
            year = int(digits[2:])
            month = int(digits[:2])
            return date(year, month, calendar.monthrange(year, month)[1])
        except ValueError:
            return None
    label_match = re.search(
        r"(?P<month>January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(?P<year>20\d{2})",
        label,
        flags=re.IGNORECASE,
    )
    if not label_match:
        return None
    month = list(calendar.month_name).index(label_match.group("month").title())
    year = int(label_match.group("year"))
    return date(year, month, calendar.monthrange(year, month)[1])


__all__ = [
    "FORM_ADV_REPORTS_METADATA",
    "REPORT_INDEX",
    "OfficialSourceSpec",
    "fixed_historical_sources",
    "parse_form_adv_reports_metadata",
    "parse_information_report_index",
]
