# Proposal — Prove the Old Path Fails Before Declaring a Migration "Fixes" a Symptom

**Filed:** 2026-04-27
**Status:** proposed
**Severity:** MEDIUM
**Affects:** `execute-changeset/SKILL.md` (Self-Verify), `review-gate/SKILL.md` (G3)

## Problem

When a test or feature fails and an engineer migrates a code path (helper → secured helper, direct query → API gateway, custom hook → context provider) to "fix" the symptom, there is no enforced step to PROVE the old path actually fails before the migration ships. As a result, migrations that are no-ops dressed as fixes get merged: both old and new paths produce the same end-state for the failing test, and the symptom persists post-migration. The engineer then files another fix, and the loop continues.

## Real failure observed

WI-132 PR #74: migrated `e2e/helpers/employee-state.ts` from direct `ownerClient.entities.Employee.update()` to `secureOperation → asServiceRole`. Hypothesis: direct path silently strips fields. PR merged. Symptom unchanged. A direct SDK probe (run AFTER PR #74 merged) showed BOTH paths persist `is_working` and `is_on_break` correctly to the database. The migration was a no-op for this symptom. Five subsequent PRs were filed before the actual root cause (multi-tenant scope mismatch) was identified.

The probe that disproved PR #74's hypothesis took 5 minutes to write and 30 seconds to run. It should have run BEFORE PR #74, not after.

## Proposed change

Add a new Self-Verify checklist row to `execute-changeset/SKILL.md` for any changeset whose justification contains a migration / path-swap pattern:

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| N | Old-path-fails / new-path-passes proof attached | If this changeset migrates a code path because of an observed symptom, attach probe evidence in the PR description (script + output) showing: (a) the OLD path produces the failing state, (b) the NEW path produces the passing state. Probe must exercise both against the same input. | |

`review-gate` G3 enforces: any PR matching the migration pattern (commit message contains "switch to", "migrate", "route through", "use ... instead of ...") that lacks a probe-evidence section is a MEDIUM finding. Block unless author cites why the probe is unnecessary (e.g. compile-time error fixed, type safety, no behavior change asserted).

## Probe evidence template

PR description must include:

```markdown
## Probe evidence

### Old path (expected to FAIL)

```bash
# script
$ node probe-old.mjs
# output showing the failure
<output>
```

### New path (expected to PASS)

```bash
$ node probe-new.mjs
<output>
```
```

If both paths produce the same end-state, the migration is a no-op and the PR must be re-justified or closed.

## Why this matters

A migration without a disprovable hypothesis is faith-based engineering. The cost of a probe is bounded (5-15 min). The cost of a no-op migration is unbounded — it ships, the symptom returns, and 4-5 follow-up PRs absorb the framework's debugging budget before the real cause is found.

This generalizes beyond E2E. Same pattern applies to:
- Migrating from `useState` to a context provider to "fix re-render" (without measuring re-renders)
- Switching DB query path to an RPC to "fix RLS" (without checking the RLS rule)
- Replacing a third-party SDK call with a wrapper to "fix flakiness" (without measuring the flake rate)

In every case: prove the old path fails, prove the new path passes, prove they exhibit different behavior on the failing input.

## Decision needed

Accept as Self-Verify additions for `execute-changeset` + reviewer hook for `review-gate` G3. No new rule file — modifying existing skills is enough.

## Source

WI-132 PR #74 (helper migration that was a no-op) → 5 follow-up PRs before scope-mismatch was identified as actual root cause.
