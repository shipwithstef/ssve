# WI-488 Execution Cross-Model Review

**Date:** 2026-07-15
**Orchestrator:** Codex
**Required primary:** Claude / Anthropic / `claude-fable-5` / `high`
**Fallback used:** No
**Final frozen diff before review:** `8eaf12d3db015bb998560ac8837660f328278ed388c9b895c04b4065f78aad87`

## Scope

Review the deterministic external-review launcher, its shared schemas, the
three migrated adapters, fixture-controlled Tier-1 coverage, and the contract
updates against WI-488. Runtime review packages were delivered through stdin.
The launcher preserved separate event and diagnostic streams and emitted a
receipt for every classified outcome.

## Invocation Record

| Attempt | Package | Result | Fallback | Evidence |
|---|---|---|---|---|
| 1 | Initial full slice | Local capability detector rejected Claude's hidden `--max-turns` even though the complete configured argv parsed; no paid model call | No | `.svc/external-review-artifacts/WI-488/review-exec-round1/receipt.json` |
| 2 | Initial full slice | Timed out at 300 seconds | No; timeout is forbidden | `.svc/external-review-artifacts/WI-488/review-exec-round2/receipt.json` |
| 3 | Reduced core slice | Fable 5/high success; 11 findings, no critical | No | `.svc/external-review-artifacts/WI-488/review-exec-round3/{findings,receipt}.json` |
| 4 | First convergence package | `error_max_turns` classified `unknown_provider` | No; class is forbidden | `.svc/external-review-artifacts/WI-488/review-exec-round4/receipt.json` |
| 5 | Launcher core convergence | Provider returned substantive findings but used the wrong `review_kind`; launcher rejected it as `schema_invalid` | No; schema failure is forbidden | `.svc/external-review-artifacts/WI-488/review-exec-round5-core/{attempt-1-findings,receipt}.json` |
| 6 | Launcher core convergence | Fable 5/high success; no critical/high, one medium plus low findings | No | `.svc/external-review-artifacts/WI-488/review-exec-round6-core/{findings,receipt}.json` |
| 7 | Final patch iteration | Fable 5/high success; no critical/high, one medium plus low findings | No | `.svc/external-review-artifacts/WI-488/review-exec-round7-core-final/{findings,receipt}.json` |

The successful receipts record identical requested, invocation, and effective
tuples. No Opus invocation occurred. The primary invocation was the
availability probe; no separate paid smoke call was made.

## Finding Disposition

The review produced 11 initial findings, nine convergence findings, and five
final-iteration findings. Every critical/high/medium correctness finding was
accepted and patched. Material fixes include:

- cross-family owner-override enforcement and Codex-only fallback gating;
- `review_kind` in the content key and package/schema/key binding on replay;
- structured-code-only fallback eligibility with conservative forbidden-class precedence;
- dead/live/unknown process identity, PID-start-token protection, heartbeat fallback, stale-lock tombstones, and atomic GC reclaim;
- schema validation using own-property checks, closed certification and attempt objects, and schema-valid failure receipts;
- capability-only validation matching its documented no-stdin contract;
- strict runtime-model binding with one explicit Claude CLI auxiliary-model allowlist;
- successful paid findings surviving cache-publication failure without a reusable-cache claim;
- floor adapters using a distinct hard-failure exit so legacy blind-adoption callers cannot degrade silently.

The final Fable review's only medium finding was the GC in-place-delete race.
It was fixed after the three-iteration review-exec cap by applying the same
atomic rename-to-tombstone protocol used by acquisition. Its low findings were
also fixed: cache publication no longer turns valid paid findings into a hard
failure, malformed heartbeat timestamps fall back to lock mtime, and the last
prototype-chain property check was removed. These post-cap patches are covered
by the 76-case fixture suite and are intentionally handed to the independent
`review-gate` task for the next fresh review rather than exceeding the
review-exec iteration cap.

The model-name question was disproven: `references/model-registry.json`
explicitly maps `gpt-5.6-codex` to display name `Codex 5.6 sol`.

## Verification

- `bash test-framework/evals/tier-1/validate-external-review-launcher.sh` — 76 passed, 0 failed, no paid fixture calls.
- `node --check scripts/run-external-review.mjs` — pass.
- `git diff --check` — pass after the post-cap fixes.
- Fable final receipt — `claude-fable-5` / `high`, fallback false, classification success.

## Verdict

**PASS.** No critical or high finding remained at the iteration cap. All known
medium findings were fixed before task completion. The post-cap patch set must
be independently verified by review-gate before audit and landing.
