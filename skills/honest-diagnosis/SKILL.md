---
name: honest-diagnosis
version: "1.0"
phases:
  - { id: P1-PreconditionEvidenceSourceCheck, required_for_completion: true }
  - { id: P2-SnapshotBlockerExtraction, required_for_completion: true }
  - { id: P3-RegistryResourceExtraction, required_for_completion: true }
  - { id: P4-DecisionLogPatternScan, required_for_completion: true }
  - { id: P5-DiagnosisReportWrite, required_for_completion: true }
  - { id: P6-HumanCheckpointContinuation, required_for_completion: true }
description: >-
  Evidence-graded answer to "why haven't I shipped a revenue product despite owning this framework?" — names ≥3 concrete blockers from the capability registry, cross-project snapshot, and pipeline-decisions log, each anchored to a file/line/decision entry. No platitudes. Use when: "why am I not shipping", "honest diagnosis". Also: "what's my real blocker", "what's wrong with how I work".
inputs:
  required: []
  optional:
    - { path: "~/.svc/capabilities/registry.json", artifact: capability-registry }
    - { path: "~/.svc/state-snapshot.json", artifact: state-snapshot }
    - { path: ".svc/pipeline-decisions.jsonl", artifact: decision-log }
outputs:
  produces:
    - { path: "docs/specs/honest-diagnosis/<date>.md", artifact: diagnosis }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

> **Cognitive routing:** 🧠 [STRAT] — evidence-graded reasoning over precomputed state. See `references/model-routing.md`.

# honest-diagnosis

Final skill in the WI-094 meta-orchestrator chain (WI-104 → 105 → 106 → 107 → **108**). Produces a blocker report that names concrete failure modes anchored to on-disk evidence — not vibes, not platitudes.

**Announce at start:** "I'm using honest-diagnosis to name concrete blockers with file/line citations."

**Doctrine (binding):**
1. Every blocker cites a path + line (or a decision-log entry id/timestamp).
2. If evidence is insufficient to distinguish cause X from cause Y, say so. Do NOT fabricate confidence.
3. Maximum 3 proposed next-moves, all borrowed from the capability-concierge (WI-106) ship lens. No new strategic invention here.

## Phase Receipt Contract

When a task graph exists, record these receipts before completing the
`honest-diagnosis` task:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-PreconditionEvidenceSourceCheck --evidence command_output:.svc/honest-diagnosis-preconditions.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SnapshotBlockerExtraction --evidence command_output:.svc/honest-diagnosis-snapshot.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-RegistryResourceExtraction --evidence command_output:.svc/honest-diagnosis-registry.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-DecisionLogPatternScan --evidence command_output:.svc/honest-diagnosis-decisions.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-DiagnosisReportWrite --evidence command_output:.svc/honest-diagnosis-report.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-HumanCheckpointContinuation --evidence command_output:.svc/honest-diagnosis-continuation.log
```

## What this skill looks for

Sources scanned in order:

1. **Cross-project snapshot** (WI-105) — per-project `active_wi_count`, `time_since_last_commit_hours`, `blocked_on`. Half-finished projects with stale commits = concrete blocker.
2. **Capability registry** (WI-104) — paid resources with zero tracked consumption, trial resources flagged as expiring. Unused-credit = paid leverage left on the table.
3. **Pipeline-decisions log** (`.svc/pipeline-decisions.jsonl`) — behavioral patterns: skill-hopping (≥N decision entries on the same WI with conflicting `skill` values), premature-completion (a `land-changeset` entry without a prior `audit-implementation` entry for the same `run_id`), revert loops (≥2 `revert` decisions within 48h on the same WI).

## Output contract

Diagnosis report at `docs/specs/honest-diagnosis/<YYYY-MM-DD>.md`:

```markdown
# Honest Diagnosis — <date>

## Blockers (≥3)

### B1 — <one-line name>
- **Type:** stale-project | idle-resource | skill-hopping | premature-completion | revert-loop | insufficient-data
- **Evidence:** <path:line> OR <decision-log timestamp+run_id>
- **Interpretation:** <what this means for shipping revenue>
- **Confidence:** high | medium | low (with why)

### B2 — ...

### B3 — ...

## What I can't tell from current data

<Uncertainties. Alternatives the evidence cannot distinguish. E.g.,
"I can't tell whether the Example Marketplace stall is low motivation vs. unclear
next-WI — both fit the commit-gap pattern. Resolve by asking the
builder directly or running roadmap-evaluation.">

## Proposed next-moves (max 3)

Borrowed verbatim from capability-concierge (WI-106) ship lens:
1. ...
2. ...
3. ...
```

A compact JSON summary is printed to stdout; the full report lives on disk.

## CLI

```bash
node scripts/honest-diagnosis.mjs [--out <path>]
```

Preconditions: registry + snapshot + decision log must all exist. If any are missing, the skill refuses with a specific instruction to run the prerequisite (seed registry / refresh snapshot / note about the decision-log being ambient).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | ≥3 blockers named | `## Blockers` section has ≥3 `### B` subsections | |
| 2 | Every blocker has an evidence citation | `**Evidence:**` line present for each | |
| 3 | Every evidence path exists on disk OR timestamp exists in the log | path-check + decision-log grep | |
| 4 | No platitudes | blocklist of phrases ("grind harder", "stay focused", "you've got this") | |
| 5 | Ambiguity block present if any confidence is `low` | `## What I can't tell` non-empty | |
| 6 | ≤3 proposed next-moves | borrowed from WI-106, not invented here | |
| 7 | Report written | `docs/specs/honest-diagnosis/<date>.md` exists | |

## Human Checkpoint

The skill asks the builder, in the summary: **"Does this diagnosis match your experience? If not, which blocker is wrong, and why?"** If the builder says any blocker is wrong, the skill prints a follow-up template for retro-learning capture but does not re-diagnose on its own — that would be re-invention without new evidence.

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

honest-diagnosis is on-demand and terminal — it does not hand off to another skill. After the diagnosis is read, the builder either acts on one of the proposed next-moves (via the ship lens they reference) or closes the report unchanged.
