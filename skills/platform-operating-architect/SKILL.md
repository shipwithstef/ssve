---
name: platform-operating-architect
version: "1.0"
handles_concerns:
  - build-ship-alignment
  - capacitor-native-bridge
  - deploy-rollback-plan
  - feature-flag-rollout
description: >
  Classify how a project actually runs on a hosted or platform-constrained system,
  then produce the safe operating model for svc to coexist with it. Use when the
  user asks how to split local/dev/staging/prod, how svc should work with Base44,
  Vercel, Replit, Bolt, Firebase, Supabase, or similar platforms, what should stay
  platform-native vs move into code, how integrations should be wrapped, or what
  platform-specific opportunities and traps matter for this repo. Also use when a
  brownfield repo is clearly platform-heavy and `router-context.md` lacks a durable
  operating model.
inputs:
  required: []
  optional:
    - { path: "docs/specs/project-state.md", artifact: project-state }
    - { path: "docs/specs/router-context.md", artifact: router-context }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "package.json", artifact: package-json }
outputs:
  produces:
    - { path: "docs/specs/platform-operating-model.md", artifact: platform-operating-model }
    - { path: "docs/specs/environment-topology.md", artifact: environment-topology }
    - { path: "docs/specs/integration-boundary-map.md", artifact: integration-boundary-map }
  updates:
    - { path: "docs/specs/router-context.md", artifact: router-context }
phases:
  - id: P1-FrameworkKnowledgeLoad
    trigger: always
    reads: ["references/knowledge/svc/CAPABILITIES.md", "FRAMEWORK-STATE.md"]
    writes: ["framework knowledge notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-PlatformKnowledgeDetection
    trigger: after:P1-FrameworkKnowledgeLoad
    reads: ["references/knowledge/INDEX.md", "references/knowledge/domains/<platform>/**", "platform-identifying config"]
    writes: ["platform knowledge or research-gap notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-RepoLocalEvidenceInspection
    trigger: after:P2-PlatformKnowledgeDetection
    reads: ["docs/specs/router-context.md", "docs/specs/project-state.md", "AGENTS.md", "CLAUDE.md", "package.json", "platform config files"]
    writes: ["repo-local operating evidence notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-OperatingModelClassification
    trigger: after:P3-RepoLocalEvidenceInspection
    reads: ["framework knowledge notes", "platform knowledge notes", "repo-local operating evidence notes"]
    writes: ["docs/specs/platform-operating-model.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-EnvironmentTopologyDesign
    trigger: after:P4-OperatingModelClassification
    reads: ["docs/specs/platform-operating-model.md", "platform parity evidence"]
    writes: ["docs/specs/environment-topology.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-IntegrationBoundaryMap
    trigger: after:P5-EnvironmentTopologyDesign
    reads: ["docs/specs/platform-operating-model.md", "repo integration surfaces"]
    writes: ["docs/specs/integration-boundary-map.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-PlatformOpportunitiesAndRouterContext
    trigger: after:P6-IntegrationBoundaryMap
    reads: ["docs/specs/platform-operating-model.md", "docs/specs/router-context.md"]
    writes: ["docs/specs/router-context.md", "platform opportunity notes"]
    evidence_kind: file
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: after:P7-PlatformOpportunitiesAndRouterContext
    reads: ["Self-Verify table", ".svc/lane-tasks-<WI>.json", "platform operating artifacts"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Platform Operating Architecture

Hosted platforms are not just deployment targets. They impose an operating model.

This skill determines how a project actually runs on top of its platform, where
svc should defer, where svc should stay authoritative, how environments should be
split, and how integrations should be bounded so normal development does not
accidentally behave like production.

**Announce at start:** "I'm using the platform-operating-architect skill to define how this repo should operate on its platform."

**Knowledge protocol:** read framework knowledge first, then platform/domain knowledge, then repo-local evidence. If platform knowledge is missing, invoke `research` and persist it to the global knowledge base before finalizing advice.

## What This Skill Answers

This skill answers questions like:

- What platform is this repo actually running on?
- Is it UI-origin, code-first, or mixed/ejected?
- Is local development fully local, hosted-backend, or hybrid-forwarded?
- What is the canonical deploy flow?
- How should local / private dev / staging / production be separated?
- Which integrations stay platform-native?
- Which integrations should be wrapped in backend functions/adapters?
- What does the platform give us for free that we should lean into?
- Which repo-local docs should override generic svc behavior?

This skill does **not** deploy anything. It defines the operating contract that
other skills follow.

## Evidence Order

### 1. Framework Knowledge

Read:

- `references/knowledge/svc/CAPABILITIES.md`
- `FRAMEWORK-STATE.md`

Pull from them:

- what svc already owns
- what adjacent skills already do (`plan-capabilities`, `onboard-repo`, `design-tech`)
- whether this repo is already mapped into router-context/project-state

### 2. Platform Knowledge

Detect the platform, then read:

```bash
cat references/knowledge/INDEX.md 2>/dev/null
cat references/knowledge/domains/<platform>/CAPABILITIES.md 2>/dev/null
find references/knowledge/domains/<platform>/details -type f 2>/dev/null | sort
```

Read only the relevant detail files for:

- operating models
- local development
- deployment/runtime
- integrations
- platform AI/tooling surfaces

If no platform knowledge exists:

1. state the gap clearly
2. invoke `research`
3. persist the platform knowledge to the framework repo
4. resume this skill

### 3. Repo-Local Evidence

Read the shortest authoritative evidence first:

```bash
cat docs/specs/router-context.md 2>/dev/null
cat docs/specs/project-state.md 2>/dev/null
cat AGENTS.md 2>/dev/null
cat CLAUDE.md 2>/dev/null
cat package.json 2>/dev/null
find . -maxdepth 3 \( -name ".app.jsonc" -o -name "vercel.json" -o -name "firebase.json" -o -name "supabase.toml" -o -name "replit.nix" -o -name "replit.yaml" -o -name "wrangler.toml" \) 2>/dev/null
```

Then inspect only the platform-identifying config and client/runtime seams needed
to answer the operating-model questions.

## Platform Detection

Use concrete signals. Do not guess from the app's branding.

| Platform | Strong signals |
|---|---|
| Base44 | `base44/`, `.app.jsonc`, `@base44/sdk`, Base44 docs/contracts |
| Vercel | `vercel.json`, Next.js + Vercel docs/contracts, Vercel env/deploy docs |
| Supabase | `supabase/`, `supabase.toml`, `@supabase/supabase-js` |
| Firebase | `firebase.json`, `.firebaserc`, Firebase SDK/config |
| Replit | `.replit`, `replit.nix`, Replit deploy/runtime docs |
| Bolt | repo/docs explicitly tied to Bolt operating model |
| Mixed | multiple strong signals or platform export/eject evidence |

If multiple platforms appear:

- primary platform = system-of-record runtime/deploy authority
- secondary platform = adjunct service or hosting modifier

## Operating Model Classification

Produce an explicit classification with evidence:

### A. Project Origin

- `ui-origin`
- `code-first`
- `mixed/ejected`

### B. Runtime Model

- `hosted-backend`
- `hybrid-local-dev`
- `fully-local`

### C. Deployment Authority

- `platform-native`
- `repo-native`
- `mixed-contract`

### D. Integration Surface

- `platform connectors`
- `platform integrations`
- `backend functions/adapters`
- `direct external client access`

### E. Risk Level

- `low` — clean separation, platform contract obvious
- `medium` — mixed model, some ambiguity
- `high` — repo docs and platform behavior disagree, or dev can easily touch prod

## Environment Topology

Always produce all four environments, even if some collapse in practice:

- `local`
- `private-dev`
- `staging` or `preprod`
- `production`

For each environment, answer:

- what backend/app/project it points to
- what data it uses
- what credentials it uses
- whether UI is public or private
- whether writes are safe
- whether integrations are sandboxed or real
- what level of verification is valid there

### Required output structure

```markdown
## Environment Matrix

| Environment | Frontend | Backend / control plane | Data class | Credentials | Writes allowed | Integration mode | Valid evidence |
|---|---|---|---|---|---|---|---|
| local | ... | ... | ... | ... | ... | ... | ... |
```

Also add:

- traffic-flow notes
- promotion path between environments
- explicit "what must never happen" bullets

### Platform parity check

Before recommending a separate dev/staging backend on a hosted platform, verify
that the non-prod environment can actually represent production closely enough to
be useful.

Minimum checks:

- deployable function/resource count versus production reality
- site/app hosting limits that can block the frontend even when backend code is present
- required environment secrets for function startup
- whether the platform supports branch or environment isolation natively, or only separate app/project lineages

If non-prod plan limits materially undercut production capacity, do **not**
present a duplicated backend as the default answer. Classify it as a degraded
environment and prefer:

- local frontend against the real hosted backend when safe
- targeted dev apps only for bounded experiments
- platform-native promotion flow for final proof

Record this explicitly in `platform-operating-model.md` and `environment-topology.md`.

## Integration Boundary Map

For every external/system boundary, decide one of:

- `platform-native`
- `connector`
- `integration`
- `backend-function-adapter`
- `app client direct`

Use these rules:

- if the platform already solves it well and safely, keep it platform-native
- if secrets must stay server-side and the platform has a supported integration layer, prefer that
- if request shaping, policy, idempotency, side-effect control, sandbox/prod switching, or write safety matters, wrap it in a backend function adapter
- avoid direct client access for any integration that can hit production side effects

### Required output structure

```markdown
## Boundary Decisions

| Surface | Current path | Recommended owner | Env split | Why |
|---|---|---|---|---|
| Payments | ... | backend-function-adapter | sandbox in dev, real in prod | ... |
```

## Platform Opportunities

Do not stop at constraints. Surface leverage.

For the detected platform, answer:

- what is unusually cheap because the platform already provides it?
- what should be leaned into instead of rebuilt?
- what operational tooling already exists (logs, previews, MCP, skills, dashboards)?
- which features are easy on this platform but expensive elsewhere?

Separate:

- `Exploit now`
- `Useful later`
- `Avoid rebuilding`

## svc Interaction Rules

Define:

- which skills remain authoritative
- which platform docs/contracts override generic svc behavior
- what must be recorded in `router-context.md`
- how `project-state.md` should describe Current Focus when environment work is active
- how final verification differs from ordinary development on this platform

If a platform's official clone/eject/dev-environment story fails parity due to
hard platform limits, write that limitation into `router-context.md` so later
skills do not keep retrying the same invalid setup.

At minimum, update `docs/specs/router-context.md` when the skill discovers:

- required platform-specific skill by intent
- forbidden deploy flow
- canonical deploy/runtime contract
- integration warnings
- verification constraints

## Output Files

### 1. `docs/specs/platform-operating-model.md`

Must include:

- detected platform
- operating model classification
- deploy/runtime authority
- auth/runtime/integration boundaries
- platform opportunities
- platform traps

### 2. `docs/specs/environment-topology.md`

Must include:

- environment matrix
- traffic flow
- credential placement
- safe dev policy
- promotion path

### 3. `docs/specs/integration-boundary-map.md`

Must include:

- boundary decisions table
- adapter requirements
- sandbox/prod split
- direct-access prohibitions

### 4. `docs/specs/router-context.md` (update if needed)

Add only routing-critical rules. Do not dump the whole operating-model doc into it.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Framework knowledge loaded first | cite `references/knowledge/svc/...` before platform advice | |
| 2 | Platform identified with evidence | cite config/docs/files, not intuition | |
| 3 | Platform knowledge loaded or missing-gap stated | cite `references/knowledge/domains/<platform>/...` or name the research gap | |
| 4 | Repo-local contracts checked | mention `router-context`, repo docs, and config surfaces inspected | |
| 5 | Environment topology covers all four environments | `local`, `private-dev`, `staging/preprod`, `production` all present | |
| 6 | Integration boundary map names platform-native vs adapter-wrapped surfaces | every important external/system boundary classified | |
| 7 | Platform opportunities surfaced | advice includes leverage, not only restrictions | |
| 8 | Router-context update is minimal and routing-critical | no full-system design dump into router-context | |
| 9 | Final verification boundary stated | distinguishes ordinary dev evidence from release-proof evidence | |

## Phase Receipt Contract

When this skill runs inside a task graph, emit one receipt per completed phase
before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-FrameworkKnowledgeLoad --evidence command_output:.svc/platform-operating-architect-framework-knowledge-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-PlatformKnowledgeDetection --evidence command_output:.svc/platform-operating-architect-platform-knowledge-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-RepoLocalEvidenceInspection --evidence command_output:.svc/platform-operating-architect-repo-evidence-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-OperatingModelClassification --evidence file:docs/specs/platform-operating-model.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-EnvironmentTopologyDesign --evidence file:docs/specs/environment-topology.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-IntegrationBoundaryMap --evidence file:docs/specs/integration-boundary-map.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-PlatformOpportunitiesAndRouterContext --evidence file:docs/specs/router-context.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/platform-operating-architect-self-verify-<WI>.log
```

If platform knowledge is missing and the correct next step is `research`,
record `P2-PlatformKnowledgeDetection` with the explicit research-gap evidence
before routing away. If no task graph exists, report the same phase evidence in
the assistant response.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill\'s task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task\'s conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill\'s task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task\'s conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
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

- If platform knowledge is missing or stale: route to `research`
- If repo has no brownfield map yet: route to `onboard-repo`
- If operating model is settled and feature work is next: route to `design-tech` or the relevant lane skill
- If the advice reveals a framework gap rather than a project problem: route to `evolve-framework`

## Key Principles

- Platform-agnostic skill, platform-aware execution
- Read knowledge first, configs second, docs third, guess never
- The platform is part of the architecture, not a deployment footnote
- Dev safety beats convenience: ordinary local work must not behave like prod by accident
- Lean into platform-native strengths before rebuilding them

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
