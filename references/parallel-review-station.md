# Parallel Review Station (WI-382)

The post-exec review phase runs **up to five read-only passes over the SAME frozen
package** (`git diff main..HEAD` + plan-manifest + spec): review-gate G5,
review-exec G6 (→ `review-cross-model`), audit-implementation, plus
benchmark-landing / track-visuals on visual lanes. None has a data dependency on
another — review-exec and audit both read `git diff main..HEAD` independently, and
review-gate + review-exec route to the SAME `review-cross-model` primitive. Today
they are serialized.

The review station loads the frozen package **once** and runs the lenses as **one
read-only analysis fan-out**, merges mechanically, and emits the same receipts —
byte-identical envelope, every rubric intact.

## In-class by construction (no policy reversal)
This is a **read-only analysis fan-out** — the lenses inspect a frozen diff, they
do not mutate the worktree. That is explicitly permitted by
`references/workflow-fanout-protocol.md` (in-class: readers, reviewers-as-analysis,
judges). It does **not** touch the mutating-stays-sequential boundary and requires
no S5 policy recording. Works via Agent-tool subagents on the Claude host **today**;
native Workflow transport is optional.

## The lenses
| lens_id | locked agent (WI-399 B1) | source skill / role | NEVER_GATE |
|---|---|---|---|
| `g5-auditor` | `svc-lens-correctness` | review-gate post-exec rubric | |
| `codex-adversarial` | — (external CLI, cross-family pair from `scripts/resolve-adversarial-reviewer.sh`) | review-exec | |
| `audit-testing` | `svc-lens-correctness` | audit-implementation specialist | |
| `audit-security` | `svc-lens-security` | audit-implementation specialist | ✅ |
| `audit-data-migration` | `svc-lens-security` | audit-implementation specialist | ✅ |
| `audit-performance` | `svc-lens-perf` | audit-implementation specialist | |
| `spec-fidelity` | `svc-lens-spec-fidelity` | plan-manifest/AC drift specialist | |
| `visual-lens` | `svc-journey-qa` | track-visuals / benchmark-landing (visual lanes only) | |

In-session lenses dispatch the locked agents BY NAME (canonical sources in
`agents/`, reviewer lock class: read-only, maxTurns 12; ≤4 lenses per wave
per WI-399 §Subagent design constraints — collapse the lens_ids onto the 4
named agents as mapped above). Improvised lens prompts violate the
locked-agent policy; the external codex-adversarial pair stays CLI-invoked.

## Procedure
1. **Freeze once.** Capture `SHA = git rev-parse HEAD` and the diff; build ONE
   read-only package. Record `diff_hash`.
2. **Fan out (barrier).** Dispatch each lens as a read-only in-session Agent
   subagent over the shared package. Each returns the
   `schemas/review-lens-finding.schema.json` shape — the orchestrator NEVER
   re-parses free text.
3. **Mechanical merge.** `node scripts/review-station-merge.mjs` →
   dedup-by-file:line, **keep-highest-severity**, attribute-to-lens. **NEVER
   orchestrator re-adjudication** (AC3 — keeps self-preferential bias out).
4. **One convergence loop, per-lens caps.** Each lens keeps its **own** 3-round
   cap (review-cross-model Step 4) — NOT a single merged counter (AC2).
5. **Keyed HIGH re-review.** For each surviving HIGH/CRITICAL fix: **re-freeze the
   diff** (re-capture `diff_hash`), then re-run **only the ORIGINATING lens**
   (`scripts/review-station-merge.mjs` `keyed_rereview` map) — never a generic
   cross-model pass. NEVER_GATE (security / data-migration) locations are keyed
   even at lower severity, so fix coverage is preserved (AC1).
6. **Mechanical re-verify.** Tests + tier-1 suite + the keyed HIGH re-reviews.
7. **Post-barrier receipts (sequential).** Only after the barrier, emit the
   review-exec, audit-implementation (and review-gate) receipts **one at a time**
   via `scripts/emit-receipt.mjs` — git-notes writes are not concurrent-safe (AC4).
   The pre-push envelope is byte-identical to the serial chain.

## Measure-first (AC5)
Before the first restructured run on a lane, instrument the **current serial**
latency + per-lens token estimate and log a `mechanical` decision to
`.svc/pipeline-decisions.jsonl` (`skill: review-station`, `serial_baseline: {...}`).
The wave is only justified where the serial baseline shows the lenses dominate
post-exec wall-clock.

## Host gate / fallback
The fan-out needs in-session Agent/Workflow subagents (Claude host). **Non-Claude
hosts fall back to the existing serial chain** — review-exec → audit-implementation
in sequence — using the same host detection as
`scripts/resolve-adversarial-reviewer.sh`. No behavior change off-Claude.

## Value-preservation
Value-neutral-to-positive: nothing removed, **every rubric runs in full**, all
three receipts schema-validate → pre-push envelope byte-identical. WI-376's
evidence (audit found a hole review-exec missed) is preserved because the wave
keeps every lens. The merge is mechanical, so the wave cannot quietly drop or
down-rank a finding. LOW risk.
