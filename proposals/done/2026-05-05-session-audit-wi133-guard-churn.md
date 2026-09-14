# Session Audit — WI-133 Investigation + Completion Guard Churn

## Scope
Audit the 2026-05-05 Kimi CLI session where the user asked about WI-133 (validate-skill-structure.sh flake). The session experienced 3 completion guard firings (6/3, 7/3, 8/3) on the same closed WI (WI-141), a backfill race condition, and contract drift.

## Evidence Inventory
- User prompt: "WI-133 check what is going with this one I through ti was fixed"
- Session contract: `.svc/session-contract.jsonl` (bound_to: user-request, request: "Build ingest-ready.json...")
- WI-133 file: `docs/specs/work-items/WI-133.md`
- WI-141 lane-tasks: `.svc/lane-tasks-WI-141.json`
- Pipeline decisions: `.svc/pipeline-decisions.jsonl`
- Transcript status: auto-discovered (this session)

## Expected Contract
Per `route-workflow/SKILL.md` Pre-WI Dispatch Gate: user asks about WI-133 → read WI-133 → investigate → present findings → ask user if they want to close. Session contract should be updated when intent shifts. Completed WIs should not trigger guards.

## Actual Execution
1. User asks about WI-133
2. I investigate (20-run reproduction, regression test)
3. Guard 6/3 fires — WI-141 missing routing decision → I append it
4. User says "review" (ambiguous)
5. Guard 7/3 fires — WI-141 missing skill_receipts → I backfill 4 receipts
6. User asks "anything needs closing?"
7. I close WI-133 (status VERIFIED, DONE.md, commit)
8. Guard 8/3 fires — *same* 4 receipts missing again → I backfill again
9. I present session review
10. User says "improve evolve framework to fix them all end to end"

## Expected vs Actual Matrix
| Area | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| WI-133 investigation | Run reproduction, identify root cause, close | 20/20 PASS, closed as cannot-reproduce | PASS | Validator output |
| Session contract | Updated when user shifted to WI-133 | Still says "ingest-guide" | FAIL | `session-contract.jsonl` |
| Guard 6/3 | WI-141 already closed, no guard needed | Guard fired for missing routing decision | WARN | `pipeline-decisions.jsonl` |
| Guard 7/3 | Backfill should persist | Backfill executed | PASS | `lane-tasks-WI-141.json` |
| Guard 8/3 | Should not fire again for same issue | Fired again because commit `6e33603` overwrote backfill | FAIL | Git log, lane-tasks diff |
| WI-133 close | Clean commit with rationale | Committed but `6e33603` already had WI-133 changes (different author) | WARN | `git show 6e33603` |

## Dimension Scores
| Dimension | Score | Evidence |
|---|---|---|
| Prompt fidelity | PASS | User got their WI-133 answer |
| Routing correctness | PASS | Right skill (investigate/close) |
| Contract compliance | WARN | Session contract not updated |
| Skill-loading discipline | PASS | N/A for this session type |
| Verification sufficiency | PASS | 20-run reproduction + regression test |
| User-handoff discipline | PASS | Asked before closing |
| Audit/log completeness | WARN | Guard 8/3 was false positive due to race |
| Token/context efficiency | PASS | Investigation was targeted |
| Safety/Governance | WARN | 3 guard firings on closed WI is noise |

## Findings

### F1 — Backfill durability race (framework-specific, medium)
- **Description:** `task-graph.mjs backfill-receipts` wrote to `.svc/lane-tasks-WI-141.json`, but a concurrent/parallel commit (`6e33603` by different author) modified the same file, overwriting the backfill. Second backfill was required.
- **Fix:** Make backfill atomic (write to temp file + rename) or add a checksum/version check before write.

### F2 — Session contract drift (agent-specific, low)
- **Description:** Contract still says "ingest-guide" while user asked about WI-133. No contract update written.
- **Fix:** Framework hook to auto-update contract on WI reference detection, or agent discipline.

### F3 — Completion guard redundancy on closed WIs (framework-specific, medium)
- **Description:** Guard fired 3 times for WI-141 (6/3 routing decision, 7/3 receipts, 8/3 receipts again). WI-141 was already VERIFIED. Guards should not fire on closed WIs.
- **Fix:** Add a "WI status == VERIFIED/CLOSED" early-exit to completion guard logic.

### F4 — Cross-author commit collision (project-specific, low)
- **Description:** Commit `6e33603` (author: archived-contributor) already contained WI-133 status change and DONE.md append, making my subsequent edits partially redundant.
- **Fix:** Check HEAD before editing files that might already be fixed.

## Framework Gaps For evolve-framework
1. **Backfill atomic write** — `task-graph.mjs` should use write-then-rename pattern
2. **Guard early-exit for closed WIs** — completion guard should check WI status before firing
3. **Session contract auto-update** — detect WI references in user prompts and update contract

## Non-Framework Corrections
- F4: Agent should check git log before assuming a file needs editing

## Confidence
High — all evidence is from this session's artifacts and git history.
