# Proposal: Workflow Lanes and Brownfield Conversion

**Date:** 2026-04-04
**Status:** IMPLEMENTED
**Author:** Codex

## Problem

Serious Vibe Coding is strongest when starting from a clean repo and shaping a new product or a new feature area through progressive narrowing.

It is weaker when dropped into an existing codebase with existing docs, inconsistent conventions, historical drift, or urgent bugfix work. In those cases, the current skill set still tends to behave like a greenfield authoring system instead of a brownfield conversion and maintenance system.

That creates three practical problems:

1. Small fixes get pulled into a feature-spec process that is too heavy.
2. Existing repos do not have a crisp first step that converts them into the svc way of working.
3. Different change types are treated too similarly, even though "new feature," "extend feature," "bugfix," and "drift cleanup" are different kinds of work.

## Core Recommendation

Serious Vibe Coding should recommend different routes depending on repo state.

### Rule 1: Clean repo -> greenfield lane

If the repo is clean, or effectively clean from a product-process perspective, svc should recommend the full greenfield path.

Examples:
- brand new repository
- starter template with no established product-spec workflow
- repo with code but no meaningful specs, no product canon, and no stable existing behavior worth preserving

Recommended message:

> This looks like a clean repo. Serious Vibe Coding can work natively here. Start with the greenfield lane and let the project adopt svc conventions from the beginning.

### Rule 2: Existing repo -> convert first

If the repo already has real product behavior, existing docs, existing tests, or established conventions, svc should not immediately force the full canonical pipeline.

It should first run a conversion route.

Recommended message:

> This is an existing repo. Before using the full svc pipeline, convert the repo into the svc way of working. Inventory current truth, map existing artifacts to svc artifacts, detect drift, and only then run feature or iteration skills.

This means brownfield is not "same pipeline, different wording." It is a distinct operating mode with a distinct first step.

## Definitions

### Greenfield

Greenfield means the repo can adopt svc conventions as the native source of truth with little or no migration cost.

Signals:
- no meaningful existing spec system
- no established artifact lifecycle to preserve
- little or no production behavior that must remain stable during migration
- no strong naming, layout, or review conventions that svc would conflict with

Greenfield is not just "empty repo." A repo can contain code and still be greenfield if nothing important needs to be preserved structurally.

### Brownfield

Brownfield means the repo already has meaningful truth that svc must adapt to before it can govern the workflow.

Signals:
- existing shipped behavior
- existing docs, tests, or architectural conventions
- historical drift between docs and code
- active users or stakeholders relying on current behavior
- migration risk if svc conventions are imposed too early

Brownfield should default to conversion first, not direct enforcement.

### Other useful differentiators

Repo state alone is not enough. Serious Vibe Coding should also classify the type of change being requested.

Important differentiators:

1. **New product / new subsystem**
   This fits the full greenfield lane.

2. **Brownfield feature extension**
   Existing system, new capability. Requires mapping current truth first, then producing a delta.

3. **Bugfix / regression**
   Existing intended behavior is known or inferable. Needs investigation, root cause, minimal patch, and regression proof. Should not default to full feature authoring.

4. **Refactor without intended behavior change**
   Focus is code structure, not user-facing requirements. Needs invariants and safety checks more than new product artifacts.

5. **Drift remediation / documentation reconciliation**
   The task is to align specs, journeys, and code with what already exists. This should be a maintenance lane.

## Proposed Workflow Lanes

### Lane A: Greenfield Product / Greenfield Feature

Use when:
- the repo is clean
- the subsystem is new
- behavior is still being discovered

Recommended flow:

1. `write-vision`
2. `build-personas`
3. `validate-feature`
4. `write-spec`
5. `audit-ac`
6. `write-journeys`
7. `design-ux`
8. `design-ui`
9. `design-tech`
10. `plan-changeset`
11. `land-changeset`
12. `verify-promotion`

This is where svc is already strongest.

### Lane B: Brownfield Conversion

Use first when:
- the repo already exists
- there is existing product behavior
- current truth is distributed across code, docs, tests, and tribal knowledge

Goal:
- convert the project into a svc-governed repo without rewriting it first

Recommended flow:

1. inventory current artifacts and conventions
2. identify canonical existing behavior
3. map existing docs/code/tests to svc artifact types
4. create or refine foundational svc artifacts from evidence
5. run `sync-spec-code` to surface drift
6. establish the minimum canonical directories and source-of-truth files

Expected outputs:
- repo mode confirmed as `convert`
- compatibility notes for existing conventions
- initial svc canonical artifacts grounded in evidence
- drift report
- recommended next route: feature extension, bugfix, refactor, or maintenance

### Lane C: Brownfield Feature Extension

Use when:
- the product already exists
- a new feature extends an existing system

Recommended flow:

1. brownfield conversion if not yet done
2. `sync-spec-code` first
3. `validate-feature`
4. `write-spec` in delta mode
5. `write-journeys` in expand mode
6. `design-tech` only for changed architecture
7. `plan-changeset`
8. selective spec/journey updates

Key principle:
- define the delta, not the whole world again

### Lane D: Bugfix / Regression

Use when:
- something worked before and is now broken
- behavior is wrong, inconsistent, or regressed
- speed and proof matter more than artifact generation

Recommended flow:

1. investigate root cause
2. capture expected behavior delta
3. patch the smallest safe surface area
4. add regression proof
5. update spec only if intended behavior changes

Expected outputs:
- bug brief
- root cause summary
- smallest valid patch
- regression test or verification note

This lane is currently underdeveloped and should become first-class.

### Lane E: Drift / Maintenance

Use when:
- the main problem is disagreement between docs, journeys, specs, and code
- no major feature work is being added yet

Recommended flow:

1. `sync-spec-code`
2. targeted drift report
3. selective remediation
4. optional journey/spec refresh

This should be cheap, repeatable, and routine.

## What Should Change in the Skill System

### 1. `route-workflow` should route by repo state and change type

Today the biggest missing distinction is not just bootstrap vs convert.

It is:
- discover behavior
- extend behavior
- correct behavior
- reconcile behavior

`route-workflow` should explicitly classify:
- greenfield foundation
- greenfield feature
- brownfield conversion
- brownfield feature extension
- bugfix/regression
- refactor without behavior change
- drift remediation

### 2. Brownfield conversion should be explicit, not implied

The system currently says convert mode exists, but the first-class route is still too implicit.

There should be a clear recommendation:

> Existing repo detected. Convert this repo into svc working mode before applying the full pipeline.

This is the main product recommendation this proposal argues for.

### 3. `write-spec` should support explicit modes

Recommended modes:
- `new-feature`
- `extend-feature`
- `bugfix-behavior`
- `contract-change`

Right now the skill is trying to be universal. That blurs the difference between creation and correction.

### 4. Bugfix work should get a first-class skill or route

Recommended addition:
- `diagnose-bug` or equivalent

Minimal structure:
- observed behavior
- expected behavior
- reproduction
- root cause
- impacted contract
- proof of fix

### 5. Delta-first should replace artifact-first in brownfield work

For existing products, the key question is:

> What changed, and what must stay invariant?

Not:

> Which full canonical document should be regenerated?

This should affect `write-spec`, `write-journeys`, and `plan-changeset`.

## Recommended Product Messaging

When svc detects repo state, it should recommend one of these two default messages.

### Clean repo recommendation

> This looks like a clean repo. Serious Vibe Coding can work natively here. Start with the greenfield lane and let svc define the source of truth from the beginning.

### Existing repo recommendation

> This is an existing repo. Convert it into the svc way of working first. Inventory the current truth, map existing artifacts to svc artifacts, detect drift, and only then run feature or iteration workflows.

This keeps the system honest. It also reduces the risk of forcing a greenfield process onto a living codebase.

## Expected Benefits

1. Better recommendation quality at the top of the workflow
2. Less ceremony for bugfix and iteration work
3. Stronger brownfield adoption story
4. Cleaner separation between discovery, extension, correction, and reconciliation
5. More realistic path for teams adopting svc on real products rather than only new repos

## Decision

Adopt the following default stance:

- **Clean repo:** use svc directly as the native workflow
- **Existing repo:** convert first, then apply the appropriate lane

And evolve the skill system so that change type matters as much as repo mode.
