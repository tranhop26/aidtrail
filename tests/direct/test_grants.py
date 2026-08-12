import pytest

from conftest import call_create, repeat


def test_create_grant_stores_locked_plan(contract, vm, sponsor, beneficiary, valid_plan):
    with vm.sender(sponsor):
        grant_id = contract.create_grant(*valid_plan).call()
    grant = contract.get_grant(grant_id).call()
    assert grant["grant_id"] == "ATG-1"
    assert grant["sponsor"] == sponsor.as_hex
    assert grant["beneficiary"] == beneficiary.as_hex
    assert grant["status"] == "FUNDING"
    assert grant["milestone_count"] == 3
    assert grant["escrow_target"] == sum(valid_plan.allocations)


@pytest.mark.parametrize(
    ("plan_change", "message"),
    [
        ({"beneficiary": None}, "beneficiary cannot be zero"),
        ({"milestone_titles": []}, "grant must contain one to five milestones"),
        ({"milestone_titles": ["1", "2", "3", "4", "5", "6"]}, "grant must contain one to five milestones"),
        ({"escrow_target": 601}, "milestone allocations must equal escrow target"),
        ({"allocations": [100, 0, 500]}, "milestone allocation must be positive"),
        ({"challenge_bond": 0}, "challenge bond must be positive"),
        ({"challenge_window": 0}, "challenge window must be positive"),
        ({"deadlines": [1, 2_000_100_000, 2_000_200_000]}, "milestone deadline must be in the future"),
        ({"deadlines": [2_000_000_000, 2_000_000_000, 2_000_200_000]}, "milestone deadlines must be ordered"),
        ({"project_name": repeat("x", 129)}, "project name is empty or too long"),
        ({"schema_version": 2}, "unsupported schema version"),
    ],
)
def test_create_grant_rejects_invalid_locked_plan(contract, vm, sponsor, beneficiary, valid_plan, plan_change, message):
    if "beneficiary" in plan_change and plan_change["beneficiary"] is None:
        plan_change = {"beneficiary": type(beneficiary)(b"\x00" * 20)}
    plan = valid_plan.with_changes(**plan_change)
    with vm.expect_revert(message):
        call_create(contract, vm, sponsor, plan)


def test_create_grant_rejects_duplicate_actors(contract, vm, sponsor, valid_plan):
    plan = valid_plan.with_changes(beneficiary=sponsor)
    with vm.expect_revert("sponsor and beneficiary must differ"):
        call_create(contract, vm, sponsor, plan)


def test_get_milestone_returns_locked_fields(contract, vm, sponsor, valid_plan):
    with vm.sender(sponsor):
        grant_id = contract.create_grant(*valid_plan).call()
    milestone = contract.get_milestone(grant_id, 1).call()
    assert milestone["grant_id"] == "ATG-1"
    assert milestone["index"] == 1
    assert milestone["allocation"] == 300
    assert milestone["criteria"] == "Three points installed"
    assert milestone["status"] == "PENDING"


def test_create_grant_indexes_sequential_grants(contract, vm, sponsor, beneficiary, valid_plan):
    with vm.sender(sponsor):
        first = contract.create_grant(*valid_plan).call()
        second_plan = valid_plan.with_changes(project_reference="water-river-2027")
        second = contract.create_grant(*second_plan).call()
    assert (first, second) == ("ATG-1", "ATG-2")
    assert contract.get_grant(second).call()["project_reference"] == "water-river-2027"
