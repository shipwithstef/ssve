# Framework Improvement — Setup Orphan Symlink Cleanup

**Date:** 2026-04-24
**Lane:** framework
**Severity:** medium

## Problem

`setup` creates symlinks from `~/.claude/skills/rules/<stack>/*.md` based on the current `rulesRegistry`. When a rule is renamed, removed, or relocated in the registry, the old symlink is orphaned — the target disappears but the symlink remains. WI-079's `validate-claude-skills-symlinks.sh` catches these after the fact but setup itself never cleans them up, so every install leaves accumulating dead symlinks.

Observed: `validate-claude-skills-symlinks.sh` fired on `~/.claude/skills/rules/web/base44-schema.md` — a leftover from an earlier registry entry that was removed.

## Fix

Add an orphan-cleanup pass to `setup` after the rules-registry loop. Walk `$SKILLS_TARGET/rules` and `$RULES_DIR`, remove symlinks whose targets are missing. Preserve symlinks pointing outside `$SCRIPT_DIR` (not ours to clean).

## Acceptance Criteria

- AC-01 `setup` removes symlinks under `$SKILLS_TARGET/rules/` whose targets do not exist.
- AC-02 `setup` reports `Rules:  pruned N orphan symlink(s)` when any were removed.
- AC-03 Symlinks pointing outside `$SCRIPT_DIR` are left untouched.
- AC-04 `validate-claude-skills-symlinks.sh` passes after a `./setup --host claude` run.
- AC-05 Full tier-1 sweep PASS.

## File Impact

- `setup` — add orphan cleanup pass
- `references/framework-learnings.jsonl` — append learning

## Rollback

Single-commit revert.
