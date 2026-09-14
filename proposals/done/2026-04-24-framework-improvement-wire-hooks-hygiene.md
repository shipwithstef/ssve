# Framework Improvement — 2026-04-24 — Wire-hooks Hygiene

**Status:** DRAFT — authored by improve-framework Step 5. Bundles two observed defects in `scripts/wire-hooks.mjs`.

## Goal

Fix `scripts/wire-hooks.mjs` so that (a) repeated invocations don't accumulate duplicate hook entries in `~/.claude/settings.json`, and (b) `.js → .mjs` renames beyond the single hard-coded case migrate automatically.

## Non-Goals

1. Changing the set of hooks wired by the script — only dedup + migration.
2. Porting additional hooks.
3. Touching the other wire scripts (kimi/codex/gemini) unless they share the same defect.

## Acceptance Criteria

### US-01 — Dedup on re-run
- **AC-01.1** After running `./setup --host claude` N times (N ≥ 2), every hook entry in `~/.claude/settings.json` matchers appears exactly once.
- **AC-01.2** A new tier-1 check `validate-settings-no-duplicate-hooks.sh` fails if any matcher contains two or more hooks with the same `name` field.

### US-02 — Extended rename migration map
- **AC-02.1** `RENAMED_FILES` in `scripts/wire-hooks.mjs` includes all known `.js → .mjs` ports (at minimum: `svc-workflow-guard.js → .mjs`, and any future ports documented via a new `hooks/.renames.json` registry).
- **AC-02.2** New `hooks/.renames.json` (or equivalent) acts as the single source-of-truth for rename migrations, readable by the wire script.

### US-03 — No regression
- **AC-03.1** Full tier-1 sweep PASS.
- **AC-03.2** Dry-run `./setup --host claude --dry-run` on a clean install produces identical settings.json across 2 runs (idempotency).

## File Impact

| File | Change |
|---|---|
| `scripts/wire-hooks.mjs` | **edit** — dedup pass before append; consume `hooks/.renames.json` |
| `hooks/.renames.json` | **create** — rename registry (single source of truth for `.js → .mjs` and future renames) |
| `test-framework/evals/tier-1/validate-settings-no-duplicate-hooks.sh` | **create** — asserts dedup correctness |
| `references/framework-learnings.jsonl` | **append** — `wire-hooks-must-dedup-before-append` + `wire-hooks-rename-registry-over-hardcoded-map` |

## Scope boundary
- **touches:** the 4 files above.
- **reads:** `~/.claude/settings.json` as ground truth for the validator.
- **must-not-touch:** other wire scripts; skill SKILL.md files; manifest; hooks other than rename metadata; route-workflow.

## Rollback

Commit-scoped revert. Dedup is additive; rename-registry is additive with a 1-entry migration. If anything regresses, revert the single commit; settings.json needs no cleanup because dedup only removes duplicates, never originals.

## Size / Risk

- Files: 4. Lines: ~120.
- Risk class: hot-path edit (`wire-hooks.mjs` runs during every `./setup`) + contract change (new `.renames.json` schema).
- Plan-changeset required: yes.


---

**Promoted to:** docs/specs/work-items/WI-076.md
**Promoted at:** 2026-04-24T13:17:40.960Z
