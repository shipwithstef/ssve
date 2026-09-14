# Proposal — Meta Gap: A `debug-e2e` Skill (or Expanded `diagnose-bug` E2E Mode)

**Filed:** 2026-04-27
**Status:** proposed
**Severity:** HIGH (frames all other 2026-04-27 E2E rules / proposals)

## Problem

svc has skills for **writing** E2E tests (`write-e2e`, `playwright`, `e2e-automation`, `autonomous-verification`) but no skill for **iterating on a failing E2E test with discipline**. The closest is `diagnose-bug`, which is generic and front-loads code-reading. As a result, every E2E debugging session improvises its own protocol: some sessions read screenshots first, some don't; some run probes, some don't; some loop on PRs, some don't.

The 4 rules / proposals filed today (`tenant-scoped-test-seeding`, `helper-app-query-parity`, `transient-ui-assertion-pattern`, `post-fix-evidence-before-next-fix`, `no-positional-role-selectors`, `prove-old-path-fails-before-migrating`, `diagnose-bug-persistence-bisect-phase-0`) all surfaced from a single 6-PR debugging session (Example Marketplace WI-132). Each is locally correct, but together they reveal the meta-gap: there is no single skill that orchestrates them as mandatory phases of E2E debugging.

## Proposed change

Two options. I recommend **Option B** (extend `diagnose-bug`) because it avoids skill proliferation.

### Option A — New `debug-e2e` skill

Frontmatter sketch:

```yaml
name: debug-e2e
description: |
  Iterate on a failing E2E test with discipline. Use when a Playwright /
  Cypress / WebdriverIO / equivalent test has failed at least once and the
  fix is not obvious. NOT for writing new tests (use write-e2e). NOT for
  generic feature bugs without a test (use diagnose-bug).
inputs:
  required:
    - { artifact: "failing-test", note: "spec path + test name" }
    - { artifact: "latest-test-artifact", note: "screenshot/trace/error-context path" }
outputs:
  produces:
    - { path: "docs/specs/debug-sessions/YYYY-MM-DD-<wi>/CLASSIFICATION.md", artifact: bug-class }
    - { path: "docs/specs/debug-sessions/YYYY-MM-DD-<wi>/PROBE.md", artifact: persistence-probe }
    - { path: "docs/specs/debug-sessions/YYYY-MM-DD-<wi>/EVIDENCE.md", artifact: artifact-citations }
    - { path: "docs/specs/debug-sessions/YYYY-MM-DD-<wi>/HYPOTHESIS.md", artifact: ranked-hypotheses }
chain:
  progressive: false
  self_verify: true
```

Phases:
1. **Read latest artifact** (mandatory, screenshot first if exists)
2. **Persistence bisect** (per `diagnose-bug-persistence-bisect-phase-0`)
3. **Helper-app parity check** (per `helper-app-query-parity` rule)
4. **Tenant scope check** (per `tenant-scoped-test-seeding` rule)
5. **Transient assertion check** (per `transient-ui-assertion-pattern` rule)
6. **Selector disambiguation check** (per `no-positional-role-selectors` proposal)
7. **Hypothesis ranking** — write 2-3 ranked hypotheses with evidence-citation per hypothesis
8. **Fix proof** — for the top-ranked hypothesis, draft the probe that proves old-path-fails / new-path-passes (per `prove-old-path-fails-before-migrating`)
9. **Hand off to `execute-changeset`** with the chosen hypothesis + probe in the manifest

### Option B — Extend `diagnose-bug` with an E2E mode

Add a top-level mode flag to `diagnose-bug`:

```yaml
modes:
  - generic     # current behavior
  - e2e-test    # new mode for failing test triage
```

When `mode: e2e-test`, the skill runs phases 1-8 from Option A above. When `mode: generic`, current behavior. This avoids creating a new skill while still routing E2E-debugging through a disciplined protocol.

`route-workflow/references/intent-routing.md` row addition:

| User intent | Skill |
|---|---|
| "this test is failing", "fix the failing E2E", "debug this Playwright test", "test is flaky" | `diagnose-bug --mode=e2e-test` |

## Why this matters at the framework level

Every project that runs E2E tests will hit the same patterns. svc currently teaches engineers to write E2E tests well (good) but lets them debug those tests ad-hoc (bad). A disciplined debug protocol with cited rules is a force multiplier — it converts every E2E-debugging session into a teaching opportunity for the next one.

The 6-PR WI-132 saga is a prototype of what this proposal prevents. Across a single debugging session, the agent:
- Skipped the screenshot for 4 PRs (caught by `post-fix-evidence-before-next-fix`)
- Filed a no-op migration as PR #1 (caught by `prove-old-path-fails-before-migrating`)
- Used a positional `getByRole().first()` (caught by `no-positional-role-selectors`)
- Used a permissive ownership query in the helper (caught by `helper-app-query-parity`)
- Failed to seed at the app's default scope (caught by `tenant-scoped-test-seeding`)
- Asserted on a racing toast (caught by `transient-ui-assertion-pattern`)

ALL 6 patterns fired in ONE session. A `debug-e2e` skill / mode would have caught them as mandatory phases.

## Decision needed

- **Option A vs Option B** — recommend Option B (extend `diagnose-bug`).
- **Phases** — accept the 8 phases proposed, or trim?
- **Output artifacts** — do we want the `docs/specs/debug-sessions/` directory convention, or fold into the existing `docs/specs/work-items/<WI>.md` body?

## Source

Synthesis of 4 rules + 3 proposals all filed 2026-04-27 from Example Marketplace WI-132 (J04 employee stat tests, 6-PR debug session).
