def fee_adjusted_received_delta(
    received: int, gas_used: int, effective_gas_price: int
) -> int:
    """Expected payer balance delta for a transaction that also receives value."""
    return received - (gas_used * effective_gas_price)
