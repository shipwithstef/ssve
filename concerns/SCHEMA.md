# Concern Schema (v1)

A "concern" is a cross-cutting subject-matter lens that should engage when a change set touches its signals. Each concern is one markdown file in `concerns/<name>.md`.

Concerns are **routing primitives**, not skills. They map subject-matter signals (file paths, keywords, packages, env vars) to the existing skills/rules that should think about that subject. The framework already has skills (`strategic-decision`, `manage-finops`, `review-security`, `design-tech`, `validate-feature`, `audit-implementation`, etc.); concerns are the missing connective tissue from "I detected a change touching X" to "the right thinkers must engage."

## File format

```markdown
---
name: <kebab-case unique id>            # required
domain: <integration|data|auth|privacy|security|performance|infra|observability|testing|ux|i18n|business|legal|docs>
severity: <CRITICAL|HIGH|MEDIUM|LOW>    # required
status: <active|deprecated|proposed>    # default: active
created: <ISO-8601 date>
last_reviewed: <ISO-8601 date>          # bump when concern definition changes

signals:
  file_path_patterns:                   # glob patterns (gitignore-style)
    - "**/payment/**"
    - "**/billing/**"
  diff_keywords:                        # regex patterns matched against added lines
    - "stripe\\.com"
    - "fetch.*googleapis"
  packages_imported:                    # exact package names from package.json / go.mod / Pipfile
    - "stripe"
    - "@stripe/*"
  env_vars_referenced:                  # glob patterns matched against env var names
    - "STRIPE_*"
    - "*_API_KEY"

handled_by:
  required_rules: [<rule-name>]         # MUST be applied; absence blocks per severity
  required_skills: [<skill-name>]       # AT LEAST ONE must run, OR explicit waiver
  optional_skills: [<skill-name>]       # surfaced as "consider also"

waiver_format: |
  How a PR explicitly waives this concern.
  Default: a line in the PR body of the form
    concern-waived: <name> — <reason>
  Logged as taste decision in .svc/pipeline-decisions.jsonl.

fires_on:                               # change-type filter
  - first-introduction
  - bugfix-touching-call-shape
  - new-caller
  - refactor

fires_off:                              # exemption filter (paths/extensions never trigger)
  - "**/test/**"
  - "**/__tests__/**"
  - "**/*.test.*"
  - "**/docs/**"

related_concerns: [<name>]              # for documentation cross-links
---

# What this concern is

Plain-English explanation: when this concern engages, what is the agent
being asked to think about?

# How an agent should think about it

A short numbered checklist the skill/rule will deepen. Concerns should
NOT contain implementation guidance — defer to the handling skill or
rule. This section is a reading order, not a procedure.

# Why it exists

Reference to the originating incident or rationale. Concerns should not
be invented in the abstract; they encode patterns that have actually
caused harm or near-misses.

# Examples

Brief examples of changes that DO and DO NOT match.
```

## Severity taxonomy

| Severity | Behavior |
|---|---|
| **CRITICAL** | Hard-block PR until concern is addressed (a `required_skill` produced an output, or PR body contains the waiver line) |
| **HIGH** | Require ack in PR body; block until acked or waived |
| **MEDIUM** | Advisory: surface in `route-workflow` output, log to `.svc/concern-hits.jsonl`. Non-blocking. |
| **LOW** | Silent log only, for analytics / future graduation |

Severity is the property of the **concern**, not the change. A change that hits CRITICAL `paid-external-api` and MEDIUM `observability-coverage` produces one block + one advisory.

## Domain registry

Domains exist for grouping/filtering only. Initial set:

`integration | data | auth | privacy | security | performance | infra | observability | testing | ux | i18n | business | legal | docs`

Adding a new domain requires updating this schema and the `validate-concern.mjs` linter.

## Layer model — universal vs project

| Layer | Path | Purpose |
|---|---|---|
| **Universal** | `seriousvibecoding/concerns/<name>.md` | Generic patterns, reusable across all projects |
| **Project** | `<project>/.svc/concerns/<name>.md` | Project-specific additions (e.g., Base44 platform quirks) AND overrides of universal concerns (e.g., bumping severity for a regulated app) |

At runtime, `scan-concerns.mjs` merges universal + project. **Project wins on name collision** — a project-side concern with the same `name` overrides the universal definition. This lets a regulated project bump `pii-handling` from HIGH to CRITICAL without forking the universal definition.

## Source-of-truth contract

The set of concerns each skill **handles** is declared in the SKILL.md frontmatter:

```yaml
---
name: manage-finops
handles_concerns: [paid-external-api, paid-llm-api, hosting-cost, pricing-tier-touch]
---
```

`build-concern-registry.mjs` validates that every `handled_by.required_skills` entry across all concerns has at least one skill claiming it. Missing claims are linter errors. This prevents the registry from referencing skills that don't actually handle the work.

## Generated artifact

`concerns/REGISTRY.json` is the runtime artifact, regenerated by `scripts/build-concern-registry.mjs`. It is committed (not gitignored) so route-workflow can read it without a build step. The build script also runs in CI as a lint to detect drift.

```json
{
  "schema_version": 1,
  "generated": "<ISO-8601>",
  "universal_count": 5,
  "concerns": [
    {
      "name": "paid-external-api",
      "domain": "integration",
      "severity": "CRITICAL",
      "signals": { ... },
      "handled_by": {
        "required_rules": ["paid-api-integration-checklist"],
        "required_skills": ["manage-finops", "design-tech"],
        "optional_skills": []
      },
      "fires_on": [...],
      "fires_off": [...],
      "source_file": "concerns/paid-external-api.md"
    },
    ...
  ]
}
```

## Lifecycle

| Phase | Status | What's true |
|---|---|---|
| `proposed` | Concern file exists but not yet enforced | Not in REGISTRY.json; ignored by route-workflow |
| `active` | Concern fires on matched changes | Default state |
| `deprecated` | Concern is being retired | Still in REGISTRY but marked deprecated; route-workflow logs but never blocks |

Concerns must be reviewed every 12 months (`last_reviewed` field). Stale concerns are flagged by a linter and either bumped or moved to `deprecated`.
