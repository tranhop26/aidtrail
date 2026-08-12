# AidTrail Task 3 Report: Bound Evidence Evaluation and Safe Abstention

## Scope and files

- `contracts/AidTrail.py`
  - Adds evidence submission, immutable evidence records, replay tracking, evidence-domain reads, and milestone evidence fields.
  - Performs bounded deterministic preflight before any nondeterministic work: beneficiary authorization, active/eligible milestone, deadline, exact JSON schema, replay domain, issuer, locked subject, dates, HTTPS URLs, content hashes, distinct source hosts, source count, and sequential nonce.
  - Fetches exactly one beneficiary report and at most two independent sources, caps each body at 8,192 characters, labels failures `[FETCH_UNAVAILABLE]`, and uses one comparative prompt operation.
  - Treats fetched material as delimited untrusted data; accepts only a finite consensus schema and clamps malformed, unknown, incomplete, contradictory, low-confidence favorable, or unavailable-source favorable results to `UNRESOLVED`.
  - Stores every accepted submission under a monotonic record index. `REQUEST_MORE_INFO` and `UNRESOLVED` permit only a fresh nonce and pack; provisional outcomes are non-retryable. Evaluation itself moves no accounting category.
- `tests/direct/conftest.py`
  - Adds active-grant/evidence-pack fixtures plus narrow direct-VM web/LLM mock helpers.
- `tests/direct/test_evidence.py`
  - Adds 38 behavioral direct tests for authorization, pack binding, safe consensus, fetch failure, prompt injection, replay prevention, immutable history, retries, and no accounting movement.

Storage additions are append-only: the original `Milestone` fields remain in declaration order; Task 3 appends submission nonce, latest pack hash, reserved amount, and evidence count. Contract-level evidence maps are appended after the existing accounting fields.

## TDD evidence

### RED

The inherited Task 3 checkpoint recorded the initial red run of:

```text
wsl.exe --cd '/mnt/c/Users/admin/Documents/Codex/2026-08-12/tham-kh-o-ki-n-tr/.worktrees/aidtrail' /home/tranhop/.local/bin/gltest tests/direct/test_evidence.py -v
```

Result: exit 1; the first evidence tests failed at the contract boundary because `submit_evidence` was absent, including the happy-path and beneficiary-authorization cases. This was the required pre-implementation red state.

### Review correction

During takeover review, the unavailable-source parameterization contained two paths that both expected `UNRESOLVED`, so it did not demonstrate that safe `REQUEST_MORE_INFO` is preserved under an unavailable corroborating source. The test was changed before final verification to independently assert all three observed outcomes:

- an otherwise favorable verdict becomes `UNRESOLVED` when a required source is unavailable;
- a finite `REQUEST_MORE_INFO` remains `REQUEST_MORE_INFO`;
- an `UNRESOLVED` result remains `UNRESOLVED`.

No production behavior changed in this review correction.

### GREEN

```text
wsl.exe --cd '/mnt/c/Users/admin/Documents/Codex/2026-08-12/tham-kh-o-ki-n-tr/.worktrees/aidtrail' /home/tranhop/.local/bin/gltest tests/direct/test_evidence.py -v
```

Result: exit 0; `38 passed in 3.17s`.

```text
wsl.exe --cd '/mnt/c/Users/admin/Documents/Codex/2026-08-12/tham-kh-o-ki-n-tr/.worktrees/aidtrail' /home/tranhop/.local/bin/gltest tests/direct -v
```

Result: exit 0; `62 passed in 5.11s`.

## Mutation and test-quality review

- The new tests name the contract-boundary break each covers and use literal, independently prepared evidence packs/results; mocks provide only web/LLM boundary responses while assertions are against real contract state and accounting reads.
- I temporarily inverted the beneficiary comparison in `submit_evidence` with `apply_patch` and ran:

  ```text
  wsl.exe --cd '/mnt/c/Users/admin/Documents/Codex/2026-08-12/tham-kh-o-ki-n-tr/.worktrees/aidtrail' /home/tranhop/.local/bin/gltest tests/direct/test_evidence.py::test_only_beneficiary_can_submit -v
  ```

  Result: exit 1; `1 failed in 0.49s`, because the stranger call succeeded instead of raising `only beneficiary can submit evidence`. The correct authorization comparison was restored with `apply_patch` before final verification.
- The validation/replay suite separately catches wrong schema/action/network/contract marker/grant/milestone/issuer/subject/date/URL/hash/source count, ensuring deterministic invalid inputs cannot reach consensus or change accounting.
- History/retry tests catch removed replay protection, reused or skipped nonce, record overwrite, and accounting movement. Safe-result tests catch unknown enum, malformed JSON, unsafe confidence, incomplete schema, contradictions, unavailable fetch, and prompt-operation failure becoming favorable.

## Final verification

All commands below were freshly run from the Task 3 worktree.

- `git diff --check`: exit 0.
- `wsl.exe --cd '/mnt/c/Users/admin/Documents/Codex/2026-08-12/tham-kh-o-ki-n-tr/.worktrees/aidtrail' /home/tranhop/.local/bin/gltest tests/direct -v`: exit 0; `62 passed in 5.11s`.
- `$env:PYTHONIOENCODING='utf-8'; genvm-lint lint contracts/AidTrail.py`: exit 0; two AST checks passed. It emits existing bare-`ValueError` style warnings, including pre-Task-3 validation code; no warning is promoted to an error.
- `$env:PYTHONIOENCODING='utf-8'; genvm-lint schema contracts/AidTrail.py`: exit 0; schema lists `submit_evidence`, `get_evidence_domain`, and `get_evidence_record` among 11 methods.
- `$env:PYTHONIOENCODING='utf-8'; genvm-lint validate contracts/AidTrail.py`: exit 0; semantic validation passed with 11 methods (7 view, 4 write).
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test:run`: exit 0; Vitest reports no frontend test files and exits successfully through the existing `--passWithNoTests` configuration.
- `npm run build`: exit 0; Next.js production build compiled and prerendered both routes successfully.

## Environment limitations

- The inherited checkpoint recorded a semantic-validator environment failure, `E101 Failed to load SDK: No module named 'genlayer.py.types'`. A fresh validation run in this checkout passed after setting `PYTHONIOENCODING=utf-8`; therefore that SDK failure is not currently reproducible, but it remains historical environment evidence rather than a contract result.
- The Windows-native direct-test runtime remains unusable in this session: `gltest tests/direct/test_evidence.py -v` fails during fixture deployment before any contract test with `PermissionError [WinError 32]` in `gltest.direct.loader._inject_message_to_fd0` while unlinking its temporary stdin file. The identical suite passes under the installed WSL/Linux gltest environment, which is the execution evidence reported above.
- The linter requires `PYTHONIOENCODING=utf-8` on Windows; without it, its successful-output checkmark causes a CP1252 `UnicodeEncodeError`. This is a console encoding issue, not a lint or validation failure.
- No deployed address is in scope, so live network schema/source verification is intentionally deferred. Direct execution and `genvm-lint` schema/semantic validation cover the Task 3 contract surface.

## Commit

`feat: evaluate bound milestone evidence` — the final immutable commit hash is reported in the task handoff. It is intentionally not embedded here because this report is part of that commit.
