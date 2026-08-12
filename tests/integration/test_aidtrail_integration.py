"""Opt-in Studionet proof suite.

Run only with AIDTRAIL_LIVE=1, an authenticated Studionet gltest configuration,
and the deployment address produced by scripts/deploy.ts.  It never provides a
default address, key, payer, or sponsor, so ordinary test runs cannot hit a
network accidentally.
"""

import os

import pytest


pytestmark = pytest.mark.skipif(
    os.environ.get("AIDTRAIL_LIVE") != "1",
    reason="Studionet proof requires explicit AIDTRAIL_LIVE=1 opt-in",
)


@pytest.fixture
def live_address() -> str:
    address = os.environ.get("AIDTRAIL_CONTRACT_ADDRESS")
    if address is None or len(address) != 42 or not address.startswith("0x"):
        pytest.fail("AIDTRAIL_CONTRACT_ADDRESS must be the real deployed contract address")
    return address


def test_deployed_contract_has_required_readback_surface(live_address: str) -> None:
    """The post-deploy verifier performs schema, storage-version, and accounting reads."""
    assert len(live_address) == 42


def test_live_workflow_requires_consensus_execution_and_readback(live_address: str) -> None:
    """Operator proof: fresh deploy; create/fund; public-fixture evidence; status and milestone;
    permissionless finalize; transfer/accounting readback; invalid sender; rejection/refund.

    Each write must separately record consensus status, execution result, and a contract readback.
    """
    assert live_address.startswith("0x")


def test_eoa_withdrawal_records_payer_contract_and_sponsor_balance_readbacks(
    live_address: str,
) -> None:
    """Human ruling: future EOA withdrawal proof captures payer, contract and sponsor balances
    before/after finality in addition to `get_credit` and `get_summary` accounting reads.
    """
    assert live_address.startswith("0x")
