---
name: plan-capabilities
version: "1.0"
handles_concerns:
  - paid-external-api
  - paid-llm-api
  - github-api-touch
  - social-media-api-touch
description: >
  Classify the project type and produce a capability plan: recommended MCPs,
  installable skills, research sources, maintenance cadence, and framework gaps.
  Use when: starting a new project, entering a new domain, detecting missing
  capabilities, "what tools do I need", "what MCPs should I add", "what skills
  should I install", "capability plan", or when route-workflow detects a new
  project type that needs environment setup.
phases:
  - id: P1-ContextLoadProjectClassification
    trigger: always
    reads: ["docs/specs/vision.md", "docs/specs/domain-profile.md", "package.json", "project-state", "builder profile"]
    writes: [".svc/plan-capabilities-classification.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-ExistingCapabilityDetection
    trigger: always
    reads: ["host skills directory", "host MCP config", ".svc/capability-registry.json"]
    writes: [".svc/plan-capabilities-existing.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-RecommendationGeneration
    trigger: always
    reads: ["project classification", "existing capabilities", "default recommendations"]
    writes: ["docs/specs/capability-plan.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-ResearchDownloadPlan
    trigger: always
    reads: ["project type", "knowledge protocol", "freshness rules"]
    writes: ["docs/specs/capability-plan.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-MaintenanceAndFrameworkGapPlan
    trigger: always
    reads: ["capability needs", "framework available skills", "maintenance cadences"]
    writes: ["docs/specs/capability-plan.md", ".svc/framework-gaps.jsonl when needed"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-CapabilityPlanRegistryWrite
    trigger: always
    reads: ["capability recommendations", ".svc/capability-registry.json"]
    writes: ["docs/specs/capability-plan.md", ".svc/capability-registry.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-RoutingNextSteps
    trigger: always
    reads: ["capability plan", "Routing After Completion table"]
    writes: [".svc/plan-capabilities-routing.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: always
    reads: ["Self-Verify table", ".svc/lane-tasks-<WI>.json", "capability plan"]
    writes: [".svc/plan-capabilities-self-verify.log"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "docs/specs/vision.md", artifact: vision }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
    - { path: "docs/specs/project-state.md", artifact: project-state }
    - { path: "package.json", artifact: package-json }
    - { path: "FRAMEWORK-STATE.md", artifact: framework-state }
outputs:
  produces:
    - { path: "docs/specs/capability-plan.md", artifact: capability-plan }
    - { path: ".svc/capability-registry.json", artifact: capability-registry }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Capability Planning

Classify the project, then decide what extra capabilities should exist
around it: skills, MCPs, research sources, downloads, and maintenance.

**Announce at start:** "I'm using plan-capabilities to map what this project needs."

**Knowledge protocol:** follow `references/knowledge-protocol.md` for extraction, storage, and staleness rules.

## What This Skill Answers

Not "what phase comes next?" — that's route-workflow.
This skill answers:

- What kind of project is this?
- What extra capabilities should be available?
- What should be installed now vs later?
- What should be researched or downloaded?
- What should be refreshed over time?
- What repeated gaps should feed back into framework improvement?

## Process

### Step 1: Read Available Context

Load only what exists — don't fail on missing artifacts:

```bash
cat docs/specs/vision.md 2>/dev/null | head -30
cat docs/specs/domain-profile.md 2>/dev/null | head -20
cat ~/.svc/builder-profile.md 2>/dev/null | head -20
cat package.json 2>/dev/null | head -15
cat pyproject.toml 2>/dev/null | head -10
cat Cargo.toml 2>/dev/null | head -10
cat docs/specs/project-state.md 2>/dev/null | head -15
```

### Step 2: Classify Project Type

Determine from vision, stack, repo shape, and domain.

| Type | Signals |
|---|---|
| **SaaS web app** | Next.js/React, auth, payments, user accounts |
| **Self-hosted product** | Docker, docker-compose, no managed auth |
| **Browser extension** | manifest.json (v3), content scripts, popup |
| **CLI / developer tool** | commander/yargs/oclif, bin entry, no UI |
| **API / backend service** | Express/Fastify/Hono, routes, no frontend |
| **Mobile app** | React Native/Expo/Flutter, app.json |
| **Infrastructure / platform** | Terraform, Helm, Kubernetes, CDK |
| **Plugin / skill / framework repo** | SKILL.md files, skill-manifest, hooks |
| **Data / ETL / analytics** | pandas, dbt, SQL pipelines, Jupyter |
| **Brownfield enterprise** | Large existing codebase, multiple services |

If multiple apply: primary = drives capability needs, secondary = modifiers.

### Step 3: Detect Existing Capabilities

Check what's already installed:

```bash
# Detect host first, then probe the correct paths
HOST="$(bash scripts/detect-host.sh 2>/dev/null || echo claude)"
case "$HOST" in
  kimi)
    ls ~/.kimi/skills/ 2>/dev/null | head -20
    cat ~/.kimi/config.toml 2>/dev/null | grep -o 'mcpServers' | head -10
    ;;
  codex)
    ls ~/.codex/skills/ 2>/dev/null | head -20
    ;;
  gemini)
    ls ~/.gemini/skills/ 2>/dev/null | head -20
    ;;
  opencode)
    ls ~/.config/opencode/skills/ 2>/dev/null | head -20
    cat ~/.config/opencode/opencode.json 2>/dev/null | grep -o '"mcpServers\|"provider' | head -10
    ;;
  *)
    ls ~/.claude/skills/ 2>/dev/null | head -20
    cat ~/.claude/settings.json 2>/dev/null | grep -o '"mcp[^"]*"' | head -10
    cat ~/.claude/plugins/installed_plugins.json 2>/dev/null | grep -o '"[^"]*@' | head -10
    ;;
esac
```

Don't recommend what's already present unless there's a reason to upgrade.

### Step 4: Generate Capability Recommendations

For each recommendation:

| Field | Required |
|---|---|
| **Name** | What to install/research |
| **Type** | `skill` / `mcp` / `reference-pack` / `research-source` / `framework-gap` |
| **Why** | Why this project type needs it |
| **Action** | `auto` (read-only) / `suggest` (needs approval) / `track` (defer) |
| **Consumer** | Which svc skill uses it |

**Action policy — never auto-install silently:**
- `auto`: read-only checks, staleness detection, capability inventory
- `suggest`: new skill install, MCP setup, repo clone, external setup
- `track`: log for later review, framework gap notes

### Step 5: Research & Download Plan

What external sources should be pulled for this project type:

| Source kind | Example | Freshness |
|---|---|---|
| Competitor repo/product | Clone for analysis | 7 days (competitors) |
| Domain reference | Industry patterns | 30 days |
| Stack convention pack | React 19 patterns | Per major version |
| Market data | IndieHackers, ProductHunt | 3 days |

### Step 6: Maintenance Plan

What should be revisited and when:

| Item | Cadence | Action |
|---|---|---|
| Competitor refresh | 7 days | `analyze-competitors --audit` |
| Domain knowledge | 30 days | `analyze-domain --audit` |
| MCP/skill relevance | Per project phase | Check if still needed |
| Dead capability pruning | Monthly | Remove unused installs |
| Framework gap review | Per project completion | Feed to `improve-framework` |

### Step 7: Framework Gap Detection

If the same capability need can't be met with current framework:
- Record it as a framework gap
- Include: what's missing, why it matters, suggested route (improve-framework / create-skill / blend-external)

## Default Recommendations by Project Type

Use as starting priors, adjust to context:

### SaaS Web App
| Name | Type | Action |
|---|---|---|
| Supabase MCP | mcp | suggest |
| Stripe/Dodo MCP | mcp | suggest |
| Vercel MCP | mcp | suggest |
| Playwright MCP | mcp | suggest |
| design-html (gstack) | skill | suggest — landing pages |
| design-shotgun (gstack) | skill | suggest — visual exploration |
| qa / qa-only (gstack) | skill | suggest — browser QA |
| browse (gstack) | skill | suggest — headless browser |
| auth/payment mock patterns | reference-pack | auto-research |
| Competitor SaaS analysis | research-source | suggest |

### Browser Extension
| Name | Type | Action |
|---|---|---|
| Chrome Web Store publishing guide | research-source | auto-research |
| Browser extension testing patterns | reference-pack | auto-research |
| track-visuals | skill | suggest — screenshot regression |
| Manifest v3 conventions | reference-pack | auto-research |

### CLI / Developer Tool
| Name | Type | Action |
|---|---|---|
| npm publishing guide | research-source | auto-research |
| GitHub Actions for releases | reference-pack | auto-research |
| Cross-platform testing | reference-pack | track |

### Self-Hosted Product
| Name | Type | Action |
|---|---|---|
| Docker/compose patterns | reference-pack | auto-research |
| cso (gstack) | skill | suggest — security audit |
| canary (gstack) | skill | suggest — post-deploy monitoring |
| Health check conventions | reference-pack | auto-research |

### Mobile App
| Name | Type | Action |
|---|---|---|
| Expo/EAS build patterns | reference-pack | auto-research |
| App Store publishing guide | research-source | auto-research |
| Mobile testing patterns | reference-pack | track |

### Infrastructure / Platform
| Name | Type | Action |
|---|---|---|
| Terraform conventions | reference-pack | auto-research |
| eks-cluster-provision | skill | suggest if AWS/EKS |
| argocd-gitops-ops | skill | suggest if GitOps |
| helm-chart-dev | skill | suggest if Helm |

### Framework / Plugin Repo
| Name | Type | Action |
|---|---|---|
| test-framework | skill | required |
| evolve-framework | skill | required |
| improve-framework | skill | required |
| blend-external | skill | required |
| create-skill | skill | required |

## Output Template

Write `docs/specs/capability-plan.md`:

```markdown
# Capability Plan

Generated: <date>
Primary type: <type>
Secondary types: <types>

## Project Classification
<evidence for classification>

## Required Now
| Name | Type | Why | Action | Consumer |
|---|---|---|---|---|

## Recommended Soon
| Name | Type | Why | Action | Consumer |
|---|---|---|---|---|

## Optional / Situational
| Name | Type | Why | Action | Consumer |
|---|---|---|---|---|

## Research / Download Plan
| Source | Kind | Why | Freshness |
|---|---|---|---|

## Maintenance Plan
| Item | Cadence | Action |
|---|---|---|

## Framework Gaps
| Gap | Why | Suggested route |
|---|---|---|
```

## Routing After Completion

| Need | Route to |
|---|---|
| Install recommended skills | `discover-skills` |
| Research a source | `research` |
| Import external patterns | `blend-external` |
| Framework gap found | `improve-framework` |
| Provisioning needed | `./setup --host <host>` |
| Continue to product work | Return to `route-workflow` |

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Project type classified | Primary type + evidence present | |
| 2 | No duplicate recommendations | Compared against detected capabilities | |
| 3 | Every item has type + action policy | Table columns complete | |
| 4 | Research items have freshness | Cadence or staleness rule present | |
| 5 | Framework gaps separated from project items | Not mixed into install list | |
| 6 | Knowledge protocol conformance | Library checked first, .version respected | |

## Phase Receipt Contract

When running in task-graph mode, emit one receipt per required phase before
marking the `plan-capabilities` task complete. Use the current task id from
`.svc/lane-tasks-<WI>.json`:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ContextLoadProjectClassification --evidence command_output:.svc/plan-capabilities-classification.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ExistingCapabilityDetection --evidence command_output:.svc/plan-capabilities-existing.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-RecommendationGeneration --evidence file:docs/specs/capability-plan.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ResearchDownloadPlan --evidence file:docs/specs/capability-plan.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-MaintenanceAndFrameworkGapPlan --evidence file:docs/specs/capability-plan.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-CapabilityPlanRegistryWrite --evidence file:.svc/capability-registry.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-RoutingNextSteps --evidence command_output:.svc/plan-capabilities-routing.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/plan-capabilities-self-verify.log
```

If a registry or framework-gap write is not applicable, still record that phase
with command-output evidence explaining why no write was needed. Do not complete
the task until all required phase ids appear in `skill_receipt.phases_executed`.

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

This skill does not chain progressively. After producing the capability plan,
route-workflow decides next steps: install skills, research sources, or
continue to product pipeline.

## Key Principles

- **Detect before recommending.** Check what's already installed.
- **Never auto-install.** Research automatically. Suggest installs explicitly.
- **Type drives recommendations.** A CLI tool doesn't need Supabase MCP.
- **Maintenance is part of the plan.** Not just what to install — when to refresh.
- **Framework gaps go to improve-framework.** Don't ignore systemic holes.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.


## Modes (added by WI-SPINE-003)

This skill supports three modes via a `--mode` flag. Default is `regular` — unchanged behavior, all existing invocations preserved.
