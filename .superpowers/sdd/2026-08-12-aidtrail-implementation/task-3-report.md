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

## Fix round 3: Mixed numeric IPv4 authorities

- Added focused regressions for `0x7f.0.0.1`, `127.0x0.0.1`, and `127.0.0x0.1`. The pre-fix URL command exited 1 with `3 failed, 15 passed`; these forms passed the contract's hostname validation and can be normalized to loopback by standard URL parsers.
- The canonical hostname validator now classifies each authority label as decimal numeric or a valid `0x` hexadecimal numeric token and rejects an authority composed entirely of numeric tokens. Normal dotted DNS names remain valid.
- Focused URL command: exit 0; `18 passed in 1.64s`.
- Full WSL direct suite: exit 0; `97 passed in 7.68s`.
- `$env:PYTHONIOENCODING='utf-8'; genvm-lint validate contracts/AidTrail.py`: exit 0; semantic validation passed with 11 methods (7 view, 4 write).
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

## Fix round 1: Artifact provenance, content authentication, and prompt hardening

### Findings closed

1. Every report/source now has an exact per-artifact schema: `url`, Keccak-256 `content_hash`, `content_version`, artifact `schema_version`, `issuer`, locked `subject`, and `observation_start`, `observation_end`, and `published_at`. The primary issuer must be the beneficiary; sources must declare a different issuer and canonical host. Every artifact subject/date is checked against the immutable grant/milestone.
2. The declared hash authenticates the exact fetched UTF-8 string after the contract's 8,192-character fetch bound. The contract computes `0x` plus `Keccak256(body.encode("utf-8")).hexdigest()` for every fetched artifact before consensus. Any unavailable or mismatched artifact prevents a favorable provisional verdict and clamps it to `UNRESOLVED`.
3. Evidence URLs require HTTPS and a dotted canonical ASCII hostname. Userinfo, all ports (including 443), localhost, single-label names, malformed labels, numeric single-token address forms, IPv6 literals, and IPv4 loopback/private/link-local ranges are rejected before fetch. Canonical lower-case hosts are used for independent-source comparison.
4. `REQUEST_MORE_INFO` is accepted only with at least one bounded, non-empty curable `missing_fields` item and no contradictions; otherwise it clamps to `UNRESOLVED`.
5. The prompt now places the canonical pack and each fetched string in separate UTF-8 hexadecimal payloads. Raw fetched bytes therefore cannot close the XML-like structural delimiters. A direct test captures the actual prompt and proves injected delimiter text is absent while its hex representation is present.
6. `prompt_comparative` is wrapped in the same safe-abstention boundary as `exec_prompt`. The installed GenLayer linter stubs declare `prompt_comparative(fn, principle)` as a normal return value with no no-throw guarantee. In the direct runtime, a substituted wrapper exception is catchable; the direct boundary test proves it produces and stores an `UNRESOLVED` record without accounting movement. `genvm-lint validate` accepts this form.

### Strict TDD and mutation evidence

- Per-artifact schema RED: after replacing the fixture with artifact-local metadata, the pre-fix happy path failed with `ValueError: unexpected evidence field`; the minimal per-artifact validator then made it pass.
- URL canonicalization RED: numeric `https://2130706433/report` and single-label `https://intranet/report` produced `2 failed, 8 passed`; both had been accepted before the canonical-host fix. The corrected check passed all ten unsafe URL cases.
- Wrapper mutation: removing the wrapper `try/except` made the direct boundary test fail with `RuntimeError: comparative wrapper unavailable`. The catch was restored.
- Hash mutation: making `_fetched_body_matches` return `True` made report and source substitution cases fail because they incorrectly became `PROVISIONAL_APPROVAL`; exact comparison was restored.
- REQUEST_MORE_INFO mutation: removing the curability/contradiction check made both unsafe request cases fail because they remained `REQUEST_MORE_INFO`; the clamp was restored.

### Fix-round verification

- Focused WSL direct evidence suite: exit 0; `64 passed in 4.92s`.
- Full WSL direct suite: exit 0; `88 passed in 6.55s`.
- `PYTHONIOENCODING=utf-8 genvm-lint lint/schema/validate contracts/AidTrail.py`: all exit 0. AST lint retains existing bare-`ValueError` warnings, none promoted to errors; schema remains 11 methods; semantic validation reports 7 view and 4 write methods.
- `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build`: all exit 0. Vitest has no frontend test files and exits through the existing `--passWithNoTests` configuration.
- `git diff --check`: exit 0.

### Remaining limitation

The contract does not DNS-resolve a public hostname before `web.render`: doing so would introduce another nondeterministic operation and violate the Task 3 budget of at most three fetches plus one prompt operation. It deterministically rejects all unsafe literal and authority forms listed above; GenLayer's HTTPS fetch runtime resolves accepted public hostnames. This is not represented as a DNS-rebinding proof.

## Fix round 2: Numeric URL authorities, finite cure reasons, readable prompt payloads

- **Numeric authorities:** the canonical-host check now rejects an authority whose labels are all numeric, covering decimal IPv4, shorthand forms such as `127.1` and `127.0.1`, leading-zero/octal-looking forms, and integer hosts. Existing ASCII-label checks reject hexadecimal token forms and IPv6 literals; standard dotted DNS names remain accepted.
- **Curable reasons:** `REQUEST_MORE_INFO` now permits only `MISSING_CONTENT_HASH`, `MISSING_CONTENT_VERSION`, `MISSING_INDEPENDENT_SOURCE`, `MISSING_OBSERVATION_PERIOD`, `MISSING_PUBLICATION_DATE`, or `MISSING_SOURCE_PROVENANCE`, with no contradictions. The prompt contains the same finite contract.
- **Readable safe payloads:** full hexadecimal prompt payloads were replaced with deterministic JSON strings (`ensure_ascii=True`) with `<`, `>`, and `&` encoded as Unicode escapes. This preserves ordinary evidence words for model evaluation while preventing evidence text from terminating the surrounding structural delimiters. Content hashes continue to cover the exact fetched UTF-8 body before prompt escaping.

### TDD and verification

- Focused RED command: `wsl.exe --cd '/mnt/c/Users/admin/Documents/Codex/2026-08-12/tham-kh-o-ki-n-tr/.worktrees/aidtrail' /home/tranhop/.local/bin/gltest tests/direct/test_evidence.py::test_nonpublic_or_ambiguous_evidence_hosts_are_rejected_before_fetch tests/direct/test_evidence.py::test_request_more_info_requires_curable_missing_fields_without_contradictions tests/direct/test_evidence.py::test_prompt_encodes_untrusted_fetched_bytes_without_delimiter_escape -v`.
- RED result: exit 1; `5 failed, 14 passed`. The failures were accepted shorthand/octal numeric hosts, arbitrary `rewrite the report` cure text, and the old hex-only prompt payload.
- GREEN result for the same focused command: exit 0; `19 passed in 1.66s`.
- Full WSL direct suite: exit 0; `94 passed in 5.92s`.
- `PYTHONIOENCODING=utf-8 genvm-lint lint/schema/validate contracts/AidTrail.py`: all exit 0; lint reports existing bare-`ValueError` warnings only, schema remains 11 methods, semantic validation passes (7 view, 4 write).
- `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build`: all exit 0. Vitest has no frontend test files and exits through the existing `--passWithNoTests` configuration.
- `git diff --check`: exit 0.

`feat: evaluate bound milestone evidence` — the final immutable commit hash is reported in the task handoff. It is intentionally not embedded here because this report is part of that commit.
