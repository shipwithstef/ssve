# Framework Improvement: Wire G-4 skill-artifact-authenticity hook for Kimi + Codex

## Evidence
- **Source:** `audit-session-execution` of current session (`proposals/2026-05-04-session-audit-current-session.md`)
- **Finding:** `svc-skill-artifact-authenticity.mjs` (G-4 / WI-114) was wired for Claude (`wire-hooks.mjs`) but NOT for Kimi (`wire-kimi-hooks.mjs`) or Codex (`wire-codex-hooks.mjs`). Agents on Kimi CLI wrote to `docs/specs/research-log.md` and `references/knowledge/` without emitting `skill_invocation` receipts.
- **Severity:** high

## Diagnosis
- **Root cause:** The G-4 hook was implemented in PR #28 with full blocking logic, path→skill mapping, and receipt checking. It was added to `hooks/hooks.json` and `wire-hooks.mjs` (Claude). But the Kimi and Codex wirers were never updated.
- **Category:** drift
- **Already in FRAMEWORK-STATE.md?** no (new finding)

## Implementation
- **Route:** quick-fix
- **Files changed:**
  - `hooks/kimi/svc-kimi-skill-artifact-authenticity.sh` — new bash adapter (Kimi stdin-JSON → .mjs argument)
  - `scripts/wire-kimi-hooks.mjs` — added PreToolUse entry for G-4 on WriteFile|StrReplaceFile
  - `scripts/wire-codex-hooks.mjs` — added PreToolUse entry for G-4 on apply_patch|Edit|Write
  - `FRAMEWORK-STATE.md` — updated hooks count (13→14), added Analysis History entry
- **Commits:** `2cf7a58`

## Replay Verification
- **Replay target:** Run `node scripts/wire-kimi-hooks.mjs --dry-run` and verify `svc-kimi-skill-artifact-authenticity.sh` appears in the generated TOML.
- **Result:** PASS
- **Evidence:**
  ```bash
  $ node scripts/wire-kimi-hooks.mjs --dry-run | grep -c "skill-artifact-authenticity"
  1
  ```

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Added 2026-05-04 entry for G-4 wiring fix
- **Known Gaps:** No change (this gap was not previously tracked)
- **Decisions:** None new
- **Capabilities:** Hooks count updated 13→14

**Status:** IMPLEMENTED (2026-05-04, commit 2cf7a58)
