# Methodology Usage Audit: What Was Actually Done vs What Should Have Been Done

> Honesty check: Did each framework get a fair run using its recommended workflow?

---

## 1. Serious Vibe Coding (port 3000) — Pre-existing from prior autopilot

### Recommended Workflow (19 skills in order)
| # | Skill | Status | What actually happened |
|---|-------|--------|----------------------|
| 1 | `write-vision` | ✅ DONE | Created `docs/specs/vision.md` — 12 sections |
| 2 | `build-personas` | ✅ DONE | Created P1, P2, P3 personas |
| 3 | `route-workflow` | ❓ UNKNOWN | Not verified whether routing was invoked |
| 4 | `validate-feature` | ✅ DONE | Ship Brief created |
| 5 | `write-spec` | ✅ DONE | 30 ACs across 5 user stories, cascade deps |
| 6 | `audit-ac` | ❓ UNKNOWN | AC table format exists but sync not verified |
| 7 | `write-journeys` | ✅ DONE | 3 journeys + index |
| 8 | `design-ux` | ✅ DONE | UX design doc created |
| 9 | `design-ui` | ✅ DONE | UI design doc + design-system.md |
| 10 | `design-tech` | ✅ DONE | Technical design section |
| 11 | `review-gate` | ❓ UNKNOWN | Not verified if formal review ran |
| 12 | `plan-changeset` | ✅ DONE | Full code written (20 files) |
| 13 | `land-changeset` | ✅ DONE | Code is in the worktree |
| 14 | `verify-promotion` | ❌ NOT DONE | No verification report found |
| 15 | `sync-spec-code` | ❌ NOT DONE | All ACs still show PLANNED, none RESOLVED |
| 16 | `test-journeys` | ❌ NOT DONE | No QA column updates in AC tables |
| 17 | `write-e2e` | ❌ NOT DONE | No E2E test files generated |
| 18 | `analyze-marketing` | ❌ NOT DONE | No marketing context doc |
| 19 | `test-framework` | ⬅️ THIS IS US | Current session |

### Verdict: PARTIAL — 12/19 skills executed
The pipeline stopped after code generation (skill 13). Skills 14-18 (verification, sync, QA, E2E, marketing) were never run. This means svc's verification claims were never tested — the very phases that catch spec-code drift weren't executed.

### What inputs fed each skill:
- write-vision ← user's one-sentence prompt
- build-personas ← vision.md
- validate-feature ← vision + personas + prompt
- write-spec ← ship brief
- write-journeys ← spec + personas
- design-ux ← DRAFT spec + personas + journeys
- design-ui ← UX design + spec
- design-tech ← all previous + design system
- plan-changeset ← BASELINED spec + all designs
- land-changeset ← change set files

---

## 2. gstack (port 3002) — Agent in worktree

### Recommended Workflow (from gstack docs)
| # | Skill | Status | What actually happened |
|---|-------|--------|----------------------|
| 1 | `/office-hours` | ❌ **NOT INVOKED** | Agent was told to invoke it but instead did its own inline brainstorming — asked and answered 3 questions as the "founder". Did NOT run the actual office-hours skill with its 6 forcing questions via AskUserQuestion. |
| 2 | `/design-consultation` | ❌ NOT DONE | No DESIGN.md created. No brand/typography/color exploration. |
| 3 | `/plan-ceo-review` | ❌ NOT DONE | No CEO-level scope review |
| 4 | `/plan-design-review` | ❌ NOT DONE | No design dimension rating |
| 5 | `/plan-eng-review` | ❌ NOT DONE | No architecture review with ASCII diagrams |
| 6 | `/autoplan` | ❌ NOT DONE | No automated review pipeline |
| 7 | Coding | ✅ DONE | Wrote 3 TypeScript files + 4 EJS views directly |
| 8 | `/qa` | ❌ NOT DONE | No QA testing against running server |
| 9 | `/review` | ❌ NOT DONE | No code review |
| 10 | `/ship` | ❌ NOT DONE | No version/changelog/PR |

### Verdict: **UNFAIR TEST** — 0/10 gstack skills actually invoked
The agent wrote code directly without using ANY gstack skill. What I called "gstack" was really just another raw approach with a slightly better brainstorming step (self-Q&A). The visual quality was good, but that came from the agent's own capabilities, not from gstack's design consultation or design review pipeline.

### What SHOULD have happened:
1. `/office-hours` — interactive Q&A with 6 forcing questions (via AskUserQuestion)
2. `/design-consultation` — create DESIGN.md with full brand/color/typography system
3. `/autoplan` or `/plan-ceo-review` → `/plan-design-review` → `/plan-eng-review` — sequential review pipeline
4. Write code guided by the reviews
5. `/qa` — test with real browser
6. `/review` — code review
7. `/ship` — version + PR

### What inputs should have fed each skill:
- `/office-hours` ← user's one-sentence prompt → produces design doc
- `/design-consultation` ← design doc from office-hours → produces DESIGN.md
- `/plan-ceo-review` ← design doc → scope decisions
- `/plan-design-review` ← design doc + DESIGN.md → 0-10 ratings per dimension
- `/plan-eng-review` ← design doc + design reviews → architecture, state machines, test matrix
- Coding ← reviewed plan + DESIGN.md
- `/qa` ← running server URL → bug reports
- `/review` ← diff → safety checks
- `/ship` ← reviewed code → version, changelog, PR

---

## 3. obra / Superpowers (port 3001) — Agent in worktree

### Recommended Workflow (from superpowers docs)
| # | Skill | Status | What actually happened |
|---|-------|--------|----------------------|
| 1 | `superpowers:brainstorming` | ❌ **NOT INVOKED AS SKILL** | Agent did its own inline brainstorming. Asked Q&A, proposed 3 approaches, presented a design. This MATCHES the brainstorming skill's spirit (explore, propose, get approval) but was not invoked via the Skill tool. |
| 2 | Design doc | ✅ DONE | `docs/superpowers/specs/2026-04-04-trendlearn-ai-design.md` — covers deployment modes, tech stack, architecture, feature matrix |
| 3 | `superpowers:writing-plans` | ❌ **NOT INVOKED AS SKILL** | Agent wrote its own plan at `docs/superpowers/plans/2026-04-04-trendlearn-ai.md`. Plan has file map + step-by-step tasks with checkboxes. This MATCHES the writing-plans format but was not invoked via the Skill tool. |
| 4 | `superpowers:executing-plans` | ❌ NOT INVOKED | Agent executed the plan by writing files directly, not through the executing-plans skill with batch review |
| 5 | `superpowers:test-driven-development` | ❌ NOT DONE | Zero test files. "Iron Law: no code without failing test first" was violated. |
| 6 | `superpowers:subagent-driven-development` | ❌ NOT DONE | No subagent dispatch |
| 7 | `superpowers:dispatching-parallel-agents` | ❌ NOT DONE | No parallel agents |
| 8 | `superpowers:requesting-code-review` | ❌ NOT DONE | No code review |
| 9 | `superpowers:verification-before-completion` | ❌ NOT DONE | No verification step |
| 10 | `superpowers:finishing-a-development-branch` | ❌ NOT DONE | No branch finishing |

### Verdict: **PARTIALLY FAIR** — 0 skills invoked, but methodology spirit was followed
The agent followed the brainstorm → plan → execute pattern correctly, producing a design doc AND a plan before writing code. The outputs match superpowers' format. But no skill was actually invoked via the Skill tool, TDD was skipped, no code review, no verification.

### What SHOULD have happened:
1. `superpowers:brainstorming` — interactive questions, propose approaches, user approval, write design doc, user reviews spec, then transition to writing-plans
2. `superpowers:writing-plans` — create plan with tasks, dependencies, file map
3. `superpowers:test-driven-development` — write failing tests BEFORE implementation
4. `superpowers:executing-plans` — batch execute with architect review between batches
5. `superpowers:requesting-code-review` — dispatch code reviewer
6. `superpowers:verification-before-completion` — run evidence checks
7. `superpowers:finishing-a-development-branch` — merge/PR/cleanup

### What inputs should have fed each skill:
- `brainstorming` ← user's one-sentence prompt → design doc (approved by user)
- `writing-plans` ← design doc → plan with tasks
- `test-driven-development` ← plan → failing tests first
- `executing-plans` ← plan → code in batches with review
- `requesting-code-review` ← completed code → review findings
- `verification-before-completion` ← running server → evidence
- `finishing-a-development-branch` ← verified code → merge decision

---

## 4. Raw (port 3003) — By design, no methodology

### What happened:
Single prompt → code. No skills, no planning, no review. This is the correct execution for the "raw" approach.

### Verdict: ✅ FAIR — This is exactly what "raw" means.

---

## Overall Fairness Assessment

| Approach | Skills invoked | Workflow followed | Fair test? |
|----------|---------------|-------------------|-----------|
| Serious Vibe Coding | 12/19 | Partially (stopped at code gen) | **MOSTLY FAIR** — but missing verification phases weakens it |
| gstack | **0/10** | **Not at all** | **UNFAIR** — no gstack skills were used |
| obra | **0/10** | Spirit only (brainstorm→plan→execute pattern) | **PARTIALLY FAIR** — right pattern, wrong execution |
| Raw | N/A | N/A | **FAIR** — correct by design |

## Root Cause

The agents were dispatched as background tasks with instructions to "invoke" skills. But:

1. **Subagents can invoke skills via the Skill tool**, but the agents chose to do the work inline instead. The brainstorming, planning, and design steps were done by the agent's own reasoning rather than loading the skill's specific instructions.

2. **Interactive skills like `/office-hours` require AskUserQuestion** — the agent couldn't interactively ask the user questions because it was running autonomously in the background.

3. **TDD was skipped by all non-svc approaches** — despite obra's "Iron Law" and gstack's "Boil the Lake" philosophy.

## What This Means for the Comparison

The Phase 2 scores (universal expectations) are valid — they measure what the user sees regardless of methodology. But the Phase 3 scores (methodology-specific) and Phase 4 insights are **compromised** because:

- We can't say "gstack's design approach produces better UI" when gstack's design skills weren't used
- We can't say "obra's plan-to-code fidelity is high" when obra's executing-plans skill wasn't invoked
- We CAN say "svc's specs were thorough but lost info at phase boundaries" — that observation stands

## Recommendation: Re-run with proper skill invocation

For a valid four-way comparison, each approach needs to be run interactively (not as background agents) so that:
1. gstack's `/office-hours` can ask questions via AskUserQuestion
2. obra's `brainstorming` can do interactive Q&A
3. Skills are invoked via the Skill tool, not approximated inline
4. TDD is enforced for obra (Iron Law)
5. Review pipelines run for both gstack (`/autoplan`) and obra (`requesting-code-review`)
