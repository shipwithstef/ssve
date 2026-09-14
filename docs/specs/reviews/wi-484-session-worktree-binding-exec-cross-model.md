# WI-484 Execution Cross-Model Review

- **Reviewed candidate:** `622d81b7` plus the final review-remediation diff
- **Authoring host:** Codex
- **Independent reviewer:** Claude Fable, high effort, read-only safe mode
- **Final verdict:** APPROVE

## Review Rounds

| Round | Verdict | Findings and disposition |
|---|---|---|
| 1 | REQUEST_CHANGES | Accepted malformed/symlink preflight fallback, released-claim freshness, malformed root handling, legacy relative claim ownership, hidden conflict diagnostics, lock race, insecure counter storage, missing contract edges, and stale-claim CAS bypass. The active-intent suggestion was accepted only for an exact same-session resume; a newer unrelated prompt intentionally remains authoritative. |
| 2 | APPROVE with low follow-ups | Verified all round-1 corrections. Serialized stale cleanup, preserved released transfer records, rejected silent mutating binding omission, and prevented a mismatched requested WI from filtering the bound graph. |
| 3 | REQUEST_CHANGES | Found that missing-session rejection occurred after worktree creation and was only string-tested. Also found clean stops could consume the receipt-pressure cap. |
| 4 | APPROVE | Verified pre-side-effect rejection, real branch/worktree/reviewer behavior tests, pressure-only counter mutation, and the agreed invalid-claim cleanup boundary. |

## Accepted Corrections

- Governed binding/claim preflight runs before graph discovery; malformed or foreign ownership never falls into another graph.
- Released claims are non-fresh, preserved while well formed, and remain generation-bound transfer records.
- Claim renewal, cleanup, binding, and transfer use serialized atomic state changes.
- A stale foreign claim cannot be taken over without an expected generation.
- Runtime counters are absolute, owner-checked, non-symlink paths and count only pressure statuses.
- A mutating worktree without session identity is rejected before preflight, branch creation, worktree creation, or scaffolding.
- A mismatched `SVC_WORKER_WI` is advisory before graph parsing and cannot change counters.
- Latest user intent supersedes stale Stop pressure; only exact same-session `continue WI-N` or `resume WI-N` restores it.

## Deliberate Boundaries

- Invalid claim records (malformed JSON, symlink, or foreign owner) are invalid-state cleanup, not preserved lifecycle history. Well-formed released records are preserved under lock.
- A crashed lock holder requires an operator to verify the recorded PID is dead before removing the lock. Automatic stale-lock breaking is intentionally excluded because it recreates a time-of-check/time-of-use race.
- Legacy worktrees without a bindings directory retain compatibility discovery. The new authoritative binding path never uses that fallback.
- Fable noted a low-risk malformed-binding diagnostic in `cmd_remove` and a legacy-only foreign-claim counter ordering. Neither is reachable in the new bound-session path or blocks an AC.

## Evidence

- `validate-session-worktree-binding.sh` — 22 passed, 0 failed.
- `validate-active-intent-guard.sh` — PASS.
- `validate-completion-guard-no-max-escape.sh` — 5 passed, 0 failed.
- `validate-stop-hook-session-isolation.sh` — PASS.
- Full Tier 1 on the final review-remediated tree — 240 scripts passed, 0 failed.
- Final Fable review — `VERDICT: APPROVE`.

## Verdict

APPROVE — proceed to implementation and security audit.
