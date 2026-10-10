## Project State File

`docs/specs/project-state.md` should capture:

- repo mode: `convert`
- conversion status: `identified | mapping | mapped | triaged`
- active workflow lanes in use
- current focus (active WI, active lane, active task graph, fallback next item)
- foundational artifact status (the **full svc canonical artifact catalog** — see `audit-coverage` Step 2 for the catalog table; do not list a subset)
- subsystem map
- compatibility notes
- work-item summary by type and status
- coverage gaps section (populated by `audit-coverage` Step 2.5)

`docs/specs/router-context.md` should capture:

- required skills by intent
- precedence rule: repo override > project-local platform rule > generic platform heuristic > global fallback
- forbidden tools or flows
- code-style authority
- deployment/runtime contract
- platform/runtime signals
- repo-local overrides discovered in docs/config

`docs/specs/agent-topology.md` should capture:

- whether delegation is allowed
- whether the repo is merely platform agent-capable vs actually configured for delegation
- preferred roles by work type
- ownership boundaries
- shared write surfaces
- when to stay single-agent

**Critical:** the foundational artifact status section must be sourced from
`audit-coverage`. Hand-listing a subset of artifacts (vision/personas/journeys
only) silently hides gaps in domain-profile, code-style, design contracts,
visual baselines, and marketing context. The audit produces the full catalog
state in `docs/specs/coverage-audit.md` — link or summarize, do not redefine.

## Work Item Types

Use these canonical types:

- `conversion`
- `feature`
- `bugfix`
- `regression`
- `refactor`
- `drift`
- `chore`

Status values:

- `identified`
- `mapped`
- `triaged`
- `planned`
- `in_progress`
- `blocked`
- `resolved`
- `verified`
- `deferred`

Severity values:

- `critical`
- `high`
- `medium`
- `low`

## Work Item Template

Each file in `docs/specs/work-items/` should follow the canonical WI schema (`references/work-item-schema.md`):

```markdown
# WI-001: Short title

**Type:** bugfix
**Status:** identified
**Severity:** high
**Filed:** <ISO date>
**Source:** onboard-repo
**Lane:** bugfix
**Repo Mode:** convert
**Source Artifact:** path/to/file-or-area
**GitHub Issue:** —

## Problem

What is wrong or missing.

## Evidence

Concrete files, runtime behavior, docs, or test references.

## Route Recommendation

Which skill or lane should take this next and why.

## Notes

Anything needed for triage, not full implementation.
```
