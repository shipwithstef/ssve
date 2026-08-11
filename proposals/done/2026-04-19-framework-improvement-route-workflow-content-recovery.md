# Framework Improvement: Route-Workflow Content-Recovery via Proper Progressive Disclosure

**Status:** IMPLEMENTED (2026-04-19)
**Parent proposal:** `proposals/done/2026-04-19-session-audit-gemini-slim-refactor-wi071-and-wi085.md` (Known Gap "residual content-recovery")

## Evidence

`verify-skill-refactor.mjs route-workflow 4c36a4e^` reported **12 missing section headers** after G1 landed — content that was deleted during the Gemini slim-refactor and not restored by any of the subsequent repair commits. User correction reframed this: the fix is NOT to dump content back into SKILL.md (that would regress to the monolithic pattern skill-creator explicitly warns against), but to distribute it properly into `references/*.md` — which is what Gemini's slim-refactor was trying to achieve.

## Diagnosis

- **Root cause:** Two different people solved the Gemini-refactor-damage the wrong way. Codex/Claude restoration commits dumped content back into SKILL.md (wrong pattern) instead of into references/ (right pattern).
- **Category:** drift (framework regressed from the correct pattern that Gemini identified)
- **Already in FRAMEWORK-STATE.md?** Yes, as Known Gap "Residual content-recovery" filed by the parent proposal.

## Implementation

Extracted the 12 missing sections from `git show 4c36a4e^:route-workflow/SKILL.md` and distributed them to the right homes:

### Files created
| File | Content | Lines |
|---|---|---|
| `route-workflow/references/autorun-orchestrator.md` | "One Prompt to Product" + "Human Checkpoint Behavior in Autorun" | 42 |
| `route-workflow/references/decision-log.md` | "Pipeline Decision Log" + 5 sub-sections (JSONL Schema, Event Types, When to Write, How to Write, End-of-Run Summary) + "Decision Classification" | 143 |

### Files modified
| File | Change |
|---|---|
| `route-workflow/references/routing-rules.md` | Appended "Change-Type Detection" (30 lines) |
| `route-workflow/references/task-graph-protocol.md` | Appended "Level B: Full state machine (deferred)" (3 lines); renamed "Output Protocol — Next Trailer Rules" → "Output Protocol — Next Command Suggestion (applies to ALL skills)" to match the original, more-descriptive header |
| `route-workflow/SKILL.md` | Added 3 pointer lines in Protocols & Output section — linking the two new refs + Change-Type Detection anchor |

## Replay Verification

**Gate:** `verify-skill-refactor.mjs route-workflow 4c36a4e^` must exit 0.

```
skill:          route-workflow
old ref:        4c36a4e^
old SKILL.md:   2633 lines
current total:  2635 lines (SKILL.md + references/*.md)
line delta:     +2
old markers:    155
current markers: 159
missing markers: 0

✅ Content preservation verified — every marker from old SKILL.md reachable in current state.
```

**Result: PASS** — 0 missing markers. Total content parity within 2 lines of pre-Gemini-refactor baseline, properly distributed.

**Sizes (proof Gemini's direction preserved):**
- SKILL.md: 81 lines (≈ slim target)
- 10 reference files: 2542 lines total
- SKILL.md is 3% of total skill content — progressive disclosure done right

## FRAMEWORK-STATE.md Mutations

- Analysis History: new entry for this recovery, with mapping table of missing sections → new homes
- Known Gaps: "Residual content-recovery for route-workflow + write-e2e" marked CLOSED
- Decisions: new locked decision — "Progressive disclosure is the svc default for large skills, not a Gemini-specific accommodation. 'Restoring content back to SKILL.md' is a regression, not a recovery."

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Evidence gathered | PASS — Known Gap entry + G1 verifier output |
| 2 | Diagnosis produced | PASS — drift category, root cause identified |
| 3 | Implementation route chosen | PASS — direct edits to SKILL.md + references |
| 4 | Replay verification passed | PASS — G1 reports 0 missing markers |
| 5 | FRAMEWORK-STATE.md updated | PASS — Analysis History + Known Gap closed + new Decision |
| 6 | svc CAPABILITIES.md updated | N/A — no new capabilities, reorganization only |
| 7 | Blend registry updated | N/A — no blend |
| 8 | Proposal in done/ | PASS — this file |
| 9 | NOTICES updated | N/A |
| 10 | Commits pushed to remote | PENDING — Step 6c |
