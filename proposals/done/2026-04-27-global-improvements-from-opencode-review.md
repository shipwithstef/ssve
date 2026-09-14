# Proposal: Global Improvements Found During OpenCode Host Integration

**Date:** 2026-04-27
**Source:** OpenCode host integration review
**Scope:** Framework-wide (not OpenCode-specific)

These issues were discovered during the OpenCode host integration but affect the framework globally. None are blocking — flagging for future planning.

---

## 1. detect-host.sh double-invokes detection functions

**File:** `scripts/detect-host.sh` lines 120-128

**Issue:** Each detection function (`detect_by_parent_process`, `detect_by_env`, `detect_by_session_files`) is called twice — once for the `if` check (output discarded) and once to capture the result. This doubles the work (process tree walk, env checks, filesystem scans).

**Impact:** Low — detection runs once per session, overhead is negligible. But it's wasteful and could cause race conditions if process state changes between calls.

**Fix:** Capture output in a variable on first call:
```bash
result="$(detect_by_parent_process 2>/dev/null)" && HOST="$result" && METHOD="parent_process"
```

**Effort:** 5 minutes

---

## 2. rulesRegistry source-of-truth split between manifest and file content

**File:** `setup` lines 210-270, `skills-manifest.json` `rulesRegistry`

**Issue:** The `setup` script determines universal vs stack-specific rules by reading file content for `stack: universal`. But the actual source of truth is `skills-manifest.json`'s `rulesRegistry`. If a rule file doesn't contain the string `stack: universal` in its body (e.g., `destructive-git-ops.md` which has no YAML frontmatter), setup's behavior diverges from the manifest.

The wire-opencode-hooks.mjs script now reads from the manifest directly (fixed today). But `setup` still uses the file-content approach.

**Impact:** Medium — currently works because all 12 universal rules either have frontmatter with `stack: universal` or are in `rules/common/`. But adding a new universal rule without the string in its content would silently misclassify it during setup.

**Fix:** Update `setup` to read `rulesRegistry` from `skills-manifest.json` instead of scanning file content. Same pattern as the fixed wire script.

**Effort:** 15 minutes

---

## 3. No backup of host config before setup overwrites

**File:** `setup`, all `wire-*.mjs` scripts

**Issue:** When `setup` runs for any host, the wire scripts modify the host's config file (e.g., `~/.claude/settings.json`, `~/.config/opencode/opencode.json`) without creating a backup. If the merge corrupts the file, the user loses their existing config.

**Impact:** Low-medium — the merge logic is additive-only and idempotent. But a power failure or bug during write could leave a corrupted config.

**Fix:** Each wire script should create a `.bak` copy before writing, or at minimum check that the existing file is valid JSON before modifying.

**Effort:** 10 minutes per wire script

---

## 4. svc-safety.toml policy only installed for Gemini

**File:** `setup` lines 330-347, `provision/hosts/*.json`

**Issue:** The `policies_path` field (which triggers policy installation) is only defined in `gemini.json`. Other hosts (Claude, Kimi, Codex, OpenCode) don't get the safety policies installed. Claude has its own settings-based policy system, but Kimi, Codex, and OpenCode have no equivalent.

**Impact:** Low — the policies protect `.git/`, `.env`, and `FRAMEWORK-STATE.md`. The hook-based guards (workflow-guard, bash-guard) provide similar protection on hosts with hooks. But hosts without hooks (like Antigravity) have no protection at all.

**Fix:** Either extend `policies_path` to hosts that support it, or document that hook-based protection is the primary mechanism and policies are Gemini-specific.

**Effort:** 30 minutes (analysis + documentation)

---

## 5. agents/ directory not linked for hosts that need it

**File:** `provision/hosts/opencode.json` (fixed today), `provision/hosts/codex.json`

**Issue:** The `agents/` directory contains first-class agent definitions (summary-extractor, plan-reviewer, strategic-reviewer, svc-kimi-executor). It's linked for Kimi (which has native YAML agent support) but not for Codex or Gemini. OpenCode now includes it (fixed today).

**Impact:** Low — agents are invoked via `dispatch-worker.sh` or `claude -p --agent`, not via the host's native agent system. The symlink makes the definitions available but doesn't automatically register them.

**Fix:** Add `"agents"` to `infra_dirs` for codex.json and gemini.json if those hosts gain agent support.

**Effort:** 5 minutes per host

---

## 6. route-workflow/SKILL.md host table missing OpenCode

**File:** `route-workflow/SKILL.md` lines 85-88

**Issue:** The "Host-specific skills path" table lists Kimi, Claude, Codex, Gemini but not OpenCode. Users following the instructions to initialize project state won't know the correct command for OpenCode.

**Impact:** Medium — anyone using OpenCode as a host will be confused by the missing row. The `init-project-state.mjs` script works fine, but the documentation doesn't tell them where to find it.

**Fix:** Add row: `| OpenCode | ~/.config/opencode/skills/ | node ~/.config/opencode/skills/scripts/init-project-state.mjs |`

**Effort:** 2 minutes

---

## 7. onboard-repo/SKILL.md host tables missing OpenCode

**File:** `onboard-repo/SKILL.md` lines 67-70, 334-336

**Issue:** Two host tables in onboard-repo list Kimi/Claude/Codex/Gemini but not OpenCode. The first table is "Host-specific skills path" (init-project-state), the second is "Rules file by host" (AGENTS.md path).

**Impact:** Medium — same confusion as item 6. Users onboarding a brownfield repo with OpenCode won't have the right commands.

**Fix:** Add OpenCode rows to both tables.

**Effort:** 3 minutes

---

## 8. dispatch-worker.sh skill lookup missing opencode path

**File:** `scripts/dispatch-worker.sh` lines 100-106

**Issue:** The worker prompt instructs the subprocess to find SKILL.md by checking `~/.kimi/skills/` first, then `~/.agents/skills/`, then repo-local. It never checks `~/.config/opencode/skills/`. If `SVC_HARNESS=opencode`, the worker should check the OpenCode skills path.

**Impact:** Low — the worker runs in a subprocess with `--pure` flag, so it reads from whatever path is available. The repo-local fallback usually works. But if the worker is invoked outside the repo, it won't find skills at the OpenCode path.

**Fix:** Add `~/.config/opencode/skills/$SKILL/SKILL.md` to the lookup chain, or make the lookup harness-aware.

**Effort:** 10 minutes

---

## 9. audit-session-execution/SKILL.md session paths table missing OpenCode

**File:** `audit-session-execution/SKILL.md` lines 195-197

**Issue:** The session artifact paths table lists Codex, Claude, Gemini but not OpenCode. OpenCode stores sessions differently (TUI-based, shareable via links).

**Impact:** Low — the audit skill won't know where to find OpenCode session data for forensic analysis.

**Fix:** Research OpenCode's session storage location and add a row.

**Effort:** 15 minutes (research + documentation)

---

## 10. README.md host list missing OpenCode

**File:** `README.md` lines 489-491

**Issue:** The README lists setup instructions for Codex and Kimi but not OpenCode.

**Impact:** Medium — README is the first thing users see.

**Fix:** Add OpenCode setup instructions.

**Effort:** 3 minutes

---

## Priority (Updated)

| # | Issue | Priority | Effort |
|---|-------|----------|--------|
| 6 | route-workflow host table missing OpenCode | Medium | 2 min |
| 7 | onboard-repo host tables missing OpenCode | Medium | 3 min |
| 10 | README host list missing OpenCode | Medium | 3 min |
| 2 | setup rules source-of-truth split | Medium | 15 min |
| 8 | dispatch-worker skill lookup missing opencode path | Low-Medium | 10 min |
| 3 | No config backup before wire scripts | Low-Medium | 10 min × 5 |
| 9 | audit-session-execution session paths missing OpenCode | Low | 15 min |
| 1 | detect-host double invocation | Low | 5 min |
| 4 | Safety policies only for Gemini | Low | 30 min |
| 5 | agents/ dir not linked for codex/gemini | Low | 5 min × 2 |
