# superpowers — Capabilities

Source: https://github.com/obra/superpowers
SHA: 917e5f53b16b115b70a3a355ed5f4993b9f8b73d (analyzed 2026-04-08)
Version: 5.0.7

## What It Is

Skill-based development discipline for AI coding agents. Multi-platform plugin
(Claude Code, Cursor, Codex CLI/App, OpenCode, Gemini CLI, GitHub Copilot CLI).
Zero-dependency constraint enforced across all layers. Focuses on mandatory
pre-implementation planning, TDD, parallel agent orchestration, verification-
before-completion, and anti-rationalization as a first-class design concern.

Author: Jesse Vincent / Prime Radiant (contact-ec6bd1fb18@example.invalid)

## Architecture

| Aspect | Mechanism | Details |
|---|---|---|
| Bootstrap injection | SessionStart hook (Claude Code), user-message prepend (OpenCode), @include (Gemini) | All wrap in `<EXTREMELY_IMPORTANT>` tags |
| Platform detection | Env vars: `CURSOR_PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT`, `COPILOT_CLI` | Output format diverges per platform |
| Cross-platform hooks | Polyglot `.cmd` wrapper — valid in both CMD.exe and bash simultaneously | LF line endings enforced via `.gitattributes` |
| Zero-dependency | Custom RFC 6455 WebSocket, bash param substitution (not sed), inline frontmatter parser | PRs adding deps are hard-rejected |
| Version management | `bump-version.sh` + `.version-bump.json` — drift detection across 5 JSON manifests | Audit mode greps repo for undeclared version strings |
| Skill loading | Progressive: frontmatter at startup, SKILL.md when relevant, supporting files on demand | `@` syntax banned (force-loads, burns context) |
| Plugin install | `/plugin install superpowers@claude-plugins-official` | Also: Codex symlink, OpenCode JSON, Gemini extension |

## Skills (14)

| Skill | What it does | Key mechanism |
|---|---|---|
| `using-superpowers` | Meta-bootstrapper — check skills before ANY response | 1% threshold + 11-item Red Flags rationalization table |
| `brainstorming` | 9-step pre-implementation gate | HARD-GATE: no code without design approval; one question at a time |
| `writing-plans` | Create plans from specs | Tasks 2-5 min each; no-placeholder iron law; type consistency check |
| `executing-plans` | Inline plan execution (fallback) | Critical review gate before execution; explicit STOP conditions |
| `test-driven-development` | Strict RED-GREEN-REFACTOR | "Delete means delete" — code before test = delete entirely |
| `systematic-debugging` | 4-phase root cause investigation | Layer-by-layer diagnostic instrumentation; 3 fixes = arch problem |
| `dispatching-parallel-agents` | Parallel agent dispatch for independent problems | Context isolation: agents never inherit session history |
| `subagent-driven-development` | Sequential task execution via fresh subagents | Two-stage review: spec compliance THEN code quality |
| `using-git-worktrees` | Systematic worktree creation | `.gitignore` verification before creation; auto-setup detection |
| `finishing-a-development-branch` | Merge/PR/cleanup decision | Exactly 4 options; typed "discard" confirmation |
| `verification-before-completion` | 5-step gate before success claims | Applies to "should/probably/seems to" and agent reports |
| `requesting-code-review` | Dispatch code-reviewer subagent | Three-tier severity: Critical/Important/Minor |
| `receiving-code-review` | Process review feedback | Anti-sycophancy rules; forbidden response strings; YAGNI check |
| `writing-skills` | TDD applied to skill creation | CSO finding: description summarizing workflow = shortcut bypass |

## Supporting Infrastructure

| Component | What it does | Details |
|---|---|---|
| Brainstorm server | Zero-dep Node.js HTTP+WebSocket for visual companion | Custom RFC 6455; `.cjs` extension; content/ + state/ dirs |
| Visual companion | Browser-based interactive display for brainstorming | `[data-choice]` click capture; frame template with indicator bar |
| Code reviewer agent | 6-part structured review subagent | Plan alignment, code quality, architecture, documentation |
| Spec reviewer | Adversarial spec compliance checker | "Do NOT trust the report, read actual code" |
| Code quality reviewer | Post-spec-compliance quality gate | File structure, responsibility isolation, growth detection |
| Implementer prompt | Subagent task template | 4 status codes: DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT |
| Document review system | Spec + plan review loops | 5-iteration limit before surfacing to human |

## Key Patterns Worth Studying

| Pattern | Where | What makes it valuable |
|---|---|---|
| Anti-rationalization tables | TDD, debugging, verification, using-superpowers | Preemptive named rebuttals for skip-justifications |
| Description CSO | writing-skills | Description summarizing workflow causes Claude to skip full read |
| Pressure testing | writing-skills, systematic-debugging tests | 3+ combined pressures (time + authority + sunk cost) |
| Two-stage review ordering | subagent-driven-development | Spec compliance before code quality prevents wasted effort |
| 3 fixes = architectural problem | systematic-debugging | Concrete stopping condition for debugging |
| Defense-in-depth validation | systematic-debugging | 4 layers: entry, business logic, environment guard, debug |
| Condition-based waiting | systematic-debugging | Replace arbitrary setTimeout with polling + descriptive timeout |
| Lean context | user feedback (2025-11-28) | One-line task + file + pattern + verify > full plan text |
| Mock-interface derivation | user feedback | Derive mock from interface, not from code — prevents drift |
| Commitment principle | using-superpowers, all skills | Announcement requirement triggers psychological commitment |

## Testing Infrastructure

| Test type | What it tests | Mechanism |
|---|---|---|
| Explicit skill requests | 9 phrasings trigger Skill tool | `claude -p` headless + stream-json + grep for tool invocation |
| Skill triggering | 6 natural prompts trigger right skill | Same mechanism, natural language (no skill name) |
| Multi-turn triggering | Skill invoked after conversation context | `--continue` for multi-turn; tests context-buildup failure mode |
| Brainstorm server unit | WebSocket protocol correctness | Direct module import; RFC 6455 test vectors |
| Brainstorm server integration | HTTP serving, file watching, events | Child process spawn; `ws` npm test client |
| Windows lifecycle | Owner PID monitoring, platform detection | MSYS2/Cygwin detection; 75s lifecycle check window |
| Subagent-driven-dev E2E | Full skill execution (Go, Svelte projects) | Session transcript inspection for tool invocations |
| Token usage analysis | Per-subagent cost visibility | Python script parsing JSONL; $3/$15 per M tokens |

## What We Took (Blend History)

### First blend (2026-04-05, pre-registry)

| Pattern | Blended into | Status |
|---|---|---|
| Task graph planning | plan-changeset | Active |
| TDD execution discipline | execute-changeset | Active |
| Subagent dispatch model | execute-changeset parallel inner worktrees | Active |

### Re-blend (2026-04-08, SHA 917e5f53)

| Pattern | Blended into | Status |
|---|---|---|
| CSO description anti-pattern | anti-patterns.md AP-20, create-skill | Active |
| Anti-rationalization table format | create-skill Structural Bulletproofing section | Active |
| Two-stage review ordering | execute-changeset Step 3 (Pass 1 spec, Pass 2 quality) | Active |
| Mock-interface derivation gate | anti-patterns.md AP-14 (5-step gate) | Active |
| Layer-by-layer diagnostic instrumentation | diagnose-bug Investigation Protocol step 4 | Active |
| 3-fixes architectural escalation | diagnose-bug 3-Attempt Escalation | Active |
| Anti-sycophancy review rules | anti-patterns.md AP-21 | Active |
| Type/naming consistency check | plan-changeset self-verify check #8 | Active |
| Pressure testing methodology | test-framework/references/pressure-testing.md | Active |

## Portable Patterns Not Yet Taken

| Pattern | Potential target | Value |
|---|---|---|
| Lean context for subagent tasks | execute-changeset task dispatch | Faster, more focused completion |
| Condition-based waiting patterns | E2E test patterns | Eliminates flaky timeouts |
