# Diff and Verdict — typescript/hooks.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| TS project setup | Don't proactively suggest hook config | Configure Prettier, tsc, console.log hooks | Behavior change in setup context |
| Editing TS files | Focus on code, not tooling | (Hooks fire via PostToolUse — not a per-turn prescription) | No per-turn change |
| Session end | No console.log audit by default | Stop hook audits console.log | Behavior change for setup |

## Analysis

This rule has two distinct parts:

**Part A — what to configure:** Lists which hooks to configure. This IS a
behavior change in project setup conversations. Without it, I wouldn't
proactively suggest these specific hook configs.

**Part B — per-turn cost as a global rule:** Loaded globally on every turn
for TS/JS files, this rule's hook configs fire only during project setup,
not during normal coding. The per-turn injection cost is HIGH relative to
the infrequent scenario where it applies.

**Fundamental issue:** This is a **setup document**, not a per-turn coding rule.
Its content is only relevant when:
1. Setting up a new project/workspace
2. Answering direct questions about Claude Code hooks

Injecting it on every TS file edit wastes tokens for no benefit on the majority
of turns.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 2 | Changes proactive hook suggestion behavior in setup contexts |
| correctness_delta | 1 | Better developer experience with auto-formatting |
| friction_cost | 2 | Per-turn cost on ALL TS file edits for a setup-only benefit |
| convention_conflict | 0 | No conflict |

## Verdict

**reject**

friction_cost = 2 disqualifies adopt-as-is. The content is correct and useful,
but the wrong primitive. This should be a setup skill or onboarding doc, not a
per-turn rule. Recommended disposition: move to a project setup reference or 
a `wsl2-audio`-style setup skill rather than a rules file.
