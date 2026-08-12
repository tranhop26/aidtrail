# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from dataclasses import dataclass
from datetime import UTC, datetime

from genlayer import Address, DynArray, Keccak256, TreeMap, allow_storage, gl, u256


SCHEMA_VERSION = u256(1)
FUNDING = "FUNDING"
PENDING = "PENDING"
MAX_MILESTONES = 5
MAX_IDENTITY_TEXT = 128
MAX_DESCRIPTION_TEXT = 2_048
MAX_CRITERIA_TEXT = 1_024
MAX_EVIDENCE_TEXT = 512
MAX_POLICY_VERSION_TEXT = 32


@allow_storage
@dataclass
class Grant:
    grant_id: str
    schema_version: u256
    sponsor: Address
    beneficiary: Address
    project_name: str
    organization: str
    project_reference: str
    region: str
    category: str
    description: str
    plan_hash: str
    escrow_target: u256
    milestone_count: u256
    evidence_policy_version: str
    challenge_bond: u256
    challenge_window: u256
    status: str


@allow_storage
@dataclass
class Milestone:
    grant_id: str
    index: u256
    title: str
    criteria: str
    allocation: u256
    deadline: u256
    evidence_requirement: str
    min_independent_sources: u256
    criteria_hash: str
    status: str


@allow_storage
@dataclass
class EvidenceRecord:
    grant_id: str
    milestone_index: u256
    submission_nonce: u256
    evidence_pack_hash: str
    status: str


@allow_storage
@dataclass
class ChallengeRecord:
    grant_id: str
    milestone_index: u256
    challenger: Address
    challenge_nonce: u256
    counter_evidence_hash: str
    status: str


class AidTrail(gl.Contract):
    next_grant_number: u256
    grants: TreeMap[str, Grant]
    milestones: TreeMap[str, Milestone]

    def __init__(self):
        self.next_grant_number = u256(0)
        root = gl.storage.Root.get()
        root.upgraders.get().append(gl.message.sender_address)

    @gl.public.write
    def create_grant(
        self,
        beneficiary: Address,
        project_name: str,
        organization: str,
        project_reference: str,
        region: str,
        category: str,
        description: str,
        escrow_target: u256,
        milestone_titles: list[str],
        milestone_criteria: list[str],
        allocations: list[u256],
        deadlines: list[u256],
        evidence_requirements: list[str],
        min_independent_sources: list[u256],
        evidence_policy_version: str,
        challenge_bond: u256,
        challenge_window: u256,
        schema_version: u256,
    ) -> str:
        self._validate_plan(
            beneficiary,
            project_name,
            organization,
            project_reference,
            region,
            category,
            description,
            escrow_target,
            milestone_titles,
            milestone_criteria,
            allocations,
            deadlines,
            evidence_requirements,
            min_independent_sources,
            evidence_policy_version,
            challenge_bond,
            challenge_window,
            schema_version,
        )
        grant_number = self.next_grant_number + 1
        grant_id = "ATG-" + str(grant_number)
        plan_hash = self._hash_plan(
            beneficiary,
            project_name,
            organization,
            project_reference,
            region,
            category,
            description,
            escrow_target,
            milestone_titles,
            milestone_criteria,
            allocations,
            deadlines,
            evidence_requirements,
            min_independent_sources,
            evidence_policy_version,
            challenge_bond,
            challenge_window,
            schema_version,
        )
        self.grants[grant_id] = Grant(
            grant_id,
            schema_version,
            gl.message.sender_address,
            beneficiary,
            project_name,
            organization,
            project_reference,
            region,
            category,
            description,
            plan_hash,
            escrow_target,
            u256(len(milestone_titles)),
            evidence_policy_version,
            challenge_bond,
            challenge_window,
            FUNDING,
        )

        for index in range(len(milestone_titles)):
            criteria_hash = self._hash_text(milestone_criteria[index])
            self.milestones[self._milestone_key(grant_id, u256(index))] = Milestone(
                grant_id,
                u256(index),
                milestone_titles[index],
                milestone_criteria[index],
                allocations[index],
                deadlines[index],
                evidence_requirements[index],
                min_independent_sources[index],
                criteria_hash,
                PENDING,
            )

        self.next_grant_number = grant_number
        return grant_id

    @gl.public.view
    def get_grant(self, grant_id: str) -> dict:
        grant = self.grants.get(grant_id)
        if grant is None:
            raise ValueError("grant not found")
        return {
            "grant_id": grant.grant_id,
            "schema_version": grant.schema_version,
            "sponsor": grant.sponsor.as_hex,
            "beneficiary": grant.beneficiary.as_hex,
            "project_name": grant.project_name,
            "organization": grant.organization,
            "project_reference": grant.project_reference,
            "region": grant.region,
            "category": grant.category,
            "description": grant.description,
            "plan_hash": grant.plan_hash,
            "escrow_target": grant.escrow_target,
            "milestone_count": grant.milestone_count,
            "evidence_policy_version": grant.evidence_policy_version,
            "challenge_bond": grant.challenge_bond,
            "challenge_window": grant.challenge_window,
            "status": grant.status,
        }

    @gl.public.view
    def get_milestone(self, grant_id: str, milestone_index: u256) -> dict:
        milestone = self.milestones.get(self._milestone_key(grant_id, milestone_index))
        if milestone is None:
            raise ValueError("milestone not found")
        return {
            "grant_id": milestone.grant_id,
            "index": milestone.index,
            "title": milestone.title,
            "criteria": milestone.criteria,
            "allocation": milestone.allocation,
            "deadline": milestone.deadline,
            "evidence_requirement": milestone.evidence_requirement,
            "min_independent_sources": milestone.min_independent_sources,
            "criteria_hash": milestone.criteria_hash,
            "status": milestone.status,
        }

    def _validate_plan(
        self,
        beneficiary: Address,
        project_name: str,
        organization: str,
        project_reference: str,
        region: str,
        category: str,
        description: str,
        escrow_target: u256,
        milestone_titles: list[str],
        milestone_criteria: list[str],
        allocations: list[u256],
        deadlines: list[u256],
        evidence_requirements: list[str],
        min_independent_sources: list[u256],
        evidence_policy_version: str,
        challenge_bond: u256,
        challenge_window: u256,
        schema_version: u256,
    ) -> None:
        if schema_version != SCHEMA_VERSION:
            raise ValueError("unsupported schema version")
        if beneficiary.as_bytes == b"\x00" * Address.SIZE:
            raise ValueError("beneficiary cannot be zero")
        if beneficiary == gl.message.sender_address:
            raise ValueError("sponsor and beneficiary must differ")
        if evidence_policy_version != "v1":
            raise ValueError("unsupported evidence policy")
        if challenge_bond == 0:
            raise ValueError("challenge bond must be positive")
        if challenge_window == 0:
            raise ValueError("challenge window must be positive")
        self._validate_bounded_text(project_name, MAX_IDENTITY_TEXT, "project name")
        self._validate_bounded_text(organization, MAX_IDENTITY_TEXT, "organization")
        self._validate_bounded_text(project_reference, MAX_IDENTITY_TEXT, "project reference")
        self._validate_bounded_text(region, MAX_IDENTITY_TEXT, "region")
        self._validate_bounded_text(category, MAX_IDENTITY_TEXT, "category")
        self._validate_bounded_text(description, MAX_DESCRIPTION_TEXT, "description")
        self._validate_bounded_text(
            evidence_policy_version, MAX_POLICY_VERSION_TEXT, "evidence policy version"
        )

        milestone_count = len(milestone_titles)
        if milestone_count == 0 or milestone_count > MAX_MILESTONES:
            raise ValueError("grant must contain one to five milestones")
        if not (
            milestone_count == len(milestone_criteria)
            and milestone_count == len(allocations)
            and milestone_count == len(deadlines)
            and milestone_count == len(evidence_requirements)
            and milestone_count == len(min_independent_sources)
        ):
            raise ValueError("milestone fields must have matching lengths")

        total = u256(0)
        previous_deadline = u256(0)
        now = u256(int(datetime.now(UTC).timestamp()))
        for index in range(milestone_count):
            self._validate_bounded_text(milestone_titles[index], MAX_IDENTITY_TEXT, "milestone title")
            self._validate_bounded_text(
                milestone_criteria[index], MAX_CRITERIA_TEXT, "milestone criteria"
            )
            self._validate_bounded_text(
                evidence_requirements[index], MAX_EVIDENCE_TEXT, "evidence requirement"
            )
            if allocations[index] == 0:
                raise ValueError("milestone allocation must be positive")
            if deadlines[index] <= now:
                raise ValueError("milestone deadline must be in the future")
            if index > 0 and deadlines[index] <= previous_deadline:
                raise ValueError("milestone deadlines must be ordered")
            if min_independent_sources[index] == 0 or min_independent_sources[index] > 2:
                raise ValueError("independent source count must be one or two")
            total += allocations[index]
            previous_deadline = deadlines[index]

        if escrow_target == 0:
            raise ValueError("escrow target must be positive")
        if total != escrow_target:
            raise ValueError("milestone allocations must equal escrow target")

    def _validate_bounded_text(self, value: str, maximum: int, label: str) -> None:
        if len(value) == 0 or len(value) > maximum:
            raise ValueError(label + " is empty or too long")

    def _hash_plan(
        self,
        beneficiary: Address,
        project_name: str,
        organization: str,
        project_reference: str,
        region: str,
        category: str,
        description: str,
        escrow_target: u256,
        milestone_titles: list[str],
        milestone_criteria: list[str],
        allocations: list[u256],
        deadlines: list[u256],
        evidence_requirements: list[str],
        min_independent_sources: list[u256],
        evidence_policy_version: str,
        challenge_bond: u256,
        challenge_window: u256,
        schema_version: u256,
    ) -> str:
        canonical = self._field(beneficiary.as_hex)
        canonical += self._field(project_name)
        canonical += self._field(organization)
        canonical += self._field(project_reference)
        canonical += self._field(region)
        canonical += self._field(category)
        canonical += self._field(description)
        canonical += self._field(str(escrow_target))
        canonical += self._field(evidence_policy_version)
        canonical += self._field(str(challenge_bond))
        canonical += self._field(str(challenge_window))
        canonical += self._field(str(schema_version))
        for index in range(len(milestone_titles)):
            canonical += self._field(milestone_titles[index])
            canonical += self._field(milestone_criteria[index])
            canonical += self._field(str(allocations[index]))
            canonical += self._field(str(deadlines[index]))
            canonical += self._field(evidence_requirements[index])
            canonical += self._field(str(min_independent_sources[index]))
        return self._hash_text(canonical)

    def _field(self, value: str) -> str:
        return str(len(value)) + ":" + value

    def _hash_text(self, value: str) -> str:
        return Keccak256(value.encode("utf-8")).hexdigest()

    def _milestone_key(self, grant_id: str, milestone_index: u256) -> str:
        return grant_id + ":" + str(milestone_index)
