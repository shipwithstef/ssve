# Framework Proposal - 2026-05-12 - Autonomous Discuss Phase with Adversarial Review

**Status:** DRAFT
**Promotion:** mapped to WI-342 in `docs/specs/work-items/PROPOSAL-PROMOTION-LEDGER.md`. Promotion is gated on WI-341 landing the compression-gate (WI-342 goes through the gate normally, no bootstrap exception). Will move to `proposals/done/` only after WI-342 lands.
**Author:** route-workflow (Claude opus-4-7), split from `proposals/2026-05-12-pre-wi-promotion-compression-gate.md` after Codex review
**Source proposal:** `proposals/2026-05-12-pre-wi-promotion-compression-gate.md`
**Plan-changeset class:** contract-change
**Lane:** framework
**deferred_until**: 2026-08-25
**reason**: auto-triage during WI-CHAIN-TIER1-FIXES; proposal stays open pending re-review after chain validation green | re-triaged 2026-06-29: batch backlog-sequenced behind active framework work — flagged for individual triage by 2026-07-29
**blocked_reason**: Beyond the 14-day defer window: imported/backlog evolution proposal awaiting a dedicated triage pass (re-deferred 2026-06-29, not abandoned).

---

## Why This Is Separate

The pre-WI promotion compression gate is a mechanical `capture-idea --from-proposal` extension. This proposal changes a different contract: how the framework resolves bounded gray-area decisions currently routed through `discuss-phase`.

The blast radius is larger:

- `discuss-phase/SKILL.md` currently declares `human_checkpoint: true`.
- `route-workflow` and the autorun/orchestrator docs treat human checkpoints as routing boundaries.
- Decision log paths are currently inconsistent: most routing docs use `.svc/pipeline-decisions.jsonl`, while `discuss-phase/SKILL.md` frontmatter still names `docs/logs/pipeline-decisions.jsonl`.
- A cross-model adversarial reviewer introduces extra token cost, loop bounds, and escalation semantics.

This should be evaluated independently from the compression gate.

## Problem

Some framework decisions are bounded but still judgment-heavy: severity grading, whether a mandatory ledger becomes a choke point, whether a gray-area waiver is justified, or whether a proposal should stay parked until scope is resolved.

Today, `discuss-phase` is the natural skill for those questions, but it is checkpointed by default. That preserves human control, but it also means the framework pauses on questions where a bounded autonomous decision with dissent and audit trail would be sufficient.

## Proposal

Make `discuss-phase` autonomous by default only for bounded, low-to-medium stakes gray-area decisions, while preserving an explicit checkpoint mode and adding adversarial review before the decision is consumed downstream.

### Mode Contract

| Mode | Trigger | Behavior |
|---|---|---|
| `autonomous` | default for bounded gray-area decisions | Author model writes decision artifact, adversarial reviewer challenges it, route-workflow proceeds only on `accept` or converged v2 |
| `checkpoint` | user passes `--checkpoint` or session contract requests human decision | Skill writes options and pauses for human choice |
| `escalated` | reviewer returns `escalate` or v2 still fails to converge | Route-workflow pauses with `human_checkpoint: pending` |

### Proposed Skill Changes

1. Flip `discuss-phase/SKILL.md` frontmatter from `human_checkpoint: true` to `human_checkpoint: false` only after the mode contract, route-workflow handling, and validators are in place.
2. Rewrite the description trigger to include autonomous routing: "Use when route-workflow or any gate detects a bounded gray area whose resolution affects downstream skills. Runs autonomously by default for bounded low-to-medium stakes decisions; pass `--checkpoint` to pause for human review."
3. Add `--checkpoint` and session-contract support for forcing the old pause behavior.
4. Add discussion artifact fields:
   - `mode: autonomous | checkpoint | escalated`
   - `superseded_by: null | <path>`
   - `adversarial_review: {...}`
5. Reconcile the decision-log path before implementation. Prefer `.svc/pipeline-decisions.jsonl` as the canonical path unless a separate migration decision says otherwise.

### Adversarial Reviewer Protocol

1. Author run uses the active host's default planning/strategy model and writes the discussion artifact with chosen resolution, rationale, evidence, and strongest dissent.
2. Reviewer run uses a different model family where available. It reads the artifact, cited context, active rules, and relevant framework learnings. It returns:

   ```yaml
   adversarial_review:
     premise_challenges: []
     missing_alternatives: []
     evidence_gaps: []
     dissent_strength: weak | strong
     verdict: accept | converge | escalate
     rationale: ""
   ```

3. Outcomes:
   - `accept`: artifact lands; route-workflow consumes the decision.
   - `converge`: author gets one retry with the critique attached; if v2 still converges rather than accepts, escalate.
   - `escalate`: artifact lands with `mode: escalated`; route-workflow pauses for human decision.

Loop bound: 2 author iterations maximum.

## What This Does Not Change

- It does not remove human checkpoints from high-stakes strategy, legal, money, irreversible architecture, or "should we build this" decisions.
- It does not change every `human_checkpoint: true` skill. A follow-up sweep should classify each checkpointed skill as `keep-human`, `flip-to-autonomous`, or `flip-with-adversarial`.
- It does not replace `review-plan` or `review-cross-model`; it applies the same adversarial pattern to decision artifacts.

## Acceptance Criteria

- [ ] `discuss-phase/SKILL.md` documents `autonomous`, `checkpoint`, and `escalated` modes.
- [ ] `--checkpoint` flag or session-contract field restores current human-pause behavior.
- [ ] Decision log path is reconciled and documented before mode changes land.
- [ ] Discussion artifact schema includes `mode`, `superseded_by`, and `adversarial_review`.
- [ ] Route-workflow consumes `mode: autonomous` artifacts, pauses on `mode: checkpoint`, and pauses on `mode: escalated`.
- [ ] An adversarial reviewer loop is bounded at 2 author iterations.
- [ ] `audit-session-execution` flags autonomous decisions later marked superseded, so the framework can learn which decision classes should have stayed checkpointed.
- [ ] Tier-1 fixtures cover `accept`, `converge -> accept`, `converge -> escalate`, explicit `--checkpoint`, and path reconciliation.
- [ ] A follow-up WI sweeps all `human_checkpoint: true` skills and classifies them without changing them in this WI.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Separated from the pre-WI promotion compression gate | PASS |
| 2 | Names contract changes and consumers | PASS |
| 3 | Preserves explicit human checkpoint path | PASS |
| 4 | Bounds adversarial loop | PASS |
| 5 | Calls out decision-log path mismatch before implementation | PASS |

## Route

If accepted: file as its own framework WI after the compression-gate WI, because this proposal benefits from the new promotion receipt and proposal-bound semantics. Severity = MEDIUM/HIGH depending on checkpoint blast-radius review. Lane = framework. Requires plan-changeset.
