# Rule: Skills That Produce User-Facing Tables Must Reproduce Them in the Reply

When a skill instructs the agent to run a Bash command (or other tool call) whose stdout IS the user-facing output — a table, a list, a report — the agent MUST reproduce that output verbatim in its assistant reply. The Bash tool's stdout is consumed by the model; it is not automatically rendered to the user.

## When this rule applies

- `list-work-items` — open-backlog table
- `audit-coverage` (any `--report` mode) — coverage matrix
- `manage-learnings list` — learnings table
- `find-skills` / `discover-skills` — search results
- `list-work-items --detail WI-NNN` — WI metadata header + body
- Any future skill whose primary product is a Bash-stdout table or list the user explicitly requested

The signal: the user invoked a skill whose POINT is to see information. If the agent runs the script, reads the output, then replies "I checked, here's a 2-line summary," the skill silently failed.

## What the agent must do

1. Run the script.
2. Copy the relevant stdout block (the table, the list, the report) into the assistant message verbatim.
3. Optionally add a 1-3 sentence prose framing AFTER the verbatim block — never instead of it.
4. If output exceeds the soft threshold from `rules/long-output-to-file.md` (~800 lines), follow that rule: write full output to file, paste a compact summary inline, name the file path. The two rules compose — one wins on volume, the other on visibility.

## What the agent must NOT do

- Replace the table with a prose summary ("there are 12 open WIs, mostly framework work")
- Reference the table by saying "see above" when nothing has been pasted
- Assume the user can see Bash tool stdout — they cannot
- Substitute a JSON dump for the human-readable table when the script offers both

## Why this exists

Observed 2026-04-26 in Example Marketplace session: user invoked `/list-work-items`, agent ran the script, agent replied with a 2-line gloss naming 4 critical WIs without pasting the actual table. User reaction: "this skill should give me output of the items I don't see it." The skill's `## Output contract` section described stdout shape correctly but never told the agent that stdout ≠ user-visible. Same failure mode applies to every skill whose deliverable is a human-readable table.

## How a reviewer enforces this

Skill authors registering a new skill that produces tabular output for the user must include a `## User-Facing Output Contract` section pointing at this rule. `review-gate` and `audit-implementation` should flag any new SKILL.md whose Process section runs a script and produces a table-shaped output but does NOT instruct the agent to reproduce that output in the reply. Severity: MEDIUM — silent UX failure, trust-eroding.
