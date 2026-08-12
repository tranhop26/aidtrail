# AidTrail Studionet recovery runbook

AidTrail settles simulated Studionet GEN only. The deployer is the single testnet upgrader; this is a temporary testnet limitation.

## Before an upgrade

1. Stop user-facing writes and collect the deployed address, transaction hash, current source hash, dependency pin, `storage_version`, `get_summary`, each active grant, and each milestone.
2. Compare the candidate source hash with the reviewed artifact. Existing class storage declarations must remain in exactly the same order; new declarations may be appended only.
3. Run the direct upgrade tests and a Studionet dry/schema check. Publish the proposed source hash and rollback source hash before sending an upgrade.

## Compatible rollback

1. Use the authorized deployment wallet to call `upgrade` with the exact, previously verified compatible source bytes.
2. Wait for consensus and separately require successful execution.
3. Re-read `storage_version`, summary, grants, milestones, credits, and source hash. Record those results in the deployment manifest only after readback succeeds.

## Incompatible layout or migration

Do not upgrade in place if a field must move, change type, or be removed. Deploy a new contract, prove a deterministic migration inventory against the old reads, migrate only through a reviewed migration procedure, and publish both addresses plus the mapping. Keep the original contract available for audit; do not claim balances migrated until the new contract and per-record accounting have been read back.

## EOA credit withdrawal evidence

For every future Studionet `withdraw_credit` operation, capture and retain the payer balance, contract balance, and sponsor EOA balance immediately before submission, the withdrawal transaction hash and execution result, then the same three balances after finality. The expected accounting readback is: sponsor credit becomes zero, `completed_refunds` increases by exactly the withdrawn credit, contract balance decreases by that exact amount, and the sponsor EOA balance reflects the received value subject to the network's fee model. Never infer success from consensus status alone.

## Permanent freeze

After all future upgrade needs are retired, use the authorized upgrader to remove every entry from `gl.storage.Root.get().upgraders`. Confirm the list is empty by supported chain inspection and record the freeze transaction. This is irreversible: with locked root code and no upgraders, neither rollback nor recovery upgrades remain possible.
