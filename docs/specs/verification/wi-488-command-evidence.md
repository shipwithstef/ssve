# WI-488 Promoted Command Evidence

**Promoted source:** `71e01336d733ab324c8dd8fbc0a7e5c2a6662a21`

**Execution window:** 2026-07-15T16:34:23Z through 2026-07-15T16:51:49Z

**Purpose:** durable digest of the exact promoted-state commands whose exhaustive console streams are machine-local.

| Command | Exit | Result |
|---|---:|---|
| `gh pr view 143 --json number,state,mergedAt,mergeCommit,url,headRefName,baseRefName` | 0 | PR #143 MERGED at 2026-07-15T16:33:47Z; merge commit `71e01336` |
| `git rev-parse HEAD` and `git rev-parse origin/main` | 0 | Exact equality at `71e01336d733ab324c8dd8fbc0a7e5c2a6662a21` |
| `./setup --host <host>` for Antigravity, Claude, Codex, Cursor, Gemini, Kimi, Mimo Code, OpenCode | 0 each | 85 framework skills plus host infrastructure current on all eight hosts |
| `bash scripts/check-install-drift.sh --host <host> --quiet` for all eight hosts | 0 each | 8 passed, 0 failed |
| `bash test-framework/evals/tier-1/validate-external-review-launcher.sh` | 0 | 97 passed, 0 failed; fake provider CLIs only |
| `bash test-framework/evals/tier-1/validate-review-plan-readonly.sh` | 0 | 22 passed, 0 failed |
| `node scripts/run-external-review.mjs --validate-capabilities --orchestrator claude ...` | 0 | Codex CLI `codex-cli-exec 0.144.4`; requested canonical model ID `gpt-5.6-codex` (`Codex 5.6 sol`) at high; 0 provider attempts |
| `node scripts/run-external-review.mjs --validate-capabilities --orchestrator codex ...` | 0 | Claude Code 2.1.210; requested `claude-fable-5` at high; 0 provider attempts |
| `node scripts/validate-provider-fidelity-evidence.mjs --evidence docs/specs/features/test-evidence/WI-488/PROVIDER_FIDELITY_EVIDENCE.md` | 0 | PASS |
| `node scripts/validate-pre-post-validation-evidence.mjs --evidence docs/specs/test-evidence/WI-488/pre-post-evidence.json` | 0 | PASS |
| `bash test-framework/evals/run-all-evals.sh` | 0 | 244 scripts passed, 0 failed, 0 timed out |
| `bash scripts/validate-main-green.sh` | 0 | 244 scripts passed, 0 failed, 0 timed out; main-green PASS |
| `node scripts/classify-delivery-graph-closeout.mjs .svc/lane-tasks-WI-488.json --write` | 0 | `framework-complete`, delivery tier `full` |

The task graph's four phase timestamps were written together after these commands completed. They identify receipt attachment time, while this digest identifies the actual execution window and exact results. The complete validator suite is deterministic and replayable from the promoted source; no paid model call occurs in Tier 1 or in either capability-only probe.
