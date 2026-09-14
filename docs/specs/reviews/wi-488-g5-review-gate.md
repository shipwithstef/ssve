# WI-488 G5 Review Gate

**Gate:** G5 — implementation review
**Final frozen implementation diff:** `b948fe6321936d98ae990b953355815c9892520448895ef3b726532f48ee62f6`
**Independent reviewer:** fresh `wi488_g5_cross_review` agent
**Scope:** the accepted WI-488 contract only; WI-486 and WI-487 remain excluded

## Step 1 — Self-review findings

### Finding: G5-A-001

- **Severity:** medium
- **Location:** `docs/plans/2026-07-15-wi488-deterministic-external-reviewer/manifest.md`, task checkpoint column
- **Description:** The reviewed manifest described checkpoints as intermediate commits although the mandatory receipt chain freezes one aggregate staged tree.
- **Justification:** The file inventory was correct, but the checkpoint language did not describe the actual receipt-bound execution method.
- **Suggested fix:** Define the checkpoints as logical, validated progress-ledger records.

### Finding: G5-A-002

- **Severity:** medium
- **Location:** `docs/specs/features/test-evidence/WI-488/PROVIDER_FIDELITY_EVIDENCE.md`
- **Description:** Required provider-fidelity evidence existed in the implementation diff but was initially absent from the manifest inventory.
- **Justification:** G5 requires every intentional tracked output to be declared.
- **Suggested fix:** Add an explicit `CREATE-EVIDENCE` manifest row.

## Step 2 — Self-judgment

### Judgment: G5-A-001

- **Verdict:** ACCEPT
- **Analysis:** The mismatch was procedural rather than architectural, but leaving commit-oriented wording would make later receipt verification ambiguous. The manifest now identifies logical evidence checkpoints and the correction is recorded in `.svc/pipeline-decisions.jsonl`.

### Judgment: G5-A-002

- **Verdict:** ACCEPT
- **Analysis:** The evidence was substantive and validator-clean, but unlisted tracked evidence violates exact diff accounting. The manifest now declares the path and purpose.

## Step 3 — Independent cross-review

The first independent pass reviewed frozen hash `8ba67873fa84aec9674ca30c98bef5b2231085a667bf40739ac57362dde486c9` and returned FAIL with six findings:

| Finding | Severity | Accepted disposition |
|---|---|---|
| G5-001 | high | Pre-invocation receipts now use null invoked/effective tuples; fixtures cover capability, disabled, empty-input, and capability-only paths. |
| G5-002 | high | `cli_version` is schema-required and receipts link the captured capability artifact. |
| G5-003 | high | Owner overrides retain the exact primary host, family, and model; direct Opus primary selection is rejected before spawn. |
| G5-004 | medium | GC takes the same content-key lock, rechecks age, tombstones atomically, and passes a controlled GC/republish race. |
| G5-005 | medium | The delayed SIGKILL timer is retained and cleared on child error and close. |
| G5-006 | medium | Provider-fidelity evidence is declared in the reviewed file inventory. |

The same independent lens re-reviewed frozen hash `76d7966379834dff0332da07d7223498c08496d268e0a382ff316e268a14841a`. It returned PASS: all six originating findings resolved and no originating finding remained open. The rerun used fake CLIs only and reported 82 passed, 0 failed.

Audit findings then reopened the implementation and required a fresh G5 cycle. The independent reviewer checked the complete audit-fixed hash and found G5-007 high: the mutation guard itself lacked crash recovery. The guard now records hostname, PID, process-start token, owner token, and heartbeat; stale/dead ownership is token-revalidated around takeover; release is owner-only. A SIGKILL-while-held fixture proves the next identical request recovers with one provider call and no residual guard. The originating reviewer re-ran G5-007 against final hash `b948fe6321936d98ae990b953355815c9892520448895ef3b726532f48ee62f6` and returned PASS. The complete focused suite reported 97 passed, 0 failed.

## Concern scan dispositions

| Concern | Disposition | Evidence |
|---|---|---|
| auth surface | false positive | `.svc/session-contract.jsonl` contains orchestration binding metadata, not credentials or application authentication logic. |
| feature closeout | N/A | WI-488 is a headless framework enabler with no user/admin journey. |
| pricing tier | false positive | The hit came from a `docs/plans` pathname; no billing, price, or entitlement behavior changed. |
| provider fidelity | satisfied | The provider-fidelity evidence validates and the independent-review receipt records Fable 5/high with no fallback. |
| security cross-family review | satisfied | Review-exec and G5 used schema-bound cross-family evidence. |
| session management | false positive | Framework session-contract metadata is not application session state. |

## Step 4 — Convergence status

- **Gate:** G5
- **Artifact:** frozen WI-488 implementation diff
- **Iteration:** 2 of 3 in the post-audit re-entry cycle
- **Findings summary:** critical 0; high 0; medium 0; low 0
- **Decision:** PASS
- **Rationale:** All eight accepted self/cross-review findings were corrected. The originating independent lens reports no open finding.

## Validation evidence

| Check | Result |
|---|---|
| Canonical launcher fixtures | PASS — 97/97, fake CLIs, zero paid review calls |
| Legacy plan-review hardening | PASS — 22/22 |
| Skill structure | PASS — 1035/1035 |
| Skill contracts | PASS — 602/602 |
| Chain references | PASS — 275/275 |
| Manifest lint | PASS |
| Plan mechanical validation | PASS |
| Task graph and framework-lane coverage | PASS — 14 tasks, no mandatory skill missing |
| System Contract Map | PASS |
| Pre/post and old/new cross-system probes | PASS |
| Provider fidelity | PASS |
| Cross-system iteration cap | PASS |
| `git diff --cached --check` | PASS |
| Browser/UI evidence | N/A — no browser-visible surface |

## G5 checklist and self-verify

All implementation/spec/design/manifest alignment checks pass. There are no placeholder implementations or unresolved questions. Every intentional tracked file is in the manifest or explicitly classified evidence. The changeset exceeds five files and 200 lines; review depth is proven by eight concrete findings, two independent passes, and targeted replay. Cross-system map and old/new path evidence validate. UI/mock-parity checks are N/A.

## Gate Decision: G5

- **Decision:** PASS
- **New state:** ready for `audit-implementation`
- **Iterations completed:** 2 in the final re-entry cycle
- **Findings resolved:** 9 across the original and post-audit G5 cycles
- **Findings remaining:** 0
- **Findings escalated:** 0
