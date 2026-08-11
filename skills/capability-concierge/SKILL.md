---
name: capability-concierge
version: "1.0"
handles_concerns:
  - paid-external-api
phases:
  - { id: P1-InputsFreshnessRefusal, required_for_completion: true }
  - { id: P2-RegistrySnapshotLoad, required_for_completion: true }
  - { id: P3-LensRankingSynthesis, required_for_completion: true }
  - { id: P4-EvidenceCitationValidation, required_for_completion: true }
  - { id: P5-ReportAndSummaryWrite, required_for_completion: true }
  - { id: P6-SelfVerifyContinuation, required_for_completion: true }
description: >
  Standing meta-orchestrator that reads the builder's capability registry
  (WI-104) and cross-project state snapshot (WI-105) and produces a ranked
  list of recommendations through three lenses: (1) ship-the-current-project,
  (2) idle-resource, (3) side-earning. Every recommendation cites the
  registry entry and snapshot row it came from — no hallucinated
  capabilities. Use when: "what should I do next", "what's my best move",
  "route my resources", "what am I under-using", "how do I ship Example Marketplace",
  or when any session wants a cross-resource + cross-project view of what
  to deploy where.
inputs:
  required: []
  optional:
    - { path: "~/.svc/capabilities/registry.json", artifact: capability-registry }
    - { path: "~/.svc/state-snapshot.json", artifact: state-snapshot }
    - { path: "docs/specs/project-state.md", artifact: project-state }
outputs:
  produces:
    - { path: "docs/specs/capability-concierge/<date>.md", artifact: recommendations }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🧠 [STRAT] for lens synthesis and ranking; reads precomputed state from WI-104+WI-105 — never re-derives. See `references/model-routing.md`.

# capability-concierge

Three lenses, one ranked list. Runs on-demand against precomputed state; does not maintain state of its own. Part of the WI-094 meta-orchestrator chain (WI-104 → 105 → 106 → 107 → 108).

**Announce at start:** "I'm using capability-concierge to produce a 3-lens ranking against your registry + snapshot."

**Doctrine (binding):** every recommendation MUST cite the registry entry id AND the snapshot row id it came from. If the underlying data doesn't exist (registry not seeded, snapshot not generated), the skill refuses to recommend — it does not hallucinate capabilities.

## Phase Receipt Contract

When a task graph exists, record these receipts before completing the
`capability-concierge` task:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-InputsFreshnessRefusal --evidence command_output:.svc/capability-concierge-preconditions.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-RegistrySnapshotLoad --evidence command_output:.svc/capability-concierge-load.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-LensRankingSynthesis --evidence command_output:.svc/capability-concierge-ranking.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-EvidenceCitationValidation --evidence command_output:.svc/capability-concierge-evidence.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ReportAndSummaryWrite --evidence command_output:.svc/capability-concierge-output.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/capability-concierge-continuation.log
```

## The three lenses

### Lens 1 — Ship the current project

Question: what's the smallest move that gets the highest-priority unfinished product closer to first revenue?

Inputs: `~/.svc/state-snapshot.json` (rows with `active_wi_count > 0`), optionally invokes `roadmap-evaluation` and `assess-market-readiness` under the hood if their artifacts are present.

Output: one recommendation — a concrete next WI or action in a named project, with rationale + the registry entry (capability) it depends on.

### Lens 2 — Idle resource

Question: which paid/trial resources are under-used this reset window vs their capacity?

Inputs: `~/.svc/capabilities/registry.json` — per-resource `reset_cadence` + `reset_day_of_period` + `consumed_estimate` (if populated) + `notes` flags like "EXPIRING".

Output: one recommendation naming the most under-used resource and a concrete place to deploy it (this project, another project, framework, or a side-earning bet).

### Lens 3 — Side-earning

Question: what small-bet opportunity fits the capabilities the builder actually holds?

Inputs: registry (for available CLI/host stack), snapshot (for existing project surfaces that could host a side-earner), optionally invokes `find-opportunity` filtered by holdings.

Output: one recommendation — a tiny bet with a named target outcome and the capability stack it requires.

## Invocation contract

```bash
node scripts/capability-concierge.mjs [--out docs/specs/capability-concierge/<date>.md]
```

**Preconditions (the script enforces):**
- `~/.svc/capabilities/registry.json` exists and validates.
- `~/.svc/state-snapshot.json` exists (was generated within the last 24h; older than that → the script refuses and asks the caller to refresh via `scripts/cross-project-state.mjs`).

**Output shape:** one recommendation per lens (exactly 3), written to `docs/specs/capability-concierge/<YYYY-MM-DD>.md` as a single Markdown report, with stdout returning a compact JSON summary.

## Capability Blocker Ledger

When invoked because route-workflow detected a `capability-inventory-gap`, read
`.svc/capability-blockers.jsonl` after validating it:

```bash
node scripts/validate-capability-blocker-ledger.mjs --ledger .svc/capability-blockers.jsonl
```

Use the latest unresolved blocker row as context for the recommendation. The
ledger records detection, routed owner skill, recovery attempts,
blocked-on-user state, and false positives; it does not replace
`.svc/lane-tasks-<WI>.json`.

## Recommendation schema

Each of the 3 recommendations carries:

```json
{
  "lens": "ship | idle | side-earning",
  "title": "one-line directive",
  "rationale": "why this is the best move — grounded in registry + snapshot",
  "required_resource": "<registry-id>",
  "snapshot_ref": "<row-id>",
  "acceptance_test": "observable success criterion",
  "evidence": ["registry.resources.<id>", "snapshot.rows[<id>].<field>"]
}
```

The `evidence` array MUST reference at least one registry path and one snapshot path. No evidence → the skill refuses to emit that lens's recommendation and prints a gap instead.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Registry present + valid | `builder-capability-registry.mjs validate` exits 0 | |
| 2 | Snapshot present + fresh | snapshot exists AND `generated_at` < 24h ago | |
| 3 | Exactly 3 recommendations | one per lens | |
| 4 | Every rec cites ≥1 registry path AND ≥1 snapshot path | evidence array | |
| 5 | No hallucinated resource-ids | every `required_resource` is in the registry | |
| 6 | Report written | `docs/specs/capability-concierge/<date>.md` exists | |

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

### Chaining

capability-concierge is on-demand — it does not participate in progressive chains. Downstream handoffs:
- Ship lens recs → the user opens that WI in the named project.
- Idle-resource recs → user may immediately deploy the under-used resource somewhere.
- Side-earning recs → hand off to `find-opportunity` or `stage-revenue` for refinement.
