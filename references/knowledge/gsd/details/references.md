# GSD References — Detail

Source: get-shit-done/references/*.md (35 files)
Extracted: 2026-04-08

## Mechanism

Reference docs are shared knowledge that workflows and agents `@-reference`. They encode the framework's rules, patterns, and constraints. Grouped by function:

### Gates Taxonomy (gates.md)

4 canonical gate types used at every validation checkpoint:

| Gate Type | Purpose | Behavior | Example |
|---|---|---|---|
| Pre-flight | Validate preconditions before starting | Block entry if unmet, no partial work | REQUIREMENTS.md exists before planning |
| Revision | Evaluate output quality, route to revision | Loop back with feedback, bounded by iteration cap + stall detection | Plan-checker reviewing PLAN.md (max 3) |
| Escalation | Surface unresolvable issues to developer | Pause workflow, present options, wait | Revision loop exhausted, merge conflicts |
| Abort | Terminate to prevent damage/waste | Stop immediately, preserve state, report | Context critically low, STATE.md in error |

Selection heuristic: pre-flight → revision → escalation → abort

### Verification Patterns (verification-patterns.md)

4-level verification hierarchy:
1. **Exists** — file present at expected path
2. **Substantive** — real implementation, not placeholder/stub
3. **Wired** — connected to rest of system (imports, called by, API calls)
4. **Functional** — actually works when invoked (often requires human)

Stub detection patterns for: React components, API routes, database schemas, hooks/utilities, environment config. Wiring patterns: Component→API, API→Database, Form→Handler, State→Render.

### Context Budget (context-budget.md)

| Tier | Usage | Behavior |
|---|---|---|
| PEAK | 0-30% | Full operations, read bodies, spawn multiple agents |
| GOOD | 30-50% | Normal, prefer frontmatter reads, delegate aggressively |
| DEGRADING | 50-70% | Economize, frontmatter-only, warn user |
| POOR | 70%+ | Emergency, checkpoint immediately, no new reads |

Read depth by context window:
- <500K: frontmatter only from prior phases
- >=500K: full body reads permitted for direct dependencies

Context degradation warning signs: silent partial completion, increasing vagueness ("appropriate handling"), skipped protocol steps.

### Universal Anti-Patterns (universal-anti-patterns.md)

27 rules across 7 categories:

**Context Budget (5)**: Never read agent .md files, never inline large files, read depth scales with window, delegate to subagents, proactive pause warning.

**File Reading (4)**: SUMMARY.md depth scales, never read other-phase PLANs, never read .planning/logs/, frontmatter when sufficient.

**Subagent (2)**: NEVER use non-GSD agents (general-purpose, Explore, etc.) — always gsd-{agent}. Never re-litigate locked decisions.

**Questioning (3)**: No checklist walking (#1 anti-pattern), no corporate speak, no premature constraints.

**State Management (1)**: No direct Write/Edit to STATE.md or ROADMAP.md — always via gsd-tools.cjs.

**Behavioral (5)**: No unapproved artifacts, no out-of-scope file edits, one primary suggestion, specific git staging, no secrets in docs.

**Error Recovery (3)**: Git lock detection, config fallback awareness, partial state recovery.

**GSD-Specific (4)**: Check yolo (not auto/autonomous), use gsd-tools.cjs (not .js), plan naming pattern, write SUMMARY before next plan.

### Questioning Philosophy (questioning.md)

"Dream extraction, not requirements gathering." Collaborative thinking, not interrogation.

Rules: start open, follow energy, challenge vagueness, make abstract concrete, know when to stop. AskUserQuestion for concrete options (2-4, not generic). Switch to freeform text when user wants to explain.

4-item background checklist: what they're building, why, who it's for, what done looks like.

Anti-patterns: checklist walking, canned questions, corporate speak, interrogation, rushing, shallow acceptance, premature constraints, asking about user skills.

### Model Profiles (model-profiles.md)

5 profiles: quality (Opus everywhere), balanced (Opus planner, Sonnet rest), budget (Sonnet/Haiku), adaptive (Opus planning+debug, Sonnet execution, Haiku mapping), inherit (follow runtime model).

`inherit` is REQUIRED for non-Anthropic providers. Per-agent overrides via model_overrides config. Resolution: config.json → model_overrides → profile table → Task call.

### Agent Contracts (agent-contracts.md)

Completion markers (21 agents mapped), handoff schemas (Planner→Executor via PLAN.md, Executor→Verifier via SUMMARY.md), workflow regex patterns for marker detection.

### Thinking Models (5 files)

Domain-specific reasoning models:
- Planning: Pre-Mortem, MECE, Constraint Analysis, Reversibility Test, Curse of Knowledge, Base Rate
- Execution: Circle of Concern, Forcing Function, First Principles, Occam's Razor, Chesterton's Fence
- Research/Debug/Verification: domain-specific variants

### Other References

- checkpoints.md: checkpoint types (auto, human-verify, decision, human-action) + pre-checkpoint automation
- gate-prompts.md: reusable prompt patterns for structured decisions
- git-integration.md + git-planning-commit.md: git conventions
- tdd.md: test-driven development protocol
- ui-brand.md: visual output formatting
- domain-probes.md: domain-specific probing questions for discuss-phase
- revision-loop.md: plan revision iteration patterns
- planner-gap-closure.md + planner-reviews.md + planner-revision.md: planner decomposition modules
- workstream-flag.md: parallel workstream management
- user-profiling.md: 8 behavioral dimensions with detection heuristics
- thinking-partner.md: conditional thinking partner activation
- artifact-types.md: planning artifact type definitions
- common-bug-patterns.md: patterns for code review
- verification-overrides.md: per-artifact verification rules
- phase-argument-parsing.md + decimal-phase-calculation.md: phase numbering rules
- continuation-format.md: session resume format

## Analysis

**Strengths**: The reference system is well-structured for progressive loading — agents only read what they need. The gates taxonomy provides clear mental model for validation checkpoints. The verification patterns with stub detection are practically useful. The questioning philosophy is opinionated and effective.

**Weaknesses**: 35 reference files is a lot of knowledge to keep consistent. The anti-patterns list at 27 rules risks becoming a checklist itself (ironic given anti-pattern #12 banning checklist walking).

## L4 Pointers

- Full reference files: get-shit-done/references/*.md (35 files)
- Few-shot examples: get-shit-done/references/few-shot-examples/ (plan-checker.md, verifier.md)
