"""Transactional publication of reconciled current-individual collections."""

import hashlib
import json
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from duckdb import DuckDBPyConnection

from riascout_adv_data.individual_plan import IndividualCollectionPlan, read_individual_collection_plan
from riascout_adv_data.individual_records import (
    IndividualRecordError,
    ParsedIndividual,
    RecordContext,
    parse_individual_record,
)
from riascout_adv_data.official_db import OfficialArtifactRecord, OfficialDatabase
from riascout_adv_data.storage import ArtifactStore, StoredArtifact

TRANSFORMATION_VERSION = "individual-v2"


class IndividualCanonicalizationError(RuntimeError):
    """A reconciled download cannot be published without violating invariants."""


@dataclass(frozen=True)
class DownloadedIndividualCollection:
    """Paths and timestamps for one completed immutable collection."""

    plan_path: Path
    completion_path: Path
    page_paths: tuple[Path, ...]
    collection_started_at: datetime
    collection_completed_at: datetime


@dataclass(frozen=True)
class IndividualCanonicalizationResult:
    """Counts from one canonical publication or verified idempotent rerun."""

    collection_id: str
    published_individuals: int
    quarantined_rows: int
    registered_page_artifacts: int
    was_already_published: bool


@dataclass(frozen=True)
class _PublicationProgress:
    """Durable page-boundary progress for a restartable publication."""

    completed_pages: int
    published_individuals: int
    quarantined_rows: int
    seen_crds: set[int]


class IndividualCanonicalizer:
    """Publish one verified collection in bounded, restartable transactions."""

    def __init__(self, database: OfficialDatabase, *, transformation_version: str = TRANSFORMATION_VERSION) -> None:
        if not transformation_version.strip():
            raise ValueError("transformation_version must not be empty")
        self._database = database
        self._transformation_version = transformation_version

    def publish(self, collection: DownloadedIndividualCollection) -> IndividualCanonicalizationResult:
        """Verify raw artifacts and publish pages behind a final status gate."""
        plan_artifact = _verify_json_artifact(collection.plan_path)
        _verify_json_artifact(collection.completion_path)
        plan = read_individual_collection_plan(collection.plan_path)
        completion = _read_object(collection.completion_path)
        page_artifacts = tuple(_verify_json_artifact(path) for path in collection.page_paths)
        _validate_collection(collection, plan, completion, page_artifacts)

        artifact_records: list[OfficialArtifactRecord] = []
        for page in page_artifacts:
            manifest = _read_object(page.manifest_path)
            retrieved_at = _manifest_timestamp(manifest)
            operation = manifest.get("operation")
            if not isinstance(operation, str):
                raise IndividualCanonicalizationError("page manifest has no operation")
            artifact_records.append(
                OfficialArtifactRecord(
                    artifact_id=f"sha256:{page.sha256}",
                    dataset_key=f"individual:{plan.collection_id}:{operation}",
                    dataset_kind="sec_api_individual_current_page",
                    source_url=plan.endpoint,
                    observation_date=collection.collection_completed_at.date(),
                    retrieved_at=retrieved_at,
                    sha256=page.sha256,
                    payload_path=str(page.payload_path),
                    manifest_path=str(page.manifest_path),
                    byte_count=page.payload_path.stat().st_size,
                )
            )
        self._database.record_artifacts(artifact_records)

        existing = self._existing_result(plan.collection_id, plan_artifact, page_artifacts)
        if existing is not None:
            return existing

        progress = self._start_or_resume_collection(
            plan=plan,
            plan_artifact=plan_artifact,
            page_artifacts=page_artifacts,
            started_at=collection.collection_started_at,
            completed_at=collection.collection_completed_at,
        )
        quarantined_rows = progress.quarantined_rows
        published_individuals = progress.published_individuals
        seen_crds = progress.seen_crds
        remaining_pages = page_artifacts[progress.completed_pages :]
        with self._database.connection() as connection:
            known_firms = {int(row[0]) for row in connection.execute("SELECT firm_crd FROM firms").fetchall()}
            for page_number, page in enumerate(remaining_pages, start=progress.completed_pages + 1):
                page_quarantined = 0
                page_published = 0
                with _connection_transaction(connection):
                    parsed_individuals: list[ParsedIndividual] = []
                    payload = _read_object(page.payload_path)
                    filings = payload.get("filings")
                    if not isinstance(filings, list):
                        raise IndividualCanonicalizationError(f"page has no filings array: {page.payload_path}")
                    for record_index, record in enumerate(filings):
                        if not isinstance(record, dict):
                            raise IndividualCanonicalizationError("verified page contains a non-object filing")
                        context = RecordContext(
                            collection_id=plan.collection_id,
                            observed_at=collection.collection_completed_at,
                            artifact_id=f"sha256:{page.sha256}",
                            source_record_index=record_index,
                            source_payload_digest=page.sha256,
                        )
                        try:
                            parsed = parse_individual_record(record, context)
                        except IndividualRecordError as error:
                            page_quarantined += 1
                            _insert_raw_error(
                                connection,
                                artifact_id=context.artifact_id,
                                member_name=context.source_json_path,
                                source_row_number=record_index,
                                error_code="invalid_individual_identity",
                                error_message=str(error),
                                raw_value=None,
                                recorded_at=collection.collection_completed_at,
                            )
                            continue
                        if parsed.individual_crd in seen_crds:
                            raise IndividualCanonicalizationError(
                                f"duplicate individual CRD {parsed.individual_crd} across retained pages"
                            )
                        seen_crds.add(parsed.individual_crd)
                        parsed_individuals.append(parsed)
                        page_published += 1
                    page_quarantined += self._publish_individuals(
                        connection,
                        plan.collection_id,
                        parsed_individuals,
                        known_firms=known_firms,
                        recorded_at=collection.collection_completed_at,
                    )
                    connection.execute(
                        """
                        UPDATE individual_collection_runs
                        SET retrieved_individual_count = retrieved_individual_count + ?,
                            completed_page_requests = ?, message = NULL
                        WHERE collection_id = ? AND status = 'running'
                        """,
                        [page_published, page_number, plan.collection_id],
                    )
                published_individuals += page_published
                quarantined_rows += page_quarantined

        if published_individuals != plan.expected_individual_count:
            message = f"published {published_individuals} individuals, expected {plan.expected_individual_count}"
            with self._database.transaction() as connection:
                connection.execute(
                    "UPDATE individual_collection_runs SET message = ? WHERE collection_id = ?",
                    [message, plan.collection_id],
                )
            raise IndividualCanonicalizationError(message)

        with self._database.transaction() as connection:
            connection.execute(
                """
                INSERT INTO individuals
                SELECT individual_crd, min(observed_at), max(observed_at)
                FROM individual_observations
                WHERE collection_id = ?
                GROUP BY individual_crd
                ON CONFLICT (individual_crd) DO UPDATE SET
                    first_seen_at = least(individuals.first_seen_at, excluded.first_seen_at),
                    last_seen_at = greatest(individuals.last_seen_at, excluded.last_seen_at)
                """,
                [plan.collection_id],
            )
            connection.execute(
                """
                UPDATE individual_collection_runs
                SET status = 'published', retrieved_individual_count = ?,
                    completed_page_requests = ?, collection_completed_at = ?, message = NULL
                WHERE collection_id = ?
                """,
                [
                    published_individuals,
                    len(page_artifacts),
                    collection.collection_completed_at,
                    plan.collection_id,
                ],
            )

        return IndividualCanonicalizationResult(
            collection_id=plan.collection_id,
            published_individuals=published_individuals,
            quarantined_rows=quarantined_rows,
            registered_page_artifacts=len(page_artifacts),
            was_already_published=False,
        )

    def _existing_result(
        self,
        collection_id: str,
        plan_artifact: StoredArtifact,
        page_artifacts: tuple[StoredArtifact, ...],
    ) -> IndividualCanonicalizationResult | None:
        with self._database.connection() as connection:
            row = connection.execute(
                """
                SELECT status, transformation_version, plan_artifact_id,
                       completed_page_requests
                FROM individual_collection_runs WHERE collection_id = ?
                """,
                [collection_id],
            ).fetchone()
            if row is None or row[0] != "published" or row[1] != self._transformation_version:
                return None
            if row[2] != f"sha256:{plan_artifact.sha256}":
                raise IndividualCanonicalizationError("published collection refers to a different plan artifact")
            count_row = connection.execute(
                "SELECT count(*) FROM individual_observations WHERE collection_id = ?",
                [collection_id],
            ).fetchone()
            if count_row is None:
                raise IndividualCanonicalizationError("cannot count published individual observations")
            published_count = int(count_row[0])
            completed_pages = int(row[3])
            quarantined = _count_page_errors(connection, page_artifacts[:completed_pages])
        return IndividualCanonicalizationResult(
            collection_id=collection_id,
            published_individuals=published_count,
            quarantined_rows=quarantined,
            registered_page_artifacts=completed_pages,
            was_already_published=True,
        )

    def _start_or_resume_collection(
        self,
        *,
        plan: IndividualCollectionPlan,
        plan_artifact: StoredArtifact,
        page_artifacts: tuple[StoredArtifact, ...],
        started_at: datetime,
        completed_at: datetime,
    ) -> _PublicationProgress:
        """Create a run or verify and load its last committed page boundary."""
        with self._database.transaction() as connection:
            row = connection.execute(
                """
                SELECT status, plan_artifact_id, transformation_version,
                       expected_individual_count, expected_page_requests,
                       retrieved_individual_count, completed_page_requests
                FROM individual_collection_runs WHERE collection_id = ?
                """,
                [plan.collection_id],
            ).fetchone()
            if row is None:
                self._prepare_collection(
                    connection,
                    plan=plan,
                    plan_artifact=plan_artifact,
                    started_at=started_at,
                    completed_at=completed_at,
                )
                return _PublicationProgress(0, 0, 0, set())
            published_prior_version = (
                row[0] == "published"
                and row[1] == f"sha256:{plan_artifact.sha256}"
                and row[2] != self._transformation_version
                and row[3] == plan.expected_individual_count
                and row[4] == len(page_artifacts)
            )
            if published_prior_version:
                self._prepare_collection(
                    connection,
                    plan=plan,
                    plan_artifact=plan_artifact,
                    started_at=started_at,
                    completed_at=completed_at,
                )
                return _PublicationProgress(0, 0, 0, set())
            expected_run = (
                "running",
                f"sha256:{plan_artifact.sha256}",
                self._transformation_version,
                plan.expected_individual_count,
                len(page_artifacts),
            )
            if tuple(row[:5]) != expected_run:
                raise IndividualCanonicalizationError(
                    "existing unfinished collection is incompatible with the verified plan"
                )
            published_individuals = int(row[5])
            completed_pages = int(row[6])
            if completed_pages < 0 or completed_pages > len(page_artifacts):
                raise IndividualCanonicalizationError("unfinished collection has invalid page progress")
            observation_rows = connection.execute(
                """
                SELECT individual_crd, artifact_id
                FROM individual_observations WHERE collection_id = ?
                """,
                [plan.collection_id],
            ).fetchall()
            if len(observation_rows) != published_individuals:
                raise IndividualCanonicalizationError(
                    "unfinished collection progress differs from canonical observations"
                )
            completed_artifact_ids = {f"sha256:{artifact.sha256}" for artifact in page_artifacts[:completed_pages]}
            if any(str(item[1]) not in completed_artifact_ids for item in observation_rows):
                raise IndividualCanonicalizationError(
                    "unfinished collection contains observations outside committed pages"
                )
            seen_crds = {int(item[0]) for item in observation_rows}
            quarantined_rows = _count_page_errors(connection, page_artifacts[:completed_pages])
        return _PublicationProgress(
            completed_pages,
            published_individuals,
            quarantined_rows,
            seen_crds,
        )

    def _prepare_collection(
        self,
        connection: DuckDBPyConnection,
        *,
        plan: IndividualCollectionPlan,
        plan_artifact: StoredArtifact,
        started_at: datetime,
        completed_at: datetime,
    ) -> None:
        _delete_collection_rows(connection, plan.collection_id)
        connection.execute("DELETE FROM individual_query_shards WHERE collection_id = ?", [plan.collection_id])
        connection.execute("DELETE FROM individual_collection_runs WHERE collection_id = ?", [plan.collection_id])
        connection.execute(
            """
            INSERT INTO individual_collection_runs VALUES (?, ?, 'running', ?, ?, 0, ?, 0, ?, ?, ?, NULL)
            """,
            [
                plan.collection_id,
                f"sha256:{plan_artifact.sha256}",
                plan.highest_crd,
                plan.expected_individual_count,
                plan.expected_page_requests,
                started_at,
                completed_at,
                self._transformation_version,
            ],
        )
        connection.executemany(
            """
            INSERT INTO individual_query_shards VALUES (?, ?, ?, ?, ?, ?, 'reconciled')
            """,
            [
                (
                    plan.collection_id,
                    shard.low_crd,
                    shard.high_crd,
                    shard.expected_count,
                    shard.expected_count,
                    (shard.expected_count + plan.page_size - 1) // plan.page_size,
                )
                for shard in plan.shards
            ],
        )

    @staticmethod
    def _publish_individuals(
        connection: DuckDBPyConnection,
        collection_id: str,
        parsed_individuals: list[ParsedIndividual],
        *,
        known_firms: set[int],
        recorded_at: datetime,
    ) -> int:
        _executemany_if_rows(
            connection,
            "INSERT INTO individual_observations VALUES (?, ?, ?, ?, ?, ?)",
            [
                (
                    collection_id,
                    parsed.individual_crd,
                    parsed.observed_at,
                    parsed.artifact_id,
                    parsed.source_record_index,
                    parsed.source_payload_digest,
                )
                for parsed in parsed_individuals
            ],
        )
        _executemany_if_rows(
            connection,
            "INSERT INTO individual_names VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    collection_id,
                    parsed.individual_crd,
                    parsed.name.first_name,
                    parsed.name.middle_name,
                    parsed.name.last_name,
                    parsed.name.suffix_name,
                    parsed.name.active_agent_registration,
                    parsed.name.artifact_id,
                    parsed.name.source_json_path,
                )
                for parsed in parsed_individuals
            ],
        )
        _executemany_if_rows(
            connection,
            "INSERT INTO individual_current_employments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    collection_id,
                    parsed.individual_crd,
                    item.employment_sequence,
                    item.employer_firm_crd,
                    item.employer_name,
                    item.employer_street_1,
                    item.employer_street_2,
                    item.employer_city,
                    item.employer_region_raw,
                    item.employer_country_raw,
                    item.employer_country_code,
                    item.employer_postal_code,
                    _firm_coverage(item.employer_firm_crd, known_firms),
                    item.artifact_id,
                    item.source_json_path,
                )
                for parsed in parsed_individuals
                for item in parsed.current_employments
            ],
        )
        _executemany_if_rows(
            connection,
            "INSERT INTO individual_current_registrations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    collection_id,
                    parsed.individual_crd,
                    item.employment_sequence,
                    item.registration_sequence,
                    item.employer_firm_crd,
                    item.jurisdiction,
                    item.registration_category,
                    item.status,
                    item.status_posted_date,
                    item.artifact_id,
                    item.source_json_path,
                )
                for parsed in parsed_individuals
                for item in parsed.current_registrations
            ],
        )
        _executemany_if_rows(
            connection,
            """
            INSERT INTO individual_registration_intervals VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            """,
            [
                (
                    item.interval_id,
                    collection_id,
                    parsed.individual_crd,
                    item.employer_firm_crd,
                    item.source_employer_name,
                    item.jurisdiction,
                    item.registration_category,
                    item.status,
                    item.start_date,
                    item.end_date,
                    item.start_precision,
                    item.end_precision,
                    item.start_method,
                    item.end_method,
                    item.interval_source,
                    item.iar_evidence_method,
                    item.artifact_id,
                    item.source_json_path,
                )
                for parsed in parsed_individuals
                for item in parsed.registration_intervals
            ],
        )
        _executemany_if_rows(
            connection,
            """
            INSERT INTO individual_registration_locations VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            """,
            [
                (
                    item.location_id,
                    collection_id,
                    parsed.individual_crd,
                    item.interval_id,
                    item.location_sequence,
                    item.location_source,
                    item.street_1,
                    item.street_2,
                    item.city,
                    item.region_raw,
                    item.country_raw,
                    item.country_code,
                    item.postal_code,
                    item.is_us_workplace,
                    item.artifact_id,
                    item.source_json_path,
                )
                for parsed in parsed_individuals
                for item in parsed.registration_locations
            ],
        )
        _executemany_if_rows(
            connection,
            """
            INSERT INTO individual_employment_intervals VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            """,
            [
                (
                    item.employment_interval_id,
                    collection_id,
                    parsed.individual_crd,
                    item.employment_sequence,
                    item.source_employer_name,
                    item.employer_firm_crd,
                    item.from_raw,
                    item.to_raw,
                    item.start_month,
                    item.end_month,
                    item.is_open_ended,
                    item.start_precision,
                    item.end_precision,
                    item.end_method,
                    item.city,
                    item.region_raw,
                    item.artifact_id,
                    item.source_json_path,
                )
                for parsed in parsed_individuals
                for item in parsed.employment_history
            ],
        )
        _executemany_if_rows(
            connection,
            "INSERT INTO individual_exams VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    collection_id,
                    parsed.individual_crd,
                    item.exam_sequence,
                    item.exam_code,
                    item.exam_name,
                    item.exam_date,
                    item.artifact_id,
                    item.source_json_path,
                )
                for parsed in parsed_individuals
                for item in parsed.exams
            ],
        )
        _executemany_if_rows(
            connection,
            "INSERT INTO individual_designations VALUES (?, ?, ?, ?, ?, ?)",
            [
                (
                    collection_id,
                    parsed.individual_crd,
                    item.designation_sequence,
                    item.designation_name,
                    item.artifact_id,
                    item.source_json_path,
                )
                for parsed in parsed_individuals
                for item in parsed.designations
            ],
        )
        _executemany_if_rows(
            connection,
            "INSERT INTO individual_disclosure_flags VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    collection_id,
                    parsed.individual_crd,
                    parsed.disclosure_flags.has_regulatory_action,
                    parsed.disclosure_flags.has_criminal,
                    parsed.disclosure_flags.has_bankruptcy,
                    parsed.disclosure_flags.has_civil_judgment,
                    parsed.disclosure_flags.has_bond,
                    parsed.disclosure_flags.has_judgment,
                    parsed.disclosure_flags.has_investigation,
                    parsed.disclosure_flags.has_customer_complaint,
                    parsed.disclosure_flags.has_termination,
                    parsed.disclosure_flags.has_other,
                    parsed.disclosure_flags.artifact_id,
                    parsed.disclosure_flags.source_json_path,
                )
                for parsed in parsed_individuals
            ],
        )
        for parsed in parsed_individuals:
            for error in parsed.errors:
                _insert_raw_error(
                    connection,
                    artifact_id=parsed.artifact_id,
                    member_name=error.source_json_path,
                    source_row_number=parsed.source_record_index,
                    error_code=error.error_code,
                    error_message=error.message,
                    raw_value=error.raw_value,
                    recorded_at=recorded_at,
                )
        return sum(len(parsed.errors) for parsed in parsed_individuals)


@contextmanager
def _connection_transaction(connection: DuckDBPyConnection) -> Iterator[None]:
    """Commit or roll back a bounded unit of work on a reused connection."""
    connection.execute("BEGIN")
    try:
        yield
    except BaseException:
        connection.execute("ROLLBACK")
        raise
    else:
        connection.execute("COMMIT")


def _delete_collection_rows(connection: DuckDBPyConnection, collection_id: str) -> None:
    tables = (
        "individual_snapshot_field_provenance",
        "individual_snapshot_coverage",
        "individual_firm_year",
        "individual_year_snapshots",
        "individual_registration_locations",
        "individual_registration_intervals",
        "individual_current_registrations",
        "individual_current_employments",
        "individual_employment_intervals",
        "individual_exams",
        "individual_designations",
        "individual_disclosure_flags",
        "individual_names",
        "individual_observations",
    )
    artifact_rows = connection.execute(
        "SELECT DISTINCT artifact_id FROM individual_observations WHERE collection_id = ?",
        [collection_id],
    ).fetchall()
    artifact_ids = [str(row[0]) for row in artifact_rows]
    if artifact_ids:
        placeholders = ", ".join("?" for _ in artifact_ids)
        connection.execute(f"DELETE FROM raw_row_errors WHERE artifact_id IN ({placeholders})", artifact_ids)
    for table in tables:
        connection.execute(f"DELETE FROM {table} WHERE collection_id = ?", [collection_id])


def _insert_raw_error(
    connection: DuckDBPyConnection,
    *,
    artifact_id: str,
    member_name: str,
    source_row_number: int,
    error_code: str,
    error_message: str,
    raw_value: str | None,
    recorded_at: datetime,
) -> None:
    connection.execute(
        """
        INSERT INTO raw_row_errors (
            artifact_id, member_name, source_row_number, error_code,
            error_message, raw_values_json, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            artifact_id,
            member_name,
            source_row_number,
            error_code,
            error_message,
            json.dumps({"raw_value": raw_value}) if raw_value is not None else None,
            recorded_at,
        ],
    )


def _executemany_if_rows(
    connection: DuckDBPyConnection,
    statement: str,
    rows: list[tuple[Any, ...]],
) -> None:
    if rows:
        connection.executemany(statement, rows)


def _count_page_errors(
    connection: DuckDBPyConnection,
    page_artifacts: tuple[StoredArtifact, ...],
) -> int:
    """Count quarantined rows for exactly the supplied immutable pages."""
    if not page_artifacts:
        return 0
    artifact_ids = [f"sha256:{artifact.sha256}" for artifact in page_artifacts]
    row = connection.execute(
        """
        SELECT count(*) FROM raw_row_errors
        WHERE artifact_id IN (SELECT unnest(?))
        """,
        [artifact_ids],
    ).fetchone()
    if row is None:
        raise IndividualCanonicalizationError("cannot count individual row errors")
    return int(row[0])


def _firm_coverage(firm_crd: int | None, known_firms: set[int]) -> str:
    if firm_crd is None:
        return "no_source_crd"
    if firm_crd in known_firms:
        return "in_firm_identity_universe"
    return "not_in_firm_snapshot_universe"


def _validate_collection(
    collection: DownloadedIndividualCollection,
    plan: IndividualCollectionPlan,
    completion: dict[str, Any],
    page_artifacts: tuple[StoredArtifact, ...],
) -> None:
    if collection.collection_started_at.tzinfo is None or collection.collection_completed_at.tzinfo is None:
        raise IndividualCanonicalizationError("collection timestamps must include a timezone")
    if completion.get("schema_version") != "individual-completion-v1":
        raise IndividualCanonicalizationError("unsupported individual completion schema")
    if completion.get("collection_id") != plan.collection_id or completion.get("status") != "downloaded":
        raise IndividualCanonicalizationError("completion artifact does not match the saved plan")
    if completion.get("plan_sha256") != _plan_digest(plan):
        raise IndividualCanonicalizationError("completion artifact plan digest does not match")
    if completion.get("planned_individual_count") != plan.expected_individual_count:
        raise IndividualCanonicalizationError("completion planned count does not match")
    if completion.get("retrieved_individual_count") != plan.expected_individual_count:
        raise IndividualCanonicalizationError("completion retrieved count does not match")
    if completion.get("completed_page_requests") != len(page_artifacts):
        raise IndividualCanonicalizationError("completion page count does not match supplied pages")
    page_entries = completion.get("pages")
    if not isinstance(page_entries, list) or len(page_entries) != len(page_artifacts):
        raise IndividualCanonicalizationError("completion page inventory is invalid")
    expected = [(str(page.payload_path), page.sha256) for page in page_artifacts]
    actual: list[tuple[str, str]] = []
    for item in page_entries:
        if (
            not isinstance(item, dict)
            or not isinstance(item.get("payload_path"), str)
            or not isinstance(item.get("sha256"), str)
        ):
            raise IndividualCanonicalizationError("completion page entry is invalid")
        actual.append((item["payload_path"], item["sha256"]))
    if actual != expected:
        raise IndividualCanonicalizationError("supplied page paths or digests differ from completion")


def _verify_json_artifact(path: Path) -> StoredArtifact:
    return ArtifactStore(path.parent).verify_json_artifact(path)


def _read_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise IndividualCanonicalizationError(f"cannot read JSON object: {path}") from error
    if not isinstance(value, dict):
        raise IndividualCanonicalizationError(f"JSON artifact is not an object: {path}")
    return value


def _manifest_timestamp(manifest: dict[str, Any]) -> datetime:
    value = manifest.get("retrieved_at")
    if not isinstance(value, str):
        raise IndividualCanonicalizationError("manifest has no retrieval timestamp")
    try:
        timestamp = datetime.fromisoformat(value)
    except ValueError as error:
        raise IndividualCanonicalizationError("manifest retrieval timestamp is invalid") from error
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        raise IndividualCanonicalizationError("manifest retrieval timestamp must include a timezone")
    return timestamp


def _plan_digest(plan: IndividualCollectionPlan) -> str:
    encoded = (json.dumps(plan.to_dict(), sort_keys=True, separators=(",", ":")) + "\n").encode()
    return hashlib.sha256(encoded).hexdigest()


__all__ = [
    "TRANSFORMATION_VERSION",
    "DownloadedIndividualCollection",
    "IndividualCanonicalizationError",
    "IndividualCanonicalizationResult",
    "IndividualCanonicalizer",
]
