import pytest

from accounting_proof import (
    NEW_TRANSACTION_TOPIC,
    fee_adjusted_received_delta,
    new_transaction_topics,
    require_expected_payer,
)


def test_fee_adjusted_delta_handles_a_withdrawal_smaller_than_its_fee() -> None:
    assert fee_adjusted_received_delta(100, gas_used=21_000, effective_gas_price=2) == -41_900


def test_fee_adjusted_delta_keeps_the_exact_received_value_when_gas_is_free() -> None:
    assert fee_adjusted_received_delta(100, gas_used=21_000, effective_gas_price=0) == 100


def test_new_transaction_topic_matches_the_official_three_argument_event() -> None:
    assert NEW_TRANSACTION_TOPIC == "0xdab9102861c7483a187584d6371d88316f005af507982ccf95c110879f3ed5a5"
    assert new_transaction_topics("0x" + ("1" * 64), "0x" + ("2" * 40)) == [
        NEW_TRANSACTION_TOPIC,
        "0x" + ("1" * 64),
        None,
        "0x" + ("0" * 24) + ("2" * 40),
    ]


def test_evm_submission_rejects_a_payer_mismatch() -> None:
    with pytest.raises(ValueError, match="payer mismatch"):
        require_expected_payer(
            {"from": "0x" + ("3" * 40)},
            "0x" + ("2" * 40),
        )
