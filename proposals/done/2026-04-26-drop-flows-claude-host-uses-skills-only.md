# Proposal — Drop `/flow:*` from Claude host paths; Claude uses regular skills only

**Date:** 2026-04-26
**Author:** session capture (Example Marketplace WI-114 routing)
**Status:** OPEN — DIAGNOSIS REVISED 2026-04-26 (see § Investigation Update at end)
**Priority:** medium (active noise; not breaking, but degrades agent + user trust)
**Scope:** framework — host parity bug + documentation cleanup

---

## Problem

The svc framework treats `/flow:<name>` as a host-agnostic invocation pattern. It is not. **Flows are a Kimi CLI primitive only.** Claude Code, Codex CLI, and Gemini CLI have no flow concept and no `/flow:*` namespace. Yet the framework currently:

1. **Wires Kimi-specific hooks into Claude Code's global `~/.claude/settings.json`** (13 `svc-kimi-*` hooks observed in the active install).
2. **Those hooks emit `/flow:svc-lane-executor` and `/flow:svc-auto-router` strings to the Claude session** every prompt and at session start.
3. **`route-workflow` and several SKILL.md files reference `/flow:` invocations** as if they were a portable pattern, when they only resolve in Kimi.

**Result observed in Example Marketplace session 2026-04-26:**
- Every UserPromptSubmit reminder ends with `To auto-resume: /flow:svc-lane-executor`
- Every SessionStart prints `📋 ACTIVE WORK ITEM (SessionStart) ... To auto-resume: /flow:svc-lane-executor`
- The user typed `/flow:svc-lane-executor` would error in Claude — there is no such slash command
- The reminder lists 12 active WIs every turn, most with empty `Next` fields, all pointing at the non-functional `/flow:` resume command
- The agent dutifully recommends `/flow:svc-lane-executor` to the user as a "next step" because the framework documentation says it's an option

Net effect: **the framework lies to Claude users about what they can run**, and the noise erodes both user trust ("what is this flow thing?") and agent token budget (12-WI block × every turn).

## What flows actually are

Per `references/host-capabilities.md` and `references/knowledge/competitors/kimi-cli/details/agent-flows.md`:

- **Kimi CLI** has a built-in `/flow:<name>` primitive that auto-executes a multi-step workflow defined in a flow file. Two svc flows exist: `svc-lane-executor` and `svc-auto-router`.
- **Claude Code** has slash commands and skills. No flow primitive. A multi-step workflow is invoked by either (a) the user typing skill commands sequentially, or (b) a skill internally calling other skills via the Skill tool.
- **Codex CLI / Gemini CLI** — same as Claude: no flow primitive.

The framework already documents this in `host-capabilities.md` line 90 ("If running on Kimi CLI, you may use `/flow:<name>`...") — but that conditional caveat is buried, and the hooks/SKILL files don't honor it.

## Files affected

Confirmed via grep across `~/app-workspaces/seriousvibecoding`:

| File | Issue | Severity |
|---|---|---|
| `hooks/kimi/svc-kimi-session-start.sh` (lines 140, 146, 149) | Prints `/flow:svc-lane-executor` unconditionally | HIGH — fires every Claude SessionStart because globally wired |
| `hooks/kimi/svc-kimi-preflight-guard.sh` (lines 106, 118, 126, 157) | Prints `/flow:svc-lane-executor` and `/flow:svc-auto-router` every UserPromptSubmit | HIGH — most-frequent noise source |
| `~/.claude/settings.json` | Wires 13 `svc-kimi-*` hooks into Claude lifecycle (SessionStart, UserPromptSubmit, PreToolUse, Stop, SubagentStart, SubagentStop, PreCompact, PostCompact, Notification) | HIGH — root cause of leakage |
| `route-workflow/SKILL.md` (this skill) | "To start new work instead: `/flow:svc-auto-router`" trailer printed via the same kimi hooks | MEDIUM |
| `strategic-decision/SKILL.md` line 533 | Resolution table lists `/flow:strategic-decision` as a Kimi option — accurate, but cited without the equivalent skill-based path for Claude | LOW (documentation) |
| `KIMI.md` line 39 | Documents `/flow:<name>` as Kimi-only — correct, no fix needed | none |
| `FRAMEWORK-STATE.md` line 1538 | Already records F-008: 7 phantom `svc-*` pipeline skills were removed for not having directories. **Same class of bug — non-existent commands referenced as if real.** | none (historical, but precedent) |
| `templates/.svc/orchestrator-state.json` line 14 | Comment says state is "Managed by svc-lane-executor" — but svc-lane-executor exists only as a Kimi flow, not as a host-agnostic manager | LOW |
| `references/host-capabilities.md` lines 57, 90 | Correctly documents flows as Kimi-only — already correct, just under-honored elsewhere | none |

13 entries in `~/.claude/settings.json` reference `/hooks/kimi/`. Only one is truly host-neutral (`svc-workflow-guard.mjs`); the rest are Kimi-flavored.

## Decision logic — what the framework should do per host

| Host | Multi-step workflow invocation | Active-WI reminder format |
|---|---|---|
| **Kimi** | `/flow:svc-lane-executor` (current — keep) | `To auto-resume: /flow:svc-lane-executor` |
| **Claude** | User runs the next skill manually (`/diagnose-bug`, `/plan-changeset`, ...). No flow. Reminder should say `Next skill: <name>` not `To auto-resume: /flow:...` | `Next skill: <skill>` (no `/flow:` reference) |
| **Codex** | Same as Claude | Same as Claude |
| **Gemini** | Same as Claude | Same as Claude |

The framework already has `scripts/detect-host.sh`. The fix is to **branch on host inside the SessionStart and UserPromptSubmit hooks** before printing flow-specific instructions.

## Fix plan

### Phase 1 — Stop the noise immediately (no logic change, just gate)

1. **`hooks/kimi/svc-kimi-session-start.sh` and `svc-kimi-preflight-guard.sh`:** add a host detection guard at the top:
   ```sh
   HOST="$(bash "$SVC_FRAMEWORK/scripts/detect-host.sh")"
   if [ "$HOST" != "kimi" ]; then exit 0; fi
   ```
   This makes them no-ops when accidentally fired by a non-Kimi host.

2. **`~/.claude/settings.json`:** unwire the 13 `/hooks/kimi/*` hook entries. Keep only `svc-workflow-guard.mjs` (host-neutral). Per `update-config` skill, this is a settings.json edit.

   These two changes together eliminate the `/flow:*` noise in Claude sessions.

### Phase 2 — Build the Claude-equivalent (parity, not removal)

The Kimi hooks are useful — they remind the user about active WIs and suggest the next step. Claude lost that capability when we ungated them. Replacement plan:

3. **Create `hooks/claude/svc-claude-session-start.sh` and `svc-claude-preflight-guard.sh`** mirroring the Kimi versions but printing **skill-based** invocations, not flow-based:
   - `Next skill: diagnose-bug` instead of `To auto-resume: /flow:svc-lane-executor`
   - `To start new work: /route-workflow` (which exists in Claude) instead of `/flow:svc-auto-router`

4. **Add `/hooks/codex/` and `/hooks/gemini/` mirrors** for the four-host parity work already on track in `2026-04-24-four-host-hook-parity.md`. This proposal is a sibling — file as a contributing proposal under that umbrella.

### Phase 3 — Sweep documentation

5. **`route-workflow/SKILL.md`:** strip `/flow:svc-auto-router` trailer or gate behind `host=kimi` condition.

6. **`strategic-decision/SKILL.md` line 533:** add a Claude row to the resolution table — `Skill tool (`/strategic-decision`)` not `/flow:strategic-decision`.

7. **`templates/.svc/orchestrator-state.json` line 14:** change `Managed by svc-lane-executor and route-workflow` to `Managed by route-workflow and per-host lane runners`.

8. **`references/host-capabilities.md`:** elevate the "Kimi-only" caveat from a footnote to the top of the flow table — make it impossible to miss.

### Phase 4 — Validator

9. **New tier-1 validator:** `validate-host-flow-leakage.sh` greps SKILL.md and shipped hooks for `/flow:` references that aren't conditionalized on `host=kimi`. Block on any new leakage.

## Acceptance criteria

- [ ] No `/flow:*` string appears in any Claude session reminder, preamble, or skill output
- [ ] Active-WI reminder still appears in Claude, but with `Next skill: <name>` instead of `/flow:*`
- [ ] Kimi sessions retain current `/flow:*` behavior unchanged
- [ ] `~/.claude/settings.json` no longer wires `/hooks/kimi/*` paths
- [ ] `hooks/claude/` exists with parity for the active-WI reminder, lane-tasks-pre-validator, branch-guard, etc.
- [ ] Tier-1 validator catches future `/flow:*` leakage

## Out of scope

- Removing flows from Kimi entirely (they work there; no reason to remove)
- Building a Claude-side autonomous executor (different proposal — would need a `claude-lane-executor` skill that orchestrates other skills via the Skill tool; tracked separately if anyone wants it)
- Dropping the `route-workflow` skill itself (it works fine as a regular skill)

## Risk

- **Low.** Phase 1 is purely additive guarding (early-exit when not Kimi). Phase 2 is new files. Phase 3 is doc edits. No behavior regressions on Kimi.
- **Migration risk:** users who got into the habit of typing `/flow:svc-lane-executor` in Claude (futilely) will need to be told to type `/route-workflow` instead. Reminder text change handles this.

## Origin

Filed during Example Marketplace session 2026-04-26 after the user noticed the `📋 ACTIVE WORK ITEM REMINDER` block firing every prompt with `/flow:svc-lane-executor` instructions that don't work in Claude. Confirmed via inspection: `~/.claude/settings.json` is wiring Kimi hooks into Claude lifecycle, and the SKILL files reference flows as host-agnostic when they aren't.

Related: `proposals/2026-04-24-four-host-hook-parity.md` (parent track — this is a specific failure mode under that umbrella).

---

## Investigation Update — 2026-04-26 (post-filing)

Attempted to land Phase 1 in Example Marketplace session, then verified before applying. Result: **the active blast radius is smaller than the proposal claimed**, but the noise is still real. Specifics:

### What is actually true (corrections to original diagnosis)

1. **`~/.claude/settings.json` does NOT wire any `/hooks/kimi/*` paths.** The 13 references I observed via `grep -c "/hooks/kimi/" ~/.claude/settings.json` matched **backup files only** (`settings.json.bak-wi127`, `settings.json.bak2-wi127`). Active config is clean.
2. **The kimi hook scripts already self-disable on non-Kimi hosts.** `~/.claude/skills/hooks/kimi/svc-kimi-preflight-guard.sh` and `svc-kimi-session-start.sh` both contain a WI-127 Phase 1.5 guard:
   ```sh
   if [ "${SVC_FORCE_HOST:-}" != "kimi" ]; then
     __SVC_HOST="$(bash "$__SVC_HG/scripts/detect-host.sh" 2>/dev/null || echo unknown)"
     [ "$__SVC_HOST" = "kimi" ] || exit 0
   fi
   ```
3. **So Phase 1 of this proposal (gate hooks + unwire from settings) is ALREADY DONE.** Nothing to land.

### What remains unexplained

The `📋 ACTIVE WORK ITEM REMINDER (UserPromptSubmit)` block continues to appear every prompt in Claude sessions, listing 12 active WIs and ending each with `To auto-resume: /flow:svc-lane-executor`. Source could not be located via:

- Grepping all hooks in `~/.claude/skills/hooks/*.{mjs,js,sh}` for the marker strings — no matches outside the kimi hooks (which are gated)
- Running each active hook (`svc-prompt-stale-state.mjs`, `svc-session-start-healthcheck.mjs`, `svc-loop-guard.mjs`) directly with simulated stdin — none produced the block
- Inspecting plugin hook registries under `~/.claude/plugins/` — no matches
- Inspecting `hooks.json` registry — no kimi entries

Hypotheses for the remaining source (none verified):
- Plugin or marketplace hook outside the searched paths
- A second hook config file the user-installed Claude is reading
- The Claude Code harness itself synthesizing the block from `.svc/lane-tasks-WI-*.json` files (would explain why no hook script contains the literal string)
- A test-only script being invoked accidentally (`scripts/framework-test-catalog.mjs` matched, but is not wired to a lifecycle event in active settings)

### Revised scope

**Drop:** Phase 1 step 1 (hook gating — done) and step 2 (unwire from settings.json — already not wired).

**Keep:** Phases 2 + 3 + 4:
- Phase 2 — `hooks/claude/` parity hooks for active-WI reminder, lane-tasks pre-validator, branch-guard, etc. (separate work; this proposal documents the requirement, doesn't ship it)
- Phase 3 — sweep `route-workflow/SKILL.md`, `strategic-decision/SKILL.md:533`, `templates/.svc/orchestrator-state.json:14`, `references/host-capabilities.md` to remove or kimi-gate `/flow:*` references
- Phase 4 — tier-1 validator `validate-host-flow-leakage.sh`

**Add:** Phase 0 — diagnose where the `📋 ACTIVE WORK ITEM REMINDER` block actually originates in a clean Claude install. This is the prerequisite that was assumed to be obvious but turned out not to be. Until Phase 0 is resolved, the noise can't be fully silenced — only its `/flow:*` content can be sanitized via Phase 3 once we find the emitter.

### Honesty note

Original proposal said "13 Kimi hooks observed in the active install." That count came from a grep that didn't filter `.bak*` files. The active install has zero. Lesson recorded — proposals citing config inspection should `grep -v ".bak"` and explicitly check `head -1` matches a live path before counting.
