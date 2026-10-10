---
name: analyze-marketing
version: "1.0"
handles_concerns:
  - paid-analytics-api
  - revenue-attribution
description: >
  Mines feature specs for marketing value and maintains docs/specs/marketing-context.md;
  second mode stress-tests messaging against buyer personas. Use for "mine features",
  "positioning", "what should we market", "does our messaging work".
phases:
  - id: P1-RepositoryModeTrackerPreflight
    trigger: always
    reads: ["REPO_MODES.md", "docs/marketing/feature-mining-tracker.json", "docs/specs/marketing-context.md", ".agents/product-marketing-context.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-WorkQueueBatchSelection
    trigger: always
    reads: ["docs/specs/features/*.md", "docs/marketing/feature-mining-tracker.json", "docs/specs/domain-profile.md", "docs/specs/analyze-competitors.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-FeatureMiningEvaluation
    trigger: mining-modes
    reads: ["docs/specs/features/*.md", "references/evaluation-framework.md", "references/weight-calibration.md", "web research when required"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-InsightTrackerWrite
    trigger: mining-modes
    reads: ["docs/marketing/feature-mining-tracker.json", "mined insights"]
    writes: ["docs/marketing/feature-mining-tracker.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ContextSyncAndNarratives
    trigger: mining-or-foundation-modes
    reads: ["docs/marketing/feature-mining-tracker.json", "docs/specs/marketing-context.md", ".agents/product-marketing-context.md"]
    writes: ["docs/specs/marketing-context.md", ".agents/product-marketing-context.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SummaryFollowupSelfVerify
    trigger: always
    reads: ["docs/marketing/feature-mining-tracker.json", "docs/specs/marketing-context.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/*.md", artifact: feature-spec }
  optional:
    - { path: ".agents/product-marketing-context.md", artifact: existing-context }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "docs/specs/analyze-competitors.md", artifact: competitor-analysis }
outputs:
  produces:
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context }
    - { path: ".agents/product-marketing-context.md", artifact: marketing-context-legacy }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Feature Marketing Insights

## Purpose

Build the product marketing context from the ground up by systematically mining ExampleProduct feature specs. Produces weighted, validated, bloat-free marketing ammunition — not engineering descriptions.

**Announce at start:** "I'm using the analyze-marketing skill to analyze marketing potential."

This skill owns the entire marketing context document (`.agents/product-marketing-context.md`):
- **Foundation** (sections 1-12): Product overview, audience, pain points, competitors, voice, proof points
- **Layer 1 (atomic insights)**: Individual feature traits with full metadata — one trait, one claim, one weight
- **Layer 2 (narratives)**: Cross-feature combinations that reference Layer 1 by ID

**Core principle:** Marketer brain, not engineer brain. "7-dimension matching algorithm" is engineering. "Find a co-builder who matches your AI tools, timezone, and shipping speed" is marketing.

## Canonical output: `docs/specs/marketing-context.md` (WI-135)

Per WI-135, the canonical svc-path output is `docs/specs/marketing-context.md`. The legacy path `.agents/product-marketing-context.md` remains supported for backward compatibility (coreyhaines-pattern interop), but the svc-canonical reader for downstream skills (validate-feature, find-opportunity, copywriting, landing-page) is the new path.

### Update, don't overwrite

If `docs/specs/marketing-context.md` already exists when this skill runs, the skill MUST update it in place rather than rewrite from scratch. Preserve prior insights and revision history. Append a revision-log entry at the bottom of the file:

```markdown
## Revision Log

| Date | Mode | Change | Source |
|------|------|--------|--------|
| 2026-04-28 | refresh | Added insights for billing/security categories | feature-billing.md |
```

If the file does not exist, generate fresh.

### No-duplication coverage matrix

`docs/specs/marketing-context.md` exists alongside several other context artifacts. Each piece of content has exactly ONE owner. Skills MUST NOT duplicate content across these files; they reference by ID/path instead.

| Content type | Owner | Notes |
|--------------|-------|-------|
| Positioning statement, target audience, key messages, voice & tone, proof points (testimonials, case studies, awards) | `docs/specs/marketing-context.md` | The canonical marketing source-of-truth. Downstream skills consume this. |
| Industry vertical, framework conventions, regulatory constraints, technical stack profile | `docs/specs/domain-profile.md` | Domain layer. Marketing context REFERENCES domain-profile but does not restate it. |
| Per-feature mining state (weight, validation, ID assignments, bloat audit history) | `docs/marketing/feature-mining-tracker.json` | Per-feature granular state. Marketing context summarises; tracker is the operational record. |
| User personas, segments, pain-point archetypes, journey-by-persona | `docs/specs/personas/P*.md` | Persona definitions. Marketing context REFERENCES personas by id (P1, P2, …) and does not redefine them. |

**Rule of thumb:** if the same content appears in two of these files, that's a bug. Resolve by keeping it in the file listed above and replacing the duplicate with a one-line cross-reference.

## Repository Mode Gate

Detect mode from `REPO_MODES.md` before running mining modes.

- `bootstrap`: initialize marketing context/tracker files from available specs and baseline docs.
- `convert`: map existing marketing docs/context into tracker format first, then mine incrementally.

## External Transformer Interop (coreyhaines-compatible)

This skill is the first producer for `.agents/product-marketing-context.md` in svc.

Contract:
- Keep `.agents/product-marketing-context.md` as canonical shared path.
- Run `analyze-marketing` first to produce tracker-backed insights and foundation sync.
- If coreyhaines `product-marketing` runs, it must start from the existing file and transform/adapt it rather than replacing svc insight payload.
- Preserve compatibility mirror behavior for `.claude/product-marketing-context.md` only as optional bridge.

## Critical Design: Iterative Batches

**This skill processes 3-4 features per conversation, NOT all at once.**

The tracker (`docs/marketing/feature-mining-tracker.json`) is the persistent state between sessions. Each invocation:
1. Reads the tracker to see what's already mined
2. Picks the next 3-4 unmined or stale features
3. Mines them, writes results to tracker + context doc
4. Outputs a **follow-up prompt** the user can paste to continue in a new conversation

This prevents context window exhaustion and keeps each session focused.

---

## Operating Modes

See references/operating-modes.md for the full "Operating Modes" section (moved verbatim).

## Pre-Flight (Every Invocation)

```
1. Read tracker -> docs/marketing/feature-mining-tracker.json
   - If missing: create empty scaffold, proceed as first Full Scan
   - If exists: extract last_mined dates for all features

2. Schema validation pass:
   - For each feature in the upcoming batch, check every insight against
     references/output-schema.md required fields
   - Fix field name errors (e.g., "audience" -> "audience_segment",
     "status: live" -> "status: active")
   - Log fixes in mining_notes, apply before mining starts

3. Determine work queue:
   - Full Scan: features sorted by priority, filter to unmined or stale
   - Refresh: features where spec file mtime > last_mined
   - Single: just the named feature

4. Comprehensively-mined check (early exit):
   - A feature is "comprehensively mined" if ALL of:
     (a) 4+ active insights exist
     (b) Top insight weight >= 70
     (c) Spec file NOT modified since last_mined
     (d) No insights have status "pending_validation"
   - For comprehensively-mined features: report "Feature X: comprehensively
     mined, skipping" and move to next feature. Do NOT re-read the full spec,
     do NOT run web research, do NOT re-evaluate. Just validate schema (step 2)
     and move on.
   - Exception: user explicitly requests re-mine ("re-mine feature-matching")

5. Pick next 3-4 from work queue (NEVER more than 4)

6. Load existing insights for deduplication:
   - Read insights arrays for ALL features in the upcoming batch from the tracker
   - These are your semantic dedup reference

7. Read foundational sections (skim, not deep-read):
   - Target audience, voice, competitive landscape — these inform how you write insights
   - **Quick Stats Reference** — load into working memory now for stat amplification in Step 2
   - Note any gaps you spot for the "Suggested Foundation Updates" output
   - Read `docs/specs/domain-profile.md` for industry positioning context
   - Read `docs/specs/analyze-competitors.md` for competitive messaging gaps — marketing angles should target whitespace, not head-on competition

8. Coverage-ledger staleness check (Mode 9 contract):
   - If the tracker has no `gap_check` entry, or it is 30+ days old, or spec statuses
     may lag deploys (any WI shipped since last mining), flag "Mode 9 due" in the
     session output. Spec headers are NOT ground truth for live/gated — reconcile
     against feature flags + deploy records before marking any insight live.
```

**Priority order** (process highest marketing value first):

| Priority | Features | Rationale |
|----------|----------|-----------|
| 1 (highest) | feature-matching, feature-conversation, feature-trust | Core differentiators |
| 2 | profiles, feature-collab, monetization | Strong user-facing value |
| 3 | discovery, referrals, feature-onboarding, teams | Growth and engagement |
| 4 (lowest) | gamification, feature-learning, feature-workspace, feature-experts, feature-privacy, feature-beta-program | Supporting/planned features |

---

## Per-Feature Mining Loop (7 Steps)

See references/mining-loop.md for the full "Per-Feature Mining Loop (7 Steps)" section (moved verbatim).

## End-of-Session Output

See references/end-of-session-output.md for the full "End-of-Session Output" section (moved verbatim).

## Key Rules

### Iterative, Not Monolithic

- **3-4 features per conversation.** Never more than 4. Context quality degrades past that. **Exception:** If the user provides an explicit pre-planned batch sequence and requests the full session, execute the complete plan — but stop early if insights become generic.
- **Tracker is persistent state.** Write after every feature, not at end of batch.
- **Follow-up prompt enables continuation.** User shouldn't need to remember what was done.
- **Skip already-mined features** in Full Scan if mined within 7 days and spec unchanged.

### Marketer Brain, Not Engineer Brain

Translate mechanisms to outcomes. If you catch yourself writing implementation details, stop and rewrite from the user's perspective.

### Live vs Planned Guardrail

- **Live features**: Market freely, present tense
- **Planned features**: Tiered penalty (see Step 5). Always mark "(Coming soon)" in context doc.
- Check spec status in `docs/specs/INDEX.md`, then reconcile with Implementation Notes status annotations (`RESOLVED`/`FIXED`/verified `UPDATED` => live, `DRIFT`/`REVERTED` => not live)

### Atomic Insights Are Sacred

- **Layer 1 (atomic):** One trait, one claim, full metadata. NEVER merge, summarize, or consolidate.
- **Layer 2 (narratives):** Cross-feature combinations referencing Layer 1 by ID. Additive only.

When you "consolidate" atomic insights, you lose the specific evidence, audience, and weight that made each one useful. Synthesis is a view on top of the data, not a replacement.

### Incremental, Not Destructive

- Never rewrite the marketing context doc from scratch
- Never delete insights (mark `"status": "deprecated"` if outdated, or `"superseded"` if replaced)
- Never reorder existing content or merge atomic insights
- Never auto-edit foundational sections — suggest updates, let user approve
- **Copy refinement exception:** You MAY update an insight's `insight` text to weave in a stat or sharpen wording — this is NOT merging or deleting. Preserve the ID, weight, audience_segment, and all metadata. Set `"updated"` to the current timestamp. Use this when stat amplification (Step 2) finds a number that directly strengthens an existing insight.

### Bloat Prevention

- **Per-session cap: 5 new insights per feature per mining session.** This prevents flooding.
- Features CAN accumulate more than 5 total insights across multiple sessions — that's fine. Accumulated coverage reflects genuine depth.
- When a new insight covers the same ground as an existing one but is sharper, mark the old one `"status": "superseded"` with `"superseded_by": "<new-id>"` in the tracker. Superseded insights are excluded from summary stats and the context doc, but remain in the tracker for audit.
- "No strong marketing angle" is valid — record with weight < 30, don't force content
- Don't add to context doc if weight < 55 (tracker only)

### Context File Quality Check

After completing a Full Scan (all 16 features), evaluate the context doc:
- Flag if total lines exceed 500 (suggest compaction)
- Flag duplicated concepts appearing in 3+ sections
- Flag engineering language that slipped through
- Rate the doc 1-10 with specific improvement actions

---

## Integration with Other Skills

| Consumer | Filter |
|----------|--------|
| **Twitter/social skills** | `weight >= 70` + `use_in` includes `"social"` + check `deployed_in` to avoid repeats |
| **Blog/content skills** | `weight >= 70` + no existing blog coverage = content gap |
| **Launch strategy** | Sort by weight descending for pitch prioritization |
| **Downstream content skills** | Append to `deployed_in` when consuming an insight |

---

## Error Handling

- **Spec file missing:** Log `"spec_missing"` in tracker, skip, include in follow-up prompt
- **Web search fails:** Proceed without, mark `"competitor_validated": false`
- **Insight already exists:** Skip silently, do not duplicate
- **Tracker corrupted:** Backup to `.bak`, create fresh tracker, warn user
- **Context doc over 500 lines:** Warn user, suggest running compaction pass
- **Context doc missing:** Scaffold foundational sections (Mode 4), then proceed

---

## Feature Spec Discovery

Feature specs live at `docs/specs/features/`. Discover them dynamically:

```bash
ls docs/specs/features/*.md 2>/dev/null
```

Read each spec to extract the feature name, status, and user-facing description
before analyzing its marketing angle. Do not hardcode feature names — use what
the current project actually has.

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-RepositoryModeTrackerPreflight --evidence command_output:.svc/analyze-marketing-preflight.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-WorkQueueBatchSelection --evidence command_output:.svc/analyze-marketing-work-queue.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-FeatureMiningEvaluation --evidence command_output:.svc/analyze-marketing-evaluation.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-InsightTrackerWrite --evidence file:docs/marketing/feature-mining-tracker.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ContextSyncAndNarratives --evidence file:docs/specs/marketing-context.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SummaryFollowupSelfVerify --evidence command_output:.svc/analyze-marketing-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Marketing context file exists | `test -f .agents/product-marketing-context.md` | |
| 2 | Has weighted insights | grep for `weight:` HTML comments in context file | |
| 3 | Feature specs mined | Tracker JSON has entries with `last_mined` dates | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: consider running Mode 6 (Capability Combinations) or Mode 7 (Quality Eval)"

Not part of progressive chains (parallel track).

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
