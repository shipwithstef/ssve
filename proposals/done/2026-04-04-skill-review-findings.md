# Comprehensive Skill Review: Findings and Fixes

> Reviewed all 28 skills for: audit mode, BDD/TDD/SDD integration, agentic best practices,
> coherent flow, design artifacts, plan lifecycle, and industry alignment.

## Critical Findings

### F1: Most skills lack audit mode (HIGH)

Only 6/28 skills have any audit/standalone-verification behavior: build-personas, audit-ac, sync-spec-code, define-code-style, onboard-repo, write-e2e.

**Every skill should work as an auditor** of its domain. Examples:
- `/write-vision --audit` → checks existing vision.md for completeness, staleness, contradiction with code reality
- `/write-journeys --audit` → compares existing journeys against current personas, specs, ACs — reports gaps
- `/design-ux --audit` → reviews existing UX doc against current spec ACs — reports uncovered states
- `/write-e2e --audit` → reviews existing E2E tests against current journeys — reports coverage gaps
- `/design-tech --audit` → reviews arch against current code — reports drift

**Fix:** Add `## Audit Mode` section to each skill describing how it evaluates existing artifacts.

### F2: TDD not enforced at the right time (HIGH)

TDD is mentioned in plan-changeset (1 ref) and write-e2e (7 refs) but NOT enforced in execute-changeset where code is actually written. The manifest says "tests before implementation" but the executor doesn't enforce the order.

**Fix:** execute-changeset must enforce: for each task group, write test → run (fail) → write code → run (pass) → checkpoint. Red-green-refactor per task.

### F3: BDD not connected to implementation (MEDIUM)

write-journeys produces Gherkin scenarios (48 BDD refs) but these never become executable tests automatically. The connection is: journey → write-e2e → Playwright tests. But there's no enforcement that every journey scenario maps to an E2E test.

**Fix:** Add AC-to-E2E traceability in write-e2e's audit mode. Every journey scenario should map to a test file or be explicitly marked as manual-only.

### F4: No DESIGN.md artifact defined (HIGH)

svc has `design-system.md` (tokens, colors, typography) produced by design-ui. But there's no `DESIGN.md` (brand, aesthetic, personality, motion principles) like gstack's design-consultation produces. The design-system.md is technical tokens only — it lacks the brand/aesthetic layer.

**Fix:** design-ui should produce or reference a DESIGN.md that covers brand personality, aesthetic direction, motion principles — the layer above tokens. This can be inspired by gstack's DESIGN.md without using paid AI (no Codex, no design binary).

### F5: Implementation plans have no lifecycle status (MEDIUM)

Plans at `docs/plans/<date>-<name>/manifest.md` are created and executed but have no tracked status. Compare with feature specs which go through DRAFT → UX-REVIEWED → DESIGNED → BASELINED → CHANGE-SET-APPROVED → PROMOTED → VERIFIED.

**Fix:** Add plan lifecycle: DRAFTED → SIMULATED → EXECUTING → CHECKPOINTED → PROMOTED → VERIFIED. Status tracked in the manifest header.

### F6: UX and UI design skills don't connect to each other well (MEDIUM)

design-ux produces screen flows and states. design-ui produces component specs and tokens. But the handoff is weak — UI design should explicitly verify it covers every screen and state from UX design. Currently it just references the UX doc without structured traceability.

**Fix:** design-ui Step 1 should produce a UX→UI traceability table: for each screen from UX, which components render it. Missing entries = gap.

### F7: execute-changeset doesn't load domain-profile or analyze-competitors (LOW)

The new domain intelligence (domain-profile.md, analyze-competitors.md) is produced early but not loaded during code generation. execute-changeset loads: manifest, spec, designs, style-contract. Should also load domain conventions for the tech stack.

**Fix:** execute-changeset inputs should include domain-profile.md and references/domains/ packs as optional context.

### F8: No SDD (Scenario-Driven Development) concept (LOW)

BDD produces scenarios in Gherkin. TDD produces unit tests. But there's no explicit "scenario-driven" phase where scenarios are used to validate implementation decisions BEFORE writing code. This is what the simulation step partially does, but from a file/import perspective, not a user-scenario perspective.

**Fix:** The simulation section in plan-changeset should include a scenario walkthrough: for each journey scenario, trace through the planned task graph and verify the implementation covers it.

## Fixes to Implement

### Fix 1: Audit mode for all pipeline skills

Add `## Audit Mode` to these skills (the ones that produce reviewable artifacts):

| Skill | Audit does |
|-------|-----------|
| write-vision | Checks vision.md for completeness, staleness, code-reality contradictions |
| build-personas | Already has modes 5-6 for gap discovery |
| validate-feature | Checks existing briefs against current personas/journeys |
| write-spec | Checks spec ACs against vision concepts + zero-state coverage |
| audit-ac | Already audits (its primary mode) |
| write-journeys | Compares journeys against current specs/personas, reports missing flows |
| design-ux | Reviews UX doc against current spec ACs, reports uncovered states |
| design-ui | Reviews UI doc against UX screens, reports unmapped components |
| design-tech | Reviews tech design against code reality, reports drift |
| sync-spec-code | Already audits (its primary mode) |
| define-code-style | Already has audit mode |
| write-e2e | Reviews E2E coverage against journey scenarios |
| analyze-domain | Re-evaluates domain profile against current codebase |
| analyze-competitors | Refreshes competitor data, reports market changes |

### Fix 2: TDD enforcement in execute-changeset

Add to execute-changeset's task execution model:

```markdown
### TDD Enforcement

For each task that produces implementation code:

1. **Write test first** — unit test for the behavior this task implements
2. **Run test** — must FAIL (proves the test tests something)
3. **Write implementation** — minimal code to pass the test
4. **Run test** — must PASS
5. **Checkpoint** — commit test + implementation together

Skip TDD for: type definitions, config files, migrations (no behavior to test),
pure UI components (covered by E2E instead).
```

### Fix 3: DESIGN.md artifact

Add to design-ui's process (before component specs):

```markdown
### Step 0: Design Foundation (DESIGN.md)

If `DESIGN.md` does not exist at project root, create it:

```markdown
# Design: [Project Name]

## Brand Personality
[Voice, tone, visual feeling — not marketing copy, design direction]
[e.g., "Technical but approachable. Dark mode default. Monospace for data, sans-serif for navigation."]

## Aesthetic Direction
[Overall visual approach — inspired by but not copying]
[Reference 2-3 existing products with similar aesthetic goals]

## Motion Principles
[When to animate, when not to. Duration ranges. Easing preferences.]

## Dark Mode Strategy
[Default or toggle? How colors adapt? Which elements change?]

## Accessibility Baseline
[WCAG level target. Minimum contrast. Focus indicators. Screen reader strategy.]
```

If DESIGN.md already exists, read it and ensure UI design decisions align.
```

### Fix 4: Plan lifecycle status

Add to plan-changeset manifest header:

```markdown
**Status:** DRAFTED
```

Status values: DRAFTED → SIMULATED → EXECUTING → CHECKPOINTED → PROMOTED → VERIFIED

Updated by:
- plan-changeset → DRAFTED
- simulation step → SIMULATED (if all checks pass)
- execute-changeset → EXECUTING (at start), CHECKPOINTED (all tasks done)
- land-changeset → PROMOTED
- verify-promotion → VERIFIED

### Fix 5: UX→UI traceability table

Add to design-ui Step 1:

```markdown
### UX→UI Traceability

Before designing components, map every screen and state from the UX design:

| UX Screen | UX States | UI Components | Coverage |
|-----------|-----------|---------------|----------|
| Dashboard | loading, empty, populated, error | DashboardLayout, TrendCard, RecCard, EmptyState | ✅ |
| Profile | viewing, editing, saving | ProfileForm, SkillList, SaveButton | ✅ |
| Settings | default, changed | SettingsPanel, ModeSelector | ✅ |

Missing entries = design gap. Fill before proceeding to component specs.
```

### Fix 6: Domain context in execute-changeset

Add to execute-changeset inputs:

```yaml
optional:
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "references/domains/*/conventions.md", artifact: domain-conventions }
```

### Fix 7: Scenario walkthrough in simulation

Add to plan-changeset simulation section:

```markdown
### Scenario Walkthrough (after file-level checks)

For each journey scenario in docs/specs/journeys/J*.feature.md:

1. Read the Given/When/Then steps
2. For each step, identify which planned task implements it
3. If a step has no implementing task: WARN — scenario coverage gap
4. Log: "Scenario J01/Scenario-1: covered by tasks 3, 4, 5" or "WARN: step 'Then user sees recommendations' has no implementing task"
```
