---
name: explore-solutions
version: "1.0"
handles_concerns:
  - paid-external-api
  - cache-strategy-symmetry
  - data-model-mutation
description: >
  Challenge a chosen technical approach with alternative paradigms and evidence before
  building, for high-stakes or hard-to-reverse designs. Use for "explore alternatives",
  "is this the best approach", "compare options", "challenge the design".
phases:
  - id: P1-UpstreamContextProblemBrief
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/vision.md", "docs/specs/personas/P*.md", "docs/specs/journeys/J*.feature.md", "docs/specs/ux/<name>.md", "docs/specs/ui/<name>.md", "docs/specs/domain-profile.md"]
    writes: ["docs/specs/explorations/<name>/PROBLEM_BRIEF.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P2-ParadigmResearchSolutionMap
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/explorations/<name>/PROBLEM_BRIEF.md", "references/bootstraps/*/manifest.md"]
    writes: ["docs/specs/explorations/<name>/SOLUTION_MAP.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-ACTradeoffAnalysis
    trigger: always
    reads: ["docs/specs/explorations/<name>/PROBLEM_BRIEF.md", "docs/specs/explorations/<name>/SOLUTION_MAP.md", "docs/specs/features/<name>.md"]
    writes: ["docs/specs/explorations/<name>/ANALYSIS.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-FinalistPrototypeComparison
    trigger: full-mode-only
    reads: ["docs/specs/explorations/<name>/ANALYSIS.md"]
    writes: ["docs/specs/explorations/<name>/COMPARISON.md", "docs/specs/explorations/<name>/prototypes/"]
    evidence_kind: file
    required_for_completion: false
  - id: P5-DecisionAndTechDesignImpact
    trigger: always
    reads: ["docs/specs/explorations/<name>/ANALYSIS.md", "docs/specs/explorations/<name>/COMPARISON.md when present", "docs/specs/features/<name>.md"]
    writes: ["docs/specs/explorations/<name>/DECISION.md", "docs/specs/features/<name>.md when tech design changes"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyAndContinuation
    trigger: always
    reads: ["docs/specs/explorations/<name>/DECISION.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
  optional:
    - { path: "docs/specs/vision.md", artifact: vision }
    - { path: "docs/specs/personas/P*.md", artifact: personas }
    - { path: "docs/specs/journeys/J*.feature.md", artifact: journey-docs }
    - { path: "docs/specs/ux/<name>.md", artifact: ux-design }
    - { path: "docs/specs/ui/<name>.md", artifact: ui-design }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "references/bootstraps/*/manifest.md", artifact: bootstrap-template }
outputs:
  produces:
    - { path: "docs/specs/explorations/<name>/DECISION.md", artifact: solution-decision }
chain:
  lanes:
    greenfield: { position: 16, prev: design-tech, next: define-code-style }
    brownfield-feature: { position: 12, prev: design-tech, next: define-code-style }
  progressive: true
  self_verify: true
  human_checkpoint: true
---

> **Cognitive routing:** labels, host, model, and effort stay configurable via the active profile (`references/model-routing.md`). Alternative-paradigm comparison is analysis of current specs, code, and cited evidence; no fixed search recipe is required. Invoke search/`research` only when `researchDecision(question)` from `scripts/lib/research-decision.mjs` returns `external_research_required`.

# Solution Explorer

Challenge the technical design with alternative paradigms before committing
to implementation. `design-tech` already picked its best approach; this skill
contests that choice with local analysis, alternatives, and current cited
evidence, so the team commits with confidence rather than by default.
External research is conditional, never required per paradigm.

Derived from petekp/claude-code-setup (MIT, Copyright 2024 Pete Petrash).
Adapted for svc's spec-first pipeline with full upstream context.

**Announce at start:** "I'm using the explore-solutions skill to challenge the technical design with alternatives."

## Why This Exists

Models satisfice: `design-tech` tends to pattern-match the most common
architecture for the stated problem, which is a local maximum, not
necessarily the best fit for this project's constraints. This skill applies a
senior engineer's discipline: the initial tech design becomes Approach A, the
baseline to beat, and exploration either confirms it with evidence or finds
something better. Repository inspection and reasoning count as analysis, never
as internal research.

## When to Skip

**Skip** (auto or manual) when:
- A bootstrap template in `references/bootstraps/` covers the paradigm —
  the paradigm choice is already production-verified
- The feature is a straightforward CRUD extension of existing patterns
- All tech decisions follow established project conventions (no new
  dependencies, no new data model patterns, no new architectural layers)

**Do not skip** when `solution_confidence_required: true` is present or the
user explicitly asks for "best solution", "right design", "all cards on the
table", "golden standard", real-world examples, or cost/cache grounding. In
that mode, load `references/solution-confidence-protocol.md`; the exploration
challenges the baseline with at least three materially different options and
feeds the selected/rejected options back into `SOLUTION-CONFIDENCE.md`.
It also feeds the action-by-action approval packet: each proposed action
needs what/why/how, positive outcome, negative/risk outcome, impact if skipped,
and required proof gates before approval or planning.
If `solution_confidence_mode=design_auto`, continue through the normal lane
after the design direction is ready. If `solution_confidence_mode=
post_design_human_gate`, stop before `plan-changeset` after the design
checkpoint.

**Bootstrap template check (automatic):** before exploring, compare each
`references/bootstraps/*/manifest.md` Stack section against the tech design's
stack. If one matches (same runtime + framework + database + API pattern),
load its `decisions.md`, report "Bootstrap template '<name>' matches. Paradigm
decisions are production-verified. Skipping exploration.", and chain directly
to `define-code-style`. Otherwise explore. (Templates are created from real
repos with `extract-bootstrap`.)

**Run** (full or abbreviated) when:
- The tech design introduces a new external dependency
- The data model is new or significantly changed
- The architecture is hard to reverse (new service, new protocol, new storage engine)
- Multiple viable paradigms exist and the right one isn't obvious
- The domain-profile flags domain-specific patterns the model may not know

## Calibration

| Mode | When | Phases | Output |
|------|------|--------|--------|
| **Full** | Hard-to-reverse, novel, high-stakes | All 5 phases | All artifacts |
| **Abbreviated** | 2-3 viable approaches, analysis alone can decide | Phases 1-3 | PROBLEM_BRIEF + SOLUTION_MAP + ANALYSIS |
| **Quick** | Small feature, sanity-check the obvious choice | Phases 1-2 | PROBLEM_BRIEF + SOLUTION_MAP only |

When in doubt, start full; abbreviate once you see the landscape.

## Process

All artifacts go in `docs/specs/explorations/<feature-name>/`. Their document
shapes, the AC-to-criterion mapping, frame-shift prompts and the EUREKA entry
format are in `references/artifact-templates.md`; use those shapes so
downstream skills and the self-verify checks can read the artifacts.

### Phase 1: Frame the Problem Against Upstream Context

Load the available upstream context (vision, personas, feature spec ACs and
consumer type, journeys, UX/UI design, domain profile) and the BASELINED tech
design, which is Approach A. Then:

- **Derive success criteria from ACs.** Every AC that constrains the approach
  becomes a MUST criterion; quality attributes from design, persona and vision
  become SHOULD/NICE. Derive criteria from what the spec defines rather than
  inventing abstract ones, so the analysis stays traceable.
- **Surface the baseline's assumptions** (why this database, API pattern,
  component structure, scale and deployment target). Each is a dimension the
  exploration can challenge.

Output: PROBLEM_BRIEF.md.

### Phase 2: Explore Alternative Paradigms

A paradigm is a different strategy — a different bet about what matters most —
not a different library for the same strategy. Name the bet the current design
makes, then find alternatives (aim for 3+ paradigms including the baseline,
1-3 concrete approaches each). For each approach state how it works, what it
gains for this feature's ACs, what it gives up, complexity relative to the
codebase, and known risks. Finish by hunting for the non-obvious: reframing,
hybrids, managed services, other domains.

Analyze each paradigm from the current repo, specs, bootstraps, and cited
evidence (analysis). Per-paradigm search is not required, and requested
solution confidence does not by itself require external examples.

If `researchDecision(question)` from `scripts/lib/research-decision.mjs` returns
`external_research_required`, bind `requesting_decision_id` and
`requesting_task_id`, invoke `research` for that scope only, return updated
question/evidence/confidence, reevaluate before unblocking, and reuse a matching
existing task on resume. Completed status alone is not resolution. When external
research does run, separate product UX examples from provider/API examples and
include cost/cache/freshness lessons where relevant. External/AI suggestions are
not accepted directly; classify them as `adopt`, `modify`, `defer`, `reject`, or
`unrelated`.

**Self-improvement signal:** if a paradigm is strictly better than a baseline
that came from default pattern-matching, log a EUREKA learning (format in the
templates reference); these are the highest-value learning entries.

Output: SOLUTION_MAP.md.

### Minimum Exploration Gate

Proceed to Phase 3 only when:
- At least 3 distinct paradigms (including baseline) have substantive analysis
- At least 5 total approaches exist across paradigms
- Local analysis was conducted against current cited evidence (not uncited brainstorming); external research only if `researchDecision(question)` returned `external_research_required` for a named scope and that work actually ran
- The non-obvious section was genuinely attempted

If the baseline seems obviously best, that is the satisficing instinct this
skill counters: document why it seems obvious, then keep exploring.

### Phase 3: Analyze Against ACs

Build a tradeoff matrix of all approaches against every criterion using
concrete assessments ("~200ms p95", not "good performance"). Eliminate
approaches that fail an AC-derived MUST, with documented reasoning; rank
survivors on SHOULD/NICE; select 2-3 finalists from different paradigms; and
name the key differentiator — the single question whose answer makes the
choice clear, which Phase 4 prototyping targets. A confirmed baseline with a
documented "why not the alternative" is a valid outcome.

Output: ANALYSIS.md.

### Phase 4: Prototype Finalists (Full mode only)

Skip in abbreviated/quick mode or when Phase 3 is decisive. Otherwise build
50-200 line prototypes in `docs/specs/explorations/<feature-name>/prototypes/`
that test only the key differentiator. Define comparison criteria before
writing code, and record concrete numbers, not impressions.

Output: COMPARISON.md.

### Phase 5: Decide

- **Baseline wins:** the exploration confirms the tech design with evidence;
  document why alternatives were rejected with AC-traced reasoning. No design
  changes.
- **Alternative wins:** revise the tech design — update the BASELINED feature
  spec's Implementation Notes, feasibility matrix and component table.

Either way, produce DECISION.md with the selected approach, confidence
(integer 1..10 or null; confidence is not evidence by itself), evidence chain,
why this approach, why not each alternative, the runner-up and the condition
that would make it the choice, and the impact on the tech design.

Output: DECISION.md.

## Session Protocol

Exploration may span multiple sessions.

**Starting:** Check `docs/specs/explorations/<name>/` for existing artifacts. Resume from last phase.

**Pausing:** Write HANDOFF.md with current phase, completed work, next steps, open questions.

## Audit Mode

When invoked with `--audit` on an existing exploration:

1. Read DECISION.md
2. Check: has the codebase evolved to invalidate the decision?
3. Check: are the MUST criteria still the same (ACs may have changed)?
4. Check: have new paradigms/tools emerged that weren't available?
5. Report: VALID / STALE / REVISIT-RECOMMENDED

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `explore-solutions` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-UpstreamContextProblemBrief --evidence file:docs/specs/explorations/<name>/PROBLEM_BRIEF.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ParadigmResearchSolutionMap --evidence file:docs/specs/explorations/<name>/SOLUTION_MAP.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ACTradeoffAnalysis --evidence file:docs/specs/explorations/<name>/ANALYSIS.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-FinalistPrototypeComparison --evidence file:docs/specs/explorations/<name>/COMPARISON.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-DecisionAndTechDesignImpact --evidence file:docs/specs/explorations/<name>/DECISION.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyAndContinuation --evidence command_output:.svc/explore-solutions-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)

Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. Follow `references/task-graph-chaining-protocol.md`: treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, mark this skill's task `completed` before leaving, then load the next runnable task's skill (marking it `in_progress`) or mark it `completed` with a skip reason. Mirror status to the host UI only from the parent session (Claude `TaskList`/`TaskUpdate`; Kimi `/task` observation; in Codex, mirror only the active step in `update_plan`); a subagent (`SVC_SUBAGENT=1`) leaves mirroring to the parent, because a failed mirror call silently drifts from the file.

### Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | DECISION.md exists | `test -f docs/specs/explorations/<name>/DECISION.md` | |
| 2 | At least 3 paradigms explored | grep paradigm count in SOLUTION_MAP.md | |
| 3 | Tradeoff matrix references ACs | ANALYSIS.md contains AC identifiers from spec | |
| 4 | Runner-up documented | DECISION.md has "Why not" section | |

### Chaining

Apply the task-graph protocol above, then:

**If `--progressive` flag is present AND self-verify passed:**
- If baseline won (no changes): invoke `define-code-style --progressive --lane <lane>`
- If tech design was revised: **re-trigger G4** on the revised design before continuing.
  The design that reaches planning has to be the one that passed review, otherwise G4 certified a different design.
  `review-gate --gate G4 --artifact docs/specs/features/<name>.md --section "Implementation Notes"`
  On G4 PASS: invoke `define-code-style --progressive --lane <lane>`
  On G4 FAIL: fix findings in the revised design, re-trigger G4.

**If `--progressive` flag is absent:**
- Report decision summary
- Suggest: "Next: run `define-code-style`"

## Post-Compaction Recovery

If context was compacted and you lost framework state, `.svc/lane-tasks-<WI>.json` is the sole source of truth: resume the first `in_progress` task (else the first `pending` task with blockers satisfied), re-load its skill with `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`, re-read this SKILL.md, and continue. Never ghost-complete: verify `skill_receipt` exists before marking any task complete. If `.svc/.checkpoint-<WI>.checkpoint.json` names a different `next_task`, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
