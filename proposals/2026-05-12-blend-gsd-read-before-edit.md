# Blend Plan: get-shit-done (Read-Before-Edit Guard)

**deferred_until**: 2026-08-25
**reason**: auto-triage during WI-CHAIN-TIER1-FIXES; proposal stays open pending re-review after chain validation green | re-triaged 2026-06-29: batch backlog-sequenced behind active framework work — flagged for individual triage by 2026-07-29
**blocked_reason**: Beyond the 14-day defer window: imported/backlog evolution proposal awaiting a dedicated triage pass (re-deferred 2026-06-29, not abandoned).

**Source:** https://github.com/gsd-build/get-shit-done
**SHA:** 8cd874969cc1e8d52b6c6464c89b36f25528e2d1
**Date:** 2026-05-12
**Previous blend:** 2026-04-08

## Summary

1 pattern to blend, 0 to skip, 0 already present.
This proposal evaluates GSD's `gsd-read-guard.js`, which prevents agents from performing "blind edits" (modifying files without reading them first).

| # | Pattern | Target | What breaks without it | What changes after |
|---|---------|--------|----------------------|-------------------|
| 1 | Read-Before-Edit Guard | `hooks/svc-read-before-edit.mjs` | Agents guess file contents from stale memory, causing `replace` tool failures due to mismatched `old_string`. | Intercepts `replace` and `write_file` calls in `PreToolUse`; if the file hasn't been read in the current session, it blocks the tool and instructs the agent to read first. |

## Blend items

### 1. Read-Before-Edit Guard → `hooks/svc-read-before-edit.mjs`

**From:** `hooks/gsd-read-guard.js` (GSD repository)
**Into:** `hooks/svc-read-before-edit.mjs` (New SVC hook)

**The problem in svc today:**
When using non-Claude hosts (like Kimi CLI, Gemini CLI, OpenCode, or Codex), agents frequently attempt to mutate a file without first reading it. Each host's tool name surface differs: Claude Code uses `Edit` / `Write`; Kimi CLI uses `WriteFile` / `StrReplaceFile`; Codex CLI uses `apply_patch` / `Edit` / `Write`; Gemini CLI uses `replace_string` / `write_file`. The reading-side names differ too: Claude `Read`, Kimi `ReadFile`, Codex `Read`, Gemini `read_file`. The repo already normalizes these surfaces in `hooks/lib/hook-payload.mjs` (and a companion `extractFilePath` helper for Edit/Write/Read-style payloads). Without reading first, the mutating tool fails because the old-string does not match the file content, creating an infinite loop where the agent blindly retries different guesses, burning tokens and context window.

**How the source solves it:**
GSD implements a `PreToolUse` hook (`gsd-read-guard.js`). When it detects a `Write` or `Edit` tool call on a file that exists on disk, it injects an advisory message: `"READ-BEFORE-EDIT REMINDER: You are about to modify <file> which already exists. If you have not already used the Read tool... you MUST Read it first."` It explicitly targets non-Claude models (like OpenCode) because Claude Code enforces this natively. 

**What this changes in svc:**
We will introduce a stateful `svc-read-before-edit.mjs` hook that uses `hooks/lib/hook-payload.mjs::readHookPayload` + `extractFilePath` to extract `{toolName, toolInput, file_path}` host-agnostically. The hook MUST treat the following case-insensitive normalized tool-name sets as equivalents (Codex rounds 2+4 caught the host-naming gaps):

- **Read-class tools** (populate the cache, must be a FULL read of the file content):
  - Claude: `Read`
  - Kimi: `ReadFile`
  - Gemini: `read_file`
  - OpenCode: `read` (lowercase)
  - Codex: **NO native Read tool surface** — Codex's hook wiring (`scripts/wire-codex-hooks.mjs`) only matches `Bash`, `apply_patch`, `Edit`, `Write`, MCP tools. File reads happen via shell commands (`cat`, `sed -n p`, `rg`, `head`, `tail`, etc.). Codex round-5 caught: a generic `Read` matcher would never fire. Codex-specific read strategy below.
- **Mutate-class tools** (block unless cached, OR target file does not exist on disk — see Add-File exemption below):
  - Claude: `Edit`, `Write`
  - Codex: `Edit`, `Write`, `apply_patch`
  - Kimi: `WriteFile`, `StrReplaceFile`
  - Gemini: `write_file`, `replace`, `edit` (matches the existing svc Gemini hook wiring per `scripts/wire-gemini-hooks.mjs` — Codex round-5 caught the prior `replace_string` was wrong for this svc setup)
  - OpenCode: `edit`, `write`, `apply_patch` (all lowercase)
- **Discovery tools (do NOT satisfy the cache)** — Codex round-4 caught: `Grep` / `grep_search` / `grep` return only matching snippets, not the full file. A grep is not equivalent to a read for the purpose of this guard. The cache MUST only accept Read-class tools above.

**Codex-specific read strategy** (Codex round-5): for Codex sessions the hook MUST ALSO inspect `Bash` tool payloads. When the bash command is one of the recognized full-file readers — `cat <path>`, `sed -n '<range>p' <path>` (when range covers `1,$` or unbounded), `head -<N> <path>` (when N >= 9999 or no limit), `tail -n +1 <path>`, `rg --no-line-number --no-heading -uuu '' <path>` (full-file dump), `less <path>`, `more <path>` — the hook treats it as a Read-class event for that path and populates the cache. Partial reads (`head -5`, `sed -n 1,10p`, `rg <pattern> <path>`) do NOT satisfy the cache. Implementation reuses the existing Bash-payload parser in `hooks/lib/hook-payload.mjs`. If this strategy proves brittle in practice, fall back to Codex-advisory-only mode (warn instead of block) until the Codex CLI ships a native Read tool event.

The matcher MUST normalize incoming tool names to lowercase before set membership check, so the same code path covers Claude (`Read`), OpenCode (`read`), and Codex (`Read`) with one entry per logical tool.

**Add File exemption** (Codex round-4): when the mutating call's target `file_path` does NOT currently exist on disk (i.e. the call is creating a new file via `Write` / `write_file` / `apply_patch` Add-File operation), the hook MUST allow the call without a prior cache hit. There is nothing to read for a file that doesn't exist yet. The hook MUST `fs.existsSync(path)` for each target path; existing-and-uncached → BLOCK; non-existent → ALLOW (and optionally log a creation event for audit).

The hook maintains a session-level cache at `.svc/sessions/read-cache-<session-id>.json` (under the already-gitignored `.svc/sessions/` directory — Codex round-3 caught: putting the cache directly under `.svc/` would leave untracked state in the working tree on every guarded session and risk accidental commit). The cache tracks which `file_path` values have been observed via a Read-class tool in this session.

On a Mutate-class tool call, the hook verifies the target `file_path` is in the cache. **For Codex's `apply_patch` specifically**, the hook MUST extract ALL touched paths from the patch (apply_patch can update / add / delete multiple files in one call), not just the first — Codex round-3 caught: the existing `extractFilePath` helper returns only the first touched path, so a multi-file patch would satisfy the cache for the first file while blindly editing the rest.

**Implementation MUST add a sibling `extractFilePaths` helper rather than changing `extractFilePath`'s return type** (Codex round-6 caught: `extractFilePath` is already imported by `hooks/svc-workflow-guard.mjs`, the lane-task validators, and `hooks/svc-session-contract-freshness.mjs` — all treat the return as a string. Changing the return type to array-or-string would break those callers). The new `extractFilePaths` returns an array for `apply_patch` payloads and a single-element array for everything else, and the read-before-edit hook calls `extractFilePaths` exclusively. Existing callers continue using `extractFilePath` unchanged.

The read-before-edit hook iterates `extractFilePaths` and verifies EVERY path is cached. If ANY path is uncached, SVC issues a **HARD BLOCK** (non-zero exit code per the host's PreToolUse contract), naming the specific uncached path(s).

**What NOT to take:**
We will NOT take GSD's "Advisory Only" approach. GSD simply injects text into the LLM context, which can be ignored by stubborn models. In SVC, because our `replace` tool fails cryptically if the string doesn't match, we must make this a hard, blocking constraint. 
We will also not ignore Claude Code. While Claude Code enforces this natively, an explicit SVC hook standardizes the behavior across all hosts (Gemini, Kimi, Codex, OpenCode).

**Why this matters:**
Blind edits are the #1 cause of `replace` tool failures. A single blind edit can waste 5-6 turns as the agent tries to guess the correct indentation or missing imports. By enforcing a hard Read-Before-Edit gate, we mathematically eliminate hallucinated replacements, saving thousands of tokens per session and drastically increasing deterministic execution.

---

## Assessment A: Blend Opportunities

- **Read-Before-Edit Guard:** A fundamental safety pattern for agentic coding. It shifts the burden of context-gathering from the LLM's memory to the file system, ensuring edits are always grounded in empirical reality.

## Assessment B: External Addon Viability

**Runtime addon?** NO
**License:** MIT
**Install:** N/A

**Integration point:** N/A. This is a behavioral pattern that must be natively implemented into SVC's hook ecosystem, as it requires intercepting SVC's specific tool names (`replace`, `write_file`, `grep_search`).

**What svc should NOT rebuild:** N/A
**What svc should still own:** The stateful tracking of which files have been read in the current session.

## Rethink: past blend reassessment

### Skipped patterns reconsidered
None for this specific mechanic.

## Attribution update
Add to `NOTICES`:
- **Pattern:** Read-Before-Edit Hook
- **Derived from:** `get-shit-done` (Garry Tan / YC)
- **License:** MIT
