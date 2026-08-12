import pytest

from conftest import call_create


def assert_conserved(summary):
    assert (
        summary["grant_inflows"] + summary["challenge_credit_inflows"]
        == summary["available"]
        + summary["reserved_milestone_escrow"]
        + summary["completed_payouts"]
        + summary["completed_refunds"]
        + summary["available_credits"]
        + summary["reserved_bonds"]
        + summary["returned_bonds"]
        + summary["slashed_bonds"]
    )


def test_exact_funding_activates_and_reserves_all_milestones(contract, vm, sponsor, valid_plan):
    # Break caught: activating before the full target or failing to reserve the target.
    with vm.sender(sponsor):
        grant_id = contract.create_grant(*valid_plan).call()
    with vm.sender(sponsor), vm.value(valid_plan.escrow_target):
        contract.fund_grant(grant_id).call()

    stored = contract.get_grant(grant_id).call()
    summary = contract.get_summary().call()
    assert stored["status"] == "ACTIVE"
    assert stored["funded"] == 600
    assert stored["reserved"] == 600
    assert summary["grant_inflows"] == 600
    assert summary["available"] == 0
    assert summary["reserved_milestone_escrow"] == 600
    assert_conserved(summary)


def test_partial_funding_stays_available_until_target_is_reached(contract, vm, sponsor, valid_plan):
    # Break caught: reserving milestones or activating on a partial payment.
    with vm.sender(sponsor):
        grant_id = contract.create_grant(*valid_plan).call()
    with vm.sender(sponsor), vm.value(200):
        contract.fund_grant(grant_id).call()

    stored = contract.get_grant(grant_id).call()
    summary = contract.get_summary().call()
    assert (stored["status"], stored["funded"], stored["reserved"]) == ("FUNDING", 200, 0)
    assert (summary["grant_inflows"], summary["available"], summary["reserved_milestone_escrow"]) == (
        200,
        200,
        0,
    )
    assert_conserved(summary)


def test_excess_funding_creates_sponsor_credit_and_withdrawal_consumes_it(
    contract, vm, sponsor, valid_plan
):
    # Break caught: losing excess funds or allowing a credit to be withdrawn twice.
    with vm.sender(sponsor):
        grant_id = contract.create_grant(*valid_plan).call()
    with vm.sender(sponsor), vm.value(650):
        contract.fund_grant(grant_id).call()

    before_withdrawal = contract.get_summary().call()
    assert contract.get_credit(sponsor).call() == 50
    assert before_withdrawal["available_credits"] == 50
    assert_conserved(before_withdrawal)

    with vm.sender(sponsor):
        contract.withdraw_credit().call()

    after_withdrawal = contract.get_summary().call()
    assert contract.get_credit(sponsor).call() == 0
    assert after_withdrawal["available_credits"] == 0
    assert after_withdrawal["completed_refunds"] == 50
    assert_conserved(after_withdrawal)
    with vm.sender(sponsor), vm.expect_revert("no credit available"):
        contract.withdraw_credit().call()


def test_credit_withdrawal_routes_excess_to_sponsor_eoa_as_external_gen_message(
    contract, vm, sponsor, valid_plan
):
    # Break caught: routing a sponsor EOA refund through an internal IC message.
    with vm.sender(sponsor):
        grant_id = contract.create_grant(*valid_plan).call()
    with vm.sender(sponsor), vm.value(650):
        contract.fund_grant(grant_id).call()

    with vm.capture_external_messages() as messages, vm.sender(sponsor):
        contract.withdraw_credit().call()

    assert messages == [{"EthSend": {"address": sponsor, "calldata": b"", "value": 50}}]


def test_partial_then_excess_funding_reserves_target_and_credits_only_excess(
    contract, vm, sponsor, valid_plan
):
    # Break caught: treating a later payment as a fresh target instead of accumulated funding.
    with vm.sender(sponsor):
        grant_id = contract.create_grant(*valid_plan).call()
    with vm.sender(sponsor), vm.value(200):
        contract.fund_grant(grant_id).call()
    with vm.sender(sponsor), vm.value(450):
        contract.fund_grant(grant_id).call()

    grant = contract.get_grant(grant_id).call()
    summary = contract.get_summary().call()
    assert (grant["status"], grant["funded"], grant["reserved"]) == ("ACTIVE", 600, 600)
    assert contract.get_credit(sponsor).call() == 50
    assert (summary["grant_inflows"], summary["available_credits"]) == (650, 50)
    assert_conserved(summary)


@pytest.mark.parametrize(
    ("actor", "amount", "message"),
    [
        ("stranger", 1, "only sponsor can fund grant"),
        ("sponsor", 0, "funding amount must be positive"),
    ],
)
def test_funding_rejects_unauthorized_or_zero_value(contract, vm, sponsor, stranger, valid_plan, actor, amount, message):
    # Break caught: accepting an unauthorized payer or a zero-value transaction.
    with vm.sender(sponsor):
        grant_id = contract.create_grant(*valid_plan).call()
    sender = stranger if actor == "stranger" else sponsor
    with vm.sender(sender), vm.value(amount), vm.expect_revert(message):
        contract.fund_grant(grant_id).call()
    assert_conserved(contract.get_summary().call())


def test_funding_rejects_a_second_payment_after_activation(contract, vm, sponsor, valid_plan):
    # Break caught: accepting a repeated payment after the grant is fully funded.
    with vm.sender(sponsor):
        grant_id = contract.create_grant(*valid_plan).call()
    with vm.sender(sponsor), vm.value(600):
        contract.fund_grant(grant_id).call()
    with vm.sender(sponsor), vm.value(1), vm.expect_revert("grant is not accepting funding"):
        contract.fund_grant(grant_id).call()
    assert_conserved(contract.get_summary().call())


def test_list_grants_returns_deterministic_capped_page(contract, vm, sponsor, valid_plan):
    # Break caught: returning more than 50 records or indexing grants nondeterministically.
    with vm.sender(sponsor):
        for index in range(52):
            contract.create_grant(
                *valid_plan.with_changes(project_reference="water-river-" + str(index))
            ).call()

    first_page = contract.list_grants(0, 99).call()
    second_page = contract.list_grants(50, 50).call()
    assert len(first_page) == 50
    assert first_page[0]["grant_id"] == "ATG-1"
    assert first_page[-1]["grant_id"] == "ATG-50"
    assert [grant["grant_id"] for grant in second_page] == ["ATG-51", "ATG-52"]
