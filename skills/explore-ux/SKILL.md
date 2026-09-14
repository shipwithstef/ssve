---
name: explore-ux
version: "1.0"
description: >
  Interactive competitive UX exploration on live app surfaces. Browses the app,
  compares observed UX patterns against competitor knowledge base and sector
  reference bank, and proposes specific improvements with competitive citations.
  Use when "how does our UX compare to competitors", "friction audit", "UX
  benchmark", "competitive flow analysis", "why is our onboarding worse", or
  when route-workflow detects visual/UX exploratory intent. Also use after
  test-journeys finds UX gaps that need competitive context, or when
  benchmark-landing scores are strong but general app UX is suspected weak.
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

## Hard rule — knowledge base precondition

This skill MUST NOT run without a populated competitive knowledge base.
Before invocation, verify:

```bash
# Check for competitor knowledge
ls references/knowledge/competitors/*/CAPABILITIES.md 2>/dev/null | wc -l
# Check for sector reference bank
ls references/landing-bank/*/INDEX.md 2>/dev/null | wc -l
```

If either count is zero:
1. **Halt** — do not proceed with exploration
2. **Route to `analyze-competitors`** (if no knowledge base) or `benchmark-landing` (if no reference bank)
3. Log the blocker in `.svc/ux-exploration/<WI>/blocker.md`

Running competitive UX exploration without competitive knowledge produces
ungrounded opinions — the exact failure mode this skill is designed to prevent.

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

### Step 0: Scope Definition

Define what to explore:

```markdown
| Parameter | Value |
|-----------|-------|
| Mode | competitive-benchmark / friction-audit / innovation-proposal |
| Target URL | <live app URL> |
| Sector | <sector slug from landing-bank> |
| Flow(s) | <journey IDs or "full app"> |
| Competitors to reference | <specific slugs or "all tracked"> |
| Viewports | desktop (1280) / mobile (375) / both |
```

Log to `.svc/ux-exploration/<WI>/scope.md`.

### Step 1: Load Competitive Context

Read the relevant competitor knowledge:

1. `references/knowledge/competitors/<slug>/CAPABILITIES.md` — extract UX patterns for the target flow
2. `references/knowledge/competitors/<slug>/enrollment-flow.md` or equivalent — flow-specific deep dives
3. `references/landing-bank/<sector>/<anchor>/pattern.md` — visual pattern references
4. `references/landing-bank/<sector>/INDEX.md` — sector baseline context

For each competitor, extract:
- Step count for comparable flows
- Key UX patterns (auto-fill, progressive disclosure, one-tap actions)
- Notable friction points (from customer-complaints.md if available)
- Enrollment/auth mechanisms

### Step 2: Browser Pre-flight

```bash
BROWSE="$HOME/gstack/browse/dist/browse"
if $BROWSE status 2>&1 | grep -q "Status: healthy"; then
  echo "✅ browse daemon ready"
  USE_BROWSE=true
else
  echo "⚠️  browse daemon unavailable — falling back to Playwright MCP"
  USE_BROWSE=false
fi
```

Auth bootstrap (same pattern as test-journeys):
```bash
ls e2e/helpers/browse-auth.md 2>/dev/null && cat e2e/helpers/browse-auth.md
```

### Step 3: Interactive Exploration

For each flow in scope:

**A. Navigate and capture baseline**
```bash
browse goto <target_url>
browse snapshot -i
browse screenshot .svc/ux-exploration/<WI>/<flow>-start.png
```

**B. Walk the flow step by step**

For each step:
1. Record the action required (tap, fill, scroll, wait)
2. Record time-to-completion (estimate or measure)
3. Capture screenshot at each state transition
4. Note any friction: confusion points, extra steps, missing feedback
5. Compare to competitor pattern: "Competitor X does this in 2 taps; ours requires 5"

**C. Capture competitor reference side-by-side (if available)**

If competitor screenshots exist in `references/landing-bank/` or captured anchors:
- Load competitor screenshot for comparable state
- Note deltas: layout, copy, interaction model, step count

### Step 4: Competitive Scoring

For each flow explored, produce a competitive scorecard:

```markdown
| Dimension | Ours | Best Competitor | Gap | Severity |
|-----------|------|-----------------|-----|----------|
| Steps to complete | 7 | 3 (Toast) | +4 steps | High |
| Time to first value | 45s | 12s (Square) | +33s | High |
| Clarity of primary action | 2/4 | 4/4 (Fivestars) | -2 | Medium |
| Empty state quality | 2/4 | 4/4 (TapMango) | -2 | Medium |
| Error recovery | 1/4 | 3/4 (Toast) | -2 | Critical |
| Mobile optimization | 2/4 | 4/4 (all) | -2 | High |
```

Scoring scale (1-4, same as track-visuals comprehension rubric):
- **4 (Best-in-class):** Matches or exceeds top competitor
- **3 (Competitive):** Within industry norm
- **2 (Behind):** Worse than most competitors, still functional
- **1 (Critical gap):** Significantly worse, likely causing drop-off

### Step 5: Generate Proposals

For each gap with severity ≥ Medium, generate a structured proposal:

```markdown
### Proposal: <title>

**Flow:** <flow name>
**Severity:** <Critical / High / Medium>
**Competitor reference:** <competitor slug> — <specific pattern or screenshot>
**Current state:** <what we do now>
**Proposed change:** <specific, implementable change>
**Expected impact:** <step reduction, time reduction, or qualitative improvement>
**Implementation effort:** <small / medium / large>
**Reversibility:** <two-way / one-way>
**Files likely touched:** <guess at affected components>
```

Save proposals to `.svc/ux-exploration/<WI>/proposals.jsonl`:
```json
{"ts":"ISO-8601","flow":"<flow>","severity":"high","title":"...","competitor_ref":"...","proposal":"...","effort":"medium","reversibility":"two-way"}
```

### Step 6: Write Exploration Report

```markdown
# UX Exploration Report: <project> — <date>

**Mode:** <mode>
**Target:** <URL>
**Sector:** <sector>
**Competitors referenced:** <list>
**Viewports tested:** <list>

## Flow Scorecards

<scorecards from Step 4>

## Proposals

<proposals from Step 5>

## Quick Wins (effort: small, impact: high)

<subset of proposals fitting quick-fix criteria>

## Strategic Changes (effort: large or one-way)

<subset requiring spec/plan/execute pipeline>

## Competitor Patterns Not Yet Adopted

<patterns from innovation-proposal mode>

## Evidence Paths

- Screenshots: `.svc/ux-exploration/<WI>/`
- Structured proposals: `.svc/ux-exploration/<WI>/proposals.jsonl`
- Competitive context: `references/knowledge/competitors/`
```

Save to `docs/specs/ux-exploration/<run-id>.md`.

## Routing Rules

Route findings automatically:

- Small effort + reversible → `quick-fix` + WI
- Medium effort + affects single feature → `write-spec` + WI
- Large effort or cross-cutting → `validate-feature` + WI
- Landing-page specific → `landing-page` + WI
- Visual-only regression → `track-visuals` diff + WI
- Journey flow issue → `write-journeys` + WI
- Spec drift (competitor now does what our spec says is unique) → `sync-spec-code` + WI

Every finding ≥ Medium severity MUST produce a WI file before the skill completes.

## Guardrails

1. **Never run without competitor knowledge.** The knowledge base precondition is a hard gate.
2. **Score against specific competitors, not generic "best practice."** Every score must cite a competitor.
3. **Capture screenshots at every state transition.** A score without evidence is an opinion.
4. **Proposals must be implementable.** "Be more like Toast" is not a proposal. "Replace 3-screen onboarding with 1-screen phone-number + SMS flow, matching Toast" is.
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

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

This skill does not advance progressive chains. It produces reports and proposals
that feed into downstream skills (`quick-fix`, `write-spec`, `validate-feature`).

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track:

1. Read `.svc/lane-tasks-<WI>.json`
2. Find the next task — First `in_progress`, else first `pending`
3. Re-load the skill
4. Re-read this SKILL.md
5. Resume from the active flow in the scope file
