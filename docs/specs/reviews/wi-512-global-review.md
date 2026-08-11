# WI-512 — global cross-batch review verdict (audit-implementation stage)

**Reviewer:** fresh-context Opus subagent — deliberately not the orchestrator, whose context is steeped in the work. ONE invocation, 3 internal passes. Reviewer family: anthropic; executor family: anthropic — cross-family fence WARNS, recorded as §4g drain-queue debt.

**Verdict: LAND-WITH-FOLLOWUPS.** All four CRITICAL fixes from the batch rounds hold under the reviewer's own re-execution — none accepted on report. No cross-batch edit silently undoes another; the three overlapping files took purely additive hunks that coexist.

## Goals A–E, traced end to end

| Goal | Fires? | Evidence |
|---|---|---|
| **A. Cheaper runs** | **PARTIAL — §2 inert** | OPT-07 fires automatically (0.439s cold → 0.222s warm reproduced independently). But nothing invokes `stage-activation.mjs`: repo-wide grep finds only a validity rule for an `na` someone else produces, plus the retired quick-fix body. → **WI-519** |
| **B. Less ping-pong** | **YES** | Inversion text + the load-bearing guard in both review skills; `self_review_passes` in both templates; round-cap diff +9 lines with zero exit-code paths touched; rule 5 wired and exiting 0 on a real lane-tasks file; `review_family` row present. |
| **C. Audit/align first-class** | **PARTIAL** | Tier-1 green in final state (1251/0, 412/0, 275/0, lint 103). Import-shape verified flipping green→red live. But no lane routes to the three ported skills, and align-feature's own completion gate was unreachable until fixed inline. |
| **D. Framework learns** | **CONDITIONALLY INERT** | The emission rule is well-formed — confidence 7 clears the ≥7 preload floor, correct 7-field row shape. But only a human explicitly invoking `align-feature` can trigger it today. One invocation away from real. |
| **E. Raw script perf** | **YES, and honestly** | Cache speedup reproduced independently; the commits explicitly record diagnose as *no* improvement, candidate-harness as noise, and the source plan's 1.8–3.2s/gate as **not reproducing**. Four items refuted with evidence → WI-516/517/518. |

## Findings

| Sev | Finding | Disposition |
|---|---|---|
| **HIGH** | The §4b table landed as *"measured on this repo, not estimated"* with example-marketplace numbers. svc has **0** `.spec.ts` files and no `audit-*-contract.mjs`, and `execute-changeset` ships to every onboarded repo — so "this repo" reads as the reader's. The batch's own §3g rule 1 violated by the batch landing §3g. | **FIXED INLINE** — denominator named, local absence stated, re-measurement instructed. |
| **HIGH** | `stage-activation.mjs` unwired; goal A's headline lever cannot fire. Same class Batch 2 fixed at HIGH; recurred unseen because *"is anything outside my slice calling this?"* is unanswerable from inside a scope-locked slice. | **WI-519** — needs a consumer decision, not a two-minute edit. |
| **HIGH** | `align-feature` Self-Verify rows 3 and 5 gated on `audit-story-receipts.mjs`, absent from svc. Batch 1 caveated three prose sites but missed the two Self-Verify cells, so the skill could not reach STORY ALIGNED here — where goal D's mechanism lives. | **FIXED INLINE** — caveat plus explicit "record UNVERIFIED, never claim STORY ALIGNED on an absent check". |
| MED | Four hand-curated doc surfaces (README, KIMI, GEMINI, ANTIGRAVITY) still route trivial fixes to `quick-fix` and call it a fast lane; none is inside a generated block. | **WI-516 extended.** |
| MED | `--stamp-imports` writes a regenerable sidecar into a **tracked** docs path; the doer deferred gitignoring it on a stale premise. | **FIXED INLINE** — pattern added to `.gitignore`. |
| MED | `project-state` slugs vs `artifact-sets` prose rows have no mapping, so the phase-mismatch step is not mechanically resolvable. | **FIXED INLINE** — rows now carry the slugs. |
| MED | `extractCitedFiles` bare-basename tier is first-match-wins repo-wide, so a short-form citation can bind the import-shape check to the wrong file in both directions — the mechanism the "closes the hole" claim rests on. | **WI-520.** |
| LOW | OPT-12 relativizes against `process.cwd()` while OPT-07 was anchored to the repo root. Behaviorally safe; no consumer resolves the path from disk. | Accepted. |
| LOW | `validate-lane-tasks-integrity` reports 1 failure against the untracked `.svc/lane-tasks-WI-512.json`. | Accepted — machine-local run state, deliberately excluded from the hygiene commit. |

**Nothing found that must not land.**

## The finding only this pass could produce

Two of the three HIGHs are *absence* findings — a mechanism nobody wired, and a caveat applied everywhere except the two cells that gate completion. Neither is visible from inside a single batch diff, because both are about the relationship between a batch and the rest of the repo. That is the argument for the fresh-context global pass as a distinct stage rather than as more per-batch rigor.
