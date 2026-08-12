# Task 5 report — upgrade and Studionet verification workflow

## Delivered

- Root-upgrader-only `upgrade(bytes)` replaces only root code and preserves contract storage; `storage_version()` reports the installed implementation version.
- V2 fixture retains V1 storage declarations in-order and adds no incompatible fields.
- Direct tests prove unauthorized rejection and authorized preservation of a funded grant plus accounting summary.
- Deployment script is dry-run by default and execute-mode fails closed unless explicit Studionet network, HTTPS RPC, and authenticated wallet key configuration are supplied. It emits only the allowed deployment facts.
- Live verifier requires a real address and HTTPS RPC, validates schema methods, reads storage/accounting, and writes secret-free JSON evidence.
- Integration suite is opt-in (`AIDTRAIL_LIVE=1`) and records the required future workflow proof points. Its EOA withdrawal case explicitly requires payer, contract, and sponsor balance readbacks before and after finality.
- Recovery runbook covers compatible rollback, incompatible migration, source-hash verification, and irreversible freeze. No deployment manifest was created because no deployment occurred.

## Verification evidence

- WSL direct upgrade suite: 12 passed.
- WSL full direct suite: 107 passed.
- WSL integration suite: 3 skipped (deliberate no-live opt-in / no credentials).
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run deploy:dry-run`: passed and emitted null address/hash/deployer with source hash, dependency pin, and `studionet` only.
- `node --check scripts/verify-live.mjs`: passed.
- `git diff --check`: passed; scan found no concrete address and no deployment manifest.

## Concern

The live integration checks intentionally remain gated until a human supplies a real Studionet deployment and credentials; no external action was taken in this task.

## Important-finding fix round 1

- V2 is now materially distinct: it appends `v2_activation_marker`, reports version 2 from V2 code, and exposes V2-only `get_v2_implementation_info()`. The direct upgrade test rebuilds a V2-backed proxy over the same root storage and proves the funded grant and complete accounting summary remain unchanged.
- The opt-in integration body now performs a fresh Studionet deployment, checks consensus finality separately from execution, creates/funds approval and rejection grants, submits bound public evidence fixtures through validator consensus, exercises an invalid sender, permissionlessly finalizes payout/refund, and proves EOA withdrawal with payer/contract/sponsor plus accounting readbacks. It safe-skips unless `AIDTRAIL_LIVE=1`; the live command must explicitly select `--network studionet`.
- `gltest.config.yaml` now declares the official SDK Studionet ID (`61999`) and endpoint. Deploy and verify scripts require that exact SDK endpoint and independently query the remote chain ID before continuing.
- Live verification now retrieves deployed source via Studionet `gen_getContractCode`, requires its SHA-256 to equal the reviewed local source, compares the complete generated schema including signatures, and executes safe reads across version, accounting, credit, evidence-domain, pagination, and available grant/milestone state. Source retrieval failure is fatal; there is no local-only attestation fallback.

Fresh evidence: focused upgrade 12/12 passed; full direct 107/107 passed; opt-in integration collected and safely skipped 1/1 without live authorization; lint/typecheck/dry-run/script syntax passed; V1/V2 semantic validation passed with 18/19 methods respectively. Existing bare-`ValueError` validator warnings remain outside this focused review round.

## Narrow final fix round 2

- EOA withdrawal proof now binds the GenLayer consensus receipt to the payer's EVM submission receipt and reads official `gasUsed` and `effectiveGasPrice` fields. It asserts the exact sponsor/payer delta as `withdrawn credit - transaction fee`, including the case where a tiny withdrawal is smaller than its fee, while retaining exact contract-balance and accounting deltas.
- Deployment now explicitly waits for `FINALIZED`, requires `FINISHED_WITH_RETURN`, and extracts a valid address only from decoded deploy transaction data before emitting deployment facts. Focused receipt-validation tests cover success, merely accepted, execution failure, and missing-address cases.

Fresh focused evidence: deploy receipt validation 4/4 passed; fee accounting 2/2 passed; live workflow safely skipped 1/1 without authorization; typecheck, lint, deployment dry-run, and diff check passed. No external call or deployment occurred.
