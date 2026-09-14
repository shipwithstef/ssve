# Framework Improvement — 2026-04-24 — Rules Registry Completeness Check

**Status:** DRAFT — improve-framework Step 5 output.

## Goal
Add a tier-1 validator that fails if any `rules/*.md` file exists on disk but is missing from `skills-manifest.json`'s `rulesRegistry.entries`. Prevents the silent bookkeeping gap that caused WI-072's unrelated tier-1 failure (`plan-changeset-trigger.md` added but not registered).

## Non-Goals
1. Auto-generating registry entries — humans still write `notes`, `last_evaluated`, etc. Validator only catches the gap.
2. Reorganizing `rules/` structure.

## Acceptance Criteria
- AC-01 `test-framework/evals/tier-1/validate-rules-registry-completeness.sh` exists and is executable.
- AC-02 Validator lists every `rules/**/*.md` on disk and asserts each has a matching entry in `skills-manifest.json.rulesRegistry.entries[*].path`.
- AC-03 Validator exits 0 on clean repo; exit 1 with the unregistered filename.
- AC-04 Full tier-1 sweep PASS.

## File Impact
| File | Change |
|---|---|
| `test-framework/evals/tier-1/validate-rules-registry-completeness.sh` | **create** |
| `references/framework-learnings.jsonl` | **append** — `new-rule-must-be-registered-in-manifest` |

## Scope boundary
- touches: the 2 files above.
- must-not-touch: skill SKILL.md; hooks; route-workflow; rules/**; manifest.

## Rollback
Single commit revert.

## Size
- Files: 2. Lines: ~60. Additive-only.
- Risk: low.
- Plan-changeset: yes (new tier-1 test is a contract addition).


---

**Promoted to:** docs/specs/work-items/WI-078.md
**Promoted at:** 2026-04-24T13:29:21.889Z
