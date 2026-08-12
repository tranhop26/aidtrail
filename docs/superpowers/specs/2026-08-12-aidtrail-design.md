# AidTrail Design Specification

**Date:** 2026-08-12

**Status:** Approved design; implementation not started

**Network target:** GenLayer Studionet/testnet

**Contract classification:** `UPGRADABLE` for the testnet phase

## 1. Product definition

AidTrail is a milestone-based community grant platform. A sponsor commits a complete grant plan and escrows simulated Studionet GEN for one beneficiary. The beneficiary submits public evidence for each milestone. GenLayer validators independently retrieve and semantically evaluate that evidence against the immutable milestone criteria. A successful evaluation creates a provisional decision; after a challenge window, a permissionless finalizer applies the on-chain payout or refund.

AidTrail targets field-based community projects such as water access, education, health, food security, and local infrastructure. It is not an insurance product, weather oracle, generic donation directory, or minimally modified version of Rainline.

Studionet GEN is simulated testnet value. The application and README must not describe it as real money or production settlement.

## 2. Problem and GenLayer fit

Conventional milestone grants usually leave one party in control of evidence review. A sponsor can delay or reject payment after work is complete; a beneficiary can submit one-sided or unrelated reports; a centralized platform can hide or override its decision. A deterministic smart contract cannot judge whether reports from multiple public sources describe the correct project, time period, location, deliverable, and acceptance criteria.

GenLayer establishes this exact decision:

> Does the bound public evidence prove that the specified milestone was completed for the specified project, according to the criteria and evidence policy committed before funding, within the allowed time, with sufficient provenance and consistency?

The exact on-chain consequence is one of:

- create `PROVISIONAL_APPROVAL`, later allowing the milestone's fixed escrow amount to be paid to the beneficiary;
- create `PROVISIONAL_REJECTION`, later allowing the milestone's reserved amount to be refunded according to the locked grant policy;
- enter `REQUEST_MORE_INFO`, allowing a new evidence submission without moving value;
- enter `UNRESOLVED`, retaining escrow safely until a permitted retry or secondary resolution;
- on appeal, uphold or overturn the provisional decision before settlement.

The sponsor, beneficiary, challenger, frontend, backend, and contract owner cannot directly select the verdict, recipient, or payout amount.

## 3. Trust model

| Actor | Cannot trust | Manipulation capability | Contract defense | Required test/evidence |
|---|---|---|---|---|
| Sponsor | Beneficiary | Submit unrelated, stale, edited, or one-sided reports | Precommitted criteria; subject/time/version binding; independent-source requirement; validator semantic review | Mismatched subject, stale evidence, missing independent source |
| Beneficiary | Sponsor | Change criteria, cancel funding, or refuse payment after delivery | Plan hash and milestone amounts locked before activation; full escrow; permissionless finalization | Criteria immutability; sponsor cannot cancel active reserved funds |
| Donors/community | Beneficiary | Exaggerate impact or reuse evidence across milestones | Submission nonce, canonical evidence-pack hash, replay domain, provenance checks | Cross-grant, cross-milestone, and repeated-pack replay rejection |
| Beneficiary | Challenger | Submit spam or irrelevant counter-evidence to delay payment | Challenge credit/bond, challenge window, bound counter-evidence, consensus appeal | Missing bond, late challenge, unrelated counter-evidence |
| Sponsor | Challenger | Collude to force a refund | Appeal validators decide against locked criteria; no caller-selected result | Unauthorized or malformed challenge paths |
| All actors | Frontend/backend | Hide status, claim success early, or fabricate a decision | Contract is authoritative; public reads; UI requires `FINALIZED`, execution success, and readback | Browser proof and transaction/readback reconciliation |
| Users | Upgrader | Replace testnet logic or corrupt storage | Explicit upgrader authority, source hash manifest, storage compatibility tests, recovery/freeze runbook | Unauthorized upgrade and state-preserving upgrade tests |

## 4. Roles and authorization

- **Sponsor:** creates the grant plan and is the only address allowed to fund it. May recover only amounts that the locked workflow marks refundable or amounts held as withdrawable credit.
- **Beneficiary:** the only address allowed to submit or resubmit primary milestone evidence.
- **Challenger:** any address may challenge a provisional decision during its window if sufficient pre-deposited challenge credit is available.
- **Keeper/finalizer:** any address may finalize an eligible provisional decision or expire an overdue grant. This role receives no authority over the outcome or amount.
- **Upgrader:** the deployment wallet during the testnet phase. It may invoke the documented upgrade mechanism; no other address may do so.

Reads are public and do not require a connected wallet.

## 5. Grant and milestone model

A grant contains:

- sequential `grant_id` and `schema_version`;
- sponsor and beneficiary addresses;
- project name, organization identity, project reference, region, category, and public description;
- milestone-plan canonical hash;
- total escrow target, funded amount, reserved amount, paid amount, refunded amount, and withdrawable-credit accounting;
- evidence-policy version;
- challenge bond and challenge-window duration;
- grant status and timestamps;
- ordered milestone IDs.

Each milestone contains:

- grant ID, index, immutable criteria, fixed GEN allocation, and criteria hash;
- evidence requirements and minimum independent-source count;
- submission deadline, cure period, and challenge window;
- submission nonce and current evidence-pack hash;
- state, provisional decision, rationale, timestamps, and appeal result;
- payout/refund completion flags.

The plan supports one to five milestones. The sum of milestone allocations must exactly equal the grant escrow target. A grant becomes `ACTIVE` only when the target is fully funded.

## 6. Evidence binding

Every primary evidence pack contains:

- canonical schema version;
- contract, network, grant, milestone, submission nonce, and action replay domain;
- beneficiary report URL, issuer identity, subject/project reference, content version, observation date, publication date, content hash or CID, and submission timestamp;
- up to two independent-source entries with the same provenance fields;
- a canonical pack hash derived from all committed fields.

The configured URLs must be public and directly retrievable by validators. Content-addressed or immutable permalinks are preferred. A dynamic URL requires a content hash and version or publication identifier.

Evidence is valid only when it:

- identifies the same project and milestone;
- covers the relevant location and observation period;
- was published within the configured freshness policy;
- meets the independent-source requirement;
- has parseable provenance and integrity fields;
- has not been used in the same replay domain.

Unavailable, contradictory, stale, malformed, edited, off-subject, or insufficient evidence cannot silently approve or release funds. It produces `REQUEST_MORE_INFO` when the missing facts can reasonably be supplied and `UNRESOLVED` when retrieved evidence or validator consensus cannot support a safe direction.

Counter-evidence is separately bound to the original decision, challenge nonce, challenger, grant, milestone, network, and contract.

## 7. State machine

Grant states:

`FUNDING -> ACTIVE -> COMPLETED | REFUNDED | EXPIRED`

Milestone states:

`PENDING -> EVALUATING -> PROVISIONAL_APPROVAL | PROVISIONAL_REJECTION | REQUEST_MORE_INFO | UNRESOLVED`

`PROVISIONAL_APPROVAL | PROVISIONAL_REJECTION -> CHALLENGED -> UPHELD_APPROVAL | UPHELD_REJECTION | OVERTURNED_TO_APPROVAL | OVERTURNED_TO_REJECTION | UNRESOLVED`

`PROVISIONAL_APPROVAL | UPHELD_APPROVAL | OVERTURNED_TO_APPROVAL -> PAID`

`PROVISIONAL_REJECTION | UPHELD_REJECTION | OVERTURNED_TO_REJECTION -> FAILED -> REFUNDED`

`PENDING | REQUEST_MORE_INFO | UNRESOLVED -> EXPIRED -> REFUNDED` after deadline plus cure period when no active provisional decision or challenge prevents expiry.

| From | Actor | Method | Preconditions | On-chain effect | To | Replay behavior |
|---|---|---|---|---|---|---|
| none | Sponsor | `create_grant` | Valid plan; exact allocation sum; future deadlines | Stores immutable plan and hashes; moves no value | `FUNDING` | Duplicate plan allowed only as a distinct grant ID |
| `FUNDING` | Sponsor | `fund_grant` | Positive value; grant not fully funded | Credits target; excess becomes sponsor credit; reserves milestones when fully funded | `FUNDING` or `ACTIVE` | Repeated funding is additive and bounded |
| `PENDING`, `REQUEST_MORE_INFO`, `UNRESOLVED` | Beneficiary | `submit_evidence` | Before deadline/cure cutoff; fresh nonce; valid shape | Runs evaluation consensus and stores verdict/facts | provisional, `REQUEST_MORE_INFO`, or `UNRESOLVED` | Same pack/domain rejected; later nonce permitted |
| Provisional | Anyone with credit | `challenge_milestone` | Window open; no existing challenge; sufficient bond | Reserves bond; runs appeal consensus | direction-specific upheld/overturned state, or `UNRESOLVED` | One challenge per provisional-decision nonce |
| Eligible approval | Anyone | `finalize_milestone` | Challenge window closed; no unresolved challenge; not terminal | Releases exact reserved amount to beneficiary | `PAID` | Repeated call rejected with no value movement |
| Eligible rejection | Anyone | `finalize_milestone` | Appeal window closed; not terminal | Marks allocation refundable; applies locked refund policy | `FAILED`/`REFUNDED` | Repeated call rejected |
| Overdue nonterminal | Anyone | `expire_grant` | Deadline and cure period elapsed | Refunds remaining eligible reserved funds | `EXPIRED`/`REFUNDED` | Idempotent at grant accounting level; double transfer rejected |
| Any credit | Credit owner | `withdraw_credit` | Positive available credit | Transfers exact available credit and zeros it first | unchanged | Second withdrawal rejects/returns zero by specified API behavior |
| Any | Authorized upgrader | `upgrade` | Sender in root upgraders; compatible source | Replaces code, retains storage | unchanged | Each upgrade is separately authorized and manifested |

`UNRESOLVED` never moves escrow. Retry uses a new nonce and does not overwrite historical evidence or decisions.

## 8. Contract surface and consensus

One Intelligent Contract, `contracts/AidTrail.py`, is the authoritative source of truth.

Core writes:

- `create_grant(...)`
- `fund_grant(grant_id)` as payable
- `submit_evidence(grant_id, milestone_index, evidence_pack)`
- `deposit_challenge_credit()` as payable
- `challenge_milestone(grant_id, milestone_index, counter_evidence)`
- `finalize_milestone(grant_id, milestone_index)`
- `expire_grant(grant_id)`
- `withdraw_credit()`
- `upgrade(new_code)`

Views include paginated grant discovery, grant detail, milestone detail, evidence history, challenge history, per-address credit, and global accounting summary.

### Primary evaluation consensus

The leader function uses at most four nondeterministic operations:

1. fetch the beneficiary report;
2. fetch independent source A;
3. fetch independent source B when required or available;
4. run `gl.nondet.exec_prompt` inside `gl.eq_principle.prompt_comparative`.

The prompt treats fetched text as untrusted evidence, not instructions. Validators compare the semantic result against a finite JSON schema containing verdict, confidence band, normalized facts per source, provenance assessment, missing fields, contradictions, and concise rationale. Equivalence must evaluate the substantive verdict and supporting facts, not merely JSON syntax or formatting.

### Appeal consensus

The appeal round uses the first-round facts already stored on-chain, fetches the counter-evidence and one corroborating source, then returns `UPHOLD`, `OVERTURN`, or `UNRESOLVED`. It cannot change the beneficiary, milestone allocation, or locked criteria.

Fetch failures are represented explicitly and degrade to safe abstention. Parsing failures or unknown enum values are clamped to `UNRESOLVED`, never approval.

## 9. Custody and accounting

The contract maintains separate values for:

- grant funding received;
- reserved milestone escrow;
- available/refundable grant funds;
- completed beneficiary payouts;
- completed sponsor refunds;
- deposited challenge credits;
- reserved challenge bonds;
- returned bonds;
- slashed bonds;
- per-address withdrawable credits.

Overfunding does not become an untracked balance. Because only the sponsor can fund a grant, excess is credited to the sponsor's withdrawable ledger. Refundable milestone allocations are also credited to the sponsor and withdrawn separately, avoiding a transfer inside a state-finalization call.

Challenge credit is deposited separately before a challenge so no nondeterministic failure path can strand an attached bond. If appeal consensus changes the effective decision, the bond returns to challenger credit. If it upholds the original decision, the bond is slashed to beneficiary credit. If the appeal is `UNRESOLVED`, the bond returns to challenger credit and the milestone remains unresolved. These destinations are fixed contract rules, not validator-selected fields.

The conservation invariant is:

`grant inflows + challenge-credit inflows = available + reserved milestone escrow + payouts + refunds + available credits + reserved bonds + returned/slashed bond destinations`

All transfers follow checks-effects-interactions style: accounting and terminal flags update before emitting the transfer. Payout, refund, bond return/slash, and credit withdrawal are mutually accounted and protected against double execution.

## 10. Upgradability and recovery

AidTrail is `UPGRADABLE` on testnet. During construction, the deployer is added to the GenLayer root upgrader list. The public upgrade method relies on root-slot authorization and replaces code only for an authorized sender.

Requirements before deployment:

- append-only, versioned storage layout;
- upgrade tests proving unauthorized rejection and preservation of existing grants/accounting;
- deployment manifest with network, deployer, source hash, dependency pin, contract address, and deployment transaction;
- recovery runbook for a faulty upgrade, compatible rollback, migration to a new contract when storage compatibility cannot be preserved, and irreversible freeze procedure;
- explicit disclosure that a single-wallet upgrader is a testnet limitation.

Production use would require a separately approved multisig/timelock design or permanent freeze. The testnet deployment must not be described as trustless or production-ready.

## 11. Frontend architecture and UX

The frontend uses Next.js App Router, strict TypeScript, Tailwind CSS, and `genlayer-js`. A read client supports public browsing without a wallet. A write client uses an injected `window.ethereum` wallet connected to the configured GenLayer network. Secrets, private keys, and tokens are never embedded in source or browser bundles.

The approved visual direction is **Impact Mosaic**: cobalt, coral, mint, and warm yellow; a photographic community-impact hero; trail/milestone motifs; richly imaged cards; rounded layered surfaces; and strong contract-state badges. It borrows discovery principles from Giveth—category chips, filtering, project imagery, owner/freshness signals, and clear detail tabs—without copying Giveth branding, assets, layout, or donation mechanics.

Primary routes:

- `/` and `/grants`: visual grant discovery with search, category, state filter, sort, escrow totals, and paginated contract reads;
- `/grant/[grantId]`: overview, milestones, evidence, and on-chain activity tabs;
- `/grants/new`: sponsor wizard with local validation and immutable-plan review before signing;
- `/dashboard`: role-aware sponsor, beneficiary, challenger, and credit views;
- evidence submission, challenge, finalize, refund/expiry, and credit-withdrawal flows as focused panels or routes.

Every write shows distinct states for wallet approval, submission, `PENDING`, `PROPOSING`, `COMMITTING`, `REVEALING`, `ACCEPTED`, `FINALIZED`, execution success/error, and authoritative readback. `FINALIZED` alone is not displayed as success. Timeout and `UNDETERMINED` states are retryable and do not optimistically advance off-chain state.

Required UI states include skeleton loading, empty lists, read errors, wallet/network errors, rejected signatures, consensus progress, finalized execution failure, `REQUEST_MORE_INFO`, `UNRESOLVED`, provisional countdown, challenge active, terminal payout/refund, and readback mismatch/reconciliation.

The interface is responsive at mobile, tablet, and desktop widths; keyboard navigable; visibly focused; reduced-motion aware; sufficiently contrasted; and usable without color as the only state indicator. Images must have suitable licensing and alt text.

## 12. Testing strategy

### Direct contract tests

Direct `glsim`/pytest tests mock web and LLM behavior while exercising real contract transitions:

- plan shape, allocation equality, deadlines, identity fields, and authorization;
- partial, exact, repeated, and excess funding;
- sponsor cancellation/rule-change rejection after activation;
- primary evidence success, rejection, `REQUEST_MORE_INFO`, and `UNRESOLVED`;
- unavailable, stale, malformed, off-subject, contradictory, version-mismatched, and replayed evidence;
- prompt-injection strings treated as data;
- challenge authorization, credit/bond reservation, late/duplicate challenge, uphold, overturn, and unresolved appeal;
- premature and permissionless finalization;
- cure and expiry branches;
- double payout, double refund, double withdrawal, and repeated callback/retry;
- value conservation and reserved/available solvency after every material transition;
- unauthorized upgrade, compatible upgrade, state preservation, and freeze/migration assumptions.

Every discovered bug receives a regression test.

### Studionet integration tests

Integration tests deploy a fresh contract and cover:

- deployment and initial readback;
- grant creation and exact escrow funding;
- at least one real consensus evidence evaluation with a fixed, reproducible public evidence fixture;
- finalized transaction execution checks and state readback;
- permissionless finalization and payout, or a safe terminal refund branch;
- rejection of unauthorized/invalid writes;
- live accounting conservation.

Integration tests must not accept `UNRESOLVED` as a substitute for a promoted happy path. Network flakiness is reported distinctly from product correctness.

### Frontend and browser verification

- unit tests for schema mapping, formatting, role/action availability, and transaction-state reduction;
- ESLint, strict TypeScript, and production build;
- browser checks for desktop and mobile layouts, wallet connection, real contract read/write, loading/error/success states, refresh reconciliation, Explorer links, accessibility basics, and console errors;
- source/schema verification that the frontend address matches the deployed contract and submitted source.

## 13. Deployment and repository workflow

No GitHub push, contract deployment, or Vercel deployment occurs under the design approval alone. Immediately before each external action, confirm:

- Git author and active GitHub CLI account;
- repository owner/name and remote;
- deployment wallet address and target GenLayer network;
- Vercel account/team and project;
- the exact action about to occur.

The deployment script must consume credentials only from environment variables or existing authenticated tooling. It must never print or persist private keys or `VERCEL_TOKEN`. Real source and environment files must never contain a placeholder contract address; the verified address is applied only after deployment via an ignored local environment file and deployment configuration.

The public repository contains source, tests, lockfiles, non-secret config, deployment manifest, README, and fixed verification evidence. It excludes dependencies, caches, build output, secrets, chat/task files, raw research, visual-companion artifacts, and local instruction files.

## 14. Completion evidence

The project is complete only when the final package contains:

- exact Git commit and source hash;
- public repository URL;
- Studionet contract address and Explorer link;
- deployment transaction hash;
- deployed frontend URL;
- contract validation, direct-test, integration-test, frontend-test, lint, type-check, and build results;
- live happy-path proof and every important promoted terminal branch;
- known limitations;
- proof matrix mapping actor, action, contract method, transaction, consensus/execution status, readback, and source/test.

No claim of real-money safety, production readiness, trustlessness, neutrality, permissionless settlement, successful payout, or verified impact may appear unless the corresponding evidence exists.

## 15. Explicit non-goals

- Fiat or production-value custody.
- Anonymous/private evidence validators cannot retrieve.
- Identity/KYC adjudication.
- A general-purpose crowdfunding marketplace with arbitrary campaigns.
- Sponsor-controlled verdicts or manual backend approval.
- Multiple beneficiaries per grant in the first release.
- Governance tokens, yield, rewards, quadratic funding, or donor reputation.
- More than one appeal round in the first release.

These exclusions keep the first implementation focused on a complete, adversarially tested milestone escrow workflow.
