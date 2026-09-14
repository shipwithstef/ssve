# WI-389 — G6 cross-model review + resolutions

**Primary:** codex — credit-exhausted (until Jun 11), legitimate fallback.
**Fallback:** gemini (per `resolve-adversarial-reviewer.sh`). Diff-only, `--approval-mode plan`, piped via stdin. **Date:** 2026-06-08.
**Verdict:** 6 findings (1 CRITICAL, 2 HIGH, 1 MEDIUM, 2 LOW) — 5 fixed, 1 partial (claim guarded, hardened anyway).

| # | Sev | Finding | Resolution |
|---|-----|---------|------------|
| 1 | CRITICAL | The no-raw-read validator only matched `\bRead\b` (Claude's tool), a blind spot for other hosts' read tools (`read_file`, `view_file`). | Broadened to `(?:Read\|read_file\|view_file\|open_file)`; the shell branch covers `cat/less/head/tail/bat`; code branch covers sync+async `readFile` + `open`. |
| 2 | HIGH | `walk()` only scanned SKILL.md + `references/_shared/rules`, ignoring root instruction files (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `DOCTRINE.md`) where context-spine instructions also live. | `walk()` now also includes root-level `.md` files. |
| 3 | HIGH | The `cat` regex allowed only 4 chars before the path → missed `cat "$REPO_ROOT/.svc/spec-index.json"`. | Widened the gap to 30 chars and anchored on the distinctive `spec-index.json` filename (prefix-agnostic). |
| 4 | MEDIUM | `query-spec-index.mjs` `JSON.parse` was unguarded → a malformed/empty index stack-traced. | Wrapped read+parse in try/catch → graceful `exit 1` with a descriptive message. |
| 5 | LOW | `--wi`/`--surface` as a final/again-flag arg. The specific "searches for `undefined`" claim was already guarded by `o.wi ? … : null` + the both-falsy usage check, but `--wi --surface x` consuming the next flag was real. | Hardened `parseArgs`: a missing value or a `--`-prefixed value is rejected → usage error. |
| 6 | LOW | The `readFileSync` regex missed async `fs.readFile`/`fs.promises.readFile`. | Pattern is now `(?:fs\.)?readFile(?:Sync)?\(`. |

**Self-review:** the tool returns only compact `path#anchor [byte_range] — title` pointers (never section content), sorted by anchor for byte-identical idempotency, hard-capped at 6000 chars (≤2K tokens even for token-dense paths) in both human and `--json` mode. The validator now catches the raw-read anti-pattern across hosts, shells, and code, and over root instruction files too.

**Rejection action:** patch-in-place (1 critical + 2 high regex-coverage fixes + 2 robustness + 1 hardening). Iteration count: 1. Full tier-1 green.

**Note:** this commit also reconciles `.svc/archive/lane-tasks/lane-tasks-WI-365.completed-38.json` status `in_progress → completed` — a 1-line follow-up to PR #53's archival that the archive-parity validator flagged on the base (WI-365 was VERIFIED via PR #38; the rename hadn't updated the inner status).
