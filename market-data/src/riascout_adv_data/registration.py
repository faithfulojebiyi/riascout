"""Point-in-time SEC, ERA, and state registration derivation."""

from dataclasses import dataclass
from datetime import date
from typing import Literal

PrimaryRegistrationType = Literal["SEC", "ERA", "STATE", "MULTIPLE", "UNKNOWN"]
ACTIVE_STATUSES = frozenset({"ACTIVE", "APPROVED", "REGISTERED", "REPORTING"})
INACTIVE_STATUSES = frozenset({"WITHDRAWN", "FINAL_REPORTED", "TERMINATED", "INACTIVE"})
CATEGORY_ORDER = ("SEC", "ERA", "STATE")


@dataclass(frozen=True)
class RegistrationObservation:
    """A dated source observation of one regulatory category and status."""

    category: str
    status: str
    effective_date: date


@dataclass(frozen=True)
class RegistrationEvent:
    """A dated event that may change one regulatory category's status."""

    category: str
    status: str
    effective_date: date


@dataclass(frozen=True)
class RegistrationStatus:
    """Filter-friendly registration status at one point in time."""

    is_sec_registered: bool | None
    is_era: bool | None
    is_state_registered: bool | None
    registration_types: tuple[str, ...]
    primary_registration_type: PrimaryRegistrationType


def derive_registration_status(
    *,
    as_of: date,
    observations: list[RegistrationObservation],
    events: list[RegistrationEvent],
    state_coverage: bool,
    sec_era_coverage: bool = True,
) -> RegistrationStatus:
    """Derive nullable regulatory flags from explicit observations and dated status events."""
    latest: dict[str, tuple[date, int, bool]] = {}
    records: list[RegistrationObservation | RegistrationEvent] = [*observations, *events]
    for record in records:
        category = record.category.upper()
        status = record.status.upper()
        if record.effective_date > as_of or category not in CATEGORY_ORDER:
            continue
        if status in ACTIVE_STATUSES:
            active = True
            precedence = 0
        elif status in INACTIVE_STATUSES:
            active = False
            precedence = 1
        else:
            continue
        candidate = (record.effective_date, precedence, active)
        if category not in latest or candidate[:2] >= latest[category][:2]:
            latest[category] = candidate

    sec = _category_value("SEC", latest, coverage=sec_era_coverage)
    era = _category_value("ERA", latest, coverage=sec_era_coverage)
    state = _category_value("STATE", latest, coverage=state_coverage)
    flags = {"SEC": sec, "ERA": era, "STATE": state}
    active_types = tuple(category for category in CATEGORY_ORDER if flags[category] is True)
    if len(active_types) > 1:
        primary: PrimaryRegistrationType = "MULTIPLE"
    elif len(active_types) == 1:
        primary = active_types[0]  # type: ignore[assignment]
    else:
        primary = "UNKNOWN"
    return RegistrationStatus(
        is_sec_registered=sec,
        is_era=era,
        is_state_registered=state,
        registration_types=active_types,
        primary_registration_type=primary,
    )


def _category_value(category: str, latest: dict[str, tuple[date, int, bool]], *, coverage: bool) -> bool | None:
    value = latest.get(category)
    if value is not None:
        return value[2]
    return False if coverage else None


__all__ = [
    "RegistrationEvent",
    "RegistrationObservation",
    "RegistrationStatus",
    "derive_registration_status",
]
