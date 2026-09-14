# Framework Improvement — 2026-04-24 — Evolve/Improve Artifact Boundary

**Status:** DRAFT — improve-framework Step 5 output.

## Goal

Make the artifact-type boundary between `evolve-framework` and `improve-framework` explicit in both SKILL.md files, so future proposals don't conflate the two like `proposals/done/2026-04-24-framework-cohesion-evolution.md` did.

## Context

That proposal did double duty: it surveyed many gaps (evolve-framework's job) AND carried per-leaf fix briefs (improve-framework's job). This caused WI-073 to skip improve-framework entirely — a lane-compliance failure that adversarial reviewers couldn't catch.

## Non-Goals
1. Rewriting either skill's Process.
2. Changing proposal filename conventions.

## Acceptance Criteria

- **AC-01** `evolve-framework/SKILL.md` adds a "Scope boundary vs improve-framework" section stating: evolution proposals list gaps WITHOUT per-leaf fix briefs; if a gap merits a fix-brief-shape, it belongs in a separate improve-framework proposal.
- **AC-02** `improve-framework/SKILL.md` adds a reciprocal "Scope boundary vs evolve-framework" section stating: improvement proposals are always scoped to a single gap; batching many gaps into one improvement proposal is forbidden.
- **AC-03** Both sections cross-reference each other.
- **AC-04** Full tier-1 sweep PASS.

## File Impact

| File | Change |
|---|---|
| `evolve-framework/SKILL.md` | **edit** — add "Scope boundary vs improve-framework" section |
| `improve-framework/SKILL.md` | **edit** — add "Scope boundary vs evolve-framework" section |
| `references/framework-learnings.jsonl` | **append** — `evolve-improve-must-have-separate-artifacts` (confidence 9) |

## Scope boundary
- touches: the 3 files above.
- must-not-touch: any other SKILL.md; route-workflow; hooks; rules; manifest.

## Rollback
Revert single commit.

## Size
- Files: 3. Lines: ~40.
- Risk class: contract change (skill scope language). Plan-changeset.


---

**Promoted to:** docs/specs/work-items/WI-077.md
**Promoted at:** 2026-04-24T13:24:55.458Z
