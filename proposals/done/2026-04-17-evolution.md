# Framework Evolution — 2026-04-17

**Status:** IMPLEMENTED (2026-04-17, commit `ac60d61`)

## Method

Read [FRAMEWORK-STATE.md](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:1) first to avoid rediscovering already-landed fixes. Then compared the new WI-070 replay evidence in [2026-04-17-session-audit-wi-070.md](/home/svc-user/app-workspaces/example-marketplace/proposals/2026-04-17-session-audit-wi-070.md:1) against the current framework contract in [DOCTRINE.md](/workspace/seriousvibecoding/DOCTRINE.md:1000), [route-workflow/SKILL.md](/workspace/seriousvibecoding/route-workflow/SKILL.md:2414), [validate-feature/SKILL.md](/workspace/seriousvibecoding/validate-feature/SKILL.md:154), [diagnose-bug/SKILL.md](/workspace/seriousvibecoding/diagnose-bug/SKILL.md:98), [scripts/task-graph.mjs](/workspace/seriousvibecoding/scripts/task-graph.mjs:166), [scripts/pipeline-log.mjs](/workspace/seriousvibecoding/scripts/pipeline-log.mjs:79), and the current tier-1 validators in [validate-framework-helper-behavior.sh](/workspace/seriousvibecoding/test-framework/evals/tier-1/validate-framework-helper-behavior.sh:93) and [validate-framework-self-management.sh](/workspace/seriousvibecoding/test-framework/evals/tier-1/validate-framework-self-management.sh:117).

This pass found one new root problem and two supporting contract holes. The earlier WI-070 findings about fake `/loop`, missing host-trace discovery, and stale `Current Focus` were already fixed and are intentionally excluded here.

## Findings (by priority)

| Priority | Category | Severity | Finding |
|---|---|---|---|
| P1 | Gap | medium | Task-graph persistence is defined as a cross-host audit source, but the framework never requires audit-grade timestamp provenance or helper-mediated timestamp writes |
| P1 | Drift | medium | Skill entrypoints still teach manual `lane-tasks-<WI>.json` authoring with placeholder timestamps, which conflicts with the helper-backed router contract |
| P2 | Fragility | medium | Framework tests validate helper behavior and string contracts, but not cross-artifact time coherence between `lane-tasks-*.json` and `pipeline-decisions.jsonl` |

### P1 — Task-graph timestamp provenance is missing from the contract

**Category:** Gap
**Severity:** medium

The framework claims that `.svc/lane-tasks.json` is the cross-host source of truth and that the decision log is the structured audit trail for interrupted runs, but it only specifies shape and dependency semantics, not time provenance. [DOCTRINE.md](/workspace/seriousvibecoding/DOCTRINE.md:1027) says the decision log and task graph are replay sources; [CAPABILITIES.md](/workspace/seriousvibecoding/references/knowledge/svc/CAPABILITIES.md:137) says `Current Focus`, `lane-tasks.json`, and `pipeline-decisions.jsonl` form the continuity layer; [route-workflow/SKILL.md](/workspace/seriousvibecoding/route-workflow/SKILL.md:2455) requires `task-graph.mjs init` for graph creation but only says skills should “change `status`, add `completed_at`” afterward, not that they must use helper-generated wall-clock timestamps for those mutations. The helper itself already does the right thing by default: [task-graph.mjs](/workspace/seriousvibecoding/scripts/task-graph.mjs:174) sets `created` to `new Date().toISOString()` and [task-graph.mjs](/workspace/seriousvibecoding/scripts/task-graph.mjs:274) sets `completed_at` the same way. The WI-070 replay shows why the missing contract matters: [lane-tasks-WI-070.json](/home/svc-user/app-workspaces/example-marketplace/.svc/lane-tasks-WI-070.json:4) records `created` as `2026-04-17T00:00:00Z` and [lane-tasks-WI-070.json](/home/svc-user/app-workspaces/example-marketplace/.svc/lane-tasks-WI-070.json:20) records task 1 completion at `2026-04-17T00:20:00Z`, while the decision log only starts the run at [pipeline-decisions.jsonl](/home/svc-user/app-workspaces/example-marketplace/.svc/pipeline-decisions.jsonl:35) `2026-04-17T13:26:47.042Z`.

**Specific fix**

1. Upgrade the file-backed task-graph contract in `DOCTRINE.md`, `route-workflow/SKILL.md`, and `CAPABILITIES.md` from “valid JSON source of truth” to “audit-grade provenance source of truth.”
2. Require helper-mediated timestamp writes for graph creation and top-level task status transitions: `task-graph.mjs init` for graph creation and `task-graph.mjs set-status` for any top-level task completion/reopen.
3. Add a rule that synthetic placeholder times are forbidden in persisted task graphs unless explicitly marked as fixtures or examples outside live project logs.
4. Decide whether process-task timing also needs first-class fields (`started_at`, `completed_at`) or whether only top-level tasks must be audit-grade.

### P1 — Skill entrypoints still teach manual JSON creation with placeholder timestamps

**Category:** Drift
**Severity:** medium

The router contract moved to helper-backed task-graph creation, but some skill entrypoints still instruct the agent to write raw JSON templates. [route-workflow/SKILL.md](/workspace/seriousvibecoding/route-workflow/SKILL.md:2455) says to bootstrap with `node scripts/task-graph.mjs init ...`. In contrast, [validate-feature/SKILL.md](/workspace/seriousvibecoding/validate-feature/SKILL.md:154) says “Write `.svc/lane-tasks-<WI>.json` now using the template below” and includes `"created": "<ISO 8601 timestamp>"` at [validate-feature/SKILL.md](/workspace/seriousvibecoding/validate-feature/SKILL.md:165). [diagnose-bug/SKILL.md](/workspace/seriousvibecoding/diagnose-bug/SKILL.md:98) does the same and also carries `"created": "<ISO 8601 timestamp>"` at [diagnose-bug/SKILL.md](/workspace/seriousvibecoding/diagnose-bug/SKILL.md:108). This inconsistency is enough to produce schema-valid but forensically weak logs, especially on hosts where the model writes JSON directly instead of shelling out to the helper.

**Specific fix**

1. Replace raw creation instructions in `validate-feature` and `diagnose-bug` with helper-first bootstrap commands.
2. Keep the JSON blocks only as illustrative schemas, clearly labeled as non-persisted examples.
3. Add one reusable “task-graph mutation discipline” snippet that every task-graph skill references instead of maintaining separate raw-JSON guidance.

### P2 — The validators do not catch cross-artifact time drift

**Category:** Fragility
**Severity:** medium

The current tier-1 tests harden helper semantics but stop short of provenance validation. [validate-framework-helper-behavior.sh](/workspace/seriousvibecoding/test-framework/evals/tier-1/validate-framework-helper-behavior.sh:93) checks reopening behavior and valid appends, but it never asserts that helper-produced timestamps are used consistently across task graphs and decision logs. [validate-framework-self-management.sh](/workspace/seriousvibecoding/test-framework/evals/tier-1/validate-framework-self-management.sh:117) checks that every skill contains the task-graph source-of-truth wording, but not that the contract includes timestamp provenance or helper-only mutation rules. That means a run can pass all framework validators while still emitting impossible chronology like the WI-070 replay.

**Specific fix**

1. Add a tier-1 helper replay that:
   - initializes a graph with the helper,
   - appends a pipeline-decision event,
   - completes a task with `set-status`,
   - fails if chronology is impossible or if persisted times look like static examples.
2. Add a self-management contract assertion that the task-graph protocol explicitly requires helper-mediated timestamp writes for persisted graphs.
3. Add one tier-2 session-forensics fixture where `lane-tasks-*.json` has synthetic midnight timestamps and the expected result is a framework-gap finding.

### P3 — Track: process-task timing is still underspecified

**Category:** Opportunity
**Severity:** low

The framework now has a strong story for top-level task continuity, but process-task timing is still structurally thin. The contracts care about `process_tasks` status ordering, yet the examples and helper layer do not define `started_at` or `completed_at` for process subtasks. That was not required to identify the WI-070 issue, so I am not proposing immediate schema expansion, but it is worth tracking because future AP-27/session-forensics work will want tighter per-skill temporal evidence.

**Why not actionable yet**

The root problem can be fixed first by making top-level timestamps trustworthy. Only then is it clear whether process-task timing adds enough value to justify extra schema weight.

## Comparison delta

No external-framework delta matters for this pass. This is an internal contract-quality issue: svc already has the right helper primitives in [task-graph.mjs](/workspace/seriousvibecoding/scripts/task-graph.mjs:166) and [pipeline-log.mjs](/workspace/seriousvibecoding/scripts/pipeline-log.mjs:79); the gap is that the doctrine, skill contracts, and tests do not force those primitives to produce replay-safe chronology.

## Stale proposal audit

- Pending proposals in `proposals/` are currently [2026-04-14-blocking-discovery-halt-protocol.md](/workspace/seriousvibecoding/proposals/done/2026-04-14-blocking-discovery-halt-protocol.md:1) and [2026-04-14-parallel-wi-dispatch.md](/workspace/seriousvibecoding/proposals/done/2026-04-14-parallel-wi-dispatch.md:1). Neither covers task-graph timestamp integrity.
- Done proposals already cover adjacent but different issues:
  - helper semantic hardening in [2026-04-09-framework-improvement.md](/workspace/seriousvibecoding/proposals/done/2026-04-09-framework-improvement.md:7)
  - session continuation honesty and transcript discovery in [2026-04-17-evolution.md](/workspace/seriousvibecoding/proposals/done/2026-04-17-evolution.md:1)
- This proposal is therefore new, not stale, and not a duplicate of an implemented task-graph fix.
