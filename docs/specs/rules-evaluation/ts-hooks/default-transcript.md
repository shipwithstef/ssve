# Default Transcript — typescript/hooks.md

> **Contamination notice:** Rule content was fetched before evaluation. Defaults are
> from first-principles knowledge of Claude Code hook behavior.

## Scenarios covered

1. Setting up a new TypeScript project in Claude Code
2. Asked about development tooling configuration for TS/JS
3. Editing a TypeScript file during coding session

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — new TS project setup:**
I do NOT proactively configure PostToolUse hooks. If asked about development
workflow setup, I might mention that hooks can run formatters or type checkers
automatically, but I wouldn't present a specific hook configuration unprompted.

**Scenario 2 — asked about TS tooling:**
I'd recommend Prettier for formatting, TypeScript compiler for type checking, and
mention ESLint for linting. I'd explain how to configure them, but I wouldn't
specifically route to Claude Code hooks config unless hooks were the topic.

**Scenario 3 — editing a TS file:**
I focus on the code change. I don't emit hook configuration recommendations
during normal file edits. If a formatting issue appears, I might mention
configuring a formatter, but not via hooks specifically.
