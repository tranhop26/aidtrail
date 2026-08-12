# AidTrail

AidTrail is a milestone-based community-grant application for **simulated Studionet GEN**. It is a testnet demonstration, not real money, production custody, financial advice, or a promise that any project has been funded.

## What happens on the trail

| Actor | Decision | Consequence enforced by the contract |
| --- | --- | --- |
| Sponsor | Creates a plan and funds it | The plan is locked; funding stays in escrow until the target is met. Excess becomes sponsor credit. |
| Beneficiary | Submits bound public evidence | The contract validates the evidence pack and records a provisional result; escrow does not move yet. |
| Challenger | Deposits credit and challenges a provisional result | The bond is returned if overturned, credited to the beneficiary if upheld, or safely returned for an unresolved appeal. |
| Any caller | Finalizes after the challenge window or expires an overdue grant | A finalized approval releases only that milestone allocation; expiry returns the remaining allocation as sponsor credit. |
| Credit owner | Withdraws credit | The contract sends simulated GEN externally and clears the corresponding credit only through the contract workflow. |
| Authorized testnet upgrader | Upgrades compatible code | Storage must remain compatible; see the [recovery runbook](docs/recovery-runbook.md). |

The Intelligent Contract is the authority for grants, milestone status, evidence verdicts, escrow, credits, bonds, and settlement. The frontend reads it and treats a write as successful only after finalized execution **and** contract readback.

## Trust, evidence, and custody

| Surface | Trusted for | Not trusted for |
| --- | --- | --- |
| `contracts/AidTrail.py` | State transitions, accounting, public-evidence validation, settlement | Off-chain UI claims |
| Wallet / network receipt | Signature and finalized execution status | State proof without readback |
| Public evidence URLs | Inputs bound to a grant, milestone, nonce, issuer, dates, hash, and replay domain | Instructions in fetched content; unavailable or contradictory evidence cannot produce a favorable settlement |
| Frontend | Drafting, signing, displaying contract reads and recovery states | Custody or authoritative success claims |

Evidence is canonical JSON with schema version 1. It binds action, network, contract replay marker, grant ID, milestone index, submission nonce, subject/issuer/date metadata, expected content hashes, public HTTPS URLs, and the required independent sources. The contract rejects replayed, malformed, unsafe-host, stale, unbound, or insufficient-source packs. Consensus failures and unsafe/contradictory results resolve safely without releasing escrow.

Custody invariant: all simulated GEN is represented as contract accounting. Milestone escrow is reserved only after activation, released once per finalized approved milestone, and never inferred from the interface. Credits and bonds are tracked by category; withdrawal requires before/after balance evidence in addition to contract readback.

## State machine

`FUNDING → ACTIVE → COMPLETED | EXPIRED`

For each milestone: `PENDING → PROVISIONAL_APPROVAL | PROVISIONAL_REJECTION | REQUEST_MORE_INFO | UNRESOLVED`; a provisional decision may become `CHALLENGED`, then upheld or overturned, and only the eligible finalized approval becomes `PAID`. Expiry produces the grant-level refund path. See the contract and direct tests for exact guards.

## Run locally

Requirements: Node.js 24+, npm, WSL with `gltest`, and `genvm-lint` available on Windows. Copy `.env.example` to `.env.local` (or `.env` for operator scripts) and populate only values appropriate to your environment. Do not commit populated environment files.

```powershell
npm install
npm run test:run
npm run lint
npm run typecheck
npm run build
npm run contract:lint
npm run contract:schema
npm run contract:validate
wsl.exe -e bash -lc "cd /mnt/c/.../aidtrail && gltest tests/direct -v"
npm run deploy:dry-run
```

Use `npm run dev` for the frontend. The verified Studionet deployment is `0x68848ba962a2ff80F1CEC4529A4c79d5D35f2C3C`; set it in `NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS`. Connect a Studionet wallet to create, fund, submit evidence, challenge, finalize, expire, deposit credit, or withdraw. Every terminal UI success needs a finalized receipt and matching readback.

Integration tests are available as `npm run contract:integration`; they require a suitable GenLayer endpoint and are not a substitute for the post-deployment verifier.

## Deployment and verification

1. Review the direct tests, contract lint/schema/validation, and [proof matrix](docs/proof-matrix.md).
2. Set `AIDTRAIL_NETWORK=studionet`, the official SDK Studionet RPC URL, and an operator private key in an untracked environment file.
3. Run `npm run deploy:dry-run`; review its source hash and dependency pin. Only after human confirmation, run `npx tsx scripts/deploy.ts --execute`.
4. Record the finalized deployment transaction, address, execution result, source/schema readback, and safe reads using `npm run verify:live -- <real-address>`.
5. Replace only the corresponding `Not yet executed` cells in the proof matrix with observed evidence.

The verifier fails closed if there is no real address, an endpoint mismatch, a source mismatch, a schema mismatch, or unavailable readback. It writes its observed JSON to ignored `docs/live-verification.json` by default. Never invent an address or transaction hash.

## Upgrades, recovery, and limits

AidTrail is upgradable on testnet by the deployer. Compatible upgrades preserve storage declaration order; incompatible changes require a new deployment and a proven migration inventory. The documented rollback, freeze, and withdrawal-evidence procedures are in [docs/recovery-runbook.md](docs/recovery-runbook.md). Removing all upgraders is irreversible.

Known testnet limits: only the deployment and safe readbacks are proven live so far; end-to-end actor workflow rows remain marked unexecuted in the proof matrix. The app relies on external wallet/network availability; evidence availability and consensus can yield non-settling results; and testnet GEN is simulated only.

## Observed local release gate — 2026-08-12

| Check | Observed result |
| --- | --- |
| `gltest tests/direct -v` (WSL) | 107 passed in 8.08s |
| `genvm-lint lint contracts/AidTrail.py` | Passed (2 checks), with warnings recommending `gl.vm.UserError` instead of bare `ValueError` |
| `genvm-lint schema contracts/AidTrail.py` | Generated 18 methods (9 view, 9 write) |
| `genvm-lint validate contracts/AidTrail.py` | Passed; 18 methods |
| `npm run test:run` | 34 passed in 8 test files |
| `npm run lint`, `npm run typecheck`, `npm run build` | Passed |
| `npm run deploy:dry-run` | Passed; produced null address/transaction/deployer as expected and source hash `0x43e80fa976b74900a06a71374f9ce251f0be92f627eed45948eda9ddcf1bb637` |
| `npm run verify:live -- 0x68848ba962a2ff80F1CEC4529A4c79d5D35f2C3C` | Passed on Studionet chain `61999`: exact source hash and full schema match; safe reads returned storage version `1`, zeroed accounting, and the address-bound evidence domain |

Contract-to-frontend parity was reviewed against the generated schema: all fourteen contract-facade operations map to exact schema names—eight writes (`create_grant`, `fund_grant`, `submit_evidence`, `challenge_milestone`, `finalize_milestone`, `expire_grant`, `deposit_challenge_credit`, `withdraw_credit`) and six reads (`get_grant`, `list_grants`, `get_milestone`, `get_summary`, `get_credit`, `get_evidence_domain`). The schema also exposes `upgrade`, `storage_version`, and evidence/challenge-record reads for operator/audit use. Direct tests cover contract actions; frontend component/unit tests cover forms, action availability, facade mapping, transaction/readback behavior, and rendering. Future terminal actions are represented in the proof matrix.

## Repository hygiene audit — 2026-08-12

`.gitignore` excludes environment files except this names-only example, runtime/build outputs, dependencies, caches, logs, worktrees, local `.superpowers` additions, and verifier output. The tracked-file scan found no populated operator environment assignment or 32-byte private-key pattern; the one 32-byte hexadecimal value in integration tests is a fixture transaction topic, not a credential. Two pre-existing `.superpowers` task reports remain tracked from earlier work; this release-candidate commit does not add instruction files, chat logs, work directories, caches, dependencies, generated build output, or fake deployment addresses.
