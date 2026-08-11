# Framework Improvement: session continuation honesty + host-trace audit discovery
**Status:** IMPLEMENTED (2026-04-17, commit `3a4c758`)

## Evidence
- **Source:** evolution proposal [2026-04-17-evolution.md](/workspace/seriousvibecoding/proposals/done/2026-04-17-evolution.md:1) grounded in the WI-070 replay and host traces
- **Finding:** `route-workflow` promised `/loop`-backed continuation without a real capability; `audit-session-execution` could call transcript evidence unavailable without host-trace discovery; `project-state.md` Current Focus was not enforced at lane entry/resume
- **Severity:** critical / high / medium bundle

## Diagnosis
- **Root cause:** framework prose had drifted ahead of real host capability. `route-workflow` described a continuation skill that did not exist. `audit-session-execution` assumed transcript evidence had to be user-supplied instead of defining deterministic host-trace discovery. `Current Focus` existed as a template but not as an enforced state transition.
- **Category:** drift + fragility
- **Already in FRAMEWORK-STATE.md?** partially. AP-27 hook-level session-log enforcement was already deferred, but these exact gaps were new and distinct.

## Implementation
- **Route:** direct SKILL.md edits + validator replay
- **Files changed:** `route-workflow/SKILL.md`, `audit-session-execution/SKILL.md`, `svc-advisor/SKILL.md`, `evaluate-rule/SKILL.md`, `test-framework/evals/tier-1/validate-framework-self-management.sh`, `FRAMEWORK-STATE.md`, `references/knowledge/svc/CAPABILITIES.md`, `references/knowledge/svc/details/skills.md`
- **Commits:** `3a4c758` — `improve-framework: add session audit and tighten continuation contracts`

## Replay Verification
- **Replay target:** `bash test-framework/evals/tier-1/validate-framework-self-management.sh`
- **Result:** PASS
- **Evidence:** `210 passed, 0 failed` after the route-workflow, audit-session-execution, and validator updates landed

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add entry for the WI-070 session replay and the three fixed contract gaps
- **Known Gaps:** no existing known-gap entry removed; AP-27 hook enforcement remains a separate deferred item
- **Decisions:** lock active-session-only autorun, mandatory host-trace discovery before transcript unavailability, and Current Focus sync at lane entry/resume
- **Capabilities:** yes — update `references/knowledge/svc/CAPABILITIES.md` to reflect session-scoped autorun and host-trace-aware session auditing
