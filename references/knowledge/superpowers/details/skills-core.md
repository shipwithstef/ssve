# superpowers — Core Skills Details

## using-superpowers (Meta-bootstrapper)

**Mechanism:** Entry-point skill loaded at session start. Enforces pre-response gate: before
ANY action (including clarifying questions), check for applicable skills at 1% probability.
Once found: announce usage → create TodoWrite per checklist item → execute.

**Key patterns:**
- `SUBAGENT-STOP` tag: subagents skip this skill entirely (avoids recursive overhead)
- Instruction hierarchy: user CLAUDE.md > superpowers skills > default system prompt
- 11-item Red Flags table names specific rationalization thoughts and rebuts them
- Skill priority: process skills (brainstorming, debugging) before implementation skills
- Two skill types: "Rigid" (TDD, debugging — follow exactly) and "Flexible" (patterns — adapt)
- Announcement requirement triggers commitment principle

## brainstorming (9-step pre-implementation gate)

**Mechanism:** HARD-GATE blocks ANY code/scaffold/implementation until design approved.
Sequence: explore context → offer visual companion → one-at-a-time questions →
propose 2-3 approaches → present design incrementally → write spec → self-review →
user review → invoke writing-plans (and ONLY writing-plans).

**Key patterns:**
- One-question-at-a-time constraint explicitly enforced
- Visual companion offer must be isolated message (nothing else in that message)
- Spec self-review: TBD scan, contradiction check, scope check, ambiguity check
- YAGNI ruthlessly applied
- Design isolation: "Can someone understand a unit without reading its internals?"
- Spec saved to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`

## writing-plans (Implementation plans from specs)

**Mechanism:** Scope check first (flag multi-subsystem specs for decomposition).
Map file structure BEFORE defining tasks. Each task 2-5 minutes. Plan header
embeds agentic worker instructions (self-executing documents).

**Key patterns:**
- No-placeholder iron law with 6 specific failure modes
- Type consistency check: catches naming drift between tasks (e.g., `clearLayers()` vs `clearFullLayers()`)
- "Similar to Task N" explicitly banned — tasks must be fully self-contained
- Self-review: spec coverage, placeholder scan, type consistency
- Execution handoff: choice between subagent-driven-development or executing-plans
- Saved to `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`

## executing-plans (Inline fallback)

**Mechanism:** Fallback for when subagents aren't available. Three steps: load plan +
critical review → execute with verification → invoke finishing-a-development-branch.

**Key patterns:**
- Critical review gate: raise concerns before starting (prevent executing flawed plans)
- Explicit STOP conditions: blockers, missing deps, unclear instructions, repeated failures
- Main/master branch protection
- Explicitly notes degraded quality vs. subagent-driven-development

## test-driven-development (Strict RED-GREEN-REFACTOR)

**Mechanism:** Iron law: NO PRODUCTION CODE WITHOUT FAILING TEST FIRST. RED: write one
minimal failing test. Verify RED is MANDATORY. GREEN: minimal code. REFACTOR: clean up.

**Key patterns:**
- "Delete means delete" — code written before test must be deleted entirely (not adapted)
- "Violating the letter is violating the spirit" — shuts down spirit/letter arguments
- 8-item verification checklist (all required)
- 11-excuse rationalization table with specific rebuttals
- 13-item Red Flags list (all trigger "Delete code, start over")
- Bad test example: mocks being tested instead of real behavior
- References `testing-anti-patterns.md` for mock/utility patterns

### testing-anti-patterns.md (5 anti-patterns)
- AP1: Testing mock behavior (verify mock existence vs. real component behavior)
- AP2: Test-only methods in production classes (put cleanup in test utilities)
- AP3: Mocking without understanding dependencies
- AP4: Incomplete mocks (partial mock hides structural assumptions)
- AP5: Integration tests as afterthought
- Gate function format: BEFORE X, ask Y, IF Z then STOP
- Red flags: `*-mock` testIds in assertions, methods only called in test files, mock setup >50% of test
- "Run test with real implementation FIRST, then add minimal mocking"

## subagent-driven-development (Sequential task execution)

**Mechanism:** Controller reads plan once, extracts ALL tasks upfront (subagents never
read plan). Per task: dispatch implementer → implement + self-review + commit →
dispatch spec reviewer (adversarial) → dispatch code quality reviewer → mark complete.

**Key patterns:**
- Two-stage review: spec compliance THEN code quality (ordering prevents wasted effort)
- Four implementer status codes: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED
- Spec reviewer: "Do NOT trust the report, read actual code"
- Model selection matrix: cheap for 1-2 file mechanical, standard for integration, capable for arch
- Re-dispatch loop: reviewer finds issues → implementer fixes → reviewer re-reviews
- Blocker escalation: context → re-dispatch; too large → break it; plan wrong → escalate to human
- Three prompt templates: `implementer-prompt.md`, `spec-reviewer-prompt.md`, `code-quality-reviewer-prompt.md`

## dispatching-parallel-agents (Independent problem domains)

**Mechanism:** Decision tree: multiple failures → independent? → can parallel? → dispatch.
Agent prompts: focused (one domain), self-contained (all context), specific output format.

**Key patterns:**
- Context isolation: agents never inherit session history
- Common mistakes: too-broad scope, no context, no constraints, vague output expectations
- Post-integration: check for conflicts, run full test suite

## using-git-worktrees (Systematic worktree creation)

**Mechanism:** Priority order: existing `.worktrees/`/`worktrees/` → CLAUDE.md → ask user.
Safety: `git check-ignore -q` before creation. If not ignored → add to `.gitignore` + commit FIRST.

**Key patterns:**
- Five language auto-detection patterns (Node, Rust, Python, Go, generic)
- Baseline test verification before proceeding
- Global alternative: `~/.config/superpowers/worktrees/<project>/` (no .gitignore check needed)

## finishing-a-development-branch (Completion workflow)

**Mechanism:** 5 steps: test → determine base → present 4 options → execute → cleanup.
Options: merge locally, push+PR, keep as-is, discard.

**Key patterns:**
- Test verification gates entry
- Exactly 4 options — no additions
- Worktree cleanup matrix: merge/discard clean up; PR/keep-as-is preserve
- Typed "discard" confirmation for Option 4

## verification-before-completion (5-step gate)

**Mechanism:** Before ANY success claim: identify command → run fresh → read full output →
verify confirms claim → make claim. Applies to "should/probably/seems to" and agent reports.

**Key patterns:**
- "From 24 failure memories" — grounded in observed failures
- Truth table: what each claim requires vs. what's not sufficient
- Applies to agent delegation (agent says success → check VCS diff)
- Red flags: satisfaction expressions ("Great!", "Done!")
- 8-excuse rationalization prevention table

## requesting-code-review (Dispatch reviewer)

**Mechanism:** Get base/HEAD SHAs, fill code-reviewer template, dispatch subagent.
Three-tier severity: Critical (must fix), Important (should fix), Minor (note).

**Key patterns:**
- Timing: mandatory after each SDD task, after each executing-plans batch, before merge
- Pushback allowed with technical reasoning

## receiving-code-review (Process feedback)

**Mechanism:** 6 steps: read → restate → verify → evaluate → respond → implement one at a time.

**Key patterns:**
- Forbidden responses: "You're absolutely right!", "Great point!", "Let me implement that now"
- Action-speaks: "Just fix it and show in code" replaces verbal acknowledgment
- YAGNI check: grep codebase before implementing "properly" suggested features
- Clarify all unclear items BEFORE implementing any
- "Strange things are afoot at the Circle K" — signal phrase for uncomfortable pushback

## writing-skills (TDD for skill creation)

**Mechanism:** RED: run pressure scenarios WITHOUT skill (document rationalizations).
GREEN: write minimal skill addressing those failures. REFACTOR: find new rationalizations,
add counters, re-test until bulletproof.

**Key patterns:**
- CSO finding: description summarizing workflow causes Claude to follow description, skip full skill
- Description format: "Use when [triggering conditions]" only — never summarize workflow
- Token targets: <150 words (getting-started), <200 (frequent), <500 (others)
- Avoid `@` syntax (force-loads files, burns context immediately)
- Rationalization table + Red Flags as structural bulletproofing
- Persuasion principles grounded in Cialdini + Meincke et al. (2025): compliance 33%→72%

## Analysis — What's valuable for svc

The anti-rationalization infrastructure (tables, red flags, pressure testing) is the most
portable pattern. The CSO finding about descriptions is directly applicable to all svc
skill frontmatter. The two-stage review ordering (spec compliance before code quality)
could improve execute-changeset review gates. The lean context pattern (one-line task
description > full plan text for subagents) could improve task dispatch efficiency.

## L4 Pointers

- All SKILL.md files: `skills/<name>/SKILL.md`
- Prompt templates: `skills/subagent-driven-development/{implementer,spec-reviewer,code-quality-reviewer}-prompt.md`
- Anti-patterns: `skills/test-driven-development/testing-anti-patterns.md`
- Persuasion research: `skills/writing-skills/persuasion-principles.md`
- Anthropic best practices: `skills/writing-skills/anthropic-best-practices.md`
