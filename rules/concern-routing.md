# Rule: Concerns Route from Subject Matter to Skills

The framework has many skills (`strategic-decision`, `manage-finops`, `review-security`, `design-tech`, `validate-feature`, `audit-implementation`, etc.) and many rules. They each handle a kind of thinking. The gap was: **routing from "what changed" to "which thinkers should engage."** Lanes route by verb (feature / bugfix / refactor / chore); concerns route by subject matter.

This rule defines the procedural gate that wires concerns into route-workflow and the review pipeline.

## What a concern is

A concern is a cross-cutting subject-matter lens stored as one markdown file in `concerns/<name>.md`. It declares signals (file path patterns, diff keywords, packages, env vars) and the skills/rules that must engage when those signals are present.

See `concerns/SCHEMA.md` for the full format.

## Two layers

| Layer | Path | Purpose |
|---|---|---|
| **Universal** | `seriousvibecoding/concerns/<name>.md` | Generic patterns reusable across projects |
| **Project** | `<project>/.svc/concerns/<name>.md` | Project-specific concerns AND severity overrides for universal ones |

`scripts/scan-concerns.mjs` merges the two at runtime. Project entries with the same `name` override universal entries.

## When concerns gate the workflow

Concerns are scanned and matched against the active change set at four points:

1. **Session start** (route-workflow) — if the user's most recent prompt names a file/feature, scan a notional change set of the relevant area; surface matched concerns as "you'll want these thinkers engaged"
2. **Before WI dispatch** (route-workflow) — scan the WI's task graph file scope; gate dispatch by severity
3. **Pre-commit** — scan staged + unstaged changes; CRITICAL/HIGH unaddressed = block commit
4. **At review-gate** — scan PR diff; CRITICAL violations = block merge, HIGH = require ack in PR body

The same registry serves all four points.

## Severity → behavior

| Severity | Behavior |
|---|---|
| **CRITICAL** | Hard-block. Required skill must have run with output, OR PR body contains the waiver line. |
| **HIGH** | Require ack in PR body (e.g., "concern-acked: <name>"). Reviewer hooks fail without it. |
| **MEDIUM** | Advisory: surface in route-workflow output, log to `.svc/concern-hits.jsonl`. Non-blocking. |
| **LOW** | Silent log only, retained for retrospective analytics. |

## Waiver protocol

Sometimes a matched concern legitimately doesn't apply (test fixture, docs change, tightly-scoped bugfix where the routing skill was already engaged on a prior PR). The waiver format is declared per-concern but defaults to a single line in the PR body:

```
concern-waived: <name> — <reason>
```

Each waiver is logged as a `taste` decision in `.svc/pipeline-decisions.jsonl`. Repeated waivers of the same concern in a 30-day window from the same author surface a meta-flag at `audit-session-execution`: "repeated waiver — is the concern definition wrong, or is the agent waiving carelessly?"

## Required skill / rule contract

When a concern lists `required_skills: [X, Y]`, **at least one of X or Y must run** during the change cycle, OR a waiver must be present. This is OR semantics, not AND, so the concern says "the right thinker engaged" rather than "every possible thinker engaged."

When a concern lists `required_rules: [R]`, the rule must be cited in the PR body or commit message (e.g., "applied: paid-api-integration-checklist") — this is how rules differ from skills. Rules are procedural, not skill-runs.

## Skill source-of-truth

Each skill declares which concerns it handles in its frontmatter:

```yaml
---
name: manage-finops
handles_concerns: [paid-external-api, paid-llm-api, hosting-cost, pricing-tier-touch]
---
```

`scripts/build-concern-registry.mjs` cross-validates: every concern's `required_skills` must have at least one skill claiming it via `handles_concerns`. Otherwise the registry build fails. This prevents drift where concerns reference skills that don't actually handle them.

## False-positive mitigation

A concern that fires too aggressively creates checklist fatigue, which causes humans (and agents) to silently rubber-stamp it. Mitigations:

1. **Specific signal lists** — prefer narrow file patterns + tight keywords over broad globs.
2. **`fires_off` exemptions** — test files, docs, build-artifact directories never trigger.
3. **Severity calibration** — if a concern fires a lot but rarely surfaces real issues, demote from CRITICAL → HIGH → MEDIUM. Promote when a missed real issue would have been caught.
4. **Per-concern review every 12 months** — `last_reviewed` field; staleness check at lint time.

## Reviewer hooks

- **`route-workflow`** scans on the four trigger points above and lists matched concerns in its output.
- **`review-gate`** at G3 fails any PR with unaddressed CRITICAL concerns or unack'd HIGH concerns. Cites `concerns/REGISTRY.json#<name>` in the finding.
- **`audit-implementation`** in its post-implementation pass cross-references the change set against the registry; matched concerns missing their required-skill output are flagged as findings.
- **`verify-promotion`** before marking a WI as `landed` checks all matched concerns have closure (skill ran OR waiver logged).

## How violations get detected

### Mechanical (cheap, in-session)

```bash
# Run from project root
node ~/.claude/skills/scripts/scan-concerns.mjs --diff
# → emits matched concerns + suggested skills + severity
```

### CI

A small shell job in CI runs the same scan against the PR's diff and fails the check if CRITICAL unaddressed.

## When to add a new concern

A pattern earns a concern slot when ANY of:

- It has caused (or near-caused) a real incident, captured in a learning
- It's a class of failure documented in a published risk taxonomy (OWASP, STRIDE, CWE) AND the framework has a skill that handles it
- It's specific enough that a simple signal-set will match a meaningful subset of changes (>1% of recent diffs)

Don't add a concern if:

- It's covered already by an existing concern (extend that one's signals instead)
- It's a process-level guideline that doesn't map to changeset signals (then it's a rule, not a concern)
- It only fires on changes too rare to justify the metadata cost (<once/year)

## Severity calibration knobs (project-level)

A project can override severity in `<project>/.svc/concerns/<name>.md` by including only the frontmatter fields that change:

```yaml
---
name: pii-handling
severity: CRITICAL    # universal default is HIGH; this project handles regulated PII
---
```

The merge logic (in `scan-concerns.mjs`) shallow-merges over the universal definition. Signals/handled_by/etc. inherit unless the project file overrides them.

## Why this exists

Originated 2026-05-07 after the Example Marketplace `placesNearbyLookup` incident exposed a structural gap: the framework had a `manage-finops` skill, a `paid-api-integration-checklist` would-be rule, a `strategic-decision` skill — none of them engaged automatically when a paid-API file was edited, because there was no routing layer mapping subject matter to skills. Adding more rules wouldn't have helped; rules sit in `rules/` waiting to be remembered. The missing primitive is automated routing from change-set signals to the right thinker.

This rule is the routing contract; `concerns/SCHEMA.md` is the data format; `scripts/scan-concerns.mjs` is the runtime; the per-concern files in `concerns/` are the data.
