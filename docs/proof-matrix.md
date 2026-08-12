# AidTrail proof matrix

Replace a row only after the stated transaction is finalized with successful execution and the listed contract readback. A consensus status alone is not proof. No contract is deployed by this repository at release-candidate time.

| Actor | Action | Contract method | Transaction hash | Consensus status | Execution result | Readback | Source/test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Deployer | Deploy reviewed `AidTrail.py` | deployment | Not yet executed | Not yet executed | Not yet executed | Not yet executed: source hash, schema, `storage_version`, `get_summary` | `scripts/deploy.ts`, `scripts/verify-live.mjs` |
| Sponsor | Create locked grant plan | `create_grant` | Not yet executed | Not yet executed | Not yet executed | Not yet executed: `list_grants`, `get_grant`, milestones | `tests/direct/test_grants.py`, frontend workflow tests |
| Sponsor | Fund grant / receive excess credit | `fund_grant` | Not yet executed | Not yet executed | Not yet executed | Not yet executed: `get_grant`, `get_summary`, `get_credit` | `tests/direct/test_accounting_upgrade.py` |
| Beneficiary | Submit or cure evidence | `submit_evidence` | Not yet executed | Not yet executed | Not yet executed | Not yet executed: `get_milestone`, `get_evidence_record` | `tests/direct/test_evidence.py` |
| Challenger | Deposit challenge credit | `deposit_challenge_credit` | Not yet executed | Not yet executed | Not yet executed | Not yet executed: `get_credit`, `get_summary` | `tests/direct/test_challenges.py` |
| Challenger | Challenge provisional decision | `challenge_milestone` | Not yet executed | Not yet executed | Not yet executed | Not yet executed: milestone and challenge record | `tests/direct/test_challenges.py` |
| Any caller | Finalize after challenge window | `finalize_milestone` | Not yet executed | Not yet executed | Not yet executed | Not yet executed: milestone status, grant and accounting summary | `tests/direct/test_challenges.py` |
| Any caller | Expire overdue grant | `expire_grant` | Not yet executed | Not yet executed | Not yet executed | Not yet executed: grant, credit and accounting summary | `tests/direct/test_challenges.py` |
| Credit owner | Withdraw available credit | `withdraw_credit` | Not yet executed | Not yet executed | Not yet executed | Not yet executed: owner credit and before/after balances | `tests/direct/test_accounting_upgrade.py`, `docs/recovery-runbook.md` |
| Authorized upgrader | Upgrade compatible code | `upgrade` | Not yet executed | Not yet executed | Not yet executed | Not yet executed: source/schema and all accounting reads | `tests/direct/test_accounting_upgrade.py`, `docs/recovery-runbook.md` |
