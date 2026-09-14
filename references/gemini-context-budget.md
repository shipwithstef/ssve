# Gemini CLI Context Budget & /compress Protocol

**Source:** `proposals/2026-04-19-session-audit-gemini-slim-refactor-wi071-and-wi085.md` — framework gap G4

Gemini CLI has an effective attention window smaller than its raw context
window. Without proactive compression, Gemini sessions experience a
documented failure mode called **Cache Layer Drift / Chapter Misalignment**
— earlier conversation chapters fall out of effective attention and the
agent cannot self-audit its own recent changes.

The Gemini slim-refactor of `route-workflow` and `write-e2e` on 2026-04-18
is the archetype: net -1767 lines of contract content dropped silently
because the agent could not hold both the old and new file states in
attention simultaneously to audit the refactor. Three subsequent repair
commits were needed to approach content parity, and a fourth partial
repair (2026-04-19) found additional still-missing content.

This document defines the context-budget contract that prevents this
failure class.

## Session-Size Ceilings

Gemini CLI writes session JSON to `~/.gemini/tmp/<project-hash>/chats/`.
Monitor that file's size as a proxy for conversation history + tool
outputs accumulated so far.

| Session JSON size | Action required |
|---|---|
| < 1.5 MB | **GOOD** — proceed normally |
| 1.5 – 2.5 MB | **WARN** — finish the current micro-task, then run `/compress` and re-anchor before the next heavy file read |
| 2.5 – 4 MB | **DEGRADING** — stop accumulating; `/compress` IMMEDIATELY. After compress, re-read FRAMEWORK-STATE.md + the active WI file to re-anchor L1/L2 context |
| > 4 MB | **POOR** — Do NOT attempt multi-file refactors, content audits, or cross-reference comparisons in this state. Commit work-in-progress, exit, restart in a fresh session. |

The `route-workflow` refactor session was 3.4 MB (session-2026-04-18T16-50).
By the **DEGRADING** threshold, the agent should have stopped before the
commit. That's why the refactor silently truncated content — the agent
could no longer see the full old SKILL.md in effective attention.

Check the current session size cheaply:

```bash
du -sh ~/.gemini/tmp/<project-hash>/chats/*.json 2>/dev/null | tail -1
```

## Mandatory `/compress` Triggers

Run `/compress` BEFORE any of these high-cost operations when the session
is already in WARN tier:

1. **Full-file refactors** (moving content between SKILL.md and references/*.md)
2. **Cross-artifact audits** (diffing old vs new versions of any file)
3. **Pillar Revisit Audit** (requires re-reading the WI + affected journeys + ACs)
4. **Pattern scan** (grep-then-read cycles across many files)
5. **Any task that requires the agent to audit its own recent work**

After `/compress`, re-anchor by reading in this order (the L1 → L4 cache hygiene order):

1. `FRAMEWORK-STATE.md` (L1)
2. `docs/specs/project-state.md` if it exists (L1)
3. The active WI file (L2)
4. Active `.svc/lane-tasks-*.json` (L2)
5. The specific code/spec files for the task at hand (L3)

## Tool-Output Compaction

Gemini CLI supports `ui.compactToolOutput` for large tool responses. Enable
it when:

- Listing directories with > 100 entries
- Reading files > 500 lines that won't all be referenced
- Running commands with verbose stdout/stderr (e.g., `git log` on busy repos)

If `ui.compactToolOutput` is not available for a specific tool, use
targeted search instead of broad scans:

| Instead of | Use |
|---|---|
| `Read` on a whole file | `Grep` for the specific pattern, then `Read` only the matching lines |
| `ls -R` on a directory tree | `Glob` with a specific pattern |
| `git log --all` | `git log --oneline -20` scoped to a file path |

## Cache Hygiene Order (L1 → L4)

Load artifacts in mandatory order to preserve prefix-cache efficiency:

| Layer | Content | Example |
|---|---|---|
| L1 | Framework / project state | `FRAMEWORK-STATE.md`, `project-state.md`, `router-context.md` |
| L2 | Spec / design / WI | feature spec, WI file, `lane-tasks.json`, design-tech |
| L3 | Code / artifacts | source files, existing tests, config |
| L4 | Task detail / diff / tool output | current edit, grep result, command output |

**Do NOT insert L4 content between L1 and L2.** Re-ordering breaks prefix
caching and can inflate token cost by ~50%. If the session becomes
disordered, run `/compress` and re-anchor in L1 → L4 order.

## Gemini-Specific Skill Branches

The following skills MUST include a Gemini-only pre-flight branch at the
top of their Pre-Flight Protocol:

- `route-workflow` (large, multi-lane orchestration)
- `write-e2e` (large, multi-file edits)
- `improve-framework` (spans framework state + proposals + skill edits)
- `reverse-engineer` (multi-phase research + file writes)
- Any skill that edits > 2 files of > 100 lines each

### Gemini Pre-Flight Branch Template

```
### Gemini Pre-Flight (if host is Gemini CLI)

1. Check session size: `du -sh ~/.gemini/tmp/*/chats/*.json | tail -1`
2. If > 2.5 MB: run `/compress` before proceeding
3. Re-anchor: read FRAMEWORK-STATE.md + project-state.md + active WI
4. Only then begin the skill's normal Process
```

## Mandatory Post-Refactor Check

After any skill refactor on Gemini, the agent MUST run:

```bash
node scripts/verify-skill-refactor.mjs <skill-name> <pre-refactor-ref>
```

This is framework gap G1's enforcement. It catches the exact content-loss
failure mode that originally triggered this document.

Exit code must be 0 before committing the refactor. If it's 1, the agent
must either (a) add the missing content to SKILL.md or references/*.md,
or (b) document the deletion as intentional in FRAMEWORK-STATE.md Decisions.

## Known Gemini Anti-Patterns

| Anti-pattern | Symptom | Fix |
|---|---|---|
| **Idle MCP bloat** | MCP servers active from earlier task continue to consume context | Close unused MCP servers between skills |
| **Unbounded shell history** | Repeated `cd` / `ls` calls accumulate in session | Use absolute paths, minimize navigation |
| **Repeated file reads** | Same file read 3+ times in a session | Cache the content; re-reference rather than re-read |
| **Massive tool outputs un-piped** | Entire `git log` or `grep` output returned uncompressed | Pipe through `head`, `tail`, `wc -l`, or targeted regex |
| **Chapter forget mid-refactor** | Agent references content from earlier in session but produces wrong summary | Run `/compress` + re-anchor; if still failing, commit WIP + restart session |

## Quick Reference

Before any Gemini skill session:

1. Check size: `du -sh ~/.gemini/tmp/*/chats/*.json | tail -1`
2. If > 1.5 MB: consider a fresh session
3. If > 2.5 MB and you must continue: `/compress` + re-anchor to L1

Before any Gemini refactor commit:

1. `node scripts/verify-skill-refactor.mjs <skill> <pre-ref>` — exit 0 required
2. `node scripts/verify-wi-pillars.mjs <wi-file>` if the WI is being VERIFIED
3. `node scripts/task-graph.mjs validate .svc/lane-tasks-<WI>.json` — exit 0 required

These three checks together block the Gemini slim-refactor failure class at the tooling layer. The agent no longer has to rely on attention alone — the tools enforce the invariants.
