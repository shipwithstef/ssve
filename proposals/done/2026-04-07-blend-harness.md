# Blend Plan: Harness

**Source:** https://github.com/revfactory/harness
**SHA:** 2d84863bd10070c48b99b973e370f160e7a51ad4
**Date:** 2026-04-07
**Previous blend:** first blend
**License:** Apache-2.0
**Status:** IMPLEMENTED (2026-04-08, commit f216b23)

## Summary

6 patterns to blend, 2 to consider for later, 5 to skip.

**Updated 2026-04-08:** re-evaluated after completing full extraction (was 60% read, now 100%).
QA boundary mismatch detection promoted from SKIP to BLEND — our review-gate checks
artifacts, not code integration boundaries. This is a genuine gap.

## Blend Items

### 1. Agent Team Architecture Taxonomy → `references/agent-patterns.md` (new)

**From:** `skills/harness/references/agent-design-patterns.md`
**Into:** New reference doc `references/agent-patterns.md`
**What to take:**
The 6 architecture patterns (pipeline, fan-out/fan-in, expert pool, producer-reviewer, supervisor, hierarchical delegation) with decision criteria. Plus the team vs subagent decision tree and team size guidelines.

**How to adapt:**
- svc currently uses subagent mode only (execute-changeset). Document this as baseline.
- Add the pattern taxonomy as a reference that execute-changeset, plan-changeset, and improve-framework can consult when deciding how to dispatch work.
- Don't require Agent Teams API — document patterns for both subagent dispatch AND team mode.

**What NOT to take:**
- The "all agents must use opus" mandate (too expensive for many tasks — svc uses Sonnet for extraction).
- Korean-language specifics.

---

### 2. Agent Definition Convention → `references/agent-patterns.md`

**From:** `skills/harness/SKILL.md:69-93` (Phase 3)
**Into:** Same new reference doc
**What to take:**
The convention that agents should be defined as files (`.claude/agents/{name}.md`) with required sections: core role, working principles, I/O protocol, error handling, collaboration. Separates WHO (agent) from HOW (skill).

**How to adapt:**
- svc doesn't generate project-specific agents currently. But when execute-changeset dispatches subagents for parallel tasks, those prompts are inline. Moving them to agent definition files would make them reusable and auditable.
- Start as a recommendation, not a requirement. "When dispatching subagents with distinct roles, consider defining them as agent files."

**What NOT to take:**
- The `.claude/commands/` prohibition (svc doesn't use commands anyway).

---

### 3. Pushy Skill Description Standard → `references/anti-patterns.md`

**From:** `skills/harness/SKILL.md:112-119` (Phase 4-2)
**Into:** `references/anti-patterns.md` as a new anti-pattern
**What to take:**
The explicit standard: descriptions must be aggressive about triggering. Include both what the skill does AND specific trigger situations. Include follow-up keywords ("re-run", "update", "modify"). Bad example vs good example format.

**How to adapt:**
Add as AP-19: "Weak skill description" to anti-patterns.md. Reference when creating or auditing skills.

**What NOT to take:**
- Nothing to skip — this is pure signal.

---

### 4. Trigger Testing Methodology → `test-framework/evals/tier-1.5/`

**From:** `skills/harness/SKILL.md:350-357` (Phase 6-4)
**Into:** `test-framework/evals/tier-1.5/test-skill-triggering.sh` improvements
**What to take:**
The methodology: 8-10 should-trigger + 8-10 should-NOT-trigger queries per skill. Near-miss negatives are most valuable (boundary cases). The "near-miss writing core" principle: "fibonacci function" as a negative for PDF skill is useless — "extract chart from Excel as PNG" is a real boundary test.

**How to adapt:**
- We already have trigger testing in tier 1.5 but without the near-miss emphasis.
- Add the near-miss methodology to the test skill triggering script.
- Recommend near-miss fixtures when creating new skills via create-skill.

**What NOT to take:**
- The full HTML-based trigger eval optimization loop (that's from Anthropic's skill-creator which we already forked).

---

### 5. Adaptive Communication Based on User Skill Level → `route-workflow/SKILL.md`

**From:** `skills/harness/SKILL.md:42` (Phase 1 domain analysis)
**Into:** `route-workflow/SKILL.md` session setup or `mine-builder/SKILL.md`
**What to take:**
Detect user's technical level from context clues (terminology used, question depth, tools mentioned) and adapt communication accordingly. Don't use "assertion", "JSON schema" with a non-technical user without explaining. Don't over-explain Docker to a devops person.

**How to adapt:**
- We already do this partially in mine-builder (captures skill level) and teach-project (calibrates to knowledge gap). But we don't have a framework-wide communication adaptation rule.
- Add a "Communication Adaptation" section to route-workflow that all downstream skills inherit via P0.

**What NOT to take:**
- Nothing to skip — this is directly applicable.

---

### 6. Boundary Mismatch Detection (Integration Coherence) → `references/verification-patterns.md`

**From:** `skills/harness/references/qa-agent-guide.md`
**Into:** `references/verification-patterns.md` — new section on integration coherence
**What to take:**
The "existence ≠ connection" principle: verifying that an API exists is NOT the same as verifying that the API response shape matches the consuming component's type. Four integration coherence areas:
1. API response shape ↔ frontend hook type (cross-compare `NextResponse.json()` vs `fetchJson<T>`)
2. File paths ↔ link/router paths (page files vs href/router.push values)
3. State transition map ↔ actual status updates (every transition executed, no dead transitions)
4. API endpoints ↔ frontend hooks (1:1 mapping, no orphaned endpoints)

Plus the "read both sides simultaneously" principle — never verify one side of a boundary in isolation.

**How to adapt:**
- Add an "Integration Coherence" section to `references/verification-patterns.md`
- Reference from `audit-implementation` and `verify-promotion` — these skills should check boundaries, not just existence
- The specific patterns are web-app focused (Next.js/React) but the PRINCIPLE (cross-boundary verification) is universal and applies to any stack

**What NOT to take:**
- The Korean-language SatangSlide-specific bug examples (keep the patterns, drop the project-specific details)
- The QA agent definition template (we don't generate project-specific QA agents — our review-gate handles this)

---

## Considered for Later

### CLAUDE.md Harness Registration
Harness writes team/skill context to CLAUDE.md so next session auto-activates. We use project-state.md instead. Worth reconsidering if project-state.md proves insufficient for session continuity — CLAUDE.md is auto-loaded, project-state.md must be read manually.

### _workspace/ Audit Trail
Preserving intermediate artifacts in a workspace directory for post-run audit. Currently svc cleans up worktrees after promotion. Could be valuable for debugging pipeline issues.

## Skipped Items

| External | Reason for skip |
|----------|----------------|
| Progressive disclosure (3-tier loading) | We already have this in our knowledge system |
| With-skill vs without-skill comparison | test-framework already has comparison mode |
| Feedback-driven evolution | Already in improve-framework + builder patterns |
| Phase 0 audit | onboard-repo + session continuity covers this |
| Orchestrator template (full) | Too coupled to Agent Teams API which we don't use yet |

## Attribution Update

Add to NOTICES:
```
Harness (https://github.com/revfactory/harness)
Copyright (c) 2025 robin (revfactory)
Licensed under the Apache License, Version 2.0

Patterns blended from Harness:
- Agent team architecture taxonomy (6 patterns) (references/agent-patterns.md)
- Agent definition convention (references/agent-patterns.md)
- Pushy skill description standard (references/anti-patterns.md)
- Trigger testing near-miss methodology (test-framework tier 1.5)
- Adaptive communication based on user skill level (route-workflow)
- Boundary mismatch / integration coherence verification (references/verification-patterns.md)
```
