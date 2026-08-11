# Proposal: list-work-items skill must surface output in agent reply

**Date:** 2026-04-26
**Source:** Example Marketplace session — user invoked `/list-work-items`, saw no inline list in the agent's reply (agent ran the script via Bash and the table was in the tool result, but the agent's user-facing summary was a one-line gloss instead of the actual table).

## Problem

`list-work-items/SKILL.md` instructs the agent to run `node scripts/list_work_items.mjs` and treats the resulting stdout table as "displayed." In Claude Code (and Kimi/Codex), Bash tool stdout is **not** automatically surfaced to the user — it's consumed by the model. If the agent writes a terse summary instead of echoing the table, the user gets nothing useful from the skill.

Observed: user ran `/list-work-items`, agent ran the script, agent replied with a 2-line gloss naming 4 critical WIs. User reaction: "this skill should give me output of the items I don't see it."

## Root cause

The skill's "Output contract" section says:
> Default stdout is a single-screen table (~92 items fits comfortably).

This is true at the script level but ignores the harness layer. Bash stdout ≠ user-visible output. The skill never instructs the agent to echo, paste, or reproduce the table in its reply.

## Fix (cheap)

Update `list-work-items/SKILL.md` to add an explicit user-output contract:

```markdown
## User-Facing Output Contract

After running the script, the agent MUST reproduce the open-backlog table verbatim in its reply to the user. The Bash tool's stdout is not automatically shown — copying the table into the assistant message is the only way the user sees it.

- Reproduce the full open-backlog markdown table (header + all rows).
- Include the closed-count footer line.
- Do NOT replace the table with a prose summary. Prose summaries are additive only, after the table.
- For `--detail WI-NNN`, reproduce the metadata header + body verbatim.
```

Add a Self-Verify row:

| # | Check |
|---|---|
| 5 | The reply to the user contains the literal table rows produced by the script (not just a summary) |

## Why this matters beyond list-work-items

Same failure mode applies to any skill whose "output" is a Bash-tool stdout table: `list-skills`, `audit-coverage --report`, `manage-learnings list`, etc. Worth a one-line global rule:

> **Skills that produce tabular output for the user MUST instruct the agent to reproduce that output in the assistant reply. Bash stdout is not user-visible.**

Candidate location: `rules/common/skill-output-visibility.md`.

## Severity

MEDIUM — silent UX failure; user gets no value from a skill they explicitly invoked. Not data-loss, but trust-eroding (user has to ask twice or run the command themselves).

## Acceptance

- [ ] `list-work-items/SKILL.md` updated with User-Facing Output Contract
- [ ] Self-Verify table gains row #5
- [ ] Optional: `rules/common/skill-output-visibility.md` created and referenced from skill template

---

## Resolution

**Closed:** 2026-04-27
**Promoted as:** WI-132 (filed and shipped same-session)
**Implementation:**
- `list-work-items/SKILL.md` — added `## User-Facing Output Contract` section + Self-Verify row #5
- `rules/common/skill-output-visibility.md` — new global rule (registered in skills-manifest.json rulesRegistry)
