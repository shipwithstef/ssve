# Harness Validation & Evolution — Detail

## Mechanism

### Validation (Phase 6)

6-step verification after harness generation:

1. **Structure check** — all agent files at `.claude/agents/`, all skills at `.claude/skills/`, no commands generated (`.claude/commands/` must be empty)
2. **Execution mode check** — team mode: verify communication paths, task dependencies, team size. Subagent mode: verify I/O connections, background flags.
3. **Execution test** — 2-3 real test prompts per skill. Run with-skill AND without-skill (baseline) in parallel subagents. Compare quality.
4. **Trigger verification** — 8-10 should-trigger + 8-10 should-NOT-trigger queries. Near-miss negatives are most valuable (boundary cases, not obviously irrelevant).
5. **Dry-run** — verify orchestrator phase order, data flow (no dead links), all inputs match previous outputs, error fallbacks are reachable.
6. **Test scenarios** — add to orchestrator: 1 happy path + 1 error path minimum.

### Evolution (Phase 7)

Harness evolves through feedback loop:

**Feedback collection:** After every run, ask "anything to improve?" Not forced, but opportunity always provided.

**Feedback routing:**

| Type | Target | Example |
|---|---|---|
| Output quality | Agent's skill | "Analysis too shallow" → add depth criteria |
| Agent role | Agent definition | "Need security review" → add QA agent |
| Workflow order | Orchestrator | "Verification first" → reorder phases |
| Team composition | Orchestrator + agents | "Merge these two" → combine agents |
| Trigger miss | Skill description | "This phrase doesn't work" → expand description |

**Change history:** All changes logged in CLAUDE.md table (date, what, target, why). Prevents regression.

**Auto-suggest triggers:**
- Same feedback 2x → suggest modification
- Agent repeatedly fails → suggest restructure
- User bypasses orchestrator → suggest workflow update

### Operations/Maintenance Workflow (Phase 7-5)

When existing harness needs check-up:

1. **Audit** — compare `.claude/agents/` and `.claude/skills/` against CLAUDE.md tables. Report drift.
2. **Incremental change** — one change at a time, sync CLAUDE.md after each.
3. **CLAUDE.md sync** — update tables, directory tree, change history.
4. **Verify** — structure check, trigger check if affected, execution test if large change.

## Analysis

- **Useful for:** Any system that generates artifacts and needs to maintain them. The feedback-to-modification routing table is directly applicable to svc's improve-framework.
- **Trade-offs:** Evolution requires human feedback. Without it, the harness stays static. The auto-suggest triggers (2x same feedback) are clever but depend on pattern detection across sessions.
- **Similar to:** svc's `improve-framework` loop (evidence → diagnosis → fix → replay). Harness's evolution is lighter — feedback-driven rather than evidence-driven. No replay verification requirement.
- **Could improve svc by:** The feedback routing table (type → target) is cleaner than our current approach. The CLAUDE.md change history table is simpler than FRAMEWORK-STATE.md for tracking what changed. The "auto-suggest when same feedback 2x" pattern could be added to our builder patterns system.
- **Assumptions:** User provides feedback. Without it, evolution stalls.
- **Watch out for:** No replay verification. A "fix" based on feedback could break something else. svc's replay requirement via test-framework is stronger.

## Key Source Files (L4)
- `skills/harness/SKILL.md:315-469` — Phase 6 + Phase 7
- `skills/harness/references/skill-testing-guide.md:1-307` — testing methodology
- `skills/harness/references/qa-agent-guide.md:1-228` — QA agent patterns
