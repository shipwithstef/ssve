# Framework Evolution — 2026-04-18

**Status:** IMPLEMENTED (2026-04-18, commit `474139e`)

## Method
I read `FRAMEWORK-STATE.md` first to avoid re-proposing already-fixed WI-070 findings. I then checked the doctrine and routing contract against the WI-070 session audit to see whether the remaining resume problem was already enforced elsewhere. Evidence used:

- `FRAMEWORK-STATE.md`
- `DOCTRINE.md`
- `skills-manifest.json`
- `route-workflow/SKILL.md`
- `proposals/2026-04-18-session-audit-wi-070.md`

This is a narrow evolution pass. I found one actionable framework gap and two lower-priority follow-ups. I am not re-proposing the already-fixed WI-070 timestamp and `Current Focus` issues.

## Findings (by priority)

### P0 — Fix now (blocks quality)

| ID | Category | Finding | Evidence | Specific fix |
|---|---|---|---|---|
| P0.1 | Gap | `route-workflow` defines how to resume from the first `in_progress` or `pending` task, but it does not define the closed-state branch for a WI whose task graph has zero actionable tasks and whose WI file is already `VERIFIED`. That leaves room for a user saying "resume WI-070" to trigger work on an already-complete lane instead of returning a closed-WI summary. | `route-workflow/SKILL.md:2243` says "Resume from the first \`in_progress\` task; if none exists, resume from the first \`pending\` task"; `route-workflow/SKILL.md:2463` repeats the same resume rule; `route-workflow/SKILL.md:2409` lists "All tasks completed" as a valid stop reason; `proposals/2026-04-18-session-audit-wi-070.md` documents the real failure mode. | Add an explicit resume pre-check to `route-workflow`: if `lane-tasks-<WI>.json` has no `pending` or `in_progress` tasks and the WI file status is `VERIFIED`, return a closed-state report and do not resume execution unless the user explicitly asks to replay, audit, or reopen. Add tier-1 replay coverage using the WI-070 shape. |

### P2 — Improve when possible (nice to have)

| ID | Category | Finding | Evidence | Specific fix |
|---|---|---|---|---|
| P2.1 | Inefficiency | `route-workflow` has a strong close-WI contract, but the generic resume table still routes `"continue"` / `"resume"` through broad continuity logic rather than explicitly checking whether the named WI is already closed before doing anything else. This encourages unnecessary artifact reading and correction turns even when the answer is "it is already done." | `route-workflow/SKILL.md:1941` maps `"continue"` / `"resume"` to "Check \`project-state.md\` + \`router-context.md\`, resume from current focus"; no earlier line in the resume section mentions an "already closed" short-circuit. | Tighten the resume/continue routing table so that named-WI resume requests first check WI status + task-graph actionable state before general continuity logic. |

### P3 — Track (not actionable yet)

| ID | Category | Finding | Evidence | Specific fix |
|---|---|---|---|---|
| P3.1 | Opportunity | The session audit surfaced an agent-side Base44 status-claim mistake, but there is not enough evidence yet that this needs new framework complexity rather than better agent discipline plus existing repo-contract scans. | `proposals/2026-04-18-session-audit-wi-070.md` finding F4; existing deploy/repo-contract coverage already exists in `route-workflow/SKILL.md` and repo-local `router-context.md`. | Track only. If the same "merged vs synced vs deployed vs verified" confusion recurs across multiple platform-heavy repos, then add a framework-level "status-claim vocabulary" rule. |

## Comparison delta
No meaningful competitor delta was needed for this pass. This is an internal resume-contract enforcement issue, not a missing macro-capability from another skill pack.

## Stale proposal audit
- `proposals/2026-04-18-session-audit-wi-070.md` is fresh evidence and still relevant.
- The earlier WI-070-derived issues already recorded in `FRAMEWORK-STATE.md` should remain closed:
  - task-graph timestamp integrity
  - host-trace discovery before declaring transcripts unavailable
  - `Current Focus` sync/repair on resume
- No stale pending proposal was found for the remaining closed-WI resume gap.
