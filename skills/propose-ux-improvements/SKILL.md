---
name: propose-ux-improvements
version: "1.0"
description: >
  Use when a founder asks to improve a named region of an existing interface,
  questions a redundant control, or wants a focused UX improvement proposal.
  For a whole-flow competitive teardown use explore-ux; for broken behavior use
  diagnose-bug; for a new feature use validate-feature.
phases:
  - { id: P1-ScopeAndEvidence, trigger: always, reads: ["founder steer", "relevant spec and code", "rendered evidence"], writes: ["docs/specs/ux-improvements/<run-id>.md"], evidence_kind: file, required_for_completion: true }
  - { id: P2-DecisionAndAlternatives, trigger: always, reads: ["scoped evidence"], writes: ["docs/specs/ux-improvements/<run-id>.md"], evidence_kind: file, required_for_completion: true }
  - { id: P3-IllustrativeAfter, trigger: visual-change-proposed, reads: ["before evidence", "selected alternative"], writes: ["docs/specs/ux-improvements/<run-id>-after.html"], evidence_kind: file, required_for_completion: false }
  - { id: P4-SelfVerifyAndHandoff, trigger: always, reads: ["proposal", "owner authorization"], writes: [".svc/ux-improve/<run-id>/self-verify.log"], evidence_kind: command_output, required_for_completion: true }
inputs:
  required:
    - { artifact: founder-steer, note: "User request naming an existing interface region" }
  optional:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
    - { path: "docs/specs/personas/*.md", artifact: personas }
outputs:
  produces:
    - { path: "docs/specs/ux-improvements/<run-id>.md", artifact: ux-improvement-proposal }
chain:
  lanes: {}
  terminal: true
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Propose a focused UX improvement

**Announce at start:** "I'm using propose-ux-improvements to assess this region against its actual purpose and behavior."

## Before Starting

Load the founder's steer, named region and desired outcome. Read relevant current
spec/ACs, actual implementation and the persona's job; use the project's existing
artifacts rather than recreating them. Follow dependencies only when they can
change the recommendation: state, permissions, data, sibling controls, responsive
layout, accessibility and journey transitions. Stop expanding when the decision
is supported. Do not bulk-read unrelated specs or a competitor library.

## Preflight

Resolve the target from the conversation and current project. Ask only if the
region or another consequential decision remains ambiguous. Reuse authorization.
Use available browser tools or owner-supplied captures; verify file existence and
record route, viewport, state, date and provenance. Do not run login or access
changes without authorization. If capture is unavailable, produce evidence-needed
with the precise missing observation; do not loop or invent a screenshot.

## P1 — Scope and evidence

Create `docs/specs/ux-improvements/<run-id>.md`. Record the steer, bounded region,
user job and success signal. Cite relevant spec/AC and code locations together.
Expose conflicts explicitly; do not silently rewrite the spec to fit the code.

Separate observed facts, code-derived behavior and inferred friction. A screenshot
shows appearance; inspect handlers and state to establish whether controls actually
duplicate an action. A launcher and a status summary may serve different jobs.
For consequential behavior that code cannot establish, name the runtime probe.
Owner captures remain owner-provided evidence, not an independently tested flow.

## P2 — Decision and alternatives

Choose the evidence-supported outcome:

| Outcome | Use when | Required result |
|---|---|---|
| propose-change | A specific improvement is supported by current evidence | Explain behavior before/after, retained information, benefit and tradeoff |
| retain-current | Current elements serve distinct useful roles or change worsens the job | Explain the useful distinction and what evidence would reopen the decision |
| evidence-needed | Missing evidence could change the recommendation | Name the missing observation and cheapest sufficient check |

Preserve retain-current as a baseline when considering change. Add credible
alternatives when they change a consequential tradeoff, including a novel approach
when it serves this product better. Do not require a fixed number of questions,
findings, alternatives or heuristic scores. Fewer controls alone does not prove
better UX; preserve useful status, discoverability and accessible interaction.

Use relevant heuristics to explain observed friction, not as a checklist recital.
Recognition rather than recall is Nielsen heuristic 6; minimalist design is 8.
Apply progressive disclosure only after assessing the cost of hiding information
for this persona and task. Prefer current product patterns when they fit; explain
why a departure earns its complexity when they do not.

For a proposed change record the concrete delta, relevant evidence, persona fit,
expected impact, meaningful alternatives, risk, reversibility, confidence, success
signal and falsification check. Scale depth to the decision. Treat expected impact
as a hypothesis until measured. Route unresolved consequential choices to the owner;
continue independent evidence gathering while the answer is pending.

## P3 — Illustrative after (only for a proposed visual change)

Require actual before-state evidence and provide a clearly labelled illustrative
after artifact at the relevant viewport: a self-contained HTML mock or annotated
capture using available tools. Show retained information and affected states.
Do not call the mock deployed, observed, user-tested or verified improvement.
Retain-current and evidence-needed do not require an after mock.

This skill produces a proposal, not an artifact that ships directly to a product.
Live product verification belongs to the accepted implementation's normal chain;
a proposal cannot satisfy its release gate. Carry the before evidence and required
states into that chain, including `_shared/live-evidence.md` when applicable.

## P4 — Self-verify and handoff

Write the outcome and evidence limits in the proposal. Record verification results
under `.svc/ux-improve/<run-id>/self-verify.log`. Only accepted proposals with owner
authorization to continue are consumed by route-workflow. Reuse existing approval;
do not ask again solely because a skill ended. Retain-current and evidence-needed
remain terminal reports, with no automatic implementation task.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Scope, persona job, current spec and code are grounded | Inspect citations and explicitly disclosed gaps/conflicts | |
| 2 | Outcome follows evidence | Distinguish action duplication from useful information; preserve retention baseline | |
| 3 | Claims have truthful provenance | Existing captures cited; inference and expected impact labelled | |
| 4 | Proposed visual change has before and illustrative after | Verify artifacts only when P3 applies; otherwise record reason | |
| 5 | Decisions and handoff are proportional | Only consequential questions; route only accepted authorized changes | |

## Rationalization Table

| Temptation | Correct response |
|---|---|
| "Two similar shapes are redundant" | Trace actions, status information and user jobs before removing either |
| "A proposal must recommend a redesign" | Retention or missing-evidence outcomes can be the correct result |
| "The mock looks better, so improvement is proven" | State the hypothesis and a falsification check; obtain actual runtime evidence later |

## Red Flags

Generic UX advice without project evidence; disappearing status information;
mandatory alternatives with no meaningful difference; screenshots claimed from
unavailable tools; a production verification claim based on a mock.

## Pipeline Continuation

### Task-graph mode (source of truth: `.svc/lane-tasks-<WI>.json`)

Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume.
For Codex, mirror only the active step in `update_plan` when that UI is available;
host UI state remains secondary. Record
P1/P2 file evidence, P3 file evidence only when applicable (otherwise the specific
skip reason), and P4 command output before completing the task. Follow
`references/task-graph-chaining-protocol.md` and
`references/skill-runtime-contracts-v2.json` for artifact consumers. This terminal
skill has no default lane successor. An accepted, owner-authorized proposal goes
through route-workflow using current repo state and the applicable normal chain;
never route to the retired quick-fix lane or substitute this proposal for a spec,
review, focused tests or post-promotion live evidence.
