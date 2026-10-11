---
name: explore-ux
version: "1.0"
description: >
  Competitive UX teardown of live app flows against the competitor knowledge base and
  sector reference bank. Use for "how does our UX compare to competitors", "friction
  audit", "UX benchmark", "why is our onboarding worse". For one region use propose-ux-
  improvements.
phases:
  - id: P1-KnowledgeBasePreconditionScope
    trigger: always
    reads: ["references/knowledge/competitors/*/CAPABILITIES.md", "references/landing-bank/*/INDEX.md", "docs/specs/features/<name>.md", "docs/specs/journeys/J*.feature.md"]
    writes: [".svc/ux-exploration/<WI>/scope.md", ".svc/ux-exploration/<WI>/blocker.md when precondition fails"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-CompetitiveContextLoad
    trigger: precondition-passed
    reads: ["references/knowledge/competitors/<slug>/CAPABILITIES.md", "references/knowledge/competitors/<slug>/*.md", "references/landing-bank/<sector>/INDEX.md", "references/landing-bank/<sector>/*/pattern.md"]
    writes: [".svc/ux-exploration/<WI>/competitive-context.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-BrowserExplorationEvidenceCapture
    trigger: precondition-passed
    reads: ["live app URL", "e2e/helpers/browse-auth.md when present", ".svc/ux-exploration/<WI>/scope.md"]
    writes: [".svc/ux-exploration/<WI>/*.png", ".svc/ux-exploration/<WI>/flow-notes.md"]
    evidence_kind: screenshot
    required_for_completion: true
  - id: P4-CompetitiveScoring
    trigger: precondition-passed
    reads: [".svc/ux-exploration/<WI>/flow-notes.md", ".svc/ux-exploration/<WI>/*.png", ".svc/ux-exploration/<WI>/competitive-context.md"]
    writes: ["docs/specs/ux-exploration/<run-id>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ProposalsAndRoutingWIs
    trigger: medium-or-higher-findings
    reads: ["docs/specs/ux-exploration/<run-id>.md", ".svc/ux-exploration/<WI>/flow-notes.md"]
    writes: [".svc/ux-exploration/<WI>/proposals.jsonl", "docs/specs/work-items/WI-*.md", ".svc/pipeline-decisions.jsonl"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-ReportSelfVerify
    trigger: always
    reads: ["docs/specs/ux-exploration/<run-id>.md", ".svc/ux-exploration/<WI>/proposals.jsonl", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "references/knowledge/competitors/<slug>/CAPABILITIES.md", artifact: competitor-knowledge-base }
    - { path: "references/landing-bank/<sector>/", artifact: sector-reference-bank }
  optional:
    - { path: "docs/specs/ux/<name>.md", artifact: ux-design }
    - { path: "docs/specs/journeys/J*.feature.md", artifact: journey-docs }
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
outputs:
  produces:
    - { path: "docs/specs/ux-exploration/<run-id>.md", artifact: ux-exploration-report }
    - { path: ".svc/ux-exploration/<WI>/proposals.jsonl", artifact: structured-proposals }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Competitive UX Explorer

Browse the live app and evaluate its UX against competitor best practices.
Produces actionable improvement proposals with competitive citations.

**Announce at start:** "I'm using explore-ux to perform competitive UX exploration."

**Outcome:** per-flow competitive scorecards, implementable proposals, and a WI for every
finding of Medium severity or higher. **Check:** Self-Verify below. **Boundary:** every
score cites a specific competitor and a screenshot — no ungrounded opinions.

## Hard rule — knowledge base precondition

This skill does not run without a populated competitive knowledge base, because exploration
without it produces ungrounded opinions — the exact failure mode this skill exists to
prevent. Before invocation, count `references/knowledge/competitors/*/CAPABILITIES.md` and
`references/landing-bank/*/INDEX.md`. If either count is zero:
1. **Halt** — do not proceed with exploration
2. **Route to `analyze-competitors`** (if no knowledge base) or `benchmark-landing` (if no reference bank)
3. Log the blocker in `.svc/ux-exploration/<WI>/blocker.md`

## Modes

| Mode | When | What it does |
|------|------|-------------|
| `competitive-benchmark` | You want to compare a specific flow against competitors | Browses the flow, counts steps, measures clarity, scores against competitor patterns |
| `friction-audit` | You suspect unnecessary friction in a flow | Identifies redundant steps, dead ends, cognitive load, missing shortcuts that competitors provide |
| `innovation-proposal` | You want proactive UX improvement ideas | Surfaces competitor patterns not yet adopted, proposes specific implementations with citations |

## Prerequisites

1. Competitor knowledge base exists: `references/knowledge/competitors/<slug>/CAPABILITIES.md`
2. Sector reference bank exists: `references/landing-bank/<sector>/INDEX.md`
3. Live app URL reachable
4. Journey docs or feature specs exist (for scoped exploration)

## Process

Templates for every artifact below: `references/templates.md`.

### Step 0: Scope Definition

Record mode, target URL, sector, flows, competitors to reference, and viewports in
`.svc/ux-exploration/<WI>/scope.md`.

### Step 1: Load Competitive Context

From the competitor knowledge (`CAPABILITIES.md`, flow-specific deep dives such as
`enrollment-flow.md`, `customer-complaints.md`) and the landing bank (`<sector>/INDEX.md`,
`<sector>/<anchor>/pattern.md`), extract per competitor: step count for comparable flows,
key UX patterns (auto-fill, progressive disclosure, one-tap actions), notable friction
points, and enrollment/auth mechanisms.

### Step 2: Browser Pre-flight

Use the gstack `browse` daemon when healthy, else fall back to Playwright MCP; bootstrap
auth the same way test-journeys does (`e2e/helpers/browse-auth.md`).

### Step 3: Interactive Exploration

For each flow in scope, capture a baseline screenshot, then walk the flow and record, per
step: the action (tap, fill, scroll, wait), time-to-completion, a screenshot at each state
transition, friction (confusion, extra steps, missing feedback), and the competitor
comparison ("Competitor X does this in 2 taps; ours requires 5"). Where competitor
screenshots exist in `references/landing-bank/` or captured anchors, note layout, copy,
interaction-model and step-count deltas side by side.

### Step 4: Competitive Scoring

Produce a scorecard per flow (dimension, ours, best competitor, gap, severity) covering
steps to complete, time to first value, clarity of primary action, empty states, error
recovery and mobile optimization.

Scoring scale (1-4, same as track-visuals comprehension rubric):
- **4 (Best-in-class):** Matches or exceeds top competitor
- **3 (Competitive):** Within industry norm
- **2 (Behind):** Worse than most competitors, still functional
- **1 (Critical gap):** Significantly worse, likely causing drop-off

### Step 5: Generate Proposals

For each gap with severity ≥ Medium, write a structured proposal (flow, severity,
competitor reference, current state, proposed change, expected impact, effort,
reversibility, files likely touched) and append it to
`.svc/ux-exploration/<WI>/proposals.jsonl`.

### Step 6: Write Exploration Report

Save to `docs/specs/ux-exploration/<run-id>.md`: header, flow scorecards, proposals, Quick
Wins (small effort, high impact), Strategic Changes (large or one-way), competitor patterns
not yet adopted, and evidence paths.

## Routing Rules

Route findings automatically:

- Small effort + reversible → `quick-fix` + WI
- Medium effort + affects single feature → `write-spec` + WI
- Large effort or cross-cutting → `validate-feature` + WI
- Landing-page specific → `landing-page` + WI
- Visual-only regression → `track-visuals` diff + WI
- Journey flow issue → `write-journeys` + WI
- Spec drift (competitor now does what our spec says is unique) → `sync-spec-code` + WI

Every finding of Medium severity or higher produces a WI file before the skill completes.

## Guardrails

1. **Never run without competitor knowledge.** The knowledge base precondition is a hard gate.
2. **Score against specific competitors, not generic "best practice."** Every score cites a competitor.
3. **Capture screenshots at every state transition.** A score without evidence is an opinion.
4. **Proposals are implementable.** "Be more like Toast" is not a proposal. "Replace 3-screen onboarding with 1-screen phone-number + SMS flow, matching Toast" is.
5. **Distinguish quick wins from strategic changes.** Don't bury a 2-line CSS fix inside a 6-week refactor proposal.
6. **Respect viewport differences.** A flow that scores 4/4 on desktop can score 2/4 on mobile. Score independently.

## Relationship to Other Skills

| Skill | explore-ux uses it | explore-ux replaces it? |
|-------|-------------------|------------------------|
| `analyze-competitors` | Reads its knowledge base output | No — analyze-competitors populates knowledge; explore-ux consumes it |
| `benchmark-landing` | Reads sector reference bank | No — benchmark-landing is landing-page-only |
| `track-visuals` | Captures screenshots to shared path | No — track-visuals is static screenshot analysis; explore-ux is interactive flow exploration |
| `test-journeys` | May share browser auth and screenshot conventions | No — test-journeys is AC-bound; explore-ux is AC-challenging |
| `design-ux` | Proposals may feed into design-ux | No — design-ux designs; explore-ux evaluates and proposes |

## Self-Verify

Before declaring exploration complete, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Knowledge base precondition met | `ls references/knowledge/competitors/*/CAPABILITIES.md | wc -l` > 0 | |
| 2 | Scope logged | `test -f .svc/ux-exploration/<WI>/scope.md` | |
| 3 | At least one flow scorecard exists | grep for scorecard table in report | |
| 4 | Every score cites a specific competitor | grep "Competitor" in scorecard section | |
| 5 | All screenshots saved to canonical path | `test -d .svc/ux-exploration/<WI>/` and `.png` files present | |
| 6 | Proposals structured in JSONL | `test -f .svc/ux-exploration/<WI>/proposals.jsonl` | |
| 7 | WI files created for all ≥ Medium findings | count WIs ≥ count medium+ proposals | |
| 8 | Report saved to canonical path | `test -f docs/specs/ux-exploration/<run-id>.md` | |
| 9 | No ungrounded opinions | Every finding references a competitor file or screenshot | |
| 10 | Routing decisions logged | `.svc/pipeline-decisions.jsonl` contains entries for each routed proposal | |

If any check FAILs, fix before continuing.

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `explore-ux` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-KnowledgeBasePreconditionScope --evidence command_output:.svc/ux-exploration/<WI>/precondition.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-CompetitiveContextLoad --evidence file:.svc/ux-exploration/<WI>/competitive-context.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-BrowserExplorationEvidenceCapture --evidence screenshot:.svc/ux-exploration/<WI>/<flow>-start.png
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-CompetitiveScoring --evidence file:docs/specs/ux-exploration/<run-id>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ProposalsAndRoutingWIs --evidence file:.svc/ux-exploration/<WI>/proposals.jsonl
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-ReportSelfVerify --evidence command_output:.svc/ux-exploration/<WI>/self-verify.log
```

## Pipeline Continuation

### Task-graph mode (source of truth: `.svc/lane-tasks-<WI>.json`; mirrors: Claude `TaskList`, Kimi `/task`+`TaskList`/`TaskOutput` observe-only, Codex `update_plan`)
- Treat `Invoke: /skill-name` + `metadata.skill` as routing instructions, not prose.
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume.
- In Claude Code mirror file state with `TaskList` / `TaskUpdate`; Kimi observes only; in Codex and other hosts without native task-mutation APIs, mirror only the active step in `update_plan`.
- Mark this task `completed` before leaving; then mirror. Evaluate the next task's conditions:
  runnable → mark `in_progress`, persist, load that skill; skippable → mark `completed` + skip reason.
- Per `route-workflow` Task-Graph Execution Protocol.

This skill does not advance progressive chains. It produces reports and proposals
that feed into downstream skills (`quick-fix`, `write-spec`, `validate-feature`).

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track:

1. Read `.svc/lane-tasks-<WI>.json`
2. Find the next task — First `in_progress`, else first `pending`
3. Re-load the skill
4. Re-read this SKILL.md
5. Resume from the active flow in the scope file
