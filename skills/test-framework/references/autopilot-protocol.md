# Autopilot Protocol

The autopilot is a continuous loop that runs svc end-to-end on real
scenarios, producing running applications. Every scenario opens worktrees,
executes all pipeline skills, starts a live server, runs E2E tests, compares
against obra and raw baselines, fixes gaps in SKILL.md files, and cleans
up. No simulations. No hedging. Real output or a bug to fix.

## Outer Loop

```
OUTER LOOP (per scenario):
  1. PICK         -> choose scenario (built-in or auto-suggested from gaps)
  2. OPEN         -> git worktree add /tmp/svc-test-{scenario-id} main
  3. EXECUTE      -> run ALL pipeline skills in pipeline order inside the worktree
                     Phase 7 produces FULL runnable code (all 8 parts)
                     land-changeset writes files into the worktree
  4. START SERVER -> cd into worktree, npm install, npm start
                     Wait for http://localhost:3000 to respond (max 15 retries, 2s apart)
                     If server fails: fix Phase 7 output, try again (max 3 fix attempts)
  5. TEST LIVE    -> sync-spec-code against source files in the worktree
                     test-journeys against the live server
                     write-e2e generates AND RUNS tests against localhost
  6. COMPARE OBRA -> open second worktree (/tmp/svc-test-{id}-obra)
                     brainstorm -> plan -> execute (parallel agents) -> running app on port 3001
                     Same scenario, same ACs to measure against
  7. COMPARE RAW  -> open third worktree (/tmp/svc-test-{id}-raw)
                     Single prompt -> code -> running app on port 3002
                     Same scenario, same ACs to measure against
  8. MEASURE      -> three-way delta (ACs, edge cases, tokens, coverage, time)
  9. FIND GAPS    -> which skills produced weak output? which handoffs lost info?

  INNER LOOP (per gap found):
    9a. DIAGNOSE  -> which skill's SKILL.md has the deficiency?
    9b. FIX       -> edit the SKILL.md to close the gap
    9c. RE-RUN    -> re-execute the fixed skill on this scenario
    9d. VERIFY    -> did the fix close the gap? If not, back to 9a (max 3 attempts)
    9e. COMMIT    -> fix({skill-name}): {what was wrong and how it's fixed}

  10. CLOSE       -> merge worktrees to main or create PR with findings
                     git worktree remove for ALL three worktrees
                     Never leave orphaned worktrees
  11. SUGGEST     -> auto-pick next scenario based on coverage gaps
  -> repeat OUTER LOOP until completion criteria met or token budget exhausted
```

## Worktree Lifecycle

Every scenario runs inside git worktrees. No exceptions.

### Single-Approach Worktree

```bash
git worktree add /tmp/svc-test-{scenario-id} main
# ... all pipeline skills execute inside this worktree ...
# ... server starts from this worktree ...
git worktree remove /tmp/svc-test-{scenario-id}
```

### Three-Way Comparison Worktrees

```bash
git worktree add /tmp/svc-test-{id}-svc main
git worktree add /tmp/svc-test-{id}-obra main
git worktree add /tmp/svc-test-{id}-raw main
```

Each worktree gets its own server on a different port:
- Serious Vibe Coding: port 3000
- Obra: port 3001
- Raw: port 3002

Clean up ALL worktrees when the scenario completes. If a worktree fails to
remove (uncommitted changes), force-remove it. Orphaned worktrees are bugs.

## Scenarios

### Scenario Types

| Type | Description | Tests |
|------|-------------|-------|
| `greenfield` | Start from zero, user gives high-level goal | Full pipeline, cascade, all phases |
| `iteration` | Add feature to existing project | Convert mode, preserve existing |
| `adversarial` | Intentionally ambiguous/complex request | Edge cases, error handling |
| `comparison` | Same feature via svc vs obra vs raw | Quality/cost tradeoff |
| `skill-isolation` | Test one specific skill deeply | Skill-specific edge cases |

### Built-in Scenarios

```json
[
  {
    "id": "S1",
    "type": "greenfield",
    "prompt": "I want to make an app that suggests what to learn for AI based on what is trendy in social platforms today. Three deployment modes: (1) self-hosted free -- anyone can run it themselves at no cost, (2) hosted for profit -- someone hosts it and charges their users a subscription to use the tool, (3) self-hosted private -- a company hosts it internally for their own team's use.",
    "complexity": "high",
    "expected_features": ["trend scraping", "content recommendation", "user profiles", "skill tracking", "learning paths"],
    "expected_enablers": ["scraping service", "recommendation engine", "content aggregator", "trend analyzer"],
    "expected_integrations": ["social media APIs (Twitter/X, Reddit, HN, LinkedIn, YouTube)", "LLM provider API"],
    "deployment_modes": ["self-hosted free (BYOK)", "hosted for profit (SaaS)", "self-hosted private (enterprise)"]
  },
  {
    "id": "S2",
    "type": "greenfield",
    "prompt": "Build a team retrospective tool where team members submit feedback anonymously, an AI summarizes themes, and the manager gets action items.",
    "complexity": "medium",
    "expected_features": ["anonymous submission", "AI summary", "action items dashboard"],
    "expected_enablers": ["LLM summarization service"],
    "expected_integrations": ["LLM API"]
  },
  {
    "id": "S3",
    "type": "iteration",
    "prompt": "Add real-time collaboration to the existing todo-api -- multiple users can see each other's changes live.",
    "complexity": "medium",
    "base_project": "examples/todo-api",
    "expected_enablers": ["websocket service", "presence tracking"]
  },
  {
    "id": "S4",
    "type": "adversarial",
    "prompt": "Make it faster and better.",
    "complexity": "ambiguous",
    "expected_behavior": "Skill should ask clarifying questions, not proceed blindly"
  },
  {
    "id": "S5",
    "type": "skill-isolation",
    "prompt": "Run each svc skill on the todo-api and report what each produces.",
    "complexity": "systematic",
    "skills_to_test": "all"
  }
]
```

## User Simulation

When a svc skill asks a question (validate-feature business questions,
brainstorming clarifications, review approvals), the autopilot responds as
the user based on the scenario context.

### Response Strategy

The autopilot uses the scenario's prompt and expected outputs to generate
reasonable user responses:

```
Skill asks: "What personas will use this feature?"
Scenario context: AI learning app, self-hostable
Autopilot responds: "Two main users -- individual learners who self-host
for free, and teams/companies who pay for hosted version."
```

### Response Rules

1. Stay consistent with the scenario prompt -- do not invent new requirements
2. When asked for preferences, choose the simpler option (faster testing)
3. When asked for approval, approve if the output looks reasonable
4. When asked to clarify ambiguity, provide ONE clear answer (do not ramble)
5. Log every simulated response for review

## Three-Way Comparison Protocol

Every scenario produces THREE running applications from THREE approaches.

### Approach 1 -- Serious Vibe Coding (full 19-skill pipeline)

1. Open worktree: `/tmp/svc-test-{id}-svc`
2. Run all pipeline skills in pipeline order (see Full Skill Invocation Order)
3. Phase 7 produces full code (all 8 parts)
4. `npm install && npm start` on port 3000
5. Run E2E tests against localhost:3000

### Approach 2 -- Obra/Superpowers (brainstorm-plan-execute)

1. Open worktree: `/tmp/svc-test-{id}-obra`
2. Invoke `superpowers:brainstorming` with the scenario prompt
3. Invoke `superpowers:writing-plans` with the brainstorm output
4. Invoke `superpowers:executing-plans` with the plan
5. Use `superpowers:dispatching-parallel-agents` for independent tasks
6. `npm install && npm start` on port 3001
7. Run same E2E tests against localhost:3001

### Approach 3 -- Raw (single prompt)

1. Open worktree: `/tmp/svc-test-{id}-raw`
2. One prompt: "Build [scenario description]. Produce a complete, runnable Node.js application."
3. No methodology, no phases, no review
4. `npm install && npm start` on port 3002
5. Run same E2E tests against localhost:3002

### Measurements (per approach)

| Metric | How to measure |
|--------|---------------|
| ACs satisfied | Check each AC from the svc spec against the running server |
| Edge cases handled | Count error handlers, validation, boundary checks in code |
| Token cost | Sum total_tokens from all sub-agent task notifications |
| Test coverage | Run unit tests, report pass/fail counts |
| Time to running server | Wall clock from first prompt to server responding |
| Code structure | Count files, modules, separation of concerns |
| E2E pass rate | Run Playwright tests against each server |

Report format: side-by-side table in `comparison.json` and `comparison.md`.
The comparison is the core value proposition -- it proves (or disproves)
that svc produces better output.

## KPIs and Metrics

### Per-Skill Metrics

| Metric | How | Why |
|--------|-----|-----|
| `tokens_consumed` | Task notification total_tokens | Cost per skill invocation |
| `wall_time_ms` | Task notification duration_ms | Latency per skill |
| `artifacts_produced` | Count output files | Productivity measure |
| `ac_count` | Count AC rows in produced specs | Specificity measure |
| `cascade_depth` | Count Feature->Enabler->Integration chain | Dependency discovery depth |
| `cross_references` | Count links between artifacts | Glue quality |
| `errors_in_output` | Review-protocol findings on output | Quality measure |

### Per-Phase Metrics

| Metric | How | Why |
|--------|-----|-----|
| `phase_context_tokens` | Count lines loaded per phase | Cache efficiency |
| `phase_artifacts_read` | Count files read | Loading discipline |
| `phase_code_loaded` | Whether code was loaded in Phases 3-6 | Spec-as-index compliance |
| `handoff_integrity` | Does output match next phase's expected input | Glue check |

### Comparison Metrics

| Metric | Serious Vibe Coding | Obra | Raw | Unit |
|--------|-----------|------|-----|------|
| `total_tokens` | N | N | N | tokens |
| `total_time` | N | N | N | ms |
| `ac_count` | N | N | N | count |
| `edge_cases_caught` | N | N | N | count |
| `e2e_pass_rate` | N | N | N | percentage |
| `test_coverage` | N | N | N | percentage |
| `time_to_server` | N | N | N | seconds |

### Glue Metrics (Skill-to-Skill)

These verify the pipeline has no holes:

| Transition | Check |
|------------|-------|
| write-spec -> design-ux | UX design references spec AC IDs |
| design-ux -> design-ui | UI design references UX screens |
| design-ui -> design-tech | Tech design references UI components |
| design-tech -> plan-changeset | Change set covers all tech design components |
| plan-changeset -> land-changeset | Manifest lists all changed files |
| land-changeset -> verify-promotion | sync-spec-code finds the RESOLVED items |
| review-gate at each gate | Findings are actionable, not theater |

### Doctrine Verification

| Claim | Metric | Pass Criteria |
|-------|--------|--------------|
| C1: Progressive narrowing | variance across 3 runs | svc pairwise diffs < raw pairwise diffs |
| C2: Spec-as-index | token ratio: spec-indexed vs full-codebase | spec-indexed tokens < 50% of full-codebase |
| C3: Cache optimization | total_tokens across sequential tasks | prescribed-order < random-order on runs 2-3 |
| C4: Review catches more | error detection count | full protocol > single-pass |
| C5: Checkpoints prevent drift | AC match rate | with-checkpoint > without |
| C6: Cascade discovery | enabler count | >= 2 enablers auto-discovered |
| C7: Worktree isolation | shared file changes in parallel worktrees | zero cross-contamination |

All 7 claims are testable. If a claim cannot be tested, downgrade or remove
it from the doctrine. Do not report anything as "structurally untestable."

## Full Skill Invocation Order

When running a scenario, execute ALL pipeline skills in this order:

| # | Skill | Phase | Input | Output |
|---|-------|-------|-------|--------|
| 1 | `write-vision` | Foundational | Scenario prompt | `docs/specs/vision.md` |
| 2 | `build-personas` | Foundational | Vision | `docs/specs/personas/P*.md` |
| 3 | `route-workflow` | Routing | Project state | Confirms next skill |
| 4 | `validate-feature` | Discovery | Vision + personas + prompt | Feature Ship Brief |
| 5 | `write-spec` | Phase 3 | Ship Brief | Feature spec (DRAFT) + cascade specs |
| 6 | `audit-ac` | Phase 3 | Feature specs | Audited AC tables |
| 7 | `write-journeys` | Phase 3 | Specs + personas | Journey docs (J*.feature.md) |
| 8 | `design-ux` | Phase 4 | DRAFT spec + personas + journeys | UX design doc |
| 9 | `design-ui` | Phase 5 | UX design + spec | UI design doc + design-system.md |
| 10 | `design-tech` | Phase 6 | DESIGNED spec + all designs | BASELINED spec |
| 11 | `review-gate` | Gate G4 | BASELINED spec | Findings (self + cross) |
| 12 | `plan-changeset` | Phase 7 | BASELINED spec + designs | Code in worktree + manifest |
| 13 | `land-changeset` | Phase 8 | Change set | Promoted code on branch |
| 14 | `verify-promotion` | Phase 9 | Promoted code + specs | Verification report |
| 15 | `sync-spec-code` | Verification | Specs + code | RESOLVED/DRIFT annotations |
| 16 | `test-journeys` | Verification | Journeys + live server | QA column updates |
| 17 | `write-e2e` | Verification | Journeys + ACs | E2E test files |
| 18 | `analyze-marketing` | Marketing | Feature specs | Marketing context doc |
| 19 | `test-framework` | Meta | All outputs | Coverage + metrics report |

For skill 16 (test-journeys): the server MUST be running. Start it
from Phase 7 code before invoking this skill.

For skill 17 (write-e2e): generates AND RUNS Playwright tests
against the live server.

For skill 18 (analyze-marketing): run Mode 4 (Foundation) then
Mode 2 (Single Feature).

## Self-Improvement Protocol

When the autopilot finds a gap, **route through the framework lane** — do not
edit SKILL.md files directly from inside autopilot.

1. **Detect** the gap (failing scenario, benchmark regression, missing capability)
2. **Route to `improve-framework`** which orchestrates:
   - Reads FRAMEWORK-STATE.md
   - Diagnoses via evolve-framework
   - Picks implementation route
   - Implements the fix
3. **Replay** the original failing scenario via test-framework
4. **Update FRAMEWORK-STATE.md** with what was found and fixed
5. **Produce** `proposals/<date>-framework-improvement.md` with structured record, then move to `proposals/done/` after implementation

**Only exception:** single-line typo/wording fixes can be committed directly.
Anything structural goes through improve-framework.

The autopilot's job is evidence and replay. improve-framework's job is fixing.

## Output Structure

```
test-framework/results/YYYY-MM-DD-HHMMSS/
  scenario-{id}/
    svc/
      worktree-path.txt       <- path to worktree used
      phase-*/                <- artifacts from each phase
      server-log.txt          <- stdout/stderr from npm start
      metrics.json            <- per-skill token/time/artifact counts
      glue-check.json         <- skill-to-skill handoff verification
      user-responses.json     <- simulated user responses logged
    obra/
      worktree-path.txt
      server-log.txt
      metrics.json
    raw/
      worktree-path.txt
      server-log.txt
      metrics.json
    comparison.json           <- three-way metrics
    comparison.md             <- human-readable comparison
    e2e-results.json          <- Playwright test results per approach
  aggregate/
    all-scenarios.json        <- combined metrics across all scenarios
    doctrine-evidence.json    <- claim-by-claim numerical evidence
    skill-coverage.json       <- 19/19 must be REAL, not simulated
    improvements.json         <- SKILL.md edits made during this run
```

## Completion Criteria

The autopilot is DONE when ALL of these are true:

- [ ] All greenfield pipeline skills (per `bootstrapStartSequence`) produced REAL output (no simulations, no outlines, no hedging)
- [ ] Server runs and responds to HTTP requests from generated code
- [ ] E2E tests execute against the live server (pass or fail -- but they RUN)
- [ ] Three-way comparison completed (svc vs obra vs raw) with numerical results
- [ ] At least 1 SKILL.md improvement committed (a real fix, not a formatting change)
- [ ] All 7 doctrine claims tested with numerical evidence
- [ ] Worktree opened and closed cleanly for every scenario
- [ ] At least 2 scenarios completed (1 greenfield, 1 iteration)
- [ ] Results written to `test-framework/results/` with timestamps
- [ ] Comprehensive comparison report produced

## Statistical Rigor

Single runs prove nothing. For any generative suite, run N times (default
N=3) and report:

- Mean, standard deviation, 95% confidence interval
- Effect size (Cohen's d): < 0.2 negligible, 0.2-0.5 small, 0.5-0.8 medium, > 0.8 large
- If CI crosses the null hypothesis, increase N and re-run

A claim is SUPPORTED only when the 95% CI lower bound is on the correct
side of the null hypothesis. Otherwise the result is INCONCLUSIVE and
requires more runs.

## Convert Mode Testing

Bootstrap (greenfield) and convert (iteration) exercise different skill
behaviors. Test both.

| Skill | Bootstrap | Convert | Key difference |
|-------|-----------|---------|----------------|
| write-vision | Create from scratch | Proposal with Evidence Table + Approval Gate | Never overwrites existing |
| build-personas | Mode 7 (Auto-Discovery) | Mode 3 (Add New) or Mode 4 (Expand) | Incremental |
| validate-feature | No existing specs | Cross-validates against existing ACs | Validates before creating |
| write-spec | Clean slate | References existing ACs across features | Cross-feature references |
| sync-spec-code | Nothing to sync | Checks existing VERIFIED specs for drift | Finds real inconsistencies |
| write-journeys | Mode 1 (Bootstrap) | Mode 2 (Expand) with prerequisite chaining | Extends, does not replace |

Run at least one convert-mode scenario (S3: add real-time collab to
todo-api) to cover these behaviors.

## Loop Control

The autopilot runs until completion criteria are met or:
- Token budget exhausted (report what was achieved and what remains)
- User interrupts (save state, report progress)
- 3 consecutive scenarios with zero new findings (satisfied -- stop)

After each scenario, decide what to run next:
1. If a skill was never tested -> pick scenario that exercises it
2. If a glue boundary failed -> re-run the two adjacent skills after fix
3. If all skills passed -> generate adversarial scenario (ambiguous prompt, edge case)
4. If iteration mode untested -> run scenario S3 (add feature to existing project)
5. If marketing untested -> run scenario with B2B angle (exercises marketing insights)
6. If token budget is low -> run only the highest-priority uncovered skill + report gaps

If a skill cannot produce real output, that is a pipeline bug. Fix the
pipeline. Do not downgrade the skill to "interface-tested" and move on.

## Anti-Patterns

| Do NOT | Instead |
|--------|---------|
| Call a skill "simulated" or "interface-tested" | Fix the pipeline so the skill runs for real |
| Produce specs without code | Phase 7 must generate all 8 code parts |
| Document gaps instead of fixing them | Edit the SKILL.md, re-run, verify |
| Skip the three-way comparison | Always run svc vs obra vs raw |
| Leave worktrees unclosed | Always clean up: merge, PR, or remove |
| Hedge with "may," "could consider," "if possible" | State what MUST happen, then do it |
| Report "STRUCTURALLY UNTESTABLE" | Build the infrastructure or downgrade the claim |
| Run only static checks and call it "tested" | Run live tests against running code |
| Accept zero SKILL.md fixes as a valid run | At least 1 real improvement per autopilot run |
