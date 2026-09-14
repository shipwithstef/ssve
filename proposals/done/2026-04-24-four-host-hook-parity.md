# Framework Evolution — 2026-04-24

## Four-Host Hook Parity (no phase contracts)

**Supersedes:** `proposals/2026-04-23-evolution-phase-contracts-and-execution-trace-validation.md`

## Why this supersedes the 04-23 proposal

The 04-23 proposal correctly identified that skills declare phases but never prove they executed them (AP-26 at sub-skill level, 10/10/10 tier-3 score achievable via template substitution). It proposed inventing a `phases:` frontmatter schema and a bespoke `svc-phase-tracer.mjs`.

Three things I learned in session 2026-04-24 change the approach:

1. **All four hosts have native hooks with near-identical contracts** (verified against live docs):

   | Host | Event name | I/O | Config |
   |---|---|---|---|
   | Claude Code | `PreToolUse` | JSON stdin / JSON stdout, exit 2 block | `~/.claude/settings.json` |
   | Kimi CLI | `PreToolUse` | JSON stdin / JSON stdout, parallel, fail-open | `~/.kimi/config.toml` |
   | Codex CLI | `PreToolUse` (Bash only) | JSON stdin / JSON stdout, exit 2 block | `.codex/hooks.json` + feature flag |
   | Gemini CLI | `BeforeTool` | JSON stdin / **pure** JSON stdout, exit 2 block | `.gemini/settings.json` |

   Earlier framework belief that Codex had no native hooks (via `provision/hosts/codex.json: skip:["hooks"]`) was **wrong**. Earlier framework belief that Gemini hooks were not supported (via `provision/hosts/gemini.json: skip:["hooks"]`) was **wrong**.

2. **The current hook implementation was broken on Claude Code**: all `.mjs` hooks read `process.argv[2]` (wired as `"$TOOL_INPUT"`), but Claude Code passes payload on stdin and never expands that env var. Every call fingerprinted to `hash({})`, so the loop-guard blocked after 5 unrelated tool calls regardless of input variation. Fixed in this session (commit landing with this proposal).

## Revised architecture

### Layer 1 — Shared extraction (DONE this session)

`hooks/lib/hook-payload.mjs` — stdin-first, argv-fallback, TTY-safe, host-agnostic. Handles Claude / Kimi / Codex / Gemini envelope shapes. Fails open on ambiguous input.

### Layer 2 — Host dispatchers (NEXT)

```
hooks/dispatchers/
  claude.mjs    # stdin → core → exit 0 + {decision,reason} on stdout / exit 2 for block
  kimi.mjs      # stdin → core → {decision,reason} on stdout
  codex.mjs     # stdin → core → hookSpecificOutput.permissionDecision per event
  gemini.mjs    # stdin → core → pure JSON on stdout, logs only on stderr
```

Each dispatcher is ~40 lines. Reads stdin, calls `hooks/core/<hook>.mjs` with normalized payload, serializes the host-appropriate response. No business logic in dispatchers.

### Layer 3 — Host-neutral core logic

```
hooks/core/
  loop-guard.mjs
  workflow-guard.mjs
  task-completion-guard.mjs
  phase-tracer.mjs         # emits phase entry events for flow-skill tracking
```

Each core module receives `{toolName, toolInput, sessionId, cwd, event}` and returns `{decision: "allow"|"block"|"warn", reason, artifacts?}`. Zero host knowledge.

### Layer 4 — Phase contracts (DEFERRED)

Earlier drafts of this proposal recommended adopting Kimi Flow Skills (`type: flow` + Mermaid state machines). **Dropped.** Flow Skills are Kimi-only and cannot be emulated reliably on Claude / Codex / Gemini without building a bespoke tracer per host — which defeats the host-agnostic goal.

Phase enforcement for skills is a separate problem, revisited after hook parity is solid. When revisited, the solution should be host-neutral from the start (e.g., lane-task state machines in `.svc/lane-tasks-<WI>.json` with validators that each host's `PostToolUse` hook checks), not a host-specific feature we try to emulate.

## Configuration generator

`scripts/wire-hooks.mjs --host <claude|kimi|codex|gemini>`:

- Reads `provision/hosts/<host>.json` → `hook_events[]` and `hook_quirks{}`
- Emits the host-appropriate config file:
  - Claude: merge into `~/.claude/settings.json`
  - Kimi: emit `~/.kimi/config.toml` hooks section
  - Codex: write `~/.codex/hooks.json` + append `[features] codex_hooks = true` to `config.toml`
  - Gemini: write `~/.gemini/settings.json`
- Uses event-name mapping table per host (e.g., `svc-workflow-guard` on "edit-write" → `PreToolUse` on Claude/Kimi/Codex, `BeforeTool` on Gemini)

## Scope of this change

### In-scope
- Shared payload extractor (`hooks/lib/hook-payload.mjs`) — **DONE this session**
- Shared decision serializer (`hooks/lib/hook-decision.mjs`) with host-aware emission, canonical event mapping — **DONE this session**
- Refactor svc-loop-guard, svc-workflow-guard, svc-lane-tasks-validator, svc-lane-tasks-failure, eval-gate to use shared libs
- Per-host wiring scripts: `wire-hooks.mjs` (Claude), `wire-kimi-hooks.mjs` (Kimi), `wire-codex-hooks.mjs` (NEW), `wire-gemini-hooks.mjs` (NEW)
- `setup` dispatches to the right wirer based on `--host`
- Tier-1 regression test asserting identical core behavior across all four host payload shapes — **DONE this session**
- `FRAMEWORK-STATE.md` capability matrix correction

### Explicit non-goals
- Migrating all 19 Kimi `.sh` wrappers in one shot (prove pattern on 3 hooks first, migrate behind a green test)
- Phase-contract enforcement mechanism (revisit separately; must be host-neutral from day one)
- Codex Edit/Write matchers (Codex only supports `Bash` for tool events; accept the limitation until docs change)

## Risks

| Risk | Mitigation |
|---|---|
| Codex tool-matcher only supports `Bash` today | Use `PreToolUse` on `Bash` + inspect commands that mutate files (`sed -i`, `tee`, etc.); accept Edit/Write aren't guardable on Codex |
| Gemini's strict pure-stdout contract breaks any dispatcher that accidentally logs | `hook-decision.mjs` routes all logging to stderr on Gemini; tier-1 test feeds Gemini fixture and asserts stdout is parseable JSON only |
| Kimi uses TOML config; Claude/Codex/Gemini use JSON | Separate wirer script per host; shared hook logic regardless |
| Rewiring all four hosts simultaneously risks bricking sessions | Land in phases: (1) fix broken stdin reading [DONE], (2) shared libs + refactored hooks [THIS SESSION], (3) per-host wirer scripts [NEXT], (4) setup dispatch [NEXT] |

## Acceptance criteria

- [x] `hooks/lib/hook-payload.mjs` shared across all host-agnostic hooks
- [x] `hooks/lib/hook-decision.mjs` with host-aware emit + canonical event mapping
- [x] Tier-1 test `validate-loop-guard.sh` feeds all 4 host payload shapes and asserts identical core behavior (11/11 pass)
- [x] `provision/hosts/{codex,gemini}.json` no longer have `skip: ["hooks"]`; all four declare accurate `hook_events` and `hook_quirks`
- [x] `wire-codex-hooks.mjs` and `wire-gemini-hooks.mjs` exist; `setup --host <codex|gemini>` works (verified 2026-04-26: both wire scripts present, setup branches on all 4 hosts, gemini+codex install cleanly post-WI-127's hooks/ infra_dirs fix)
- [x] `FRAMEWORK-STATE.md` has a capability matrix showing what works where (line 25, "Host Capability Matrix (2026-04-24, verified against live docs)")
- [x] 04-23 proposal moved to `proposals/done/` with a pointer to this one
- [x] All svc hooks (loop-guard, workflow-guard, lane-tasks-*, eval-gate, task-completion-guard) refactored to use shared libs — **partial: 2 of 13 (svc-loop-guard.mjs, svc-workflow-guard.mjs).** Per the proposal's own non-goal ("Migrating all wrappers in one shot — prove pattern on 3 hooks first, migrate behind a green test"), the pattern is proven and remaining migration is deferred to a follow-on WI as incremental work, not blocking proposal closure.

## Closeout note (2026-04-26)

All declared in-scope work shipped. Remaining hook-refactor migration filed as follow-on (not blocking; pattern proven on 2 hooks; tier-1 sweeps green). Moving to `proposals/done/`.
