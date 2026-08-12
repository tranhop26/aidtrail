import json

import pytest

from conftest import REPORT_BODY, SOURCE_A_BODY, copy_pack, evidence_body_hash


APPEAL_OVERTURN = (
    '{"verdict":"OVERTURN","confidence":"HIGH","facts":["counter report"],'
    '"provenance":"counter report and observer agree","contradictions":[],'
    '"rationale":"the original conclusion is wrong"}'
)
APPEAL_UPHOLD = (
    '{"verdict":"UPHOLD","confidence":"HIGH","facts":["original report"],'
    '"provenance":"original report remains supported","contradictions":[],'
    '"rationale":"counter evidence does not change the decision"}'
)
APPEAL_UNRESOLVED = (
    '{"verdict":"UNRESOLVED","confidence":"LOW","facts":[], '
    '"provenance":"sources conflict","contradictions":["material conflict"],'
    '"rationale":"no safe direction"}'
)


def approve(active_grant, contract, vm, beneficiary, valid_pack, approval_result):
    vm.mock_web(valid_pack["report"]["url"], REPORT_BODY)
    vm.mock_web(valid_pack["independent_sources"][0]["url"], SOURCE_A_BODY)
    vm.mock_llm(approval_result)
    with vm.sender(beneficiary):
        contract.submit_evidence(active_grant, 0, json.dumps(valid_pack)).call()
    return contract.get_milestone(active_grant, 0).call()


def counter_pack(contract, active_grant, milestone, challenger, valid_pack):
    domain = contract.get_evidence_domain().call()
    subject = copy_pack(valid_pack["report"]["subject"])
    return {
        "schema_version": 1,
        "action": "CHALLENGE_MILESTONE",
        "network": domain["network"],
        "contract_replay_marker": domain["contract_replay_marker"],
        "grant_id": active_grant,
        "milestone_index": 0,
        "decision_submission_nonce": 1,
        "challenge_nonce": 1,
        "challenger": challenger.as_hex,
        "original_evidence_pack_hash": milestone["evidence_pack_hash"],
        "counter_report": {
            "url": "https://challenger.example/counter/atg-1-survey",
            "content_hash": evidence_body_hash("Counter evidence rejects completion."),
            "content_version": "counter-v1",
            "schema_version": 1,
            "issuer": challenger.as_hex,
            "subject": subject,
            "dates": copy_pack(valid_pack["report"]["dates"]),
        },
        "independent_sources": [
            {
                "url": "https://counter-observer.example/atg-1-survey",
                "content_hash": evidence_body_hash("Counter observer corroborates the challenge."),
                "content_version": "counter-observer-v1",
                "schema_version": 1,
                "issuer": "observer:appeal-monitor",
                "subject": subject,
                "dates": copy_pack(valid_pack["report"]["dates"]),
            }
        ],
    }


def assert_conserved(contract):
    summary = contract.get_summary().call()
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


def challenge(
    active_grant, contract, vm, challenger, milestone, valid_pack, appeal_result
):
    pack = counter_pack(contract, active_grant, milestone, challenger, valid_pack)
    with vm.sender(challenger), vm.value(25):
        contract.deposit_challenge_credit().call()
    vm.mock_web(pack["counter_report"]["url"], "Counter evidence rejects completion.")
    vm.mock_web(
        pack["independent_sources"][0]["url"], "Counter observer corroborates the challenge."
    )
    vm.mock_appeal_llm(appeal_result)
    with vm.sender(challenger):
        contract.challenge_milestone(active_grant, 0, json.dumps(pack)).call()
    return pack


def test_challenge_requires_predeposited_credit(
    active_grant, contract, vm, beneficiary, challenger, valid_pack, approval_result
):
    # Break caught: a challenger can invoke an appeal without reserving the locked bond.
    milestone = approve(active_grant, contract, vm, beneficiary, valid_pack, approval_result)
    with vm.sender(challenger), vm.expect_revert("insufficient challenge credit"):
        contract.challenge_milestone(
            active_grant, 0, json.dumps(counter_pack(contract, active_grant, milestone, challenger, valid_pack))
        ).call()


def test_third_party_finalizes_approval_after_window(
    active_grant, contract, vm, beneficiary, keeper, valid_pack, approval_result
):
    # Break caught: settlement is not permissionless or pays a value other than locked escrow.
    milestone = approve(active_grant, contract, vm, beneficiary, valid_pack, approval_result)
    vm.set_datetime(milestone["challenge_deadline"] + 1)
    with vm.capture_external_messages() as messages, vm.sender(keeper):
        contract.finalize_milestone(active_grant, 0).call()
    stored = contract.get_milestone(active_grant, 0).call()
    assert (stored["status"], stored["execution_complete"], stored["reserved_amount"]) == (
        "PAID",
        True,
        0,
    )
    assert messages == [{"EthSend": {"address": beneficiary, "calldata": b"", "value": 100}}]


def test_overturn_returns_bond_to_challenger_credit_and_finalizes_refund(
    active_grant, contract, vm, beneficiary, challenger, keeper, sponsor, valid_pack, approval_result
):
    # Break caught: an overturned approval loses the bond or pays the beneficiary.
    milestone = approve(active_grant, contract, vm, beneficiary, valid_pack, approval_result)
    challenge(active_grant, contract, vm, challenger, milestone, valid_pack, APPEAL_OVERTURN)
    appealed = contract.get_milestone(active_grant, 0).call()
    record = contract.get_challenge_record(active_grant, 0, 1).call()
    assert (appealed["status"], contract.get_credit(challenger).call()) == (
        "OVERTURNED_TO_REJECTION",
        25,
    )
    assert (record["decision_submission_nonce"], record["original_status"], record["bond_amount"]) == (
        1,
        "PROVISIONAL_APPROVAL",
        25,
    )
    vm.set_datetime(appealed["challenge_deadline"] + 1)
    with vm.sender(keeper):
        contract.finalize_milestone(active_grant, 0).call()
    assert contract.get_credit(sponsor).call() == 100
    assert contract.get_milestone(active_grant, 0).call()["status"] == "REFUNDED"
    assert_conserved(contract)


def test_upheld_challenge_slashes_bond_to_beneficiary_credit(
    active_grant, contract, vm, beneficiary, challenger, valid_pack, approval_result
):
    # Break caught: an upheld challenge returns the bond to its challenger instead of its fixed beneficiary destination.
    milestone = approve(active_grant, contract, vm, beneficiary, valid_pack, approval_result)
    challenge(active_grant, contract, vm, challenger, milestone, valid_pack, APPEAL_UPHOLD)
    assert contract.get_milestone(active_grant, 0).call()["status"] == "UPHELD_APPROVAL"
    assert contract.get_credit(challenger).call() == 0
    assert contract.get_credit(beneficiary).call() == 25
    assert_conserved(contract)


def test_unresolved_appeal_returns_bond_without_releasing_escrow(
    active_grant, contract, vm, beneficiary, challenger, keeper, valid_pack, approval_result
):
    # Break caught: an indeterminate appeal changes the original escrow outcome.
    milestone = approve(active_grant, contract, vm, beneficiary, valid_pack, approval_result)
    challenge(active_grant, contract, vm, challenger, milestone, valid_pack, APPEAL_UNRESOLVED)
    stored = contract.get_milestone(active_grant, 0).call()
    assert (stored["status"], stored["reserved_amount"], contract.get_credit(challenger).call()) == (
        "UNRESOLVED",
        100,
        25,
    )
    vm.set_datetime(stored["challenge_deadline"] + 1)
    with vm.sender(keeper), vm.expect_revert("milestone is unresolved"):
        contract.finalize_milestone(active_grant, 0).call()
    assert_conserved(contract)


def test_counter_evidence_binds_the_original_decision_and_cannot_be_replayed(
    active_grant, contract, vm, beneficiary, challenger, valid_pack, approval_result
):
    # Break caught: a challenger can redirect an appeal to a different provisional decision or replay it.
    milestone = approve(active_grant, contract, vm, beneficiary, valid_pack, approval_result)
    pack = counter_pack(contract, active_grant, milestone, challenger, valid_pack)
    pack["original_evidence_pack_hash"] = "0x" + "11" * 32
    with vm.sender(challenger), vm.value(25):
        contract.deposit_challenge_credit().call()
    with vm.sender(challenger), vm.expect_revert("counter evidence decision hash mismatch"):
        contract.challenge_milestone(active_grant, 0, json.dumps(pack)).call()
    assert contract.get_credit(challenger).call() == 25

    valid = counter_pack(contract, active_grant, milestone, challenger, valid_pack)
    vm.mock_web(valid["counter_report"]["url"], "Counter evidence rejects completion.")
    vm.mock_web(valid["independent_sources"][0]["url"], "Counter observer corroborates the challenge.")
    vm.mock_appeal_llm(APPEAL_UPHOLD)
    with vm.sender(challenger):
        contract.challenge_milestone(active_grant, 0, json.dumps(valid)).call()
    with vm.sender(challenger), vm.expect_revert("milestone is not challengeable"):
        contract.challenge_milestone(active_grant, 0, json.dumps(valid)).call()
    assert_conserved(contract)


def test_expiry_credits_sponsor_once_after_cure_period(
    active_grant, contract, vm, keeper, sponsor
):
    # Break caught: a keeper can expire before the fixed cure period or refund the same allocation twice.
    milestone = contract.get_milestone(active_grant, 0).call()
    vm.set_datetime(milestone["deadline"] + 86_401)
    with vm.sender(keeper):
        contract.expire_grant(active_grant).call()
    expired = contract.get_milestone(active_grant, 0).call()
    assert (expired["status"], expired["execution_complete"], expired["expired"]) == (
        "REFUNDED",
        True,
        True,
    )
    assert contract.get_credit(sponsor).call() == 100
    with vm.sender(keeper), vm.expect_revert("no eligible milestones to expire"):
        contract.expire_grant(active_grant).call()
    assert_conserved(contract)
