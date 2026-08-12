from collections.abc import Iterator
from contextlib import contextmanager
import sys
from typing import Any, NamedTuple, cast

import pytest
from gltest.direct import create_address


class GrantPlan(NamedTuple):
    beneficiary: Any
    project_name: str
    organization: str
    project_reference: str
    region: str
    category: str
    description: str
    escrow_target: int
    milestone_titles: list[str]
    milestone_criteria: list[str]
    allocations: list[int]
    deadlines: list[int]
    evidence_requirements: list[str]
    min_independent_sources: list[int]
    evidence_policy_version: str
    challenge_bond: int
    challenge_window: int
    schema_version: int

    def with_changes(self, **changes: Any) -> "GrantPlan":
        return self._replace(**changes)


class CallResult:
    def __init__(self, method: Any, args: tuple[Any, ...]):
        self._method = method
        self._args = args

    def call(self) -> Any:
        return self._method(*self._args)


class ContractCalls:
    def __init__(self, contract: Any):
        self._contract = contract

    def __getattr__(self, name: str) -> Any:
        method = getattr(self._contract, name)

        def prepare(*args: Any) -> CallResult:
            return CallResult(method, args)

        return prepare


class SenderVM:
    def __init__(self, direct_vm: Any):
        self._direct_vm = direct_vm

    @contextmanager
    def sender(self, address: Any) -> Iterator[None]:
        with self._direct_vm.prank(address):
            yield

    @contextmanager
    def value(self, amount: int) -> Iterator[None]:
        previous_value = self._direct_vm.value
        self._direct_vm.value = amount
        try:
            yield
        finally:
            self._direct_vm.value = previous_value

    def expect_revert(self, message: str) -> Any:
        return self._direct_vm.expect_revert(message)


@pytest.fixture
def vm(direct_vm: Any) -> SenderVM:
    return SenderVM(direct_vm)


@pytest.fixture
def sponsor() -> Any:
    return create_address("sponsor")


@pytest.fixture
def beneficiary() -> Any:
    return create_address("beneficiary")


@pytest.fixture
def stranger() -> Any:
    return create_address("stranger")


@pytest.fixture
def contract(direct_deploy: Any) -> ContractCalls:
    for module_name in tuple(sys.modules):
        if module_name == "genlayer" or module_name.startswith("genlayer."):
            del sys.modules[module_name]
    return ContractCalls(direct_deploy("contracts/AidTrail.py"))


@pytest.fixture
def valid_plan(beneficiary: Any) -> GrantPlan:
    return GrantPlan(
        beneficiary=beneficiary,
        project_name="Clean water access",
        organization="River Community Group",
        project_reference="water-river-2026",
        region="Chiang Rai",
        category="Water",
        description="Install and commission three community water points.",
        escrow_target=600,
        milestone_titles=["Survey", "Install", "Commission"],
        milestone_criteria=["Survey published", "Three points installed", "Water quality verified"],
        allocations=[100, 300, 200],
        deadlines=[2_000_000_000, 2_000_100_000, 2_000_200_000],
        evidence_requirements=["public report", "public photos", "public test report"],
        min_independent_sources=[1, 1, 2],
        evidence_policy_version="v1",
        challenge_bond=25,
        challenge_window=86_400,
        schema_version=1,
    )


def call_create(contract: ContractCalls, vm: SenderVM, sponsor: Any, plan: GrantPlan) -> None:
    with vm.sender(sponsor):
        contract.create_grant(*plan).call()


def repeat(value: str, length: int) -> str:
    return value * length
