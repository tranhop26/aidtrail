from web3 import Web3


NEW_TRANSACTION_SIGNATURE = "NewTransaction(bytes32,address,address)"
NEW_TRANSACTION_TOPIC = "0x" + Web3.keccak(
    text=NEW_TRANSACTION_SIGNATURE
).hex().removeprefix("0x")


def fee_adjusted_received_delta(
    received: int, gas_used: int, effective_gas_price: int
) -> int:
    """Expected payer balance delta for a transaction that also receives value."""
    return received - (gas_used * effective_gas_price)


def indexed_address_topic(address: str) -> str:
    normalized = address.removeprefix("0x").lower()
    if len(normalized) != 40:
        raise ValueError("invalid indexed address")
    return "0x" + ("0" * 24) + normalized


def new_transaction_topics(consensus_tx_id: str, activator: str) -> list[str | None]:
    return [
        NEW_TRANSACTION_TOPIC,
        consensus_tx_id,
        None,  # indexed recipient
        indexed_address_topic(activator),
    ]


def require_expected_payer(evm_transaction: dict, expected_payer: str) -> None:
    actual = evm_transaction.get("from")
    if not isinstance(actual, str) or actual.lower() != expected_payer.lower():
        raise ValueError(
            f"EVM submission payer mismatch: expected {expected_payer}, received {actual}"
        )
