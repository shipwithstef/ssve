---
**Status:** IMPLEMENTED — 2026-04-14
---

# Framework Improvement: create-skill must run ./setup after creating a skill

## Evidence
- **Source:** User report (2026-04-14) — "skill is missing after logout and login, you make this error all the time"
- **Finding:** `svc-advisor` was committed to the framework repo in the previous session but had no symlink in `~/.claude/skills/`. After session restart, the skill was invisible. Audit also found `blend-private` and `evaluate-rule` missing from `~/.codex/skills/` (likely from earlier create-skill runs).
- **Severity:** HIGH — every new skill created via create-skill is invisible to Claude Code / Codex until someone manually re-runs `./setup`. This has happened repeatedly per the user.

## Diagnosis
- **Root cause:** `create-skill/SKILL.md:116-123` (the "After creating the skill, also" checklist) tells the agent to update the manifest, README, EXTERNAL_ADDONS, and lint — but never tells it to run `./setup` to create the symlink. The setup script (`setup:105-123`) IS idempotent and correctly detects new skills on re-run, but the create-skill contract doesn't invoke it. Result: skill directory exists in framework repo, manifest references it, but no symlink exists in host skill paths.
- **Category:** Gap (contract missing a step) + Drift (setup script handles it; skill doesn't call setup)
- **Already in FRAMEWORK-STATE.md?** No

## Implementation
- **Route:** direct SKILL.md edit
- **Files changed:**
  - `create-skill/SKILL.md` — added step 7 (MANDATORY: run `./setup --host claude` and `./setup --host codex` if installed) with rationalization table + red flags, added self-verify checks #5 and #6
  - Fixed `svc-advisor` symlink in `~/.claude/skills/` (immediate)
  - Fixed `svc-advisor`, `blend-private`, `evaluate-rule` symlinks in `~/.codex/skills/` (immediate)
- **Commits:** (this commit)

### Changes

1. Added step 7 to "After creating the skill, also" checklist:
   ```
   7. MANDATORY — run the installer
     cd $FRAMEWORK_REPO && ./setup --host claude
     [ -d ~/.codex/skills ] && ./setup --host codex
   ```
2. Added rationalization table shutting down the 4 most common skip-reasons
3. Added red flags list (3 behaviors that indicate the step was skipped)
4. Added self-verify checks #5 (symlink exists) and #6 (symlink resolves to framework repo)

## Replay Verification
- **Replay target:** Create a new skill, follow the updated contract, verify symlink exists in `~/.claude/skills/<new-skill>` before declaring done.
- **Result:** PASS — `./setup --host claude` output showed "Skills: 1 installed, 53 already current", and `ls ~/.claude/skills/svc-advisor/SKILL.md` now resolves correctly. The Codex sync installed 3 previously-missing symlinks (`svc-advisor`, `blend-private`, `evaluate-rule`).
- **Evidence:** audit script `node -e "..."` now returns `Missing in ~/.claude/skills: []` and `Missing in ~/.codex/skills: []`.

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add entry for this fix
- **Known Gaps:** none to move (this gap wasn't tracked)
- **Capabilities:** no capability change — create-skill contract tightened, not expanded
