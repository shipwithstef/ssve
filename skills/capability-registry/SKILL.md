---
name: capability-registry
version: "1.0"
description: >
  Manage the per-builder inventory of paid and free AI/dev resources (GPT
  Business, Claude Max, Kimi, Gemini, MiMo, Base44, Namecheap, etc.) with
  separate sub-budgets, quotas, reset cadence, last-verified date, and
  host mapping. Persistent JSON at `~/.svc/capabilities/registry.json`.
  Use when: "add a resource to my registry", "list my capabilities",
  "what AI tools do I have", "update my Claude Max seats", "register a
  new vendor", or when any other skill needs a machine-readable view of
  the builder's tool inventory. First WI in the WI-094 meta-orchestrator
  chain (WI-104 → 105 → 106 → 107 → 108).
phases:
  - id: P1-RegistryPathSeedResolution
    trigger: always
    reads: ["~/.svc/capabilities/registry.json", "references/capability-registry-seed.json"]
    writes: ["~/.svc/capabilities/registry.json"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-RegistryReadValidate
    trigger: always
    reads: ["~/.svc/capabilities/registry.json", "scripts/builder-capability-registry.mjs"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-CrudMutation
    trigger: add-update-remove-request
    reads: ["stdin resource JSON", "resource id", "~/.svc/capabilities/registry.json"]
    writes: ["~/.svc/capabilities/registry.json"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-ListShowOutput
    trigger: list-or-show-request
    reads: ["~/.svc/capabilities/registry.json"]
    writes: ["assistant response"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-SchemaSelfVerify
    trigger: always
    reads: ["~/.svc/capabilities/registry.json", "Self-Verify checklist"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-Continuation
    trigger: always
    reads: [".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "~/.svc/capabilities/registry.json", artifact: capability-registry }
    - { path: "references/capability-registry-seed.json", artifact: seed }
outputs:
  produces:
    - { path: "~/.svc/capabilities/registry.json", artifact: capability-registry }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🔁 [PASS] — mechanical CRUD, no reasoning required. See `references/model-routing.md`.

# capability-registry

Persistent inventory of the builder's AI/dev resources. Pure state + CRUD — no recommendations, no cross-project reads, no auto-discovery. Those live in sibling skills (WI-105 reader, WI-106 concierge, WI-107 rediscover, WI-108 diagnosis).

**Announce at start:** "I'm using capability-registry to inspect/update your resource inventory."

## Registry schema

Each entry in `~/.svc/capabilities/registry.json` is an object under `resources`:

```json
{
  "schema_version": 1,
  "resources": {
    "<resource-id>": {
      "label": "Human-readable name",
      "tier": "paid | free | trial",
      "cost_usd_monthly": 20,
      "host_cli": ["cli-name-1", "cli-name-2"],
      "reset_cadence": "monthly | weekly | daily | never",
      "reset_day_of_period": 1,
      "last_verified": "2026-04-25",
      "notes": "free-form",
      "sub_budgets": {
        "<sub-id>": {
          "label": "...",
          "quota": "string or number",
          "consumed_estimate": 0,
          "notes": "..."
        }
      }
    }
  }
}
```

## CLI

```bash
# List all registered resources (default: compact summary)
node scripts/builder-capability-registry.mjs list

# Show one resource in full
node scripts/builder-capability-registry.mjs show <resource-id>

# Add or update a resource (reads JSON from stdin)
echo '{"label":"...","tier":"paid",...}' \
  | node scripts/builder-capability-registry.mjs set <resource-id>

# Remove a resource
node scripts/builder-capability-registry.mjs remove <resource-id>

# Seed the registry from references/capability-registry-seed.json if the
# registry file does not yet exist.
node scripts/builder-capability-registry.mjs seed

# Check schema validity (used by the tier-1 validator)
node scripts/builder-capability-registry.mjs validate
```

## Capability Blocker Ledger

`capability-registry` owns capability inventory, while blocker diagnosis is
recorded in the project-local ledger at `.svc/capability-blockers.jsonl`.
Do not create a separate `capability-preflight` skill for WI-326; route-workflow
and preflight append blocker rows, then this skill or `capability-concierge`
can inspect the ledger when the blocker type is `capability-inventory-gap`.

```bash
node scripts/validate-capability-blocker-ledger.mjs --ledger .svc/capability-blockers.jsonl
```

Ledger rows are defined in `references/capability-blocker-ledger.md` and track
the blocker class, routed owner skill, recovery attempts, blocked-on-user
state, and false-positive decisions without duplicating lane task status.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Registry file exists | `test -f ~/.svc/capabilities/registry.json` after `seed` | |
| 2 | Schema version present | top-level `schema_version: 1` | |
| 3 | ≥7 seeded resources | from WI-094 illustrative inventory | |
| 4 | At least one resource has `sub_budgets` | separate-meter modeling works | |
| 5 | `list` output fits in one screen | compact default output <30 lines | |
| 6 | `validate` exits 0 on the seeded file | machine-readable schema check | |

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-RegistryPathSeedResolution --evidence command_output:.svc/capability-registry-seed.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-RegistryReadValidate --evidence command_output:.svc/capability-registry-validate.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-CrudMutation --evidence command_output:.svc/capability-registry-crud.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ListShowOutput --evidence command_output:.svc/capability-registry-list-show.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-SchemaSelfVerify --evidence command_output:.svc/capability-registry-self-verify.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-Continuation --evidence command_output:.svc/capability-registry-continuation.log
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

### Chaining

capability-registry is on-demand — it does not participate in progressive chains. Downstream: WI-105 (state reader), WI-106 (concierge), WI-107 (rediscover), WI-108 (diagnosis) all read this registry.
