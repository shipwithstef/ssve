# Framework Improvement: Feature Lane Process Tasks (validate-feature + write-spec)

**Status:** IMPLEMENTED (2026-04-12)

## Evidence

- **Source:** User request during improve-framework session (Example Marketplace context). Post-implementation of diagnose-bug process tasks architecture, user requested the same pattern be applied to the FEATURE lane's first two skills.
- **Finding:** validate-feature and write-spec both have well-defined multi-step processes (8 and 10 steps respectively) implemented as prose only — no file-persisted process task tracking, no stop hook enforcement, no auto-compact resilience, no platform-portable task state.
- **Secondary findings:** Two ordering problems in existing prose steps:
  1. `validate-feature` Step 1 bundled market signal gathering inside Q3/Q4 questions — not surfaced as a distinct pre-step.
  2. `write-spec` Step 0b (mode classification) ran before Step 1 (context scan) — mode cannot be determined before scanning. G0 Scope Review was positioned conceptually before spec assembly.
- **Severity:** medium

## Diagnosis

- **Root cause:** The process_tasks architecture (composite IDs, file-first persistence, skill|phase naming, platform-portable hydration) was implemented for diagnose-bug but not extended to the FEATURE lane. FEATURE lane skills had rich process steps in prose with no enforcement mechanism beyond prose.
- **Category:** missing capability (process task tracking for FEATURE lane)
- **Ordering bugs category:** drift (incorrect step ordering not caught during original authoring)
- **Already in FRAMEWORK-STATE.md?** No (new, post-diagnose-bug)

## Implementation

- **Route:** Direct SKILL.md edits
- **Files changed:**
  - `validate-feature/SKILL.md` — inserted "### 0. Task Graph Setup — MANDATORY" after flowchart, before Step 0
  - `write-spec/SKILL.md` — inserted "### 0. Task Graph Setup" after "## Process" header, before Step 0
  - `FRAMEWORK-STATE.md` — new Analysis History entry (feature lane process tasks)

### validate-feature Task Graph Setup (9 process tasks)

| ID | Name | Skill Step | Notes |
|---|---|---|---|
| {T}.1 | validate-feature\|context-scan | Step 0 | Scan artifacts before anything |
| {T}.2 | validate-feature\|escape-check | HARD-GATE | Dynamic: conditional skip — sets {T}.3–{T}.7 to skipped if standalone/greenfield |
| {T}.3 | validate-feature\|market-check | Step 1 (Q3/Q4 proxy) | last30days + competitor data BEFORE questions |
| {T}.4 | validate-feature\|business-questions | Step 1 (full 8 Qs) | Grounded in real market signals |
| {T}.5 | validate-feature\|brief-present | Step 2 | User review gate |
| {T}.6 | validate-feature\|cross-validate | Step 3 | Spec/journey alignment |
| {T}.7 | validate-feature\|ship-decision | Step 3b | K1–K7 kill signals → verdict |
| {T}.8 | validate-feature\|route | Step 4 | Write WI + route |
| {T}.9 | validate-feature\|finalize | (meta) | JSON update + lane task completion |

### write-spec Task Graph Setup (10 process tasks)

| ID | Name | Skill Step | Notes |
|---|---|---|---|
| {T}.1 | write-spec\|type-classify | Step 0 | Feature/Enabler/Integration |
| {T}.2 | write-spec\|context-scan | Step 1 + Step 0b | Scan THEN derive mode — fixes ordering bug |
| {T}.3 | write-spec\|problem-frame | Step 2 | Problem statement + goals |
| {T}.4 | write-spec\|story-draft | Step 3 | User stories |
| {T}.5 | write-spec\|ac-draft | Step 4 | Acceptance criteria |
| {T}.6 | write-spec\|dep-check | Step 5 | Dependencies |
| {T}.7 | write-spec\|spec-assemble | Steps 6–8 | Write spec + journey sync + refs + Pillars Matrix |
| {T}.8 | write-spec\|scope-review | G0 Scope Review | In-place revision AFTER spec assembled (NOT a loop) |
| {T}.9 | write-spec\|dep-queue | Step 9 | Dependency WI registration |
| {T}.10 | write-spec\|finalize | Step 10 | Handoff + lane-tasks update |

### Architectural decisions

**Graph ownership split:**
- validate-feature OWNS the lane-tasks-WI.json file (creates it, embeds its own process_tasks)
- write-spec EMBEDS its process_tasks into Task {T}'s entry when it runs (three-case logic: already there / JSON exists but no process_tasks / standalone)

**Two dynamic task patterns named:**
- "conditional skip" — validate-feature {T}.2 (escape-check): if escape-hatch fires, sets {T}.3–{T}.7 to `status:skipped`, jumps to {T}.8
- "in-place revision" — write-spec {T}.8 (scope-review): if G0 prime directive fires, revises spec file as part of {T}.8's own work — does NOT reset prior tasks, is NOT a loop

**{T} notation:** All instructions use `{T}` for lane task ID, making them position-independent (validate-feature=5 in full lane, =1 standalone; write-spec=6 in full lane, =2 standalone).

**Ordering bug fixes:**
- validate-feature: market-check ({T}.3) separated as distinct step BEFORE business questions ({T}.4)
- write-spec: context-scan ({T}.2) merges and reorders old Step 0b — scan first, mode derived as conclusion
- write-spec: scope-review ({T}.8) runs AFTER spec-assemble ({T}.7) — critique requires a real draft

## Replay Verification

- **Replay target:** Next validate-feature and write-spec invocations should produce a lane-tasks-WI.json with process_tasks arrays and hydrate them into the Claude task system.
- **Result:** PENDING — live execution verification
- **Evidence:** SKILL.md edits verified by reading insertion points before and after. Design confirmed by advisor consultation during session (no loop for scope-review, {T} notation for position independence).

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Added "2026-04-12: feature lane process tasks — validate-feature and write-spec" entry with gaps, fixes, and decisions
- **Known Gaps → Fixed:** N/A (not a previously deferred gap)
- **Decisions:** Two dynamic task pattern types named (conditional-skip, in-place-revision); write-spec EMBEDS rather than OWNS graph; {T} notation standard for position-independent instructions
- **Capabilities:** No new skill added; existing skills enhanced
