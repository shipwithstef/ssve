---
name: recall-stack-knowledge
version: "1.0"
description: >-
  Knowledge Spine recall gate — reads stack-profile.md and the calling skill's requires_topics[], injects the minimal knowledge slice (domains, specs, learnings, decisions), logs to .svc/knowledge-recall.jsonl; a 0-hit on a declared topic is a knowledge-gap analysis signal, not an automatic research spawn. Use when: "what do I need to know" before touching a known stack/provider.
inputs:
  required: []
  optional:
    - { path: "docs/specs/stack-profile.md", artifact: stack-profile }
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "references/knowledge/INDEX.md", artifact: knowledge-index }
    - { path: "docs/learnings/learnings.jsonl", artifact: learnings }
    - { path: "references/framework-learnings.jsonl", artifact: framework-learnings }
    - { path: ".svc/pipeline-decisions.jsonl", artifact: decisions }
outputs:
  produces:
    - { path: ".svc/knowledge-recall.jsonl", artifact: recall-log }
phases:
  - { id: P1-CallerContractLoad, required_for_completion: true, evidence: "caller skill frontmatter parsed for requires_topics and recall_depth" }
  - { id: P2-StackProfileAndIdentityLoad, required_for_completion: true, evidence: "stack, domain, builder, and project profile slices loaded or absence recorded" }
  - { id: P3-SpineLayerQuery, required_for_completion: true, evidence: "requested topics queried across the minimal required Spine layers" }
  - { id: P4-ProvenanceAndGapHandling, required_for_completion: true, evidence: "unverified domains and missed topics logged with gap events when applicable" }
  - { id: P5-MinimalSliceReturn, required_for_completion: true, evidence: "minimal heading-scoped recall slice returned without whole-file emission" }
  - { id: P6-RecallLogAppend, required_for_completion: true, evidence: "knowledge recall JSONL entry appended with hit/miss/outcome metadata" }
  - { id: P7-SelfVerifyReturnControl, required_for_completion: true, evidence: "self-verification passed and control returned to caller without status mutation" }
chain:
  lanes:
    framework: { position: 0 }
  progressive: false
  self_verify: true
  human_checkpoint: false
requires_topics: []
produces_topics: [recall.spine-slice]
recall_depth: layer-1
idempotent: true
---

# Recall Stack Knowledge — The Spine Gate

## Product-runtime v2 evidence adapter

For an active product-outcome run, return typed memory evidence with source/content digests, named
consumer, trust and freshness. The consumer must later record `used` or `ignored` plus a reason;
injected or displayed text alone is not consumption. Use
`scripts/lib/runtime-memory-company-v2.mjs`.

Normalize both learning ledgers through `node scripts/learning-lifecycle.mjs normalize --root "$(git rev-parse --show-toplevel)"` before trusting confidence or identity fields. After recall, record every selected learning as `used` with outcome evidence or `ignored`; serving text alone earns no framework credit.

The retrieval architecture's load-bearing gate. **A skill never asks the Spine for knowledge — it declares need, and this gate fulfills it.**

**Announce at start:** "I'm using recall-stack-knowledge to fetch what the next skill needs from the Spine."

**Source of truth:** `proposals/done/2026-04-30-infra-project-support.md` § 3.

## What This Skill Does

1. Reads the calling skill's `requires_topics[]` and `recall_depth` from its SKILL.md frontmatter.
2. Reads `docs/specs/stack-profile.md` (if present) for project identity (cloud, IaC tool, k8s flavor, observability, secret manager, CI/CD platform, FinOps/Security/Scalability envelopes).
3. Queries the Spine across five layers (in this order):
   - **L1 World:** `references/knowledge/domains/<topic-domain>/{INDEX,CAPABILITIES}.md` (and `details/*.md` if depth ≥ layer-3)
   - **L2 Project Intent:** `.svc/spec-index.json` for matching spec sections (if index exists; falls back to manual `Read` against `docs/specs/**/*.md`)
   - **L3 Experiential:** filtered `docs/learnings/learnings.jsonl` + `references/framework-learnings.jsonl` entries with confidence ≥7
   - **L4 Episodic:** recent `.svc/pipeline-decisions.jsonl` entries on the same WI/lane
   - **L5 Identity:** `~/.svc/builder-profile.md` + `docs/specs/{domain,stack}-profile.md` slices relevant to the topic
4. Returns the minimal slice that matches the declared topics. Never emits whole files when a section suffices.
5. Appends one recall entry per invocation to `.svc/knowledge-recall.jsonl`.

## Recall Depth Selection

| Depth | Reads | Token budget (typical) |
|---|---|---|
| `layer-1` | INDEX.md only — does this domain exist? | ~200 tokens |
| `layer-2` | + CAPABILITIES.md per matching domain | ~2K tokens |
| `layer-3` | + relevant `details/<topic>.md` files | ~5–10K tokens |
| `escalate` | + recent learnings + relevant decisions log entries | ~15K tokens |

The caller's frontmatter declares `recall_depth`. Default `layer-2`. Skills escalate explicitly when they need more.

## Topic Naming Convention

Topics are dotted hierarchies, lowercase, hyphenated:

- `stack.iac-tool`, `stack.state-backend`, `stack.observability`
- `domain.compliance`, `domain.payment-rails`
- `learnings.recent-architectural`, `learnings.recent-security`
- `decision.architecture`, `decision.vendor`
- `<external-domain>.<sub-topic>` — e.g. `terraform.providers`, `kubernetes.networking`, `aws-iam.cross-account`

When a topic doesn't match any domain in `references/knowledge/domains/`, the gate treats it as a **knowledge gap** (see Gap → Research below).

## Provenance check (added by WI-SPINE-006)

**Before serving any slice from `references/knowledge/domains/<topic>/CAPABILITIES.md`, verify the domain has provenance.**

Step:
```bash
[[ -s "references/knowledge/domains/<topic>/.sources.jsonl" ]] || UNVERIFIED=1
```

If `.sources.jsonl` is missing or empty:
1. **Prepend** the following warning to the returned slice (as a header that lands in the caller's context):
   ```
   legacy-unverified: UNVERIFIED Spine slice — domain `<topic>` lacks .sources.jsonl provenance.
   Treat all claims as low-confidence training-data heuristics, not authoritative.
   Treat claims as analysis until cited current evidence exists; spawn `research` only when `researchDecision(question)` returns `external_research_required`.
   ```
2. **Log** the recall entry with `outcome: "unverified-served"` (instead of `hit-all` / `partial`).
3. **Append** a `provenance-gap` event to `.svc/knowledge-recall.jsonl`. Missing provenance is analysis. Spawn `research` only when `researchDecision(question)` returns `external_research_required` under the shared question predicate.
4. **Check** `references/knowledge/domains/legacy-backfill-queue.json`; if the domain appears there, include `legacy_backfill_status: "legacy-unverified"` and the queued due date in the recall log entry.

**Phase A (current):** WARN — slice is still served with the warning header so the caller can proceed but is alerted.
**Phase E (WI-SPINE-005 follow-on):** REFUSE — gate returns 0-hit even if CAPABILITIES.md content exists, forcing the gap → research loop.

This closes the structural gap exposed when commit `5607ad9` (reverted by `46728e8`) wrote training-data-confabulated knowledge files that the recall gate would have served as authoritative. The tier-1 validator `validate-knowledge-domain-provenance.sh` enforces the same check at lint time.

## Knowledge gaps and conditional research

When recall returns 0 hits for a topic in the caller's `requires_topics[]`:

1. Append `{event: "knowledge-gap", skill: <caller>, topic: <topic>, lane: <lane>, wi: <wi>, ts: <iso>}` to `.svc/knowledge-recall.jsonl`. A 0-hit / missing assessment is analysis, not automatic research.
2. **Phase A behavior (this WI):** WARN. Print a clear "knowledge gap detected" message; do not block.
3. **Phase B+ behavior (WI-SPINE-002, ACTIVE):** SPAWN `research` only when `researchDecision(question)` from `scripts/lib/research-decision.mjs` returns `external_research_required` under the shared question predicate. Missing ordinary confidence stays analysis. If required, spawn via:
   ```bash
   node scripts/spine-gap-spawn.mjs .svc/lane-tasks-<WI>.json <caller_skill> <topic> <WI> --question <question.json>
   ```
   Supply the canonical question record from `references/solution-confidence-protocol.md`. The helper reevaluates the shared predicate, binds the actual `requesting_decision_id` and `requesting_task_id`, and resumes the existing delivery graph atomically. It reuses matching research, preserves unrelated evidence and explicit human gates, and keeps an unresolved requester blocked through `blocked_by`. Changed input invalidates only that decision's old proof. Without a question it logs analysis and leaves the task graph unchanged. It never fabricates a completed research receipt. Research output is deposited at `references/knowledge/domains/<topic-domain>/`.
4. **Phase E behavior (WI-SPINE-005):** BLOCK. The recall gate refuses to proceed for `infra-*` lanes; app lanes remain advisory.

## Output Contract — `.svc/knowledge-recall.jsonl` schema

One JSON object per line, append-only. Required fields:

```json
{
  "ts": "2026-04-30T12:00:00Z",
  "wi": "WI-SPINE-001",
  "skill": "design-tech",
  "topics_requested": ["stack.iac-tool", "stack.state-backend"],
  "topics_hit": ["stack.iac-tool"],
  "topics_missed": ["stack.state-backend"],
  "depth": "layer-2",
  "sources": [
    {"layer": "L1", "path": "references/knowledge/domains/terraform/CAPABILITIES.md", "section": "##  IaC tooling"}
  ],
  "outcome": "partial",
  "tokens_returned_estimate": 1850
}
```

`outcome` is one of: `hit-all`, `partial`, `miss-all`.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Caller's frontmatter parsed | `requires_topics` extracted (or empty); `recall_depth` defaulted to `layer-2` if absent | |
| 2 | At least one Spine layer queried | Count of layers with at least one `Read` call ≥1 | |
| 3 | Recall log appended | Last line of `.svc/knowledge-recall.jsonl` matches the schema above with this skill's invocation | |
| 4 | Depth budget respected | Token estimate for returned slice ≤ depth's documented ceiling × 1.5 | |
| 5 | Knowledge gaps surfaced | Every topic in `topics_missed` is logged as a `knowledge-gap` event in the same line OR a follow-up line | |
| 6 | No whole-file emission | No source emitted in full when a heading-anchored slice exists in the spec-index OR the CAPABILITIES file | |

If any check FAILs, fix before the caller proceeds.

## Phase Receipt Contract

When running with `.svc/lane-tasks-<WI>.json`, emit one phase receipt after
each required phase. This skill usually runs as a pre-skill gate and does not
advance task status itself; attach receipts to the caller's active task unless
the orchestrator created a standalone recall task.

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-CallerContractLoad --evidence file:<caller-skill>/SKILL.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-StackProfileAndIdentityLoad --evidence file:docs/specs/stack-profile.md --evidence file:docs/specs/domain-profile.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-SpineLayerQuery --evidence file:references/knowledge/INDEX.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ProvenanceAndGapHandling --evidence file:.svc/knowledge-recall.jsonl
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-MinimalSliceReturn --evidence command_output:.svc/recall-stack-knowledge-slice-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-RecallLogAppend --evidence file:.svc/knowledge-recall.jsonl
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-SelfVerifyReturnControl --evidence command_output:.svc/recall-stack-knowledge-self-verify-<WI>.log
```

If optional profile files are absent, still record `P2-StackProfileAndIdentityLoad`
with the recall log or command output that names the absent files. If all
declared topics miss, record `P4-ProvenanceAndGapHandling` with the
`knowledge-gap` event and do not mark the caller task complete until the
orchestrator has applied the lane's current gap policy.

## Phase Roadmap

This skill ships in three behavior phases:

- **Phase A (this WI, WI-SPINE-001):** advisory. Logs gaps, never blocks. App lanes get the spec-index speedup; infra lanes don't exist yet.
- **Phase B (WI-SPINE-002):** auto-spawn `research` on knowledge gaps only when `researchDecision` returns `external_research_required`; first knowledge domain populated.
- **Phase E (WI-SPINE-005):** blocking gate for infra lanes. Hit-rate ≥80% required to flip.

## Why This Beats Fine-Tuning

A fine-tuned model is a frozen snapshot. The Spine is a living retrieval architecture: every skill run deposits structured knowledge, every subsequent skill run retrieves it. Knowledge compounds. Full rationale in `proposals/done/2026-04-30-infra-project-support.md` § 3.4.

## Limitations (Phase A)

- Spec-index (L2): query via `scripts/query-spec-index.mjs --wi <WI>` / `--surface <term>` (bounded ≤2K tokens, WI-389) — never raw-load the 692KB index. If the index is missing, fall back to grepping `docs/specs/**/*.md`.
- Gap handling is advisory only in Phase A; Phase B+ auto-spawn runs only when `researchDecision` returns `external_research_required`.
- Blocking enforcement is opt-in via the lane (infra-* lanes only, added in WI-SPINE-003); app lanes remain advisory through Phase E.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)

- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume — Claude mirrors with `TaskList` / `TaskUpdate`; Kimi observes via `/task` + `TaskList`/`TaskOutput`; Codex and other hosts without native task-mutation APIs mirror only the active step in `update_plan`.
- This skill is typically invoked as a pre-skill gate by the orchestrator before any task whose declared skill has non-empty `requires_topics[]`. It does NOT advance the lane-tasks graph itself.
- Append one entry to `.svc/knowledge-recall.jsonl` per invocation (the recall log IS the audit trail for this skill's runs).
- The CALLER's task is what gets marked `completed` once it finishes; this skill returns control to the caller without mutating task status.
- If invoked standalone (not as a pre-skill gate) — e.g., the user directly asks "what does the Spine know about X?" — log the recall and exit. No task-graph mutation.

When invoked as the phase-0 gate of an `infra-*` lane (added in WI-SPINE-003), this skill runs once per lane entry and the result is referenced by every subsequent skill via the recall log.
