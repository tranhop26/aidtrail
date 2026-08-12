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
