# superpowers — Design Evolution & Plans Details

## Release History

| Version | Date | Key changes |
|---|---|---|
| v5.0.1 | 2025-11 | Gemini CLI extension; skills moved inside skill directory (agentskills.io); Windows quoting fixes |
| v5.0.2 | 2025-12 | Brainstorm server rebuilt zero-dependency (custom RFC 6455, fs.watch, owner-PID); replaced Express/ws/chokidar |
| v5.0.3 | 2026-01 | Cursor hooks; session-start no longer fires on `--resume`; Bash 5.3+ heredoc hang fix (`printf` not heredoc) |
| v5.0.5 | 2026-02 | ESM module fix (`.cjs` for Node 22+); Windows PID namespace fix; stop-server.sh SIGTERM+SIGKILL escalation |
| v5.0.6 | 2026-03 | Inline self-review replaced subagent review loops (~30s vs ~25 min, comparable quality); content/state dir split |
| v5.0.7 | 2026-03 | GitHub Copilot CLI support; OpenCode bootstrap moved to first user message (Qwen/multi-model fix) |

## Key Architectural Decisions (with rationale)

### Subagent review loops → Inline self-review (v5.0.6)
- Subagent review loops doubled execution time with no quality gain
- Inline self-review catches 3-5 bugs per run in ~30s vs ~25 min
- Comparable defect detection rates

### Blocking TaskOutput → Non-blocking events file (visual brainstorming refactor)
- Original: background task captures server stdout (blocking)
- Refactored: `.events` file written by server, read by Claude on next turn
- Eliminates: TaskOutput, wait-for-feedback.sh, sendToClaude, polling

### Vendored node_modules → Zero-dependency server (v5.0.2)
- 714 tracked files (Express, ws, chokidar) replaced by ~300 lines
- Supply chain motivation: vendored deps don't get patches
- Custom RFC 6455 WebSocket, fs.watch instead of chokidar

### System message → First user message injection (v5.0.7)
- System message injection: per-turn token bloat, breaks Qwen/multi-model
- User message injection: one-time, model-agnostic
- Idempotency guard: check for `EXTREMELY_IMPORTANT` before injecting

### Slash commands → Skills (v5.0.x)
- `commands/brainstorm.md`, `execute-plan.md`, `write-plan.md` all deprecated
- Replaced by skill-based invocation via `superpowers:<skill-name>`
- Tombstone files redirect with deprecation message

## Design Docs

### OpenCode Support (2025-11-22)
- Shared `lib/skills-core.js` extracted from Codex CLI script
- OpenCode plugin: `session.started` hook + `use_skill` + `find_skills` tools
- Skill shadowing: personal overrides superpowers; `superpowers:` prefix forces core
- 18-task implementation plan across 5 phases

### Skills Improvements from User Feedback (2025-11-28)
8 problems from real development sessions:

| Problem | Severity | Root cause |
|---|---|---|
| False positive integrations | Critical | Verification checked existence, not correctness |
| Background process accumulation | High | Stateless subagents don't clean up across runs |
| Mock-interface drift | Critical | Mock derived from code, not interface |
| Lean context experiment | Medium | Full plan text > one-line description for subagents (surprised: lean was better) |
| Self-reflection finding bugs | Medium | Post-implementation reflection found real code bugs |
| Code reviewer can't find file | Low | Reviewer needs explicit file-reading instructions |
| Fix-workflow latency | Low | Implementer who diagnosed should fix before reporting |
| Skills not read | Medium | No enforcement mechanism |

**Key fix patterns:**
- Verification: identify what should be DIFFERENT, find where observable, verify difference
- Mock safety gate: STOP → find interface → list methods → mock ONLY those
- Process cleanup: `pkill` + `lsof` before each E2E test

### Visual Brainstorming (2026-01-17)
Original blocking design with Express/ws/chokidar, TaskOutput capture.

### Visual Brainstorming Refactor (2026-02-19)
Non-blocking "Browser Displays, Terminal Commands" model. Key changes:
- Only `[data-choice]` clicks captured (narrowed from all buttons/forms/inputs)
- Multiple screens via separate filenames (never reuse)
- Events cleared on new file, preserved on existing file change
- Selection indicator bar replaces feedback footer

### Document Review System (2026-01-22)
Spec + plan review loops with subagent reviewers:
- 5-iteration limit before human escalation
- Malformed output: re-dispatch with note; after 2 failures → human
- Chunk-based plan review (1000-line max per chunk)

### Zero-Dep Brainstorm Server (2026-03-11)
Replace 714 vendored files with ~250-300 line stdlib server:
- Custom RFC 6455 with tested protocol layer
- Dual-mode: server or module export for testing
- `ws` npm package used ONLY in tests

### Codex App Compatibility (2026-03-23)
Detection: `git-dir` vs `git-common-dir` comparison:
- Normal: both resolve to same `.git`
- Linked worktree: `git-dir` = `.git/worktrees/<name>`, `git-common-dir` = `.git`
- Submodule: both equal (avoids false positive)
- ~50 lines across 5 files, zero new files

## Analysis — What's valuable for svc

The user feedback document (2025-11-28) is the most actionable — the mock-interface
derivation gate, verification difference check, and lean context experiment are
all directly portable. The subagent review → inline review architectural decision
(30s vs 25 min, comparable quality) provides concrete evidence for svc's own
review gate design decisions.

## L4 Pointers

- Release notes: `RELEASE-NOTES.md`
- Changelog: `CHANGELOG.md`
- OpenCode design: `docs/plans/2025-11-22-opencode-support-design.md`
- User feedback: `docs/plans/2025-11-28-skills-improvements-from-user-feedback.md`
- Visual brainstorm refactor: `docs/superpowers/plans/2026-02-19-visual-brainstorming-refactor.md`
- Zero-dep server: `docs/superpowers/plans/2026-03-11-zero-dep-brainstorm-server.md`
- Codex App compat: `docs/superpowers/specs/2026-03-23-codex-app-compatibility-design.md`
