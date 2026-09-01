from datetime import date

from riascout_adv_data.official_sources import (
    OfficialSourceSpec,
    fixed_historical_sources,
    parse_form_adv_reports_metadata,
    parse_information_report_index,
)

REPORT_INDEX_HTML = """
<html><body>
  <a href="/files/investment/data/reports/ia122025-exempt.zip">Exempt Investment Advisers, December 2025</a>
  <a href="https://www.sec.gov/files/investment/data/reports/ia122025.zip">
    Registered Investment Advisers, December 2025
  </a>
  <a href="/files/investment/data/reports/ia08032026-exempt_0.zip">Exempt Reporting Advisers, August 2026</a>
  <a href="/files/investment/data/reports/ia08032026_0.zip">Registered Investment Advisers, August 2026</a>
  <a href="https://example.com/not-sec.zip">Registered Investment Advisers, August 2026</a>
</body></html>
"""


def _find(specs: tuple[OfficialSourceSpec, ...], category: str, observation_date: date) -> OfficialSourceSpec:
    return next(
        spec
        for spec in specs
        if spec.dataset_kind == f"{category}_report" and spec.observation_date == observation_date
    )


def test_fixed_sources_are_the_three_official_historical_archives() -> None:
    specs = fixed_historical_sources()

    assert [spec.key for spec in specs] == ["adv-part1-part1", "adv-part1-part2", "advw-history"]
    assert all(spec.url.startswith("https://www.sec.gov/") for spec in specs)


def test_report_index_parser_classifies_december_2025_and_latest_2026() -> None:
    specs = parse_information_report_index(REPORT_INDEX_HTML)

    assert _find(specs, "ria", date(2025, 12, 31)).url.endswith("ia122025.zip")
    assert _find(specs, "era", date(2025, 12, 31)).url.endswith("ia122025-exempt.zip")
    assert _find(specs, "ria", date(2026, 8, 3)).snapshot_status == "provisional"
    assert all("example.com" not in spec.url for spec in specs)


def test_report_index_parser_rejects_unusable_monthly_labels() -> None:
    html = '<a href="/files/ia.zip">Registered Investment Advisers, someday</a>'

    assert parse_information_report_index(html) == ()


def test_form_adv_metadata_parser_returns_complete_filing_and_withdrawal_history() -> None:
    payload = {
        "advFilingData": {
            "sectionDisplayName": "Form ADV Part 1 Data Files",
            "sectionDisplayOrder": 1,
            "2025": {
                "files": [
                    {
                        "displayOrder": "1",
                        "displayName": "January",
                        "fileName": "ADV_Filing_Data_20250101_20250131.zip",
                        "size": 6654164,
                        "year": "2025",
                        "fileType": "advFilingData",
                        "uploadedOn": "2026-05-04 16:31:59",
                    }
                ]
            },
            "2026": {
                "files": [
                    {
                        "displayOrder": "1",
                        "displayName": "January",
                        "fileName": "ADV_Filing_Data_20260101_20260131.zip",
                        "size": 6473194,
                        "year": "2026",
                        "fileType": "advFilingData",
                        "uploadedOn": "2026-05-01 18:41:14",
                    }
                ]
            },
        },
        "advW": {
            "sectionDisplayName": "Form ADV-W Data Files",
            "sectionDisplayOrder": 4,
            "2025": {
                "files": [
                    {
                        "displayOrder": "1",
                        "displayName": "January",
                        "fileName": "ADVW_20250101_20250131.zip",
                        "size": 35970,
                        "year": "2025",
                        "fileType": "advW",
                        "uploadedOn": "2025-02-03 16:35:32",
                    }
                ]
            },
        },
        "advBrochures": {
            "sectionDisplayName": "Form ADV Part 2 Data Files",
            "2025": {"files": [{"fileName": "ADV_Brochures_202501.zip", "size": 10}]},
        },
    }

    specs = parse_form_adv_reports_metadata(payload, years=range(2025, 2027))

    assert [(spec.dataset_kind, spec.observation_date, spec.key) for spec in specs] == [
        ("adv_part1", date(2025, 1, 31), "adv-filing-data-2025-01"),
        ("advw", date(2025, 1, 31), "advw-2025-01"),
        ("adv_part1", date(2026, 1, 31), "adv-filing-data-2026-01"),
    ]
    assert specs[0].url == (
        "https://reports.adviserinfo.sec.gov/reports/foia/advFilingData/2025/ADV_Filing_Data_20250101_20250131.zip"
    )
