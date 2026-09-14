# write-spec — Process details (Steps 7-10, cascade, anti-patterns, revision logs, audit mode, recovery)

### Step 7: Trigger Journey Sync

After the spec is saved, invoke `write-journeys` to create or update journeys.

**For Features:** User journeys with UI steps + system steps marked as dependencies.

**For Enablers:** System journeys with service interactions, triggers, and SLA verification.

**For Integrations:** Contract journeys with request/response flows, error handling, and timeout behavior.

**What to expect back:**
- Journey file(s) referencing the AC IDs from Step 4
- Layer 3 analysis findings:
  - **Contradictions** → fix in spec
  - **Missing transitions** → add stories or ACs
  - **Ungrounded preconditions** → create enabler spec (recursive)
  - **Concept fragmentation** → consolidate naming in spec

**Loop:** If Layer 3 reveals gaps, go back to Steps 3-4 and fix the stories/ACs. Re-run write-journeys. Repeat until Layer 3 is clean or remaining issues are flagged as known dependencies.

**Recursive spec creation:** When Layer 3 flags an ungrounded precondition that needs its own enabler spec, queue it. Complete the current spec first, then create the enabler spec using this same skill. The dependency chain builds top-down — Features reveal Enablers, Enablers reveal other Enablers and Integrations.

### Step 8: Update Journey References

After write-journeys completes, update the spec's Journey References section:

```markdown
## Journey References

| Journey | Scenarios | ACs Covered | Type |
|---------|-----------|-------------|------|
| J05: Match discovery flow | Scenario 1, 3 | MATCH-01, MATCH-02, MATCH-05 | User |
| J12: Score recalculation | Scenario 1 | RECALC-01, RECALC-02 | System |
```

### Step 9: Dependency Spec Queue

If Steps 5 or 7 revealed missing dependency specs, present the queue:

```
Missing dependency specs to create:
  1. feature-email-service.md (Enabler) — needed by: MATCH-03, J05 step 3
  2. feature-stripe-integration.md (Integration) — needed by: US-3, J05 step 7

Create these now? (Each goes through write-spec → design-ux → design-ui → design-tech → plan-changeset → execute-changeset → land-changeset → verify-promotion)
```

This is how a single feature request cascades into the full system specification. The user approves which dependencies to spec now vs defer.

### Step 10: Handoff

The DRAFT spec is complete. Present a summary:

```
Feature spec saved: docs/specs/features/<feature-name>.md
Status: DRAFT
Type: [Feature | Enabler | Integration]
Stories: N user stories, M acceptance criteria
Journeys: [list of journey files created/updated]
Layer 3 issues: [resolved count] resolved, [open count] flagged as dependencies
Dependency queue: [count] enabler/integration specs to create

Ready for UX design. Next step:
  "Run design-ux against docs/specs/features/<feature-name>.md"
```

**The terminal state is invoking design-ux.** This skill does not write code, choose technologies, or make architecture decisions.

## The Cascade Effect

This is what makes svc's approach different from traditional spec writing. In traditional development, you spec the feature and hand-wave the infrastructure. In svc, specifying a feature **automatically reveals** every enabler and integration it depends on:

```
User says: "I want match recommendations"
    ↓
write-spec creates: feature-match-discovery.md (Feature)
    ↓ Layer 3 finds ungrounded preconditions:
write-spec creates: feature-score-recalculation.md (Enabler)
write-spec creates: feature-notification-service.md (Enabler)
    ↓ Layer 3 finds more:
write-spec creates: feature-email-delivery.md (Integration)
    ↓
Full system specified. Nothing hand-waved.
```

Each spec is its own file (agent-friendly: parallel processing, clean diffs, targeted reads). Each links to the others through System Dependencies and Journey References. The chain is traceable end-to-end.

**This is the vibe code era improvement:** The agent doesn't just implement what you ask — it discovers what you need. The spec process itself is the architecture discovery tool.

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Skip enabler specs ("it's just a cron") | Unspecified plumbing is where production breaks | Every shipping component gets a feature spec |
| Write implementation details in stories | Couples requirements to a solution | Describe consumer intent, let downstream design skills choose the how |
| Skip personas for Features | Stories become generic, untestable | Reference P*.md personas or flag their absence |
| Write ACs as steps | Steps describe procedure, not criteria | Write assertions: "User sees X" not "User clicks Y then sees X" |
| Create one giant story | Untestable, no granularity | Split by consumer goal — one goal per story |
| Skip write-journeys | Miss hidden dependencies between features | Always run it — Layer 3 finds what humans miss |
| Add technical design | Not this skill's job | Leave Technical Design empty for design-ux and beyond |
| Hand-wave dependencies | "We'll figure out the email service later" | Create the enabler spec now or explicitly defer with reasoning |
| Put everything in one spec file | Agents work better with focused files | One spec per feature, cross-reference by ID |

## AC Revision Log

When any downstream skill revises an AC (feasibility issue in tech design,
implementation discovery, journey gap), the revision must be logged in the
spec under `## Revision Log`:

```markdown
## Revision Log

| Date | AC | Was | Now | Why | By skill |
|------|----|-----|-----|-----|----------|
| 2026-04-05 | AC-03 | "Items sync in real-time" | "Items sync within 5s via polling" | WebSocket adds disproportionate complexity for MVP scope | design-tech |
| 2026-04-05 | AC-07 | (new) | "User sees sync indicator during poll interval" | Added to cover the UX gap introduced by AC-03 revision | execute-changeset |
```

**Rules:**
1. Never silently change an AC — every change gets a log entry
2. Include which skill made the revision and WHY
3. If a revision adds a new AC, log it as `(new)` in the "Was" column
4. If a revision removes an AC, log it as `(removed)` in the "Now" column
5. `audit-implementation` checks the revision log against the implementation —
   every revision should be reflected in the code

The AC table remains the single source of truth. The revision log is the
audit trail of how it got there. This is how the system learns across layers
without throwing away downstream work.

## Routing

| Situation | Route to |
|-----------|----------|
| Spec complete, ready for UX design | `design-ux` |
| Layer 3 reveals missing persona | `build-personas` (then return) |
| Layer 3 reveals concept fragmentation | Fix in spec, then re-run `write-journeys` |
| Layer 3 reveals dependency on unbuilt feature | Create enabler spec (this skill, recursive) |
| User wants to validate the feature idea first | `validate-feature` (then return here) |
| Spec exists but ACs are weak/missing | `audit-ac` (can run standalone) |
| Dependency queue approved | Run this skill again for each queued spec |

### Auto-Invoke On-Demand Skills

Based on signals detected during spec authoring, conditionally insert these skills:

| Signal | Skill | Insertion Point | Why |
|--------|-------|-----------------|-----|
| Layer 3 reveals competitive differentiators or product-market fit angles not yet in marketing context | `analyze-marketing` | After Layer 3 completion, before design-ux handoff | Marketing ammunition must be captured while product positioning is fresh |
| Unknown domain concept, API, or competitor behavior encountered during spec research | `research` | Inline before the spec section that needs the answer | Prevents spec decisions based on incomplete domain knowledge |

If any on-demand skill is inserted, update `.svc/lane-tasks-<WI>.json` with the new task and set `blocked_by` so downstream work waits for the on-demand skill's output. Log the insertion as a `mechanical` decision in `.svc/pipeline-decisions.jsonl`.

## Audit Mode

When invoked with `--audit` to review existing feature specs:

1. Glob `docs/specs/features/*.md` (exclude briefs)
2. For each spec:
   - Vision-to-spec traceability: every vision concept has ≥1 AC?
   - Zero-state AC exists for Feature type?
   - AC table uses shared contract format?
   - No compound ACs?
   - System Dependencies section present?
   - Status is valid lifecycle value?
3. Report: spec-by-spec PASS/WARN/FAIL with specific gaps


## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.


## Phase receipt commands

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ContextAndModeSelection --evidence command_output:.svc/write-spec-context-mode.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-DiscussionPreflightAndAlternatives --evidence command_output:.svc/write-spec-discussion-alternatives.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-StoryAcceptanceCriteriaDraft --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ScopeReviewDecisionLog --evidence command_output:.svc/write-spec-scope-review.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-JourneySyncDependencyQueue --evidence command_output:.svc/write-spec-journey-sync.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyHandoff --evidence command_output:.svc/write-spec-self-verify.log
```
