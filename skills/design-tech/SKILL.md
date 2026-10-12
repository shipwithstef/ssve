---
name: design-tech
version: "1.0"
handles_concerns:
  - paid-external-api
  - data-model-mutation
description: >
  Define architecture, tech choices and component design for a feature spec that has
  finished UX and UI design, before planning. Use for "tech design", "architecture for
  this feature", "how should we build X".
phases:
  - id: P1-SpecJourneyDiscussionPreflight
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/journeys/J*-<name>.feature.md", "docs/specs/discussions/<topic>.md when present"]
    writes: [".svc/pipeline-decisions.jsonl when discussion routing affects design"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-CodebasePatternAnalysis
    trigger: always
    reads: ["src/", "app/", "lib/", "components/", "package.json", "go.mod", "requirements.txt", "pyproject.toml"]
    writes: [".svc/design-tech-codebase-analysis.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-ArchitectureAlternativesAndDiagrams
    trigger: always
    reads: ["references/design-alternatives.md", "docs/specs/features/<name>.md", "docs/specs/ui/<name>.md"]
    writes: ["docs/specs/features/<name>.md", "docs/specs/tech/<name>.md when using separate tech output"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-CostOpsFeasibilityRiskDesign
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/journeys/J*-<name>.feature.md", "docs/specs/analyze-competitors.data.json when present"]
    writes: ["docs/specs/features/<name>.md", "docs/specs/tech/<name>.md when using separate tech output"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-G4ReviewAndDecisionLogging
    trigger: always
    reads: ["docs/specs/features/<name>.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/pipeline-decisions.jsonl", ".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-BaselinedSpecSelfVerify
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/tech/<name>.md when using separate tech output"]
    writes: ["docs/specs/features/<name>.md"]
    evidence_kind: file
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
    - { path: "docs/specs/journeys/J*-<name>.feature.md", artifact: journey-docs }
  optional:
    - { path: "docs/specs/ux/<name>.md", artifact: ux-design }
    - { path: "docs/specs/ui/<name>.md", artifact: ui-design }
outputs:
  produces:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec, status: BASELINED }
chain:
  lanes:
    greenfield: { position: 15, prev: track-visuals, next: explore-solutions }
    brownfield-feature: { position: 11, prev: track-visuals, next: explore-solutions }
    refactor: { position: 2, prev: sync-spec-code, next: plan-changeset }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Writing Technical Design

**Runtime v2 continuation:** Register the baselined spec and its declared consumers via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
Preserve architecture, security, data, operations and G4 obligations.

## Overview

Technical design answers HOW to build what the spec defines. It takes a DESIGNED feature spec (after UX and UI design) and produces the architecture, component design, data model, and technology decisions needed to implement it.

This skill transitions a feature spec from DESIGNED → BASELINED.

```
write-spec              → DRAFT (WHAT: stories, ACs, journeys)
design-ux         → UX-REVIEWED (HOW users experience it: flows, states)
design-ui         → DESIGNED (HOW it looks: components, visual language)
design-tech  → BASELINED (HOW to build it: architecture, data model)
plan-changeset        → implementation manifest + task graph
execute-changeset      → CHANGE-SET-APPROVED (DO: execute the plan on branch)
land-changeset      → PROMOTED (APPLY: reviewed branch state to codebase)
verify-promotion       → VERIFIED (PROVE: tests pass, QA complete)
```

**Announce at start:** "I'm using the design-tech skill to define the technical approach."

## Product Questions — shared format

Ground architecture, concurrency, scalability and cost choices in the current spec and affected implementation dependencies. Follow `_shared/product-question-format.md` with `phase: design-tech`. Reuse accepted decisions and task authorization; ask only unresolved consequential owner choices. Record real decisions in the existing companion or canonical decision artifact. No empty companion or numeric question floor is required. Unresolved consequential decisions block dependent work. BASELINED requires the shared promotion predicate.

## Discussion Artifact Pre-Flight

Before finalizing architecture, check for a matching discussion artifact at
`docs/specs/discussions/<topic>.md`.

If one exists:

- read it before making technical choices in the same area
- treat `decided` rows as fixed inputs to the technical design
- if the artifact status is `blocked`, stop and surface the blocker instead of designing through it
- if the artifact status is `rerouted`, hand off to `recommended_next_skill`
- if technical design encounters unresolved one-way-door ambiguity not already
  covered by an active discussion artifact, route to `discuss-phase` before completing G4

## Design Alternatives

For each key decision in this phase (architecture, data model, API pattern,
state management), follow the Design Alternatives Protocol
(`references/design-alternatives.md`).

## Solution Confidence Mode

Before finalizing technical design, check `.svc/lane-tasks-<WI>.json`,
the active decision workspace, and the latest user prompt for
`solution_confidence_required: true` or confidence phrases such as "best
solution", "right design", "all cards on the table", "golden standard",
"real examples", "cost/caching", or "before the plan".

When active, load `references/solution-confidence-protocol.md` and inspect
`solution_confidence_mode`.

- `design_auto`: produce or update
  `docs/specs/decisions/<YYYY-MM-DD-slug>/SOLUTION-CONFIDENCE.md`, complete the
  technical design work needed to choose the direction, then continue through
  the normal lane.
- `post_design_human_gate`: produce or update
  `docs/specs/decisions/<YYYY-MM-DD-slug>/SOLUTION-CONFIDENCE.md`, complete the
  technical design work needed to choose the direction, then stop before
  `plan-changeset` for user approval.
- `intake_only`: append evidence to the decision workspace and stop at the
  explicit intake boundary instead of writing a final technical design.

Human gates are not default. They happen after design only when explicitly
requested.

The confidence artifact must cover current implementation, prior decisions,
web/mobile/native surfaces, user perception, cache/freshness classes, cost
model, options considered, tradeoff matrix, action-by-action approval packet,
outcome coverage, proof gates, and triage of external/AI suggestions.
Repository inspection and reasoning are ANALYSIS, never internal research.
There is no five-example floor and no mandatory external examples merely because
confidence was requested. Invoke `research` only when `researchDecision(question)`
from `scripts/lib/research-decision.mjs` returns `external_research_required`. The approval packet must state what changes,
why each action exists, how it would be achieved, positive outcome,
negative/risk outcome, impact if skipped, and required proof before closeout.
Suggestions from Base44 or other assistants must be evaluated as evidence, not
accepted. `plan-changeset` waits for this artifact to select a direction or
record a measured "not ready yet" stop; after that it proceeds automatically
unless `post_design_human_gate` is active. In `post_design_human_gate`, do not
ask the user to approve until the approval packet is complete.

## Capability and Inertia Pre-Flight

Before choosing an architecture that extends an existing integration, SDK,
framework pattern, or API surface, prove that the foundation is still the
right one to build on.

1. Identify capability assumptions in the spec: external APIs, host features,
   provider permissions, SDK methods, browser/native APIs, data stores,
   payment/auth/search/geocoding/AI services, and any "we can just..." claim.
2. If availability is uncertain, run the smallest code or provider scan before
   finalizing design. Use project-local truth first, then route to the right
   skill:
   - missing business capability -> `validate-feature`
   - unknown provider/API behavior -> local analysis first; `research` only if `researchDecision(question)` from `scripts/lib/research-decision.mjs` returns `external_research_required`. A new dependency/configuration/API choice is a consequential amendment, not an automatic research trigger. Bind `requesting_decision_id` and `requesting_task_id`; completed status is not resolution; do not fabricate a completed `research` receipt when only local analysis ran
   - capability inventory or project-fit question -> `capability-registry` /
     `capability-concierge`
   - auth/token/provider setup blocker -> the provider environment skill
3. If the work extends existing code, scan the affected files for deprecated
   foundations:

```bash
node scripts/validate-deprecated-foundations-registry.mjs --root .
node scripts/scan-deprecated-foundations.mjs --root . --path <file-or-dir> --first-hit-codebase-scan --promote-findings .svc/deprecated-foundation-findings.jsonl --fail-on-findings
```

4. If the scan finds a deprecated foundation, stop normal design and record a
   migrate-vs-extend decision in the technical design. A deliberate extension
   must name the successor, migration size, why migration is deferred, and the
   child WI that owns the migration debt. Confirmed project-local findings are
   promoted per `references/deprecated-foundations-lifecycle.md`.

Do not design through a capability blocker. Route before implementation churn.

**Adversarial Engineering Review** — After the tech design is drafted, P0 challenges it interactively (max 8 issues per section). Tag every recommendation `[Layer 1]` tried-and-true, `[Layer 2]` new-and-popular (needs stronger justification), `[Layer 3]` first principles or `[EUREKA]`, plus a `[Confidence: X/10]` score (below 5 goes to an appendix unless it is a P0 production risk). Review architecture (end-to-end data flow, a System Contract Map for cross-runtime flows, feature toggles and realistic mocks for every external dependency, and a first-demo that runs locally with no credentials), code quality, tests, performance, and motion (animate only `transform`/`opacity`; animating `top`/`left`/`width`/`height`/`margin` is not allowed because it forces layout on every frame). Include ASCII diagrams for data flow, state machines, dependency graphs and pipelines, updated in the same commit as the design. If the design adds 8+ new files or 2+ new classes/services, pause and run the scope-reduction trigger: explain what is overbuilt, propose a minimal version, and ask the team whether to reduce. Details: `references/adversarial-engineering-review.md`.

Cross-system flows (OAuth, hosted login, SSO, payments, webhooks, deep links) require a System Contract Map; the full rule is in that reference.

## When To Use

- After design-ui produces a DESIGNED feature spec
- When a feature's requirements are clear but the technical approach isn't
- When the team needs to evaluate feasibility before committing to implementation
- Before invoking plan-changeset

## Prerequisites

| Artifact | Where | Required? |
|----------|-------|-----------|
| Feature spec (DESIGNED) | `docs/specs/features/<feature>.md` | Yes — must have user stories + ACs + UX and UI design |
| Journey doc(s) | `docs/specs/journeys/J*.feature.md` | Yes — must reference the feature's ACs |
| Style contract | `docs/specs/style-contract.md` | Optional — if exists, use its patterns. Produced by define-code-style AFTER this phase in greenfield. In brownfield, usually exists. |
| Domain profile | `docs/specs/domain-profile.md` | Tech stack, framework conventions (produced by analyze-domain) |

**Gate:** Do not start technical design without a DESIGNED spec (after UX and UI design). If the spec doesn't exist or lacks user stories and ACs, route to `write-spec` first. If UX/UI design hasn't been done, route to `design-ux` first. The only exception is pure background Enabler/Integration work with no human-visible surface; those skips must be explicit in the spec and journey set.

## Process

### Step 1: Read The Spec And Journeys

Read the DESIGNED feature spec and all referenced journey docs. Understand:
- What user stories need to be satisfied
- What ACs define "done"
- What journey flows exercise this feature
- What Layer 3 findings were flagged (dependencies, gaps)

### Step 2: Codebase Analysis

Scan the existing codebase (source tree and manifests such as `package.json`, `go.mod`, `pyproject.toml`) to understand current patterns and constraints, and log the findings to `.svc/design-tech-codebase-analysis.log`. Identify:
- **Tech stack:** Languages, frameworks, libraries already in use
- **Patterns:** How existing features are structured (MVC, services, hooks, etc.)
- **Data layer:** Database, ORM, API patterns
- **Testing:** What test frameworks and conventions exist
- **Boundaries:** Where this feature touches existing code

**Step 2.5: Concern Scan** — Before architecting, run `node <SKILLS_PATH>/scripts/scan-concerns.mjs --project <repo-root> --paths <planned-or-touched-files> --json`, open each matched concern's `source_file` checklist, and fold its requirements into the matching Technical Design section. CRITICAL/HIGH matches that name a specialist in `required_skills` (e.g. `review-security`, `manage-finops`) become an explicit design decision or a routed follow-on task, never left implicit. Details: `references/step-2-5-concern-scan.md`.

**Step 3: Architecture Decision** — Write the `## Technical Design` section: architecture summary, components table, data model, data flow, external dependencies and a Technology Decisions table (choice plus rationale). Two subsections are always present: a Cost Model (compute, storage, bandwidth, external API, background jobs, with scaling trigger points, a red line, and year-1 projections; a $0 claim must name the free-tier quotas used) and Operations & Ownership (owner, on-call, SLA/SLO, error budget, monitoring, alerting, runbook, failure modes, recovery, backup, dependency failure impact; "best effort" is valid only if stated explicitly). If the feature touches core mechanics (earn, redeem, verify, enroll, loyalty, points, reward), include a Competitive Tech Alternatives table, and if the landscape is populated and our tech matches no competitor, add an ADR explaining the divergence. Details: `references/step-3-architecture-decision.md`.

**Steps 4-5: Feasibility, Risks, Trade-offs** — Step 4 is the critical gate: build a Feasibility Matrix checking every spec AC against the design, with a `Persona pressure` column citing a concrete persona ID/path or `N/A - system-only` for user/admin-facing ACs. If an AC is infeasible, explain why, propose alternatives, and loop back to write-spec rather than proceeding with a design that leaves ACs unsatisfied. Step 5 adds Risks (impact, mitigation) and Trade-offs (chose, over, rationale) tables. Details: `references/steps-4-5-feasibility-risks.md`.

### Step 6: Trigger G4 Review

The technical design artifact is ready for Gate G4 review. Invoke the Review Protocol:

```
/review-gate --gate G4 --artifact docs/specs/features/<feature-name>.md --section "Implementation Notes"
```

G4 checks: All ACs feasible? Architecture sound? Risks identified? Trade-offs explicit?

**On PASS:** proceed to Step 7.
**On FAIL:** fix findings, re-trigger G4.
**On ESCALATE:** present to user.

### Step 7: Update The Feature Spec

Only after G4 PASS. Write the technical design into the feature spec and update status:

```markdown
# Feature: [Feature Name]

**Status:** BASELINED
```

Add the full technical design (architecture, components, data model, data flow, technology decisions, feasibility matrix, risks, trade-offs) under `## Implementation Notes`.

Mark all planned items as `PLANNED`:
```markdown
## Implementation Notes

- `PLANNED` — UserProfile service (new: src/services/userProfile.ts)
- `PLANNED` — ProfileCard component (new: src/components/ProfileCard.tsx)
- `PLANNED` — users table: add timezone column (migration)
```

**Decision Logging** — After the design is written into the spec, append one entry per Technology Decisions row (type `taste` if alternatives existed, `mechanical` if obvious) with `node scripts/pipeline-log.mjs append --path .svc/pipeline-decisions.jsonl --run-id <WI-ID> --skill design-tech --phase <task-id> ...`, and log the feasibility matrix summary as a single `gate-result` entry. Details: `references/decision-logging.md`.

### Step 8: Handoff

Present a summary:

```
Feature spec updated: docs/specs/features/<feature-name>.md
Status: BASELINED (was DRAFT)
Components: N new, M modified
Data model changes: [yes/no — summary]
Feasibility: [all ACs feasible / N ACs need spec revision]
Risks: [count]

Ready for solution exploration. Next step:
  "Run explore-solutions against docs/specs/features/<feature-name>.md"
```

**The terminal state is invoking explore-solutions, which then hands off to plan-changeset and execute-changeset.**

## Feedback Loops

Technical design often reveals problems upstream. Handle them:

| Discovery | Action |
|-----------|--------|
| AC is technically impossible | Route back to `write-spec` to revise the AC |
| Story assumes nonexistent capability | Route to `validate-feature` for the dependency |
| Capability availability is unknown | Run the capability/inertia pre-flight above, then route to `validate-feature`, `research`, `capability-registry`, `capability-concierge`, or the provider environment skill |
| Deprecated foundation found in target code | Record migrate-vs-extend decision; migrate now or file child WI before extending |
| Design requires new persona understanding | Route to `build-personas` (then return) |
| Journey flow doesn't match what's technically possible | Route to `write-spec` to re-run `write-journeys` |
| Existing code is too tangled to extend | Include refactoring as part of the design |

**Key principle:** It's cheaper to revise the spec now than to discover infeasibility during implementation.

### Auto-Invoke On-Demand Skills

Based on signals detected during technical design, conditionally insert these skills into the task graph:

| Signal | Skill | Insertion Point | Why |
|--------|-------|-----------------|-----|
| Cost Model pillar unanswered or requires infrastructure/platform selection | `manage-finops` | After Cost Model pillar evaluation | Hosting/provider choice blocks architecture decisions |
| Spec references tier gating, usage limits, or pricing boundaries but `docs/specs/monetization-architecture.md` is missing | `monetization-architecture` | After tech architecture pillar, before explore-solutions | Gating matrix must exist before hard-to-reverse architecture decisions |
| `researchDecision(question)` from `scripts/lib/research-decision.mjs` returns `external_research_required` (explicit user research request, or necessary freshness with reason AND external_resolvable AND insufficient current cited evidence, or consequential unresolved external question with confidence < 7) | `research` | Inline for that named scope only; bind `requesting_decision_id` and `requesting_task_id`; reuse matching task on resume; reevaluate before unblocking | External research only by the predicate. Missing ordinary confidence, missing evidence alone, local unknowns, and new dependency/API choices stay analysis. Do not fabricate a completed `research` receipt when only local analysis ran |

If any on-demand skill is inserted, update `.svc/lane-tasks-<WI>.json` with the new task and set `blocked_by` so downstream work waits for the on-demand skill's output. Log the insertion as a `mechanical` decision in `.svc/pipeline-decisions.jsonl`.

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Write code or over-spec exact file contents | That's not technical design's job | Define architecture, responsibilities, constraints, and file-level intent |
| Invent new patterns when existing ones work | Increases codebase complexity | Follow established project patterns unless they're clearly broken |
| Ignore existing tech stack | Creates maintenance burden | Use what's already there unless there's a strong reason not to |
| Design without reading ACs | Design may not satisfy requirements | Walk through every AC in the feasibility check |
| Skip risks and trade-offs | Surprises during implementation | Name them now — the team can decide if they're acceptable |
| Over-design | Premature abstraction, wasted effort | Design what the ACs require, not what might be needed someday |

## Routing

| Situation | Route to |
|-----------|----------|
| Design complete, spec BASELINED | `plan-changeset` then `execute-changeset` |
| AC not feasible, spec needs revision | `write-spec` (feedback loop) |
| Missing dependency discovered | `validate-feature` |
| Design reveals persona gap | `build-personas` (then return) |
| No DESIGNED spec exists | `design-ux` (prerequisite, or `write-spec` if no spec at all) |

## Audit Mode

When invoked with `--audit` to review existing technical design:

1. Read the technical design section in the feature spec
2. Check feasibility matrix: every AC still marked feasible given current codebase?
3. Check architecture against actual code: do the components described actually exist?
4. Check data model against actual schema: tables/columns match?
5. Check dependency versions: still current? Breaking changes since design was written?
6. Report: section-by-section PASS/WARN/FAIL

## Chrome Control Testability

For technical designs that introduce or alter layout/chrome components, verify
the UI design names every interactive chrome control with an accessible name
and stable app-controlled selector. Run:

```bash
node scripts/validate-design-chrome-testability.mjs --root .
```

This companion rule prevents later E2E positional selector exceptions by
requiring chrome controls to be testable before implementation starts.

**Retrieval-Augmented Reasoning** — When uncertain mid-design, retrieve instead of guessing: pause, analyze locally (grep, read the slice, installed docs, cited `references/knowledge/` nodes), incorporate the result, and continue. Invoke `research` only when `researchDecision(question)` from `scripts/lib/research-decision.mjs` returns `external_research_required`; a new dependency or API choice is a consequential amendment, not an automatic research trigger. Log non-trivial retrievals in `.svc/pipeline-decisions.jsonl`, and never fabricate a `research` receipt when only local analysis ran. Details: `references/retrieval-augmented-reasoning.md`.

## Pipeline Continuation

**Lane graph driven by `svc-next`.** When `.svc/lane-tasks-<WI>.json` was compiled for this work, `svc-next` alone completes this stage and picks the successor: do not mark the task completed, start or load the next task or skill, or follow a next-skill default from this section; finish through `## Handback` at the end of this file. The rules below apply only without a compiled lane graph.

### Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `design-tech` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-SpecJourneyDiscussionPreflight --evidence command_output:.svc/design-tech-preflight.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-CodebasePatternAnalysis --evidence command_output:.svc/design-tech-codebase-analysis.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ArchitectureAlternativesAndDiagrams --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-CostOpsFeasibilityRiskDesign --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-G4ReviewAndDecisionLogging --evidence command_output:.svc/design-tech-g4-review.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-BaselinedSpecSelfVerify --evidence file:docs/specs/features/<name>.md
```

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)

Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. Follow `references/task-graph-chaining-protocol.md`: treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, mark this skill's task `completed` before leaving, then load the next runnable task's skill (marking it `in_progress`) or mark it `completed` with a skip reason. Mirror status to the host UI only from the parent session (Claude `TaskList`/`TaskUpdate`; Kimi `/task` observation; in Codex, mirror only the active step in `update_plan`); a subagent (`SVC_SUBAGENT=1`) leaves mirroring to the parent, because a failed mirror call silently drifts from the file.

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Feature spec status is BASELINED | grep for "BASELINED" in `docs/specs/features/<name>.md` | |
| 2 | Technical design section exists | grep for "## Technical Design" or "## Implementation Notes" in feature spec | |
| 3 | Feasibility matrix covers all ACs | Every AC from the spec has a row in the feasibility matrix | |
| 4 | No blocking unresolved consequential decisions | Apply the shared promotion predicate. Inspect TBD/TODO as evidence-gap warnings: block missing required AC/state/dependency evidence or a consequential owner choice; explicitly defer harmless details without manufacturing answers | |
| 5 | Cost Model sub-section present and filled | grep for "### Cost Model" in feature spec Technical Design; verify all rows populated (compute, storage, bandwidth, external APIs, background jobs) + scaling trigger points + first-month/year-1 projection. Zero-cost claim must have justification. | |
| 6 | Operations & Ownership sub-section present and filled | grep for "### Operations & Ownership" in feature spec Technical Design; verify all rows populated (owner, on-call, SLA/SLO, error budget, monitoring, alerting, dashboard, runbook, failure modes, recovery, backup/restore, dependency failure impact). "Best effort" is acceptable but must be explicit. | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

### Chaining

**Under a compiled lane graph (`.svc/lane-tasks-*.json`) `svc-next` chooses the next stage: do not invoke or suggest the next skill from this section; follow `## Handback` at the end of this file. The standalone guidance below applies only when no lane graph exists.**

Apply the task-graph protocol above, then:

**If `--progressive` flag is present AND self-verify passed:**
- Check `--skip` list. If this skill is in the skip list, pass through to next.
- Invoke next skill: `explore-solutions --progressive --lane <lane>`
  - In greenfield lane: `explore-solutions --progressive --lane greenfield`
  - In brownfield-feature lane: `explore-solutions --progressive --lane brownfield-feature`

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: run `explore-solutions` if this design introduces a hard-to-reverse framework or architecture choice; otherwise continue to `define-code-style` if the approach is already established"

## Post-Compaction Recovery

If context was compacted and you lost framework state, `.svc/lane-tasks-<WI>.json` is the sole source of truth: resume the first `in_progress` task (else the first `pending` task with blockers satisfied), re-load its skill with `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`, re-read this SKILL.md, and continue. Never ghost-complete: verify `skill_receipt` exists before marking any task complete. If `.svc/.checkpoint-<WI>.checkpoint.json` names a different `next_task`, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## Skill Outcome Contract

When this skill discovers new delivery-graph signals, emit `skill_outcome` per
`references/skill-outcome-contract.md` before completing the task.

## Handback

When a compiled lane graph (`.svc/lane-tasks-<WI>.json`) drives this work, run the `CLOSEOUT` command `svc-next` printed for this stage, verbatim (it ends in `--receipt load-skill`). Never rebuild the command: the printed one carries the selected project root and WI. Then follow the card it prints and do only what its `SKILL` says. `progressive: true` means do not ask a person; it never names the next skill. Without a lane graph there is no card: skip this section and use the Chaining guidance above.
