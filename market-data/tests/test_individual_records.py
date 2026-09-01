import json
from copy import deepcopy
from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from riascout_adv_data.individual_records import RecordContext, current_status_activity, parse_individual_record

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "individual" / "current-page.json"
RECORDS = json.loads(FIXTURE_PATH.read_text())["filings"]
RECORD_ONE = RECORDS[0]
RECORD_TWO = RECORDS[1]
CONTEXT = RecordContext(
    collection_id="collection-test",
    observed_at=datetime(2026, 8, 26, tzinfo=UTC),
    artifact_id="sha256:test-page",
    source_record_index=0,
    source_payload_digest="test-page",
)


def test_parser_keeps_current_employers_registrations_and_locations_separate() -> None:
    parsed = parse_individual_record(RECORD_ONE, CONTEXT)

    assert parsed.individual_crd == 7_000_001
    assert len(parsed.current_employments) == 2
    assert len(parsed.current_registrations) == 3
    assert parsed.current_registrations[0].status_posted_date == date(2022, 10, 20)
    assert parsed.current_registrations[0].is_active_status is True
    assert parsed.current_registrations[1].is_active_status is False
    assert len(parsed.registration_locations) == 3
    assert {location.is_us_workplace for location in parsed.registration_locations} == {True, False}


def test_previous_registration_is_half_open_with_contextual_iar_evidence() -> None:
    parsed = parse_individual_record(RECORD_ONE, CONTEXT)

    interval = parsed.previous_registrations[0]
    assert interval.start_date == date(2020, 1, 10)
    assert interval.end_date == date(2022, 10, 20)
    assert interval.start_method == "source_registration_begin_date"
    assert interval.end_method == "source_registration_end_date_exclusive"
    assert interval.iar_evidence_method == "iapd_previous_registration_context"


def test_missing_or_present_employment_end_is_open_ended() -> None:
    parsed = parse_individual_record(RECORD_ONE, CONTEXT)

    employment = parsed.employment_history[0]
    assert employment.start_month == date(2022, 10, 1)
    assert employment.end_month is None
    assert employment.is_open_ended is True
    assert employment.end_method == "source_open_ended"


def test_current_status_date_is_conservative_and_unknown_start_is_not_invented() -> None:
    parsed_one = parse_individual_record(RECORD_ONE, CONTEXT)
    parsed_two = parse_individual_record(RECORD_TWO, CONTEXT)

    current = parsed_one.current_registration_intervals[0]
    unknown_start = parsed_two.current_registration_intervals[0]
    assert current.start_date == date(2022, 10, 20)
    assert current.start_method == "current_status_posted_date"
    assert unknown_start.start_date is None
    assert unknown_start.start_method == "current_collection_observation_only"


def test_parser_retains_person_when_nested_employment_month_is_malformed() -> None:
    parsed = parse_individual_record(RECORD_TWO, CONTEXT)

    assert parsed.individual_crd == 7_000_002
    assert parsed.employment_history[0].start_month is None
    assert parsed.errors[0].error_code == "invalid_employment_month"
    assert parsed.errors[0].source_json_path.endswith(".fromDt")


def test_malformed_previous_date_is_unknown_precision_and_quarantined() -> None:
    record = deepcopy(RECORD_ONE)
    record["PrevRgstns"]["PrevRgstn"][0]["regBeginDt"] = "2020-99-99"

    parsed = parse_individual_record(record, CONTEXT)

    assert parsed.previous_registrations[0].start_date is None
    assert parsed.previous_registrations[0].start_precision == "unknown"
    assert any(error.error_code == "invalid_registration_begin_date" for error in parsed.errors)


def test_parser_uses_only_source_crds_and_excludes_aliases() -> None:
    parsed = parse_individual_record(RECORD_ONE, CONTEXT)

    assert [employment.employer_firm_crd for employment in parsed.current_employments] == [800001, 800002]
    assert parsed.employment_history[0].employer_firm_crd is None
    assert not hasattr(parsed, "aliases")


def test_exams_designations_and_disclosure_flags_are_summary_only() -> None:
    parsed = parse_individual_record(RECORD_ONE, CONTEXT)

    assert parsed.exams[0].exam_code == "S65"
    assert parsed.exams[0].exam_date == date(2020, 1, 5)
    assert parsed.designations[0].designation_name == "CERTIFIED TEST PROFESSIONAL"
    assert parsed.disclosure_flags.has_customer_complaint is True
    assert parsed.disclosure_flags.has_regulatory_action is False


def test_empty_drps_means_no_documented_disclosure_categories() -> None:
    record = deepcopy(RECORD_ONE)
    record["DRPs"] = {}

    parsed = parse_individual_record(record, CONTEXT)

    flags = parsed.disclosure_flags
    assert (
        flags.has_regulatory_action,
        flags.has_criminal,
        flags.has_bankruptcy,
        flags.has_civil_judgment,
        flags.has_bond,
        flags.has_judgment,
        flags.has_investigation,
        flags.has_customer_complaint,
        flags.has_termination,
    ) == (False, False, False, False, False, False, False, False, False)
    assert flags.has_other is None


@pytest.mark.parametrize(
    ("drps_present", "drps_value"),
    [(False, None), (True, "invalid-source-shape")],
    ids=("missing", "malformed"),
)
def test_unavailable_drps_source_remains_unknown(drps_present: bool, drps_value: object) -> None:
    record = deepcopy(RECORD_ONE)
    if drps_present:
        record["DRPs"] = drps_value
    else:
        record.pop("DRPs", None)

    parsed = parse_individual_record(record, CONTEXT)

    flags = parsed.disclosure_flags
    assert (
        flags.has_regulatory_action,
        flags.has_criminal,
        flags.has_bankruptcy,
        flags.has_civil_judgment,
        flags.has_bond,
        flags.has_judgment,
        flags.has_investigation,
        flags.has_customer_complaint,
        flags.has_termination,
    ) == (None, None, None, None, None, None, None, None, None)


def test_status_classification_preserves_unknown_as_unknown() -> None:
    assert current_status_activity("APPROVED_RES") is True
    assert current_status_activity("TERMED") is False
    assert current_status_activity("NEW_VENDOR_STATUS") is None
    assert current_status_activity(None) is None
