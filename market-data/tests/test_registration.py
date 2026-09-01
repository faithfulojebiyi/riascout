from datetime import date

from riascout_adv_data.registration import (
    RegistrationEvent,
    RegistrationObservation,
    derive_registration_status,
)


def test_notice_filing_does_not_create_state_registration() -> None:
    status = derive_registration_status(
        as_of=date(2024, 12, 31),
        observations=[RegistrationObservation("SEC", "ACTIVE", date(2020, 1, 2))],
        events=[RegistrationEvent("STATE_NOTICE", "FILED", date(2021, 1, 1))],
        state_coverage=False,
    )

    assert status.is_sec_registered is True
    assert status.is_era is False
    assert status.is_state_registered is None
    assert status.primary_registration_type == "SEC"


def test_withdrawal_applies_at_snapshot_boundary() -> None:
    observations = [RegistrationObservation("SEC", "ACTIVE", date(2020, 1, 2))]
    events = [RegistrationEvent("SEC", "WITHDRAWN", date(2022, 6, 30))]

    before = derive_registration_status(
        as_of=date(2022, 6, 29), observations=observations, events=events, state_coverage=False
    )
    after = derive_registration_status(
        as_of=date(2022, 6, 30), observations=observations, events=events, state_coverage=False
    )

    assert before.is_sec_registered is True
    assert after.is_sec_registered is False


def test_era_final_report_closes_era_status() -> None:
    status = derive_registration_status(
        as_of=date(2023, 1, 1),
        observations=[RegistrationObservation("ERA", "ACTIVE", date(2020, 1, 1))],
        events=[RegistrationEvent("ERA", "FINAL_REPORTED", date(2022, 5, 31))],
        state_coverage=False,
    )

    assert status.is_era is False
    assert status.primary_registration_type == "UNKNOWN"


def test_explicit_overlapping_registrations_return_multiple() -> None:
    status = derive_registration_status(
        as_of=date(2024, 1, 1),
        observations=[
            RegistrationObservation("SEC", "ACTIVE", date(2023, 1, 1)),
            RegistrationObservation("STATE", "ACTIVE", date(2023, 12, 15)),
        ],
        events=[],
        state_coverage=True,
    )

    assert status.registration_types == ("SEC", "STATE")
    assert status.primary_registration_type == "MULTIPLE"


def test_no_evidence_and_no_category_coverage_returns_unknown_flags() -> None:
    status = derive_registration_status(
        as_of=date(2024, 1, 1),
        observations=[],
        events=[],
        state_coverage=False,
        sec_era_coverage=False,
    )

    assert status.is_sec_registered is None
    assert status.is_era is None
    assert status.is_state_registered is None
    assert status.primary_registration_type == "UNKNOWN"
