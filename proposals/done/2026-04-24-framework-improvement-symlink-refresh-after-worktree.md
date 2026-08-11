# Framework Improvement — 2026-04-24 — Symlink Refresh After Worktree Removal

**Status:** DRAFT — improve-framework Step 5 output.

## Goal
Add a tier-1 dead-symlink detector for `~/.claude/skills/` so the agent immediately notices when worktree deletion has broken the symlinks (observed 3× this session after WI-073/WI-074/WI-075 closeouts).

## Non-Goals
1. Modifying `scripts/worktree.sh` (which is shared across hosts; orthogonal concern).
2. Auto-running `./setup` — we want detection, not magic.

## Acceptance Criteria
- AC-01 `test-framework/evals/tier-1/validate-claude-skills-symlinks.sh` exists and is executable.
- AC-02 Validator lists all entries under `~/.claude/skills/hooks/**` and `~/.claude/skills/**/SKILL.md` and asserts each resolves to a real file.
- AC-02b If `~/.claude/skills/` does not exist (fresh machine), validator exits 0 with a skip message.
- AC-03 Validator exit 0 on clean install; exit 1 with the dead-symlink path(s) + message "run ./setup --host claude to refresh".
- AC-04 Full tier-1 sweep PASS.

## File Impact
| File | Change |
|---|---|
| `test-framework/evals/tier-1/validate-claude-skills-symlinks.sh` | **create** |
| `references/framework-learnings.jsonl` | **append** — `worktree-delete-breaks-claude-skills-symlinks` |

## Scope boundary
- touches: the 2 files.
- must-not-touch: scripts/worktree.sh; setup; skill SKILL.md; hooks; route-workflow; manifest.

## Rollback
Single commit revert.

## Size
- Files: 2. Lines: ~40. Additive.
- Risk: low.
- Plan-changeset: yes (new tier-1 contract).


---

**Promoted to:** docs/specs/work-items/WI-081.md
**Promoted at:** 2026-04-24T13:33:08.686Z
