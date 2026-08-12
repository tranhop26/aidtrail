from accounting_proof import fee_adjusted_received_delta


def test_fee_adjusted_delta_handles_a_withdrawal_smaller_than_its_fee() -> None:
    assert fee_adjusted_received_delta(100, gas_used=21_000, effective_gas_price=2) == -41_900


def test_fee_adjusted_delta_keeps_the_exact_received_value_when_gas_is_free() -> None:
    assert fee_adjusted_received_delta(100, gas_used=21_000, effective_gas_price=0) == 100
