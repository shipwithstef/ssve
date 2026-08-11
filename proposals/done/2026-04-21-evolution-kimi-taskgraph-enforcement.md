# Framework Evolution — 2026-04-21 (Kimi Task-Graph Enforcement)

**Status:** IMPLEMENTED (2026-04-21, see `proposals/done/2026-04-21-framework-improvement-kimi-taskgraph-enforcement.md`)

## Method

Read `FRAMEWORK-STATE.md` first to skip already-landed Kimi work and already-tracked AP-27 fixes. Then read the specific files that define the current host/task-graph contract and the recent failure evidence:

- `DOCTRINE.md`
- `skills-manifest.json`
- `KIMI.md`
- `references/task-graph-chaining-protocol.md`
- `route-workflow/references/task-graph-protocol.md`
- `scripts/task-graph.mjs`
- `svc-advisor/SKILL.md`
- `audit-session-execution/SKILL.md`
- `references/knowledge/svc/details/infrastructure.md`
- example-marketplace session audit `proposals/2026-04-21-session-audit-w099-kimi.md`

This is a targeted evolution pass, not a full-surface re-audit of all skills. Scope is limited to Kimi host parity, task-graph enforcement, and the concrete failure class proven by the WI-099 audit.

## Findings (by priority)

| ID | Priority | Severity | Category | Finding |
|---|---|---|---|---|
| F-001 | P0 | high | Drift / Fragility | Kimi host capabilities are described inconsistently across the framework, so different skills tell Kimi to follow different task-graph behavior |
| F-002 | P0 | high | Gap | `task-graph.mjs` enforces task shape but not graph-level completion semantics, so impossible “graph completed while child task pending” states remain writable |
| F-003 | P1 | high | Gap | AP-27 ghost-execution enforcement is still effectively Claude/Codex-specific; Kimi has no host-agnostic skill-load receipt path |
| F-004 | P1 | medium | Fragility | E2E/debug close-out has no mechanical “latest artifact wins” rule, so stale blocker summaries can overwrite newer evidence |

### P0 — Fix now (blocks quality)

#### F-001 — Kimi host capabilities are described inconsistently across the framework, so different skills tell Kimi to follow different task-graph behavior

**Evidence:**
- `KIMI.md:76-79` says Kimi background work is monitored with `/task` or native `TaskList` / `TaskOutput`.
- `KIMI.md:175-185` says Kimi has native `TaskList` / `TaskOutput` tools for task-graph continuity.
- `route-workflow/references/task-graph-protocol.md:8-12` defines host mechanics for Claude, Codex, and Gemini, but omits Kimi entirely.
- `references/task-graph-chaining-protocol.md:16-37` only names Claude Code and Codex for host mirroring / skill loading.
- `svc-advisor/SKILL.md:130-175` and `audit-session-execution/SKILL.md:377-415` still say `Kimi: file-only (no native task API)`.
- `references/knowledge/svc/details/infrastructure.md:7-13` still says only two hosts are supported: Claude and Codex.

**Why this matters:**
- This is no longer just stale prose. It means the same framework tells Kimi, depending on which file was loaded, that it either has native task APIs or does not.
- The WI-099 Kimi audit already showed contract drift on task handling and skill loading; contradictory host instructions make that more likely, not less (`example-marketplace/proposals/2026-04-21-session-audit-w099-kimi.md:82-89`, `98-109`).

**Fix:**
1. Create one canonical host-capabilities source of truth for task-graph behavior. Best candidate: extend `provision/hosts/*.json` with explicit fields for `task_ui`, `background_tasks`, `skill_load_mode`, and `native_task_read_tools`.
2. Generate or lint the task-graph boilerplate from that host matrix instead of hand-maintaining Claude/Codex-centric text in multiple skills.
3. Add Kimi explicitly to:
   - `route-workflow/references/task-graph-protocol.md`
   - `references/task-graph-chaining-protocol.md`
   - any skill still carrying legacy embedded boilerplate
   - `references/knowledge/svc/details/infrastructure.md`
4. Extend `validate-framework-self-management.sh` to fail if Kimi host claims in `KIMI.md`, boilerplates, and knowledge docs diverge.

#### F-002 — `task-graph.mjs` enforces task shape but not graph-level completion semantics, so impossible “graph completed while child task pending” states remain writable

**Evidence:**
- `scripts/task-graph.mjs:119-129` validates only task-level structure plus dependency integrity.
- `scripts/task-graph.mjs:138-156` computes next runnable task from child task states only.
- `scripts/task-graph.mjs:242-296` updates individual task status only; there is no graph-level `status` validation or graph closure rule.
- `FRAMEWORK-STATE.md:1262` locks the principle that helper-layer task graphs are semantic contracts, not shape-only JSON.
- The WI-099 audit captured the exact impossible state this helper still cannot block: graph top-level `status` was set to `completed` while `task-8-regression` remained `pending` (`example-marketplace/proposals/2026-04-21-session-audit-w099-kimi.md:83-86`, `123-139`).

**Why this matters:**
- The framework already learned that mechanical enforcement must beat agent discipline (`FRAMEWORK-STATE.md:1231`).
- But the task-graph helper still allows a critical semantic invariant to live outside the helper, so raw file edits can lie about completion and downstream audits inherit false state.

**Fix:**
1. Formalize graph-level status inside `scripts/task-graph.mjs` instead of leaving it as an unvalidated ad-hoc field.
2. Either:
   - remove top-level graph `status` entirely and derive it from task states, or
   - add helper commands that compute and enforce it (`graph-status`, `close-graph`) and reject `completed` while any child task is `pending` / `in_progress`.
3. Add a validator check: a graph with actionable tasks cannot be “closed,” regardless of host.
4. Update task-graph examples in skills that still show freehand top-level `status` fields so they use the helper contract only.

### P1 — Fix soon (degrades quality)

#### F-003 — AP-27 ghost-execution enforcement is still effectively Claude/Codex-specific; Kimi has no host-agnostic skill-load receipt path

**Evidence:**
- `route-workflow/references/task-graph-protocol.md:61-63` says the skill must be loaded before work, but defines the mechanism only for Claude Code and Codex.
- `route-workflow/references/task-graph-protocol.md:246-258` frames the explicit AP-27 self-verify in terms of Claude `Skill` tool invocation or Codex `SKILL.md` read.
- `FRAMEWORK-STATE.md:801-809` says AP-27 was strengthened at the self-verify layer, but true enforcement at write-time remains future work.
- The WI-099 audit proved that Kimi can still ghost-execute a named task: `task-8-regression` ran with no evidence the named E2E skill contract was loaded first (`example-marketplace/proposals/2026-04-21-session-audit-w099-kimi.md:84`, `99`, `141-158`).

**Why this matters:**
- The existing “future enhancement” path is transcript-centric and Claude-shaped.
- Kimi needs a first-class, host-agnostic enforcement path rather than being treated as an afterthought to the Claude transcript model.

**Fix:**
1. Add a host-agnostic skill-load receipt mechanism to the helper layer, not to host transcripts.
2. Candidate design:
   - `node scripts/task-graph.mjs load-skill .svc/lane-tasks-<WI>.json <task-id> <skill-name>`
   - writes `loaded_skill`, `loaded_at`, and `loaded_via` onto the task or into `.svc/skill-load-log.jsonl`
3. Make `set-status ... completed` reject completion when the task lacks a matching prior load receipt for `metadata.skill`.
4. Keep host-native traces as supplemental evidence only; helper receipts become the canonical cross-host proof.

#### F-004 — E2E/debug close-out has no mechanical “latest artifact wins” rule, so stale blocker summaries can overwrite newer evidence

**Evidence:**
- `write-e2e/SKILL.md:38-49` requires analysis, selector definition, writing, and verification, but has no explicit close-out rule tying the user-facing summary to the latest failing or passing runtime artifact.
- The WI-099 Kimi audit showed the last full-suite run had already shifted from crash to missing success-state visibility (`example-marketplace/proposals/2026-04-21-session-audit-w099-kimi.md:76-77`, `182-190`), but the final user-facing summary still reported the stale-bundle crash as the blocker (`example-marketplace/proposals/2026-04-21-session-audit-w099-kimi.md:89`, `96-100`).

**Why this matters:**
- This is not only a Kimi problem. Any long debugging session can accumulate old hypotheses that outlive newer evidence.
- Without a close-out guard, the framework can produce a polished but temporally stale summary.

**Fix:**
1. Add a `write-e2e` self-verify row requiring the close-out message to quote or paraphrase the latest failing assertion, latest error signature, or latest passing command.
2. Add the same rule to other audit/debugging skills that summarize runtime failures (`audit-session-execution`, `diagnose-bug`, possibly `test-journeys`).
3. For background-task-driven hosts, require the final summary to cite the last task id / output path it is summarizing.

## Comparison delta

No direct competitor gap drives this proposal. `references/skill-pack-comparison.md` does show gstack has explicit safety guardrails such as `/guard` and `/freeze`, which reinforces the general value of mechanical enforcement, but the failures here are not “missing a new skill.” They are internal contract-drift and helper-enforcement gaps in svc’s existing task-graph system.

## Stale proposal audit

| Proposal | Current state | Recommendation |
|---|---|---|
| `proposals/done/2026-04-21-evolution-kimi-rules-and-framework-drift.md` | Implemented and closed Kimi rules auto-injection + related drift | Do not reopen; this proposal is a new phase focused on task-graph enforcement, not rule delivery |
| `proposals/done/2026-04-21-evolution.md` | Partially implemented list-work-items evolution | Leave pending; unrelated to Kimi task-graph enforcement |
| `proposals/done/2026-04-20-session-audit-capture-idea-wrong-repo.md` | Pending | Leave pending; unrelated |
| `proposals/done/2026-04-14-blocking-discovery-halt-protocol.md` | BLOCKED | Leave pending |
| `proposals/done/2026-04-14-parallel-wi-dispatch.md` | BLOCKED | Leave pending |

No current pending proposal covers:
- Kimi native-task-api contract drift across boilerplates
- graph-level completion enforcement in `task-graph.mjs`
- host-agnostic skill-load receipts
- “latest artifact wins” close-out enforcement for E2E/debug summaries

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Proposal file exists | `test -f proposals/2026-04-21-evolution-kimi-taskgraph-enforcement.md` | PASS |
| 2 | Every finding cites file:line | F-001 through F-004 each cite concrete file:line evidence | PASS |
| 3 | FRAMEWORK-STATE.md was read first | Method starts from `FRAMEWORK-STATE.md`; already-closed Kimi-rules work explicitly excluded | PASS |
| 4 | Findings are ranked by impact | Priority + severity summary table included | PASS |
