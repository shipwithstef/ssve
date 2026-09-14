# MiMo Code + Cutting-Edge Techniques — Complete Capability-to-Skill Mapping

**Date:** 2026-06-13
**Purpose:** Map EVERY MiMo Code native capability to EVERY relevant svc skill and cycle.
**Source:** MiMo Code source (XiaomiMiMo/MiMo-Code), MiMo model docs, svc skill contracts.

---

## Reviewer Corrections (2026-06-13, Claude)

Reviewed against the live `github.com/XiaomiMiMo/MiMo-Code` README, `references/model-registry.json`, `references/opencode-mimo-config.json`, and `CLAUDE.md`. **Feature claims verified accurate** — MiMo-Code is a real OpenCode fork and all headline features (`/goal` with judge, `/dream`, `/distill`, compose mode, Max Mode, MEMORY.md+FTS5, tree tasks, on-demand subagents) are confirmed in its README.

Corrections required:

1. **[FIXED inline] Part 5 SENSE routing** — was `mimo-v2.5` (confirmed **text-only** per opencode-mimo-config.json `modalities.input:["text"]`); SENSE is multimodal QA → changed to `mimo-v2.5-pro`.
2. **[FIXED inline] Part 5 PASS routing** — was `mimo-v2-flash`, which is **not in model-registry.json** (`resolve-model.sh` would fail). Substituted `mimo-v2.5`. To use V2-Flash, first wire it per the opencode-model-list learning (opencode.json → opencode-mimo-config.json → model-registry.json).
3. **[DECISION — not auto-applied] Reviewer-allowlist conflict** — the `mimo-code-native` profile sets `REVIEW: mimo-v2.5-pro` and Parts 1/3 propose Max Mode for `review-gate`/`review-exec`. CLAUDE.md:169-170 locks **"Out-of-scope as reviewers: Kimi, MiMo. Reviewer allowlist: {codex, claude, gemini}."** Self-review by the executing family defeats cross-model adversarial integrity. Route REVIEW/review-exec cross-model even on this host. Left for owner decision.
4. **[CAVEAT] Subagent model differs** — MiMo-Code subagents *share session context*; svc agents are *closed-input* (manifest-only). The 1:1 mapping to dispatch-waves/lens agents drops isolation guarantees. Verify before wiring.
5. **[CAVEAT] `hooks:false`/`hook_events:[]` likely understates capability** — as an OpenCode fork it inherits OpenCode's plugin hooks. Verify against MiMo-Code plugin docs before declaring hooks unsupported.
6. **[NOTE] Pricing citation** — V2-Pro ($1/$3) and V2-Omni (~$1/$3) are cited "per model-registry.json" but the registry carries **no pricing** for them (undefined). Drop the citation or add the prices.
7. **[NOTE] Host-JSON schema parity** — diff the proposed `provision/hosts/mimo-code.json` shape against `provision/hosts/opencode.json` before adding, so `setup`/lint accept it.
8. **[FRAMING] `/distill`, compose, workflow-tool** map to svc's *unbuilt* proposals (compact-to-skill, compose-workflow, routine-runner). Correct takeaway: on MiMo-Code, **skip building those svc skills — use the native features.**

Delivery: adding a profile to `model-registry.json` + a new `provision/hosts/mimo-code.json` are contract changes to hot config (`resolve-model.sh`, `setup`) → route through plan-changeset per `rules/plan-changeset-trigger.md`.

---

## Part 1: MiMo Code Features → svc Skills

### 1. Persistent Memory (MEMORY.md + checkpoint.md + SQLite FTS5)

| svc Skill | How memory helps | Cycle |
|---|---|---|
| `manage-learnings` | `/dream` auto-extracts learnings into MEMORY.md | All |
| `FRAMEWORK-STATE.md` | checkpoint-writer auto-updates state snapshots | All |
| `route-workflow` | memory search finds past routing decisions | All |
| `diagnose-bug` | memory search finds past diagnoses for same symptom | Bugfix |
| `review-gate` | memory search finds past gate decisions for similar artifacts | All |
| `evolve-framework` | memory tracks which framework changes worked | Framework |
| `teach-project` | memory provides resume context for new sessions | All |
| `recall-stack-knowledge` | memory search supplements stack knowledge | All |

**Cycle mapping:**
- Greenfield: memory provides domain/competitor research from prior sessions
- Brownfield: memory provides codebase patterns and past decisions
- Bugfix: memory provides past diagnoses and fixes
- Framework: memory tracks evolution decisions and their outcomes

### 2. `/goal` (Stop Condition with Judge)

| svc Skill | When to use /goal | Cycle |
|---|---|---|
| `execute-changeset` | Goal: "All tasks complete, tests pass, no TODOs" | All |
| `review-gate` | Goal: "All findings resolved or explicitly deferred" | All |
| `review-exec` | Goal: "Adversarial review complete, all critical findings addressed" | All |
| `plan-changeset` | Goal: "Task graph validated, all ACs covered" | All |
| `dispatch-waves` | Goal: "All waves complete, merge-back validated" | All |
| `test-journeys` | Goal: "All journey scenarios verified with evidence" | All |
| `benchmark-landing` | Goal: "Score >= 7/10 on all dimensions" | Greenfield |
| `diagnose-bug` | Goal: "Root cause identified, fix verified, regression test added" | Bugfix |

**Cycle mapping:**
- Greenfield: /goal on execute-changeset, review-gate, benchmark-landing
- Brownfield: /goal on execute-changeset, review-gate, sync-spec-code
- Bugfix: /goal on diagnose-bug, execute-changeset, verify-promotion
- Framework: /goal on evolve-framework, improve-framework, test-framework

### 3. `/dream` (Memory Consolidation)

| svc Skill | What dream extracts | Cycle |
|---|---|---|
| `manage-learnings` | Past session decisions, failure modes, verified patterns | All |
| `FRAMEWORK-STATE.md` | Architecture decisions, locked decisions | Framework |
| `concerns/REGISTRY.json` | Which concerns fired and when | All |
| `skill freshness` | Which skills were updated and when | All |

**Auto-dream interval:** Default 7 days. Matches svc's weekly compounding metric.

### 4. `/distill` (Skill Discovery)

| svc Skill | What distill produces | Cycle |
|---|---|---|
| `create-skill` | New skill from repeated workflow patterns | All |
| `compact-to-skill` (from Fable 5 plan) | Distill maps to this — packages repeated workflows into skills | All |
| `manage-learnings` | Distill captures meta-learnings about process effectiveness | All |

**Auto-distill interval:** Default 30 days. Matches svc's monthly skill freshness review.

### 5. Compose Mode (Specs-Driven Workflows)

| svc Skill | Compose mode equivalent | Cycle |
|---|---|---|
| `write-spec` | Planning phase of compose | Greenfield/Brownfield |
| `design-ux` → `design-ui` → `design-tech` | Design phases of compose | Greenfield/Brownfield |
| `plan-changeset` → `execute-changeset` → `review-gate` | Execution phases of compose | All |
| `land-changeset` → `verify-promotion` | Merge/verify phases of compose | All |

**Compose mode maps to the full greenfield lane:** write-vision → analyze-domain → ... → verify-promotion.

### 6. Max Mode (Parallel Best-of-N with Judge)

| svc Skill | When Max Mode helps | Cycle |
|---|---|---|
| `explore-solutions` | Run N alternative explorations in parallel, judge picks best | Greenfield/Brownfield |
| `design-tech` | Run N architecture proposals, judge picks best | Greenfield/Brownfield |
| `review-gate` | Run N reviewer perspectives, judge synthesizes (replaces manual debate) | All |
| `diagnose-bug` | Run N hypotheses in parallel, judge picks most likely root cause | Bugfix |
| `reverse-engineer` | Run N deconstructions, judge picks most accurate | Greenfield |

**Max Mode is the Claude Code equivalent of Multi-Agent Debate (Technique 1).**

### 7. Subagent System

| svc Skill | Subagent usage | Cycle |
|---|---|---|
| `dispatch-waves` | Parallel workers via subagents | All |
| `execute-changeset` | Task-level subagents for independent tasks | All |
| `review-exec` | Lens agents as subagents | All |
| `write-e2e` | Test generation subagent | All |
| `track-visuals` | Screenshot capture subagent | Greenfield/Brownfield |
| `benchmark-landing` | Scoring subagent | Greenfield |

**MiMo Code subagent types map to svc agents:**
- `build` agent → execute-changeset worker
- `plan` agent → plan-changeset analyzer
- `compose` agent → route-workflow orchestrator
- `explore` subagent → research/discover-skills worker

### 8. Context Management (Auto-Checkpoint + Reconstruction)

| svc Skill | Context management helps | Cycle |
|---|---|---|
| `execute-changeset` | Long task graphs benefit from auto-checkpointing | All |
| `write-journeys` | Large journey docs benefit from budgeted injection | All |
| `design-ux` | Complex state machines benefit from context reconstruction | Greenfield/Brownfield |
| `review-gate` | Multi-artifact reviews benefit from checkpoint + rebuild | All |

**Svc already has `references/context-budget.md` — MiMo Code's implementation is the runtime version of this.**

### 9. Workflow Tool (Async JS Workflows)

| svc Skill | Workflow tool equivalent | Cycle |
|---|---|---|
| `compose-workflow` (PROPOSED, not implemented) | Compose mode is MiMo Code equivalent | All |
| `dispatch-waves` | Workflow tool for parallel fan-out | All |
| `routine-runner.mjs` (PROPOSED, not implemented) | Workflow tool for async task execution | All |

**MiMo Code's workflow tool is async job management (run/status/wait/cancel), NOT equivalent to Claude Code's Dynamic Workflows (subagent orchestration).** MiMo Code's compose mode is the closer equivalent to Dynamic Workflows.

### 10. Task Tracking (Tree-Shaped T1/T1.1)

| svc Skill | Task tracking helps | Cycle |
|---|---|---|
| `execute-changeset` | Maps directly to svc's task-graph.mjs | All |
| `dispatch-waves` | Wave tracking maps to task tree | All |
| `plan-changeset` | Task decomposition maps to T1/T1.1/T1.2 | All |

**Svc already has `.svc/lane-tasks-<WI>.json` — MiMo Code's tree is the runtime version.**

---

## Part 2: MiMo Models → svc Cognitive Labels

| Model | Context | Price (in/out) | Vision | Tool Use | Thinking | Best svc Label |
|---|---|---|---|---|---|---|
| **V2.5-Pro** | 1M | $1/$3 | ✅ text+image | ✅ | ✅ | STRAT, PLAN, REVIEW, SENSE |
| **V2.5** | 1M | $0.40/$2 | ❌ text only | ✅ | ✅ | EXEC, PASS |
| **V2-Pro** | 1M | $1/$3 | ❌ text only | ✅ | ✅ | EXEC (superseded by V2.5-Pro) |
| **V2-Omni** | 1M | ~$1/$3 | ✅ text+image | ✅ | ✅ | SENSE (superseded by V2.5-Pro) |
| **V2-Flash** | 256K | Not published | ❌ text only | ✅ | ✅ | PASS (cheapest, fastest) |
| **V2.5-TTS** | N/A | Free (limited) | ❌ | ✅ | ❌ | N/A (speech synthesis) |

**Notes:**
- V2.5-Pro pricing is flat $1/$3 per MTok per model-registry.json (no tiered pricing confirmed)
- V2.5 is text-only per model-registry.json and opencode-mimo-config.json — NOT multimodal
- V2-Omni supports text+image per opencode-mimo-config.json — NOT text+image+video+audio
- V2-Flash is NOT in model-registry.json — must be added before use, or substitute V2.5
- "MiMo Auto" is a free tier channel, not a separate model — removed from table

**New profile: `mimo-code-native`** (DO NOT modify svc-default — it carries locked WI-357 decision)
```json
{
  "mimo-code-native": {
    "description": "MiMo Code host with native MiMo model routing. Separate from opencode-mimo profile.",
    "labels": {
      "STRAT": { "harness": "mimo-code", "model": "mimo-v2.5-pro", "rationale": "1M context, strongest reasoning" },
      "PLAN": { "harness": "mimo-code", "model": "mimo-v2.5-pro", "rationale": "1M context, deterministic planning" },
      "EXEC": { "harness": "mimo-code", "model": "mimo-v2.5", "rationale": "$0.40/$2, 1M context, execution" },
      "REVIEW": { "harness": "mimo-code", "model": "mimo-v2.5-pro", "rationale": "Strongest review with vision" },
      "SENSE": { "harness": "mimo-code", "model": "mimo-v2.5-pro", "rationale": "text+image multimodal sensory QA" },
      "DISC": { "harness": "native", "tool": "websearch", "rationale": "Native web search" },
      "PASS": { "harness": "mimo-code", "model": "mimo-v2.5", "rationale": "Cheapest MiMo pass-through" }
    }
  }
}
```

---

## Part 3: Cutting-Edge Techniques → MiMo Code Features

| Technique | MiMo Code Feature | How it maps |
|---|---|---|
| **1. Multi-Agent Debate** | Max Mode (parallel best-of-N + judge) | Max Mode runs N candidates, judge picks best — this IS multi-agent debate |
| **2. Experience Replay** | `/dream` (auto-extracts from session traces) | Dream reads trajectory database, extracts persistent knowledge |
| **3. HTN Planning** | Compose mode (specs-driven lifecycle) | Compose mode decomposes specs into planning→execution→review phases |
| **4. Uncertainty Quantification** | Memory system (tracks decisions in MEMORY.md) | Decision tracking via memory search + checkpoint snapshots |
| **5. Population-Based Learning** | Subagent system (parallel workers) + Max Mode | Parallel subagents explore different approaches, Max Mode judges |
| **6. Causal Reasoning** | `/dream` + memory (extracts cause-effect from traces) | Dream consolidates causal patterns from session history |
| **7. Self-Play** | Max Mode (parallel exploration of edge cases) | Max Mode can run N edge-case explorations in parallel |
| **8. Meta-Learning** | `/distill` (packages repeated workflows into skills) | Distill discovers meta-patterns and creates reusable skills |
| **9. RAR** | Memory search (mid-reasoning retrieval) | `memory` tool provides FTS5 search during reasoning |
| **10. Adaptive Temperature** | Agent config (model selection per task) | MiMo Code's agent system routes to different models per task type |

---

## Part 4: Cycle-by-Cycle Capability Matrix

### Greenfield Cycle
| Phase | MiMo Code Feature Used | svc Skill |
|---|---|---|
| Vision | Memory search (past product research) | write-vision |
| Domain | Memory search (past domain analysis) | analyze-domain |
| Competitors | Memory search (past competitor data) | analyze-competitors |
| Capabilities | Memory search (past capability matrices) | catalog-domain-capabilities |
| Personas | Memory search (past persona research) | build-personas |
| Validate | /goal (stop when validation complete) | validate-feature |
| Spec | Compose mode (planning phase) | write-spec |
| AC Audit | Memory search (past AC patterns) | audit-ac |
| Journeys | Memory search (past journey patterns) | write-journeys |
| UX Design | Compose mode (design phase) | design-ux |
| UI Design | Max Mode (N design alternatives) | design-ui |
| Logo | — | design-logo |
| Landing | Max Mode (N landing approaches) | landing-page |
| Visuals | Subagent (screenshot capture) | track-visuals |
| Tech Design | Max Mode (N architecture proposals) | design-tech |
| Solutions | Max Mode (N solution explorations) | explore-solutions |
| Code Style | Memory search (past style contracts) | define-code-style |
| Plan | Compose mode (execution planning) | plan-changeset |
| Execute | Subagents (parallel task execution) | execute-changeset |
| Visuals Diff | Subagent (screenshot diff) | track-visuals |
| Benchmark | Subagent (scoring) | benchmark-landing |
| Review Gate | /goal + Max Mode (N reviewer perspectives) | review-gate |
| Audit | Memory search (past audit patterns) | audit-implementation |
| Land | Subagent (merge + PR) | land-changeset |
| Verify | /goal (stop when verified) | verify-promotion |

### Brownfield Feature Cycle
| Phase | MiMo Code Feature Used | svc Skill |
|---|---|---|
| Sync | Memory search (past spec/code state) | sync-spec-code |
| Validate | /goal | validate-feature |
| Spec through Verify | Same as greenfield (phases 3-20) | Same skills |

### Bugfix Cycle
| Phase | MiMo Code Feature Used | svc Skill |
|---|---|---|
| Diagnose | Max Mode (N hypotheses), /goal (stop when root cause found) | diagnose-bug |
| Plan | Compose mode | plan-changeset |
| Execute | Subagents | execute-changeset |
| Review | /goal + Max Mode | review-gate |
| Audit | Memory search (past similar bugs) | audit-implementation |
| Land | Subagent | land-changeset |
| Verify | /goal | verify-promotion |

### Framework Cycle
| Phase | MiMo Code Feature Used | svc Skill |
|---|---|---|
| Test | Subagent (test runner) | test-framework |
| Evolve | Max Mode (N improvement proposals) | evolve-framework |
| Blend | Memory search (past blend patterns) | blend-external/blend-private |
| Improve | /goal + memory | improve-framework |
| Recall | Memory search | recall-stack-knowledge |
| Blast Radius | — | plan-blast-radius |
| Topology | — | track-topology-diff |
| Competitors | Memory search | refresh-competitors |

---

## Part 5: MiMo Code Host Config for svc

**New file:** `provision/hosts/mimo-code.json`

```json
{
  "name": "MiMo Code",
  "detection": {
    "envVars": ["MIMOCODE_PROJECT_DIR", "MIMO_CODE"],
    "parentProcess": "mimo"
  },
  "setupFlag": "--host mimo-code",
  "skillsPath": "~/.mimocode/skills",
  "capabilities": {
    "skills": true,
    "hooks": false,
    "plugins": true,
    "mcp": true,
    "commands": true,
    "agents": true,
    "subagents": true,
    "background_tasks": true,
    "persistent_memory": true,
    "goal_stop": true,
    "compose_mode": true,
    "max_mode": true,
    "dream_distill": true,
    "voice_input": true,
    "context_management": true,
    "workflow_tool": true,
    "task_tracking": true
  },
  "hook_events": [],
  "nativeCapabilities": ["skills", "plugins", "mcp", "commands", "agents", "subagents", "persistent_memory", "goal", "compose", "max_mode", "dream", "distill", "voice", "context_management", "workflow"],
  "task_graph": {
    "task_ui": "task tool (tree-shaped T1/T1.1)",
    "background_tasks": true,
    "skill_load_mode": "skill tool"
  },
  "model_routing": {
    "default_provider": "mimo",
    "models": {
      "strat": "mimo-v2.5-pro",
      "plan": "mimo-v2.5-pro",
      "exec": "mimo-v2.5",
      "review": "mimo-v2.5-pro",
      "sense": "mimo-v2.5-pro",
      "pass": "mimo-v2.5"
    }
  },
  "commitAttribution": "MiMo Code <contact-2a30bad810@example.invalid>"
}
```

---

## Summary: What MiMo Code Adds to svc

| svc Gap | MiMo Code Feature | Implementation |
|---|---|---|
| No persistent memory across sessions | MEMORY.md + checkpoint.md + SQLite FTS5 | Wire into manage-learnings, FRAMEWORK-STATE |
| No automatic stop condition | `/goal` with judge model | Wire into execute-changeset, review-gate |
| No automatic memory consolidation | `/dream` (auto every 7 days) | Wire into manage-learnings auto-compact |
| No automatic skill creation | `/distill` (auto every 30 days) | Wire into create-skill auto-generate |
| No parallel reasoning comparison | Max Mode (N candidates + judge) | Wire into review-gate, explore-solutions |
| No specs-driven compose workflow | Compose mode (planning→execution→review→merge) | Wire into greenfield lane |
| No intelligent context management | Auto-checkpoint + reconstruction + budgeted injection | Wire into references/context-budget.md |
| No async workflow execution | Workflow tool (run/status/wait/cancel) | Wire into dispatch-waves |

---

## Implementation Sequence (on paper only — nothing executed)

> Ordered so a future implementation pass has the *how* and *order* settled. Each item is its own WI through the chain (all touch hot config: `model-registry.json`, `provision/hosts/`, `setup`). **Prerequisites first — they block everything downstream.**

### Prerequisites (must clear before any wiring)

| # | Prerequisite | Why it blocks | Proof it's cleared |
|---|--------------|---------------|--------------------|
| P1 | Wire `mimo-v2-flash` into the model layer (or decide to drop it) | Host config routes PASS to it; `resolve-model.sh` fails on an unknown id | `bash scripts/resolve-model.sh PASS --json` resolves under the new profile |
| P2 | Resolve the **reviewer-allowlist** conflict (CLAUDE.md:169-170) | MiMo can't be its own reviewer; the profile's `REVIEW: mimo-v2.5-pro` violates `{codex,claude,gemini}` | Documented decision: REVIEW/review-exec route cross-model even on mimo-code host |
| P3 | Confirm `provision/hosts/mimo-code.json` schema parity vs `opencode.json` | `setup`/lint reject unknown host-JSON shapes | `node scripts/lint-skills-manifest.mjs` + a `./setup --host mimo-code` dry-run pass |
| P4 | Confirm hook capability (OpenCode-fork plugin hooks) — `hooks:false` may be wrong | Under-declaring drops telemetry; over-declaring breaks install | Verified against MiMo-Code plugin docs; `hook_events` set accordingly |

### WIs (each its own chain run)

| WI | Scope | Chain | Depends on | Proof-of-done | Rollback |
|----|-------|-------|------------|---------------|----------|
| **WI-MIMO-1** Add `mimo-v2-flash` to registry | opencode.json → opencode-mimo-config.json → model-registry.json (per the opencode-model-list learning) | CHAIN | — | `resolve-model.sh` resolves v2-flash; registry pricing/modalities present | `git revert` 3 files |
| **WI-MIMO-2** Add `provision/hosts/mimo-code.json` | new host file, schema-parity with opencode.json; SENSE→v2.5-pro, PASS→v2-flash(after P1)/v2.5 | CHAIN | P1, P3, P4 | lint PASS; `./setup --host mimo-code` dry-run OK | `git rm` host file |
| **WI-MIMO-3** Add `mimo-code-native` profile | new profile in model-registry.json; REVIEW routed cross-model per P2; **do NOT touch svc-default** | CHAIN | P2 | `SVC_MODEL_PROFILE=mimo-code-native bash scripts/resolve-model.sh EXEC/REVIEW/SENSE --json` returns expected harness/model | `git revert` profile block |
| **WI-MIMO-4** Skip-on-this-host markers | document that on mimo-code, native `/distill`+compose replace the unbuilt svc `compact-to-skill`/`compose-workflow`/`routine-runner` (do not build duplicates) | DIRECT (docs) | WI-MIMO-2 | doc note exists in REPO_MODES/host section | `git revert` |

> **Out of scope for this doc (the "wire into X" column above is aspiration, not committed work):** wiring memory/`/goal`/Max Mode into individual svc skills are separate feature WIs, each needing their own write-spec — they are NOT part of the host-enablement sequence and must not be assumed done.
