# AidTrail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, test, deploy, and verify a complete GenLayer milestone-based community-grant application whose Intelligent Contract evaluates bound public evidence and settles simulated Studionet GEN escrow.

**Architecture:** A single upgradable Python Intelligent Contract owns grant plans, milestone state, evidence decisions, appeal bonds, custody, and settlement. A Next.js App Router frontend uses separate read and injected-wallet write clients, derives all workflow state from contract reads, and tracks consensus status through final execution and readback. Direct tests mock nondeterminism; Studionet integration tests and browser checks prove the deployed contract and UI.

**Tech Stack:** Python GenLayer Intelligent Contracts, `gltest`/`pytest`, GenLayer CLI, Next.js 16, React 19, strict TypeScript, Tailwind CSS 4, `genlayer-js`, Vitest, Testing Library, ESLint, Vercel.

## Global Constraints

- Studionet GEN is simulated testnet value and must never be described as real money or production settlement.
- The contract is `UPGRADABLE` for testnet; deployer authority, storage compatibility, recovery, migration, and freeze limitations must be documented and tested.
- The Intelligent Contract is the sole authority for verdicts, recipients, amounts, workflow state, custody, and settlement.
- Evidence replay domain is network + contract + grant + milestone + submission/challenge nonce + action.
- Evidence failure defaults to `REQUEST_MORE_INFO` or `UNRESOLVED`, never approval, payout, or refund.
- Frontend success requires consensus `FINALIZED`, execution success, and authoritative contract readback.
- No private key, wallet secret, GitHub credential, or `VERCEL_TOKEN` may enter source, logs, manifests, fixtures, or committed environment files.
- Real source and `.env` files may not contain placeholder contract addresses.
- GitHub push, contract deployment, and Vercel deployment each require action-time user confirmation of the exact identity and target.
- Public assets must be original or suitably licensed, with attribution recorded where required.

---

## File and responsibility map

- `contracts/AidTrail.py`: storage types, authorization, evidence consensus, state machine, custody, views, and upgrade entrypoint.
- `tests/direct/conftest.py`: direct VM fixture, addresses, clock, web/LLM mocks, and reusable valid plans/evidence.
- `tests/direct/test_grants.py`: plan creation, funding, immutable terms, indexing, and authorization.
- `tests/direct/test_evidence.py`: primary evaluation, evidence binding, abstention, retry, and replay.
- `tests/direct/test_challenges.py`: challenge credit, appeal, bond outcomes, provisional windows, and permissionless finalization.
- `tests/direct/test_accounting_upgrade.py`: conservation, double-execution resistance, expiry/refunds, credits, and upgrade lifecycle.
- `tests/integration/test_aidtrail_integration.py`: fresh Studionet deploy and live workflow proof.
- `gltest.config.yaml`: direct and Studionet test configuration.
- `scripts/deploy.ts`: confirmed-network deployment and deployment-manifest output without secret logging.
- `scripts/verify-live.mjs`: schema/source/address/accounting readback and transaction evidence collector.
- `src/lib/genlayer/config.ts`: validated public network and deployed-address configuration.
- `src/lib/genlayer/schema.ts`: contract method schema and raw result types.
- `src/lib/genlayer/read-client.ts`: wallet-free reads.
- `src/lib/genlayer/write-client.ts`: injected-wallet connection and writes.
- `src/lib/genlayer/contract.ts`: typed domain reads/writes and post-write reconciliation.
- `src/lib/domain.ts`: grant, milestone, evidence, accounting, and transaction domain types.
- `src/lib/format.ts`: GEN, address, date, state-label, and countdown formatting.
- `src/lib/transaction-state.ts`: pure transaction lifecycle reducer.
- `src/components/providers/wallet-provider.tsx`: injected wallet/network state.
- `src/components/providers/transaction-provider.tsx`: consensus polling, execution verification, and readback lifecycle.
- `src/components/layout/app-shell.tsx`: responsive navigation and footer.
- `src/components/grants/*`: hero, filters, cards, progress, trust badges, and lists.
- `src/components/grant/*`: overview, milestone timeline, evidence, activity, and role actions.
- `src/components/forms/*`: sponsor plan wizard, evidence pack form, challenge form, and funding confirmation.
- `src/app/*`: Explore, detail, create, dashboard, loading, error, and not-found routes.
- `src/**/*.test.ts(x)`: formatter, schema, action gating, reducer, and component-state tests.
- `public/*`: original AidTrail marks and licensed/attributed project imagery.
- `README.md`: setup, architecture, trust model, usage, testing, deployment, evidence, and limitations.
- `docs/deployment-manifest.json`: fixed live deployment facts after confirmed deployment.
- `docs/recovery-runbook.md`: upgrade, rollback, migration, and freeze procedure.
- `docs/proof-matrix.md`: final transaction/readback/source/test mapping.

---

### Task 1: Project toolchain and contract skeleton

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `gltest.config.yaml`
- Create: `contracts/AidTrail.py`
- Create: `tests/direct/conftest.py`
- Create: `tests/direct/test_grants.py`

**Interfaces:**
- Consumes: approved state names and roles from the design spec.
- Produces: `AidTrail(gl.Contract)`, `create_grant(...) -> str`, `get_grant(grant_id: str) -> dict`, `get_milestone(grant_id: str, milestone_index: u256) -> dict`, and deterministic IDs `ATG-{n}`.

- [ ] **Step 1: Scaffold the pinned frontend and test toolchain**

Create scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:run`, `contract:test`, `contract:integration`, and `verify:live`. Pin `genlayer-js` to the verified current SDK release used by the contract schema, and commit the generated npm lockfile. Configure Vitest for jsdom and strict TypeScript with `noEmit`.

- [ ] **Step 2: Write the first failing direct test**

```python
def test_create_grant_stores_locked_plan(contract, vm, sponsor, beneficiary, valid_plan):
    with vm.sender(sponsor):
        grant_id = contract.create_grant(*valid_plan).call()
    grant = contract.get_grant(grant_id).call()
    assert grant["grant_id"] == "ATG-1"
    assert grant["sponsor"] == sponsor.as_hex
    assert grant["beneficiary"] == beneficiary.as_hex
    assert grant["status"] == "FUNDING"
    assert grant["milestone_count"] == 3
    assert grant["escrow_target"] == sum(valid_plan.allocations)
```

- [ ] **Step 3: Run the focused test and confirm the missing contract fails**

Run: `gltest tests/direct/test_grants.py::test_create_grant_stores_locked_plan -v`

Expected: failure because `AidTrail` or `create_grant` is not defined.

- [ ] **Step 4: Implement the minimal storage model and creation path**

Define constants, `Grant`, `Milestone`, `EvidenceRecord`, and `ChallengeRecord` storage types; validate one-to-five milestones, exact allocation sum, beneficiary distinct from zero address, future ordered deadlines, bounded strings, and evidence-policy fields. Canonicalize the immutable plan into a deterministic hash stored with the grant. Add deployer to `gl.storage.Root.get().upgraders` in `__init__`.

- [ ] **Step 5: Add validation tests and make them pass**

Cover zero/duplicate actors, empty or six-milestone plans, allocation mismatch, zero amounts, past/unordered deadlines, excessive strings, unsupported schema version, and grant indexing. Run `gltest tests/direct/test_grants.py -v` and require all tests to pass.

- [ ] **Step 6: Run contract validation and frontend toolchain smoke checks**

Run `npm run lint`, `npm run typecheck`, `npm run test:run`, and GenLayer contract schema/validation. Expected: zero warnings promoted to errors and a schema containing the creation and read methods.

- [ ] **Step 7: Commit the independently usable skeleton**

```text
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts gltest.config.yaml contracts tests/direct
git commit -m "feat: establish AidTrail contract and toolchain"
```

### Task 2: Escrow funding, accounting, and public reads

**Files:**
- Modify: `contracts/AidTrail.py`
- Modify: `tests/direct/conftest.py`
- Modify: `tests/direct/test_grants.py`
- Create: `tests/direct/test_accounting_upgrade.py`

**Interfaces:**
- Consumes: `Grant`, `Milestone`, and `ATG-{n}` from Task 1.
- Produces: `fund_grant(grant_id)` payable, `get_summary() -> dict`, `list_grants(offset: u256, limit: u256) -> list`, `get_credit(owner: Address) -> u256`, and `withdraw_credit() -> None`.

- [ ] **Step 1: Write failing funding and conservation tests**

```python
def test_exact_funding_activates_and_reserves_all_milestones(contract, vm, sponsor, grant):
    with vm.sender(sponsor), vm.value(grant.escrow_target):
        contract.fund_grant(grant.grant_id).call()
    summary = contract.get_summary().call()
    stored = contract.get_grant(grant.grant_id).call()
    assert stored["status"] == "ACTIVE"
    assert stored["reserved"] == grant.escrow_target
    assert summary["grant_inflows"] == summary["reserved_milestone_escrow"]

def test_non_sponsor_funding_is_rejected(contract, vm, stranger, grant):
    with vm.sender(stranger), vm.value(1):
        with pytest.raises(Exception):
            contract.fund_grant(grant.grant_id).call()
```

- [ ] **Step 2: Run the tests and confirm missing funding behavior**

Run: `gltest tests/direct/test_grants.py tests/direct/test_accounting_upgrade.py -v`

Expected: the new tests fail because funding/accounting views are absent.

- [ ] **Step 3: Implement sponsor-only funding and credit accounting**

Accept partial payments only from the sponsor. On the transaction that reaches the target, reserve each milestone allocation and activate the grant. Credit any excess to sponsor withdrawable credit. Reject zero payment, terminal grants, and funding after activation. Implement pagination capped at 50 items.

- [ ] **Step 4: Implement safe credit withdrawal**

Zero the caller's credit before `gl.message.emit_transfer`; reject zero credit. Add direct tests for excess funding, repeated funding, second withdrawal, and balance conservation.

- [ ] **Step 5: Verify the invariant after every funding branch**

Assert in tests:

```python
assert (
    summary["grant_inflows"] + summary["challenge_credit_inflows"]
    == summary["available"] + summary["reserved_milestone_escrow"]
    + summary["completed_payouts"] + summary["completed_refunds"]
    + summary["available_credits"] + summary["reserved_bonds"]
    + summary["returned_bonds"] + summary["slashed_bonds"]
)
```

Run the complete direct suite and require PASS.

- [ ] **Step 6: Commit escrow funding**

```text
git add contracts/AidTrail.py tests/direct
git commit -m "feat: add solvent milestone escrow funding"
```

### Task 3: Bound evidence evaluation and safe abstention

**Files:**
- Modify: `contracts/AidTrail.py`
- Modify: `tests/direct/conftest.py`
- Create: `tests/direct/test_evidence.py`

**Interfaces:**
- Consumes: active grants, milestones, and accounting from Tasks 1–2.
- Produces: `submit_evidence(grant_id: str, milestone_index: u256, evidence_json: str) -> None`, immutable evidence history, and verdicts `PROVISIONAL_APPROVAL`, `PROVISIONAL_REJECTION`, `REQUEST_MORE_INFO`, `UNRESOLVED`.

- [ ] **Step 1: Write failing happy-path and authorization tests**

```python
def test_bound_evidence_creates_provisional_approval(active_grant, contract, vm, beneficiary, valid_pack):
    with vm.sender(beneficiary):
        contract.submit_evidence(active_grant, 0, json.dumps(valid_pack)).call()
    milestone = contract.get_milestone(active_grant, 0).call()
    assert milestone["status"] == "PROVISIONAL_APPROVAL"
    assert milestone["submission_nonce"] == 1
    assert milestone["evidence_pack_hash"].startswith("0x")
    assert milestone["reserved_amount"] > 0

def test_only_beneficiary_can_submit(active_grant, contract, vm, stranger, valid_pack):
    with vm.sender(stranger):
        with pytest.raises(Exception):
            contract.submit_evidence(active_grant, 0, json.dumps(valid_pack)).call()
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `gltest tests/direct/test_evidence.py -v`

Expected: failure because evidence submission and consensus are absent.

- [ ] **Step 3: Implement deterministic evidence preflight**

Parse a bounded JSON string; require exact schema version, action, network, contract replay marker, grant, milestone, nonce, issuer, subject, dates, URLs, hashes, and minimum independent sources. Reject reuse of the canonical pack hash in the same replay domain before nondeterministic calls. Require beneficiary sender and an eligible nonterminal state.

- [ ] **Step 4: Implement safe fetch and comparative consensus**

Fetch the beneficiary report and up to two independent sources with bounded response sizes and explicit `[FETCH_UNAVAILABLE]` markers. In `prompt_comparative`, require validators to compare subject, place, dates, criteria, provenance, independence, contradictions, and completion facts. Parse only the finite result schema; clamp malformed output, unknown enums, or unsafe confidence to `UNRESOLVED`.

- [ ] **Step 5: Add adversarial evidence tests**

Test stale dates, wrong project/milestone, wrong nonce/action, edited hash/version, duplicate pack, missing independent source, unavailable sources, contradictory sources, malformed JSON/result, unknown verdict, prompt-injection content, `REQUEST_MORE_INFO`, and `UNRESOLVED`. Confirm none changes reserved/payout/refund accounting.

- [ ] **Step 6: Add retry-history tests**

Prove a beneficiary can resubmit from `REQUEST_MORE_INFO` or `UNRESOLVED` with nonce + 1, cannot replay the old pack, and cannot overwrite prior evidence records.

- [ ] **Step 7: Run the full direct suite and commit**

Run `gltest tests/direct -v`. Expected: all tests pass with no skipped promoted branch.

```text
git add contracts/AidTrail.py tests/direct
git commit -m "feat: evaluate bound milestone evidence"
```

### Task 4: Challenges, provisional windows, and settlement

**Files:**
- Modify: `contracts/AidTrail.py`
- Create: `tests/direct/test_challenges.py`
- Modify: `tests/direct/test_accounting_upgrade.py`

**Interfaces:**
- Consumes: provisional decisions and evidence history from Task 3.
- Produces: `deposit_challenge_credit()` payable, `challenge_milestone(...)`, `finalize_milestone(...)`, `expire_grant(...)`, challenge history, payouts, sponsor refund credits, and fixed bond destinations.

- [ ] **Step 1: Write failing challenge and permissionless-finalization tests**

```python
def test_third_party_finalizes_approval_after_window(approved, contract, vm, keeper):
    vm.set_datetime(approved.challenge_deadline_plus_one)
    with vm.sender(keeper):
        contract.finalize_milestone(approved.grant_id, approved.index).call()
    milestone = contract.get_milestone(approved.grant_id, approved.index).call()
    assert milestone["status"] == "PAID"
    assert milestone["execution_complete"] is True

def test_challenge_requires_predeposited_credit(approved, contract, vm, challenger, counter_pack):
    with vm.sender(challenger):
        with pytest.raises(Exception):
            contract.challenge_milestone(approved.grant_id, approved.index, json.dumps(counter_pack)).call()
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `gltest tests/direct/test_challenges.py -v`

Expected: missing methods and states fail.

- [ ] **Step 3: Implement challenge credit and appeal consensus**

Deposit challenge credit deterministically. Reserve the exact configured bond before appeal; bind counter-evidence to original decision nonce and challenge nonce. Appeal reads first-round facts from storage, fetches counter-evidence and corroboration, and returns direction-specific upheld/overturned state or `UNRESOLVED`.

- [ ] **Step 4: Implement fixed bond outcomes**

On decision change, return bond to challenger credit. On uphold, slash it to beneficiary credit. On `UNRESOLVED`, return it to challenger credit and preserve milestone escrow. Add tests for each outcome, late/duplicate challenges, and malformed/replayed counter-evidence.

- [ ] **Step 5: Implement permissionless settlement and expiry**

After the challenge window, finalize an approval by updating reserved/payout accounting and terminal flags before emitting the exact beneficiary transfer. Finalize a rejection by moving the exact allocation to sponsor credit. After deadline + cure period, allow any keeper to expire eligible nonterminal milestones and credit refunds. Derive grant `COMPLETED`, `REFUNDED`, or `EXPIRED` only from milestone terminal states.

- [ ] **Step 6: Test terminal safety and conservation**

Cover early finalization, active challenge, `UNRESOLVED`, double payout, double refund, repeated expiry, wrong milestone, payout recipient/amount, sponsor refund credit, and full conservation after mixed outcomes.

- [ ] **Step 7: Run and commit**

Run `gltest tests/direct -v` and require complete PASS.

```text
git add contracts/AidTrail.py tests/direct
git commit -m "feat: add challenge and settlement workflow"
```

### Task 5: Upgrade lifecycle, deployment script, and live integration suite

**Files:**
- Modify: `contracts/AidTrail.py`
- Modify: `tests/direct/test_accounting_upgrade.py`
- Create: `tests/fixtures/AidTrailV2.py`
- Create: `tests/integration/test_aidtrail_integration.py`
- Create: `scripts/deploy.ts`
- Create: `scripts/verify-live.mjs`
- Create: `docs/recovery-runbook.md`
- Create after confirmed deployment: `docs/deployment-manifest.json`

**Interfaces:**
- Consumes: complete contract surface from Tasks 1–4.
- Produces: `upgrade(new_code: bytes)`, a repeatable deploy command, live readback verifier, and integration proof fixtures.

- [ ] **Step 1: Write failing upgrade lifecycle tests**

```python
def test_unauthorized_upgrade_fails(contract, vm, stranger, v2_code):
    with vm.sender(stranger):
        with pytest.raises(Exception):
            contract.upgrade(v2_code).call()

def test_authorized_upgrade_preserves_grants(factory, deployed_contract, sponsor, v2_code):
    before = deployed_contract.get_grant("ATG-1").call()
    tx = deployed_contract.upgrade(args=[v2_code]).transact(from_=sponsor)
    assert tx_execution_succeeded(tx)
    upgraded = factory.v2.build_contract(deployed_contract.address)
    assert upgraded.get_grant(args=["ATG-1"]).call() == before
    assert upgraded.storage_version(args=[]).call() == 2
```

- [ ] **Step 2: Implement upgrade and recovery documentation**

Replace root code only through root upgrader authorization. Keep storage declarations append-only in the V2 fixture. Document exact rollback to compatible prior source, migration when layout cannot remain compatible, source-hash verification, and irreversible removal of all upgraders to freeze.

- [ ] **Step 3: Build integration tests around a fresh deployment**

Test deploy/readback, create/fund, real public-fixture consensus, execution status, milestone readback, permissionless finalize, transfer/accounting readback, invalid sender, and one safe rejection/refund branch. Each test checks transaction consensus status and execution result separately.

- [ ] **Step 4: Implement secret-safe deployment and verification scripts**

`scripts/deploy.ts` must fail closed unless network is the confirmed Studionet target and the wallet comes from authenticated CLI/environment configuration. It prints only address, transaction hash, deployer address, source hash, dependency pin, and network. `scripts/verify-live.mjs` accepts the real address as an argument/environment value, compares schema/methods, reads storage version/accounting, and outputs a JSON evidence file without secrets.

- [ ] **Step 5: Run pre-deployment verification only**

Run direct tests, contract validation, and script dry-run/schema checks. Do not deploy. Confirm no manifest or source contains a fake address.

- [ ] **Step 6: Commit the deployable contract package**

```text
git add contracts tests scripts gltest.config.yaml docs/recovery-runbook.md
git commit -m "test: add upgrade and Studionet verification workflow"
```

### Task 6: Typed GenLayer client and transaction lifecycle

**Files:**
- Create: `src/lib/domain.ts`
- Create: `src/lib/format.ts`
- Create: `src/lib/genlayer/config.ts`
- Create: `src/lib/genlayer/schema.ts`
- Create: `src/lib/genlayer/read-client.ts`
- Create: `src/lib/genlayer/write-client.ts`
- Create: `src/lib/genlayer/contract.ts`
- Create: `src/lib/transaction-state.ts`
- Create: `src/lib/format.test.ts`
- Create: `src/lib/transaction-state.test.ts`
- Create: `src/lib/genlayer/contract.test.ts`

**Interfaces:**
- Consumes: exact contract methods and dict shapes from Tasks 1–5.
- Produces: `readGrant`, `listGrants`, `readMilestone`, `readSummary`, `createGrant`, `fundGrant`, `submitEvidence`, `challengeMilestone`, `finalizeMilestone`, `expireGrant`, `depositChallengeCredit`, `withdrawCredit`, and `reduceTransactionState`.

- [ ] **Step 1: Write failing mapper and reducer tests**

```ts
it('does not mark FINALIZED execution error as success', () => {
  const state = reduceTransactionState(initialTx, {
    type: 'receipt', status: 'FINALIZED', execution: 'FINISHED_WITH_ERROR'
  });
  expect(state.phase).toBe('execution_error');
});

it('requires matching readback after successful execution', () => {
  const finalized = reduceTransactionState(initialTx, {
    type: 'receipt', status: 'FINALIZED', execution: 'FINISHED_WITH_RETURN'
  });
  expect(finalized.phase).toBe('verifying_readback');
});
```

- [ ] **Step 2: Run unit tests and verify failure**

Run: `npm run test:run -- src/lib/transaction-state.test.ts src/lib/genlayer/contract.test.ts`

Expected: missing modules fail.

- [ ] **Step 3: Implement domain types and strict raw mappers**

Define finite unions for all grant/milestone/verdict/transaction states. Validate deployed address with `isAddress`; absence is a configuration error for writes and a visible unavailable state for reads. Convert bigint fields without lossy numbers.

- [ ] **Step 4: Implement separate clients and typed contract operations**

Reads use the public Studionet client without a wallet. Writes require injected provider, selected account, and correct network. Every write returns a transaction hash plus a caller-supplied readback predicate keyed to the affected grant/milestone/credit.

- [ ] **Step 5: Implement transaction reducer and polling semantics**

Represent wallet approval, submitted, all consensus stages, retryable timeout/undetermined, finalized execution failure, verifying readback, readback mismatch, and success. Only matching readback transitions to success.

- [ ] **Step 6: Run tests, lint, typecheck, and commit**

Run `npm run test:run`, `npm run lint`, and `npm run typecheck`; require zero failures.

```text
git add src/lib package.json package-lock.json vitest.config.ts
git commit -m "feat: add typed GenLayer client lifecycle"
```

### Task 7: Impact Mosaic shell and Explore experience

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/providers.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/app/grants/page.tsx`
- Create: `src/app/grants/loading.tsx`
- Create: `src/app/grants/error.tsx`
- Create: `src/components/layout/app-shell.tsx`
- Create: `src/components/grants/impact-hero.tsx`
- Create: `src/components/grants/grant-filters.tsx`
- Create: `src/components/grants/grant-card.tsx`
- Create: `src/components/grants/grant-list.tsx`
- Create: `src/components/grants/grant-card.test.tsx`
- Create: `public/aidtrail-mark.svg`
- Create: `public/assets/ATTRIBUTION.md`

**Interfaces:**
- Consumes: `listGrants`, `readSummary`, formatters, and domain types from Task 6.
- Produces: responsive public Explore UI and reusable `GrantCard({grant})`.

- [ ] **Step 1: Write failing card-state tests**

```tsx
it('shows exact contract progress and simulated-value label', () => {
  render(<GrantCard grant={fundedGrantFixture} />);
  expect(screen.getByText('2 of 3 milestones paid')).toBeInTheDocument();
  expect(screen.getByText('320 GEN')).toBeInTheDocument();
  expect(screen.getByText(/simulated Studionet value/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement the visual system without copied assets**

Create CSS tokens for cobalt, coral, mint, yellow, ink, neutral surfaces, radii, shadows, focus rings, and reduced motion. Recreate the approved Impact Mosaic composition with an original SVG trail motif and properly attributed/openly licensed project imagery; do not copy Giveth imagery, logo, or geometry.

- [ ] **Step 3: Implement server/read-driven discovery states**

Render hero metrics, search, categories, state filters, sort, pagination, rich cards, empty results, skeletons, and retryable read errors. Use query parameters for shareable filters. Ensure card badges map to exact contract states and never imply payout before `PAID`.

- [ ] **Step 4: Verify responsiveness and accessibility in tests**

Test headings, link names, status text, image alt text, keyboard-visible controls, and no color-only status. Run component tests, lint, typecheck, and build.

- [ ] **Step 5: Commit Explore**

```text
git add src/app src/components/layout src/components/grants public
git commit -m "feat: build Impact Mosaic grant discovery"
```

### Task 8: Wallet providers, grant detail, and role-aware actions

**Files:**
- Create: `src/components/providers/wallet-provider.tsx`
- Create: `src/components/providers/transaction-provider.tsx`
- Create: `src/components/wallet/wallet-button.tsx`
- Create: `src/app/grant/[grantId]/page.tsx`
- Create: `src/app/grant/[grantId]/loading.tsx`
- Create: `src/app/grant/[grantId]/not-found.tsx`
- Create: `src/components/grant/grant-overview.tsx`
- Create: `src/components/grant/milestone-timeline.tsx`
- Create: `src/components/grant/evidence-panel.tsx`
- Create: `src/components/grant/activity-panel.tsx`
- Create: `src/components/grant/role-actions.tsx`
- Create: `src/components/grant/role-actions.test.tsx`

**Interfaces:**
- Consumes: read/write methods and reducer from Task 6.
- Produces: `useWallet`, `useTransaction`, public grant detail, exact action gating, and reusable transaction-status UI.

- [ ] **Step 1: Write failing role-action tests**

```tsx
it('offers permissionless finalize to an unrelated connected address', () => {
  render(<RoleActions milestone={finalizableApproval} wallet={strangerWallet} />);
  expect(screen.getByRole('button', {name: /finalize payout/i})).toBeEnabled();
});

it('does not offer evidence submission to a non-beneficiary', () => {
  render(<RoleActions milestone={pendingMilestone} wallet={strangerWallet} />);
  expect(screen.queryByRole('button', {name: /submit evidence/i})).toBeNull();
});
```

- [ ] **Step 2: Implement injected-wallet and network handling**

Support disconnected, connecting, connected, wrong-network, rejected request, provider unavailable, and account/network-change states. Never generate or persist a custodial private key in the browser.

- [ ] **Step 3: Implement detail tabs and evidence provenance**

Show immutable criteria, plan/evidence hashes, source issuer/subject/version/dates, consensus rationale, challenge countdown, complete state timeline, Explorer links, simulated-value disclosure, and all historical submissions/challenges.

- [ ] **Step 4: Implement role and permissionless action gating**

Sponsor sees funding and refundable credit; beneficiary sees eligible evidence/cure actions; any funded challenger sees challenge action during the window; any connected address sees eligible finalize/expire actions. Disabled actions state the precise contract precondition.

- [ ] **Step 5: Connect transaction provider to execution and readback**

Poll status, inspect execution result, then refetch affected state until the predicate matches or display a reconciliation error. Persist only non-sensitive transaction hashes for refresh recovery.

- [ ] **Step 6: Test and commit**

Run unit/component tests, lint, typecheck, and build.

```text
git add src/components/providers src/components/wallet src/components/grant src/app/grant
git commit -m "feat: add wallet-aware grant workflow"
```

### Task 9: Sponsor, beneficiary, challenge, and dashboard forms

**Files:**
- Create: `src/app/grants/new/page.tsx`
- Create: `src/app/dashboard/page.tsx`
- Create: `src/components/forms/grant-plan-wizard.tsx`
- Create: `src/components/forms/fund-grant-form.tsx`
- Create: `src/components/forms/evidence-form.tsx`
- Create: `src/components/forms/challenge-form.tsx`
- Create: `src/components/forms/credit-form.tsx`
- Create: `src/components/forms/forms.test.tsx`
- Create: `src/components/dashboard/dashboard-client.tsx`

**Interfaces:**
- Consumes: all typed writes, wallet/transaction contexts, and contract constraints.
- Produces: complete user-facing creation, funding, evidence, challenge, credit, and reconciliation workflows.

- [ ] **Step 1: Write failing validation and consequence-preview tests**

```tsx
it('blocks a plan whose allocations do not equal escrow target', async () => {
  render(<GrantPlanWizard />);
  await fillPlan({target: '100', allocations: ['30', '30', '30']});
  expect(screen.getByText(/allocations must total 100 GEN/i)).toBeInTheDocument();
  expect(screen.getByRole('button', {name: /review and sign/i})).toBeDisabled();
});

it('shows challenge bond destination before signing', () => {
  render(<ChallengeForm milestone={challengeableFixture} />);
  expect(screen.getByText(/returned if decision changes/i)).toBeInTheDocument();
  expect(screen.getByText(/credited to beneficiary if upheld/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement grant wizard with immutable review**

Use stepwise project identity, milestone criteria, evidence policy, economics, dates, and final canonical summary. Validate one-to-five milestones, exact sums, chronological dates, bounded fields, minimum independent sources, and sponsor/beneficiary addresses before enabling signature.

- [ ] **Step 3: Implement evidence and challenge forms**

Collect every bound field defined in the contract schema; compute a preview of the canonical pack; show freshness, immutability, replay-domain, bond, and possible consequence explanations. Never upload evidence to an AidTrail backend; submit public URLs and their integrity metadata directly to the contract.

- [ ] **Step 4: Implement dashboard and all async states**

Show sponsored grants, beneficiary tasks, provisional/challenge deadlines, credits, and recoverable actions. Add skeleton, empty, read-error, wrong-network, signature-rejected, consensus-timeout, execution-error, readback-mismatch, and success presentations.

- [ ] **Step 5: Run complete frontend verification and commit**

Run `npm run test:run`, `npm run lint`, `npm run typecheck`, and `npm run build`; require all PASS.

```text
git add src/app/grants/new src/app/dashboard src/components/forms src/components/dashboard
git commit -m "feat: complete AidTrail user workflows"
```

### Task 10: Documentation, repository audit, and pre-deployment release candidate

**Files:**
- Create: `README.md`
- Create: `.env.example`
- Create: `docs/proof-matrix.md`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: the complete local application.
- Produces: a reviewable, secret-clean release candidate ready for user-confirmed external actions.

- [ ] **Step 1: Write complete operator and user documentation**

Document product use, actors, exact decision/consequence, trust matrix, evidence schema, state machine, custody invariant, simulated GEN disclaimer, local setup, direct/integration tests, environment variable names without values, deploy/readback flow, frontend use, upgradability/recovery, limitations, and evidence links.

- [ ] **Step 2: Create a proof-matrix template with no fabricated facts**

Use columns Actor, Action, Contract method, Transaction hash, consensus status, execution result, readback, and source/test. Before deployment, rows explicitly say `Not yet executed`; they are replaced only with actual observed evidence after confirmed actions.

- [ ] **Step 3: Run the full local release gate**

Run contract validation, `gltest tests/direct -v`, frontend unit tests, ESLint, TypeScript, production build, and deployment-script dry-run/schema verification. Save concise command results in README only after observing them.

- [ ] **Step 4: Audit repository hygiene and secrets**

Inspect staged/untracked files; scan tracked content for private-key patterns, tokens, credentials, local instruction files, chat logs, `.superpowers`, `work`, caches, dependencies, build output, and fake addresses. Confirm `.env.example` contains names and documentation only.

- [ ] **Step 5: Review contract-to-frontend parity**

Compare every frontend method/state/type to the generated contract schema. Confirm all advertised actions have direct and/or component tests and every terminal claim maps to a future proof-matrix row.

- [ ] **Step 6: Commit the release candidate**

```text
git add README.md .env.example .gitignore docs package.json package-lock.json
git commit -m "docs: prepare AidTrail release candidate"
```

### Task 11: Action-time identity confirmation and Studionet deployment

**Files:**
- Create from actual output: `docs/deployment-manifest.json`
- Modify with actual evidence: `README.md`
- Modify with actual evidence: `docs/proof-matrix.md`
- Create ignored local configuration: `.env.local`

**Interfaces:**
- Consumes: verified release candidate and deployment scripts.
- Produces: actual contract address, deployment transaction, Explorer link, live workflow transaction hashes, and fixed readbacks.

- [ ] **Step 1: Stop and collect identity context without deploying**

Read Git author, active GitHub CLI account, repository remote/owner, available deployment wallet address, selected GenLayer network, Vercel account/team/project, and presence—not value—of required environment variables.

- [ ] **Step 2: Ask for exact action-time confirmation**

State the exact deployment wallet address, target network, source commit/hash, GitHub repository target, and Vercel team/project. Do not proceed until the user explicitly confirms the contract deployment action and identity context.

- [ ] **Step 3: Deploy and verify the contract after confirmation**

Run the deploy script once, capture actual address and transaction, wait for `FINALIZED`, confirm execution success, verify schema/source hash, and perform initial reads. If execution fails, retain the evidence and diagnose; do not represent it as a deployment.

- [ ] **Step 4: Run live integration and promoted workflow proofs**

Run the fresh-deployment integration suite. Execute the happy path and important terminal/refund branch, collecting each transaction's consensus status, execution result, readback, accounting summary, and Explorer URL. Prove a third-party keeper can finalize if the product claims permissionless finalization.

- [ ] **Step 5: Record only observed deployment facts**

Write manifest, `.env.local` deployed address, README deployment section, and proof matrix. Re-run schema verification and the frontend production build against the real address.

- [ ] **Step 6: Commit deployment evidence locally**

```text
git add docs/deployment-manifest.json docs/proof-matrix.md README.md
git commit -m "docs: record verified Studionet deployment"
```

### Task 12: Confirmed GitHub push, Vercel deployment, and browser evidence

**Files:**
- Modify with actual URLs/evidence: `README.md`
- Modify with browser/live proof: `docs/proof-matrix.md`

**Interfaces:**
- Consumes: confirmed GitHub/Vercel identities, real contract address, and clean local commit.
- Produces: public repository URL, Vercel URL, browser-verified live application, and final evidence package.

- [ ] **Step 1: Stop and reconfirm GitHub push target**

Show Git author, active GitHub account, repository owner/name, remote URL, branch, exact commits, and staged/untracked hygiene result. Push only after explicit confirmation.

- [ ] **Step 2: Push the confirmed repository and verify commit identity**

Create or use only the confirmed repository, push the verified branch, then read the remote commit hash and confirm it equals local HEAD. Never push local instructions, raw research, `.env.local`, `.superpowers`, or `work`.

- [ ] **Step 3: Stop and reconfirm Vercel target**

Show the exact Vercel account/team/project, repository/commit, public environment variable names, and intended production action. Confirm `VERCEL_TOKEN` exists without printing it. Deploy only after explicit confirmation.

- [ ] **Step 4: Deploy frontend and verify the URL**

Use the supplied environment token through the CLI environment only. Capture production URL and deployment ID. Confirm the deployed frontend points at the verified contract address and no token is present in build output or source.

- [ ] **Step 5: Run browser verification on desktop and mobile**

Exercise Explore, filters, grant detail, disconnected reads, wallet connection, real write, consensus progress, execution success, readback, refresh reconciliation, error/empty states, responsive layout, keyboard focus, image/alt behavior, Explorer links, and console errors. Record screenshots or transaction links only when they contain no secret/private data.

- [ ] **Step 6: Run final fixed verification and update evidence**

Re-run lint, typecheck, unit tests, direct tests, integration tests, build, live schema/source verification, and public smoke test. Update README and proof matrix with exact commit, source hash, repository, Vercel URL, contract address, transactions, results, limitations, and browser proof.

- [ ] **Step 7: Commit and, after another exact push confirmation if required by policy, publish final evidence**

```text
git add README.md docs/proof-matrix.md
git commit -m "docs: publish AidTrail verification evidence"
```

The task is complete only after remote commit equality, live contract readback, live frontend interaction, and every advertised material claim has a proof-matrix row or is disclosed as a limitation.
