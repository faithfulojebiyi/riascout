"""Pure parsing of current SEC-API individual adviser records."""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from riascout_adv_data.geography import derive_us_based, normalize_country

ACTIVE_CURRENT_STATUSES = frozenset({"APPROVED", "APPROVED_RES", "TEMPREG"})
DOCUMENTED_INACTIVE_OR_PENDING_STATUSES = frozenset(
    {
        "CANCELLED",
        "DENIED",
        "INACTIVE",
        "PENDING",
        "REVOKED",
        "SUSPENSION",
        "TERMED",
        "TERMINATED",
        "WITHDRAWN",
    }
)


class IndividualRecordError(ValueError):
    """A source record lacks the identity required for canonical publication."""


@dataclass(frozen=True)
class RecordContext:
    """Collection and source provenance supplied to the pure parser."""

    collection_id: str
    observed_at: datetime
    artifact_id: str
    source_record_index: int
    source_payload_digest: str

    @property
    def source_json_path(self) -> str:
        return f"$.filings[{self.source_record_index}]"


@dataclass(frozen=True)
class ParsedName:
    first_name: str | None
    middle_name: str | None
    last_name: str | None
    suffix_name: str | None
    active_agent_registration: bool | None
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class ParsedCurrentEmployment:
    employment_sequence: int
    employer_firm_crd: int | None
    employer_name: str | None
    employer_street_1: str | None
    employer_street_2: str | None
    employer_city: str | None
    employer_region_raw: str | None
    employer_country_raw: str | None
    employer_country_code: str | None
    employer_postal_code: str | None
    employer_firm_coverage: str
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class ParsedCurrentRegistration:
    employment_sequence: int
    registration_sequence: int
    employer_firm_crd: int | None
    jurisdiction: str | None
    registration_category: str | None
    status: str | None
    status_posted_date: date | None
    is_active_status: bool | None
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class ParsedRegistrationInterval:
    interval_id: str
    employer_firm_crd: int | None
    source_employer_name: str | None
    jurisdiction: str | None
    registration_category: str | None
    status: str | None
    start_date: date | None
    end_date: date | None
    start_precision: str
    end_precision: str
    start_method: str
    end_method: str
    interval_source: str
    iar_evidence_method: str | None
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class ParsedRegistrationLocation:
    location_id: str
    interval_id: str
    location_sequence: int
    location_source: str
    street_1: str | None
    street_2: str | None
    city: str | None
    region_raw: str | None
    country_raw: str | None
    country_code: str | None
    postal_code: str | None
    is_us_workplace: bool | None
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class ParsedEmploymentInterval:
    employment_interval_id: str
    employment_sequence: int
    source_employer_name: str | None
    employer_firm_crd: int | None
    from_raw: str | None
    to_raw: str | None
    start_month: date | None
    end_month: date | None
    is_open_ended: bool
    start_precision: str
    end_precision: str
    end_method: str
    city: str | None
    region_raw: str | None
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class ParsedExam:
    exam_sequence: int
    exam_code: str | None
    exam_name: str | None
    exam_date: date | None
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class ParsedDesignation:
    designation_sequence: int
    designation_name: str | None
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class ParsedDisclosureFlags:
    has_regulatory_action: bool | None
    has_criminal: bool | None
    has_bankruptcy: bool | None
    has_civil_judgment: bool | None
    has_bond: bool | None
    has_judgment: bool | None
    has_investigation: bool | None
    has_customer_complaint: bool | None
    has_termination: bool | None
    has_other: bool | None
    artifact_id: str
    source_json_path: str


@dataclass(frozen=True)
class ParsedRowError:
    error_code: str
    message: str
    source_json_path: str
    raw_value: str | None


@dataclass(frozen=True)
class ParsedIndividual:
    individual_crd: int
    observed_at: datetime
    artifact_id: str
    source_record_index: int
    source_payload_digest: str
    name: ParsedName
    current_employments: tuple[ParsedCurrentEmployment, ...]
    current_registrations: tuple[ParsedCurrentRegistration, ...]
    current_registration_intervals: tuple[ParsedRegistrationInterval, ...]
    previous_registrations: tuple[ParsedRegistrationInterval, ...]
    registration_locations: tuple[ParsedRegistrationLocation, ...]
    employment_history: tuple[ParsedEmploymentInterval, ...]
    exams: tuple[ParsedExam, ...]
    designations: tuple[ParsedDesignation, ...]
    disclosure_flags: ParsedDisclosureFlags
    errors: tuple[ParsedRowError, ...]

    @property
    def registration_intervals(self) -> tuple[ParsedRegistrationInterval, ...]:
        """Return current and previous registration evidence together."""
        return self.current_registration_intervals + self.previous_registrations


def current_status_activity(status: str | None) -> bool | None:
    """Classify documented current status without guessing unknown values."""
    if status is None:
        return None
    normalized = status.strip().upper()
    if normalized in ACTIVE_CURRENT_STATUSES:
        return True
    if normalized in DOCUMENTED_INACTIVE_OR_PENDING_STATUSES:
        return False
    return None


def parse_individual_record(record: dict[str, Any], context: RecordContext) -> ParsedIndividual:
    """Parse one individual record while retaining nested-row errors separately."""
    if context.observed_at.tzinfo is None or context.observed_at.utcoffset() is None:
        raise ValueError("observed_at must include a timezone")
    info = record.get("Info")
    if not isinstance(info, dict):
        raise IndividualRecordError("individual record has no Info object")
    individual_crd = _positive_int(info.get("indvlPK"))
    if individual_crd is None:
        raise IndividualRecordError("individual record has no positive integer CRD")

    base_path = context.source_json_path
    errors: list[ParsedRowError] = []
    name = ParsedName(
        first_name=_text(info.get("firstNm")),
        middle_name=_text(info.get("midNm")),
        last_name=_text(info.get("lastNm")),
        suffix_name=_text(info.get("suffixNm")),
        active_agent_registration=_yes_no(info.get("actvAGReg")),
        artifact_id=context.artifact_id,
        source_json_path=f"{base_path}.Info",
    )

    current_employments: list[ParsedCurrentEmployment] = []
    current_registrations: list[ParsedCurrentRegistration] = []
    current_intervals: list[ParsedRegistrationInterval] = []
    registration_locations: list[ParsedRegistrationLocation] = []
    for employment_sequence, employment in enumerate(_nested_objects(record, "CrntEmps", "CrntEmp")):
        employment_path = f"{base_path}.CrntEmps.CrntEmp[{employment_sequence}]"
        employer_firm_crd = _positive_int(employment.get("orgPK"))
        country = normalize_country(_text(employment.get("cntry")))
        current_employments.append(
            ParsedCurrentEmployment(
                employment_sequence=employment_sequence,
                employer_firm_crd=employer_firm_crd,
                employer_name=_text(employment.get("orgNm")),
                employer_street_1=_text(employment.get("str1")),
                employer_street_2=_text(employment.get("str2")),
                employer_city=_text(employment.get("city")),
                employer_region_raw=_text(employment.get("state")),
                employer_country_raw=country.raw,
                employer_country_code=country.code,
                employer_postal_code=_text(employment.get("postlCd")),
                employer_firm_coverage=(
                    "source_crd_present_unassessed" if employer_firm_crd is not None else "no_source_crd"
                ),
                artifact_id=context.artifact_id,
                source_json_path=employment_path,
            )
        )
        branch_locations = _branch_objects(employment.get("BrnchOfLocs"))
        for registration_sequence, registration in enumerate(_nested_objects(employment, "CrntRgstns", "CrntRgstn")):
            registration_path = f"{employment_path}.CrntRgstns.CrntRgstn[{registration_sequence}]"
            status = _text(registration.get("st"))
            is_active = current_status_activity(status)
            status_date = _strict_date(
                registration.get("stDt"),
                path=f"{registration_path}.stDt",
                error_code="invalid_status_posted_date",
                errors=errors,
            )
            category = _text(registration.get("regCat"))
            current_registrations.append(
                ParsedCurrentRegistration(
                    employment_sequence=employment_sequence,
                    registration_sequence=registration_sequence,
                    employer_firm_crd=employer_firm_crd,
                    jurisdiction=_text(registration.get("regAuth")),
                    registration_category=category,
                    status=status,
                    status_posted_date=status_date,
                    is_active_status=is_active,
                    artifact_id=context.artifact_id,
                    source_json_path=registration_path,
                )
            )
            if is_active is not True:
                continue
            interval_id = (
                f"current:{context.collection_id}:{individual_crd}:{employment_sequence}:{registration_sequence}"
            )
            interval = ParsedRegistrationInterval(
                interval_id=interval_id,
                employer_firm_crd=employer_firm_crd,
                source_employer_name=_text(employment.get("orgNm")),
                jurisdiction=_text(registration.get("regAuth")),
                registration_category=category,
                status=status,
                start_date=status_date,
                end_date=None,
                start_precision="day" if status_date is not None else "unknown",
                end_precision="unknown",
                start_method=(
                    "current_status_posted_date" if status_date is not None else "current_collection_observation_only"
                ),
                end_method="source_current_open_ended",
                interval_source="current_registration",
                iar_evidence_method=("explicit_ra_category" if _upper(category) == "RA" else None),
                artifact_id=context.artifact_id,
                source_json_path=registration_path,
            )
            current_intervals.append(interval)
            registration_locations.extend(
                _parse_locations(
                    branch_locations,
                    interval_id=interval_id,
                    location_source="current_branch",
                    base_path=f"{employment_path}.BrnchOfLocs",
                    context=context,
                )
            )

    previous_intervals: list[ParsedRegistrationInterval] = []
    for previous_sequence, previous in enumerate(_nested_objects(record, "PrevRgstns", "PrevRgstn")):
        previous_path = f"{base_path}.PrevRgstns.PrevRgstn[{previous_sequence}]"
        interval_id = f"previous:{context.collection_id}:{individual_crd}:{previous_sequence}"
        start_date = _strict_date(
            previous.get("regBeginDt"),
            path=f"{previous_path}.regBeginDt",
            error_code="invalid_registration_begin_date",
            errors=errors,
        )
        end_date = _strict_date(
            previous.get("regEndDt"),
            path=f"{previous_path}.regEndDt",
            error_code="invalid_registration_end_date",
            errors=errors,
        )
        interval = ParsedRegistrationInterval(
            interval_id=interval_id,
            employer_firm_crd=_positive_int(previous.get("orgPK")),
            source_employer_name=_text(previous.get("orgNm")),
            jurisdiction=None,
            registration_category=None,
            status="PREVIOUS",
            start_date=start_date,
            end_date=end_date,
            start_precision="day" if start_date is not None else "unknown",
            end_precision="day" if end_date is not None else "unknown",
            start_method="source_registration_begin_date",
            end_method="source_registration_end_date_exclusive",
            interval_source="previous_registration",
            iar_evidence_method="iapd_previous_registration_context",
            artifact_id=context.artifact_id,
            source_json_path=previous_path,
        )
        previous_intervals.append(interval)
        registration_locations.extend(
            _parse_locations(
                _branch_objects(previous.get("BrnchOfLocs")),
                interval_id=interval_id,
                location_source="previous_branch",
                base_path=f"{previous_path}.BrnchOfLocs",
                context=context,
            )
        )

    employment_history: list[ParsedEmploymentInterval] = []
    for employment_sequence, employment in enumerate(_nested_objects(record, "EmpHss", "EmpHs")):
        employment_path = f"{base_path}.EmpHss.EmpHs[{employment_sequence}]"
        from_raw = _text(employment.get("fromDt"))
        to_raw = _text(employment.get("toDt"))
        is_open_ended = to_raw is None or to_raw.casefold() == "present"
        start_month = _strict_month(
            from_raw,
            path=f"{employment_path}.fromDt",
            error_code="invalid_employment_month",
            errors=errors,
        )
        end_month = (
            None
            if is_open_ended
            else _strict_month(
                to_raw,
                path=f"{employment_path}.toDt",
                error_code="invalid_employment_month",
                errors=errors,
            )
        )
        employment_history.append(
            ParsedEmploymentInterval(
                employment_interval_id=(f"employment:{context.collection_id}:{individual_crd}:{employment_sequence}"),
                employment_sequence=employment_sequence,
                source_employer_name=_text(employment.get("orgNm")),
                employer_firm_crd=_positive_int(employment.get("orgPK")),
                from_raw=from_raw,
                to_raw=to_raw,
                start_month=start_month,
                end_month=end_month,
                is_open_ended=is_open_ended,
                start_precision="month" if start_month is not None else "unknown",
                end_precision="unknown" if is_open_ended or end_month is None else "month",
                end_method=(
                    "source_open_ended"
                    if is_open_ended
                    else "source_employment_end_month"
                    if end_month is not None
                    else "invalid_source_month"
                ),
                city=_text(employment.get("city")),
                region_raw=_text(employment.get("state")),
                artifact_id=context.artifact_id,
                source_json_path=employment_path,
            )
        )

    exams = tuple(
        ParsedExam(
            exam_sequence=sequence,
            exam_code=_text(exam.get("exmCd")),
            exam_name=_text(exam.get("exmNm")),
            exam_date=_strict_date(
                exam.get("exmDt"),
                path=f"{base_path}.Exms.Exm[{sequence}].exmDt",
                error_code="invalid_exam_date",
                errors=errors,
            ),
            artifact_id=context.artifact_id,
            source_json_path=f"{base_path}.Exms.Exm[{sequence}]",
        )
        for sequence, exam in enumerate(_nested_objects(record, "Exms", "Exm"))
    )
    designations = tuple(
        ParsedDesignation(
            designation_sequence=sequence,
            designation_name=_first_text(designation, "dsgntnNm", "dsgntn", "name", "nm"),
            artifact_id=context.artifact_id,
            source_json_path=f"{base_path}.Dsgntns.Dsgntn[{sequence}]",
        )
        for sequence, designation in enumerate(_nested_objects(record, "Dsgntns", "Dsgntn"))
    )
    disclosure_flags = _parse_disclosure_flags(record, context, errors)

    return ParsedIndividual(
        individual_crd=individual_crd,
        observed_at=context.observed_at,
        artifact_id=context.artifact_id,
        source_record_index=context.source_record_index,
        source_payload_digest=context.source_payload_digest,
        name=name,
        current_employments=tuple(current_employments),
        current_registrations=tuple(current_registrations),
        current_registration_intervals=tuple(current_intervals),
        previous_registrations=tuple(previous_intervals),
        registration_locations=tuple(registration_locations),
        employment_history=tuple(employment_history),
        exams=exams,
        designations=designations,
        disclosure_flags=disclosure_flags,
        errors=tuple(errors),
    )


def _parse_locations(
    locations: list[dict[str, Any]],
    *,
    interval_id: str,
    location_source: str,
    base_path: str,
    context: RecordContext,
) -> list[ParsedRegistrationLocation]:
    parsed: list[ParsedRegistrationLocation] = []
    for sequence, location in enumerate(locations):
        country = normalize_country(_text(location.get("cntry")))
        parsed.append(
            ParsedRegistrationLocation(
                location_id=f"location:{interval_id}:{sequence}",
                interval_id=interval_id,
                location_sequence=sequence,
                location_source=location_source,
                street_1=_text(location.get("str1")),
                street_2=_text(location.get("str2")),
                city=_text(location.get("city")),
                region_raw=_text(location.get("state")),
                country_raw=country.raw,
                country_code=country.code,
                postal_code=_text(location.get("postlCd")),
                is_us_workplace=derive_us_based(country.code),
                artifact_id=context.artifact_id,
                source_json_path=f"{base_path}.BrnchOfLoc[{sequence}]",
            )
        )
    return parsed


def _parse_disclosure_flags(
    record: dict[str, Any],
    context: RecordContext,
    errors: list[ParsedRowError],
) -> ParsedDisclosureFlags:
    drps_node = record.get("DRPs")
    has_explicit_no_disclosures = isinstance(drps_node, dict) and not drps_node
    disclosures = _nested_objects(record, "DRPs", "DRP")
    mapping = {
        "has_regulatory_action": "hasRegAction",
        "has_criminal": "hasCriminal",
        "has_bankruptcy": "hasBankrupt",
        "has_civil_judgment": "hasCivilJudc",
        "has_bond": "hasBond",
        "has_judgment": "hasJudgment",
        "has_investigation": "hasInvstgn",
        "has_customer_complaint": "hasCustComp",
        "has_termination": "hasTermination",
    }
    values: dict[str, bool | None] = {}
    for target, source in mapping.items():
        flags: list[bool] = []
        saw_unknown = False
        for sequence, disclosure in enumerate(disclosures):
            raw = disclosure.get(source)
            parsed = _yes_no(raw)
            if parsed is None and raw is not None:
                saw_unknown = True
                errors.append(
                    ParsedRowError(
                        error_code="unknown_disclosure_flag",
                        message=f"unsupported Y/N disclosure flag for {source}",
                        source_json_path=f"{context.source_json_path}.DRPs.DRP[{sequence}].{source}",
                        raw_value=_text(raw),
                    )
                )
            elif parsed is not None:
                flags.append(parsed)
        values[target] = (
            True if any(flags) else False if (flags and not saw_unknown) or has_explicit_no_disclosures else None
        )

    return ParsedDisclosureFlags(
        has_regulatory_action=values["has_regulatory_action"],
        has_criminal=values["has_criminal"],
        has_bankruptcy=values["has_bankruptcy"],
        has_civil_judgment=values["has_civil_judgment"],
        has_bond=values["has_bond"],
        has_judgment=values["has_judgment"],
        has_investigation=values["has_investigation"],
        has_customer_complaint=values["has_customer_complaint"],
        has_termination=values["has_termination"],
        has_other=None,
        artifact_id=context.artifact_id,
        source_json_path=f"{context.source_json_path}.DRPs",
    )


def _nested_objects(record: dict[str, Any], outer: str, inner: str) -> list[dict[str, Any]]:
    node = record.get(outer)
    if isinstance(node, dict):
        node = node.get(inner)
    if not isinstance(node, list):
        return []
    return [item for item in node if isinstance(item, dict)]


def _branch_objects(node: object) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []

    def visit(value: object) -> None:
        if isinstance(value, list):
            for item in value:
                visit(item)
            return
        if not isinstance(value, dict):
            return
        if "BrnchOfLoc" in value:
            visit(value["BrnchOfLoc"])
            return
        if any(key in value for key in ("str1", "city", "state", "cntry", "postlCd")):
            found.append(value)

    visit(node)
    return found


def _strict_date(
    raw: object,
    *,
    path: str,
    error_code: str,
    errors: list[ParsedRowError],
) -> date | None:
    text = _text(raw)
    if text is None:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        errors.append(
            ParsedRowError(
                error_code=error_code,
                message="expected YYYY-MM-DD",
                source_json_path=path,
                raw_value=text,
            )
        )
        return None


def _strict_month(
    raw: str | None,
    *,
    path: str,
    error_code: str,
    errors: list[ParsedRowError],
) -> date | None:
    if raw is None:
        return None
    try:
        month_text, year_text = raw.split("/", maxsplit=1)
        if len(month_text) != 2 or len(year_text) != 4:
            raise ValueError
        return date(int(year_text), int(month_text), 1)
    except (TypeError, ValueError):
        errors.append(
            ParsedRowError(
                error_code=error_code,
                message="expected MM/YYYY",
                source_json_path=path,
                raw_value=raw,
            )
        )
        return None


def _yes_no(value: object) -> bool | None:
    if isinstance(value, bool):
        return value
    if not isinstance(value, str):
        return None
    normalized = value.strip().upper()
    if normalized == "Y":
        return True
    if normalized == "N":
        return False
    return None


def _positive_int(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        return None
    return value


def _text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _first_text(value: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        result = _text(value.get(key))
        if result is not None:
            return result
    return None


def _upper(value: str | None) -> str | None:
    return value.strip().upper() if value else None


__all__ = [
    "ACTIVE_CURRENT_STATUSES",
    "DOCUMENTED_INACTIVE_OR_PENDING_STATUSES",
    "IndividualRecordError",
    "ParsedCurrentEmployment",
    "ParsedCurrentRegistration",
    "ParsedDesignation",
    "ParsedDisclosureFlags",
    "ParsedEmploymentInterval",
    "ParsedExam",
    "ParsedIndividual",
    "ParsedName",
    "ParsedRegistrationInterval",
    "ParsedRegistrationLocation",
    "ParsedRowError",
    "RecordContext",
    "current_status_activity",
    "parse_individual_record",
]
