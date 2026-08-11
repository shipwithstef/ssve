# Mandatory-chain stage-context isolation (WI-380)

The 7 mandatory-chain skills (~2,958 lines post-WI-366) run in ONE orchestrator
context per WI. `references/context-budget.md` classifies a single accumulating
context as DEGRADING (50-70%) → POOR (70%+, "silent partial completion"); the
2026-06-06 eval estimated **25-45% mandatory-step dropout** from exactly this.
`context-budget.md:47` mandates "orchestrator routes, subagents execute" — the
prose chain mechanically violates it.

This re-bases the chain onto **per-stage fresh subagents**. Each stage boots a
clean context loaded with only its own `SKILL.md` + the prior stage's **hash-bound
baton** (WI-381), works in the **single shared worktree**, and returns a ≤1K-token
schema-forced summary (`schemas/stage-summary.schema.json`). The orchestrator holds
only the session contract + stage summaries + the receipts index. **Stages stay
strictly SEQUENTIAL — this isolates CONTEXT, not ordering** (so it composes with,
but does not require, the parallel-transport reversal; the isolation itself is
sequential). This is now permitted mutating transport per the S5 policy
(`references/workflow-fanout-protocol.md`, recorded 2026-06-09).

## Segments (AC1: ≥3, split at the 3 human_checkpoint seams)
Workflows take no mid-run input, so each `human_checkpoint:true` seam is a segment
boundary (`scripts/stage-segment.mjs` `SEGMENTS`):

| Segment | Locked agent (WI-399 B1) | Stages | Checkpoint after | Emits |
|---|---|---|---|---|
| `seg-1-plan` | `svc-stage-plan` | plan-changeset → review-plan | plan-changeset | plan-manifest, review-plan |
| `seg-2-exec` | `svc-stage-exec` | execute-changeset → review-exec → audit-implementation | execute-changeset | exec-record, review-exec, audit-implementation |
| `seg-3-land` | `svc-stage-land` | land-changeset → verify-promotion | land-changeset | envelope-on-squash |

Dispatch uses these locked agents BY NAME (canonical sources in `agents/`,
synced to `.claude/agents/` by `scripts/sync-native-agents.mjs`; executor
lock class: mutation tools, maxTurns 80, no nested spawns). Improvised stage
prompts violate the locked-agent policy (WI-372) — if an agent file is
missing, fall back to the serial prose chain, never to an ad-hoc prompt.

## Contract per stage
1. **Input:** its own `SKILL.md` + the prior stage's **baton** (`plan-manifest.ac_digests`,
   hash-bound — WI-381). A stage reads the BATON, **never** the prose summary (AC4):
   prose is for humans; routing is on the receipt index + `next_action`.
2. **Work:** in the shared worktree (claims discipline holds — `.svc/claims/`).
3. **Receipts:** the stage AGENT's OWN shell emits its receipts via
   `scripts/emit-receipt.mjs`. The orchestration only **verifies the returned SHA**
   (`scripts/stage-segment.mjs verify-receipt`) — it never re-emits. If a stage's
   receipt is missing, the segment runner **HALTS** (fail-closed), never silently
   continues (AC3). `hooks/git/pre-push.d` validates the git note byte-identically.
4. **Return:** the `stage-summary` schema (≤1K tokens) + `next_action`.

## Backward control flow (AC2: the review-exec P4 kickback ladder)
After `seg-2-exec`, `scripts/stage-segment.mjs nextStageAction(findings, iter)` is
the explicit state machine:
- no CRITICAL/HIGH → `pass`
- a finding traces to a plan flaw → `re-plan` (restart at `seg-1-plan` / G5)
- fix > 20 lines OR structural → `re-execute` (`seg-2-exec`, iteration resets)
- else ≤20-line patch → `patch` (re-run review on the patched diff, iteration++)
- **hard cap: 3 patches** → forced `re-execute`/`re-plan`

## Resume & host parity (AC5)
Resume claims are limited to the **same session** (docs-canonical). **Non-Claude
hosts keep the prose chain** as a stated degradation path until the segment runner
has host parity — the isolation needs in-session Agent/Workflow subagents.
