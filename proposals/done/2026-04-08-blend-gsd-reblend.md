# Blend Plan: GSD Re-Blend (v1.34.2)

**Source:** https://github.com/gsd-build/get-shit-done
**Version:** v1.34.2
**Date:** 2026-04-08
**Previous blend:** 2026-04-06, SHA unknown-2026-04-06, 11 patterns taken

## Summary

7 patterns to blend, 12 to skip, 11 already present from previous blend.

## Blend Items

### 1. Gates Taxonomy (4 canonical types) → review-gate/SKILL.md + DOCTRINE.md

**From:** get-shit-done/references/gates.md
**Into:** review-gate/SKILL.md (gate selection guidance), DOCTRINE.md (gate taxonomy section)
**What to take:**
4 canonical gate types with clear selection heuristic:
- Pre-flight: validate preconditions before work starts (cheap, deterministic)
- Revision: evaluate output quality, loop back with feedback (bounded by iteration cap + stall detection)
- Escalation: surface unresolvable issues to developer (pause, present options)
- Abort: terminate to prevent damage/waste (preserve state, report)

Selection heuristic: "Start with pre-flight. If after work produced → revision. If revision can't resolve → escalate. If continuing is dangerous → abort."

**Why it matters for svc:** svc has 7 review gates (G1-G7) but no taxonomy for what TYPE of gate each is. The taxonomy makes gate behavior predictable and helps when designing new gates for new skills.

**How to adapt:**
- Map each G1-G7 gate to one of the 4 types
- Add the selection heuristic to DOCTRINE.md so skill authors know which gate type to use
- Add stall detection concept to revision gates (issue count not decreasing between iterations)

**What NOT to take:**
- The gate matrix table mapping GSD-specific workflows — svc has different workflows

---

### 2. Stall Detection in Revision Loops → review-gate/SKILL.md

**From:** get-shit-done/references/gates.md (Revision Gate section)
**Into:** review-gate/SKILL.md (review loop behavior)
**What to take:**
"The loop also escalates early if issue count does not decrease between consecutive iterations (stall detection). After max iterations, escalates unconditionally."

**Why it matters for svc:** review-gate currently has a max iteration concept but no stall detection. If a reviewer finds 5 issues, the author "fixes" them but introduces 5 new issues, the loop continues until max iterations. Stall detection catches this degenerate case early.

**How to adapt:**
- Add stall detection rule to the review loop in review-gate: "If issue count does not decrease between consecutive review passes, escalate immediately instead of continuing to max iterations"
- Track issue count between passes

**What NOT to take:**
- GSD's specific iteration cap (3) — svc should keep its own

---

### 3. Test Quality Audit in Verifier → verify-promotion/SKILL.md

**From:** docs/AGENTS.md (gsd-verifier section)
**Into:** verify-promotion/SKILL.md (post-merge verification)
**What to take:**
Test quality audit checks:
1. Disabled/skipped tests on requirements — tests that exist but are `.skip()` or `@Disabled`
2. Circular test patterns — system generating its own expected values (testing itself)
3. Assertion strength — existence vs value vs behavioral verification
4. Expected value provenance — where did the expected value come from? If it came from the system under test, the test is tautological

"Blockers from test quality audit override an otherwise passing verification"

**Why it matters for svc:** verify-promotion checks that tests pass but doesn't audit test QUALITY. A test that asserts `expect(result).toBeDefined()` passes but proves nothing. Circular tests (system generates expected output, test compares to it) are actively harmful.

**How to adapt:**
- Add a "Test Quality Audit" section to verify-promotion with the 4 checks
- Make test quality blockers override passing verification (same as GSD)
- Adapt language to svc terminology

**What NOT to take:**
- GSD's milestone scope filtering (defers gaps to later phases) — svc doesn't have milestones

---

### 4. Adaptive Context Enrichment for 1M Models → execute-changeset/SKILL.md

**From:** docs/ARCHITECTURE.md (Adaptive Context Enrichment section)
**Into:** execute-changeset/SKILL.md (subagent prompt building)
**What to take:**
When context_window >= 500K (1M models): subagent prompts get enriched with additional context:
- Executors receive prior task summaries + full context from earlier pipeline phases
- Verifiers receive all plan files + summaries + requirements

At standard 200K: truncated versions with cache-friendly ordering.

**Why it matters for svc:** svc currently builds subagent prompts the same way regardless of model context window. With Opus 4.6 (1M context) and Sonnet 4.6 (1M), we're leaving context budget on the table. Enriching subagent prompts when we have the headroom improves cross-task awareness.

**How to adapt:**
- Add context window detection to execute-changeset subagent prompt section
- At >=500K: include prior task summaries, full spec context, AC mappings
- At <500K: current behavior (minimal context)
- Add the same for audit-implementation verifier agents

**What NOT to take:**
- GSD's specific bridge file mechanism (/tmp/claude-ctx-*.json) — that's implementation, not methodology

---

### 5. Agent Completion Markers Convention → references/anti-patterns.md

**From:** get-shit-done/references/agent-contracts.md
**Into:** references/anti-patterns.md (new AP) + execute-changeset/SKILL.md
**What to take:**
Standardized completion markers for subagent handoff:
- Every agent emits a specific H2 heading when done (## TASK COMPLETE, ## BLOCKED, ## CHECKPOINT REACHED)
- Orchestrators regex-match these markers to detect completion and route
- Agents without markers write artifacts directly to disk

**Why it matters for svc:** svc subagents currently return results inline, and the orchestrator parses them ad-hoc. Standardized completion markers would make subagent handoff more reliable, especially for execute-changeset where multiple agents run in parallel.

**How to adapt:**
- Define svc completion markers: ## TASK COMPLETE, ## TASK BLOCKED, ## CHECKPOINT
- Add to execute-changeset subagent dispatch section
- Add anti-pattern: "Do not parse subagent results without checking for completion markers first"

**What NOT to take:**
- GSD's inconsistent casing (some Title Case, some ALL-CAPS) — pick one convention

---

### 6. Schema Drift Detection → plan-changeset/SKILL.md

**From:** docs/FEATURES.md (Feature #59: Schema Drift Detection)
**Into:** plan-changeset/SKILL.md (pre-planning checks)
**What to take:**
Schema drift detection: when ORM changes (Prisma, Drizzle, TypeORM) are in the plan but migration steps are missing, flag it as a gap BEFORE execution.

**Why it matters for svc:** plan-changeset validates task coverage and AC mapping but doesn't check for schema-migration consistency. A plan that modifies `schema.prisma` without a migration task will produce a broken state.

**How to adapt:**
- Add a pre-flight check to plan-changeset: "If any task modifies an ORM schema file (prisma/schema.prisma, drizzle/*.ts, etc.), verify a migration task exists in the same plan or a later plan in the same changeset"
- Flag as blocker, not auto-fix (migration strategy is a design decision)

**What NOT to take:**
- GSD's full schema-detect.cjs module — too coupled to their CLI tools layer

---

### 7. Claim Provenance Tagging → references/anti-patterns.md

**From:** docs/FEATURES.md (Feature #65: Claim Provenance Tagging)
**Into:** references/anti-patterns.md (new AP)
**What to take:**
Every factual claim in planning artifacts should be tagged with its source:
- `[FROM-SPEC]` — came from the feature spec
- `[FROM-CODE]` — observed in the codebase
- `[FROM-RESEARCH]` — from web/library research
- `[ASSUMED]` — not verified, inference

**Why it matters for svc:** When review-gate finds a claim in a plan or spec, it currently can't tell if it was grounded in evidence or assumed. Provenance tags make review faster and catch ungrounded assumptions.

**How to adapt:**
- Add as AP-23: "Untagged claims in planning artifacts are unverifiable — tag every factual assertion with provenance"
- Add to plan-changeset output requirements
- review-gate can flag `[ASSUMED]` claims for extra scrutiny

**What NOT to take:**
- Implementation as a hook (GSD's approach) — svc should enforce this in the skill prompt

---

## Skipped Items

| External | Reason for skip |
|----------|----------------|
| Discussion phase (gray areas) | Already in Known Gaps as deferred — validate-feature partially covers |
| Wave-based parallel execution | Already in Known Gaps — inner worktrees exist |
| Context monitor hook | Already in Known Gaps — documented in references/context-budget.md |
| Prompt injection scanner hook | Already in Known Gaps |
| Dynamic roadmap mutation | Already in Known Gaps — fixed lane sequences by design |
| 8-dimension passive profiling | Already in Known Gaps — mine-builder does active interview |
| Multi-runtime installer | svc uses git clone + ./setup — different architecture |
| Model profiles (5 tiers) | svc uses Opus/Sonnet only; inherit not needed for single-provider |
| Workstreams/workspaces | Overkill for svc — worktrees cover branch isolation |
| Forensics system | Post-mortem for stuck workflows — svc has diagnose-bug |
| Socratic exploration | Nice UX pattern but not pipeline-critical |
| Post-merge hunk verification | land-changeset squash merge avoids hunk issues |

## Rethink: Past Blend Reassessment

### Blended Patterns Reassessed

| Pattern | svc skill | Verdict | Action |
|---------|-----------|---------|--------|
| Context degradation tiers | references/context-budget.md | Solid, working well | KEEP |
| 4-level verification | references/verification-patterns.md | Solid, core to review-gate | KEEP |
| Anti-patterns (18 of 27) | references/anti-patterns.md | Growing well (now 22 APs) | KEEP |
| Thinking models | references/thinking-models.md | Used by execution, could expand | KEEP |
| Deviation rules | execute-changeset/SKILL.md | Working well | KEEP |
| Scope prohibition | plan-changeset/SKILL.md | Working well | KEEP |
| Safety gates | DOCTRINE.md | Working well — gates taxonomy (#1 above) strengthens | KEEP + EXTEND |
| Session continuity | route-workflow/SKILL.md | Working well | KEEP |
| Questioning anti-patterns | mine-builder/SKILL.md | Working well | KEEP |
| Freeform routing | route-workflow/SKILL.md | Working well | KEEP |
| Workflow guard hook | hooks/ | Working, opt-in | KEEP |

### Skipped Patterns Reconsidered

| Pattern | Original skip reason | Reassessment | Action |
|---------|---------------------|--------------|--------|
| discuss-phase (gray areas) | validate-feature partially covers | Still true; svc progressive narrowing is more granular | KEEP SKIP |
| fast.md (trivial task skip) | Deferred to future | quick-fix covers this well | KEEP SKIP |

## Attribution Update

Add to NOTICES: "GSD v1.34.2 re-blend: gates taxonomy, stall detection, test quality audit, adaptive context enrichment, completion markers, schema drift detection, claim provenance tagging"
