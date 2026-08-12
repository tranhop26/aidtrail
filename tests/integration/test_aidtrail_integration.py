"""Explicitly opt-in, destructive Studionet workflow proof.

This module performs a fresh deployment and spends simulated Studionet GEN only
when AIDTRAIL_LIVE=1 and the required accounts/public evidence fixtures exist.
"""

from datetime import UTC, datetime
import json
import os
from pathlib import Path
import time

from Crypto.Hash import keccak
from eth_account import Account
import pytest

from gltest import get_contract_factory
from gltest.assertions import tx_execution_failed, tx_execution_succeeded
from gltest.clients import get_gl_client
from gltest.types import TransactionStatus
from gltest.utils import extract_contract_address


pytestmark = pytest.mark.skipif(
    os.environ.get("AIDTRAIL_LIVE") != "1",
    reason="Studionet proof requires explicit AIDTRAIL_LIVE=1 opt-in",
)

OFFICIAL_STUDIONET_ID = 61999
OFFICIAL_STUDIONET_RPC = "https://studio.genlayer.com/api"
ROOT = Path(__file__).parents[2]


def required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        pytest.fail(f"{name} is required for the live Studionet proof")
    return value


def assert_finalized(receipt: dict) -> None:
    # Consensus/finality and GenVM execution are deliberately separate assertions.
    assert receipt.get("status") == "FINALIZED"
    assert tx_execution_succeeded(receipt)


def content_hash(body: str) -> str:
    digest = keccak.new(digest_bits=256)
    digest.update(body.encode("utf-8"))
    return "0x" + digest.hexdigest()


def grant_args(beneficiary: str, suffix: str, now: int) -> list:
    return [
        beneficiary,
        f"AidTrail live {suffix}",
        "AidTrail integration",
        f"studionet-{suffix}-{now}",
        "Studionet",
        "Integration",
        f"Public fixture workflow for {suffix}",
        100,
        ["Public fixture verdict"],
        [f"The public fixture clearly supports a {suffix} decision"],
        [100],
        [now + 3600],
        ["public report and independent corroboration"],
        [1],
        "v1",
        1,
        1,
        1,
    ]


def evidence_pack(contract, grant_id: str, beneficiary: str, prefix: str, now: int) -> str:
    report_url = required(f"AIDTRAIL_{prefix}_REPORT_URL")
    report_body = required(f"AIDTRAIL_{prefix}_REPORT_BODY")
    source_url = required(f"AIDTRAIL_{prefix}_SOURCE_URL")
    source_body = required(f"AIDTRAIL_{prefix}_SOURCE_BODY")
    grant = contract.get_grant(args=[grant_id]).call()
    milestone = contract.get_milestone(args=[grant_id, 0]).call()
    domain = contract.get_evidence_domain(args=[]).call()
    subject = {
        "project_name": grant["project_name"],
        "project_reference": grant["project_reference"],
        "region": grant["region"],
        "milestone_title": milestone["title"],
        "criteria_hash": milestone["criteria_hash"],
    }
    dates = {
        "observation_start": now - 300,
        "observation_end": now - 60,
        "published_at": now - 30,
    }
    return json.dumps(
        {
            "schema_version": 1,
            "action": "SUBMIT_EVIDENCE",
            "network": domain["network"],
            "contract_replay_marker": domain["contract_replay_marker"],
            "grant_id": grant_id,
            "milestone_index": 0,
            "submission_nonce": 1,
            "report": {
                "url": report_url,
                "content_hash": content_hash(report_body),
                "content_version": "live-v1",
                "schema_version": 1,
                "issuer": beneficiary,
                "subject": subject,
                "dates": dates,
            },
            "independent_sources": [
                {
                    "url": source_url,
                    "content_hash": content_hash(source_body),
                    "content_version": "live-v1",
                    "schema_version": 1,
                    "issuer": f"aidtrail-live-{prefix.lower()}-observer",
                    "subject": subject,
                    "dates": dates,
                }
            ],
        },
        sort_keys=True,
        separators=(",", ":"),
    )


@pytest.fixture(scope="module")
def live_accounts():
    return {
        "sponsor": Account.from_key(required("AIDTRAIL_SPONSOR_PRIVATE_KEY")),
        "beneficiary": Account.from_key(required("AIDTRAIL_BENEFICIARY_PRIVATE_KEY")),
        "keeper": Account.from_key(required("AIDTRAIL_KEEPER_PRIVATE_KEY")),
    }


def test_fresh_studionet_deploy_and_complete_workflow(live_accounts) -> None:
    client = get_gl_client()
    assert client.chain.id == OFFICIAL_STUDIONET_ID
    assert client.chain.rpc_urls["default"]["http"][0] == OFFICIAL_STUDIONET_RPC
    assert client.provider.url == OFFICIAL_STUDIONET_RPC

    factory = get_contract_factory(contract_file_path=ROOT / "contracts" / "AidTrail.py")
    deploy_receipt = factory.deploy_contract_tx(
        account=live_accounts["sponsor"],
        wait_transaction_status=TransactionStatus.FINALIZED,
    )
    assert_finalized(deploy_receipt)
    address = extract_contract_address(deploy_receipt)
    contract = factory.build_contract(address, account=live_accounts["sponsor"])
    assert contract.storage_version(args=[]).call() == 1
    assert contract.get_summary(args=[]).call()["grant_inflows"] == 0

    now = int(datetime.now(UTC).timestamp())
    grant_ids: dict[str, str] = {}
    for outcome in ("APPROVAL", "REJECTION"):
        create_receipt = contract.create_grant(
            args=grant_args(live_accounts["beneficiary"].address, outcome.lower(), now)
        ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
        assert_finalized(create_receipt)
        grant_id = contract.list_grants(args=[0, 50]).call()[-1]["grant_id"]
        grant_ids[outcome] = grant_id

        fund_receipt = contract.fund_grant(args=[grant_id]).transact(
            value=100,
            wait_transaction_status=TransactionStatus.FINALIZED,
        )
        assert_finalized(fund_receipt)
        assert contract.get_grant(args=[grant_id]).call()["status"] == "ACTIVE"

        beneficiary_contract = contract.connect(live_accounts["beneficiary"])
        evidence_receipt = beneficiary_contract.submit_evidence(
            args=[grant_id, 0, evidence_pack(contract, grant_id, live_accounts["beneficiary"].address, outcome, now)]
        ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
        assert_finalized(evidence_receipt)
        assert contract.get_milestone(args=[grant_id, 0]).call()["status"] == f"PROVISIONAL_{outcome}"

    invalid_sender = contract.connect(live_accounts["beneficiary"])
    invalid_receipt = invalid_sender.fund_grant(args=[grant_ids["APPROVAL"]]).transact(
        value=1,
        wait_transaction_status=TransactionStatus.FINALIZED,
    )
    assert invalid_receipt.get("status") == "FINALIZED"
    assert tx_execution_failed(invalid_receipt)

    time.sleep(2)
    keeper_contract = contract.connect(live_accounts["keeper"])
    approval_receipt = keeper_contract.finalize_milestone(
        args=[grant_ids["APPROVAL"], 0]
    ).transact(
        wait_transaction_status=TransactionStatus.FINALIZED,
        wait_triggered_transactions=True,
        wait_triggered_transactions_status=TransactionStatus.FINALIZED,
    )
    assert_finalized(approval_receipt)
    assert contract.get_milestone(args=[grant_ids["APPROVAL"], 0]).call()["status"] == "PAID"

    rejection_receipt = keeper_contract.finalize_milestone(
        args=[grant_ids["REJECTION"], 0]
    ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
    assert_finalized(rejection_receipt)
    assert contract.get_milestone(args=[grant_ids["REJECTION"], 0]).call()["status"] == "REFUNDED"
    assert contract.get_credit(args=[live_accounts["sponsor"].address]).call() == 100

    payer_before = client.get_balance(live_accounts["sponsor"].address)
    contract_before = client.get_balance(address)
    sponsor_before = client.get_balance(live_accounts["sponsor"].address)
    summary_before = contract.get_summary(args=[]).call()
    withdrawal_receipt = contract.withdraw_credit(args=[]).transact(
        wait_transaction_status=TransactionStatus.FINALIZED,
        wait_triggered_transactions=True,
        wait_triggered_transactions_status=TransactionStatus.FINALIZED,
    )
    assert_finalized(withdrawal_receipt)
    payer_after = client.get_balance(live_accounts["sponsor"].address)
    contract_after = client.get_balance(address)
    sponsor_after = client.get_balance(live_accounts["sponsor"].address)
    summary_after = contract.get_summary(args=[]).call()

    assert payer_before == sponsor_before and payer_after == sponsor_after
    assert contract_before - contract_after == 100
    assert sponsor_after >= sponsor_before
    assert contract.get_credit(args=[live_accounts["sponsor"].address]).call() == 0
    assert summary_after["completed_refunds"] - summary_before["completed_refunds"] == 100
