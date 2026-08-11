---
name: test-framework
version: "1.0"
description: Test and benchmark the svc framework end-to-end. Use when you need to verify the pipeline works, prove doctrine claims, measure token efficiency, validate progressive narrowing, or run the autopilot that continuously tests all skills against real scenarios. Triggers on "test the framework", "prove it works", "benchmark svc", "validate the pipeline", "run autopilot", "test all skills", "check for holes", or any request to verify svc's methodology. Also use when comparing svc against obra/gstack/raw approaches.
phases:
  - id: P1-TestModeSelection
    trigger: always
    reads: ["task request", "skills/test-framework/SKILL.md", "references/autopilot-protocol.md"]
    writes: [".svc/test-framework-mode.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-StaticOrScenarioRunnerExecution
    trigger: static-or-scenario-mode
    reads: ["test-framework/evals/", "skills-manifest.json"]
    writes: ["test-framework/results/", "test-framework/evals/results/"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-LiveAutopilotOrComparisonExecution
    trigger: live-autopilot-or-comparison-mode
    reads: ["worktree paths", "scenario definitions", "running server endpoints"]
    writes: ["test-framework/results/"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-MethodologyUsageAudit
    trigger: comparison-mode
    reads: ["approach invocation logs", "methodology docs", "comparison artifacts"]
    writes: ["test-framework/results/"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ResultsPersistenceGapRouting
    trigger: always
    reads: ["test results", "FRAMEWORK-STATE.md", "failing gaps"]
    writes: ["test-framework/results/", "FRAMEWORK-STATE.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["test-framework/results/", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional: []
outputs:
  produces:
    - { path: "test-framework/results/", artifact: test-results }
chain:
  lanes:
    framework: { position: 1 }
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Framework Test

End-to-end testing that produces running applications, not documents about running applications. Every test ends with a live server responding to requests, E2E tests executing against it, and a three-way comparison proving svc produces better output than alternatives.

**Announce at start:** "I'm using the test-framework skill to test and benchmark svc."

## Modes

| Mode | Command | What it does |
|------|---------|-------------|
| `static` | `bash test-framework/evals/run-all-evals.sh --tier1` | Pipeline integrity, doctrine checks. No LLM. Use this for everyday verification. |
| `live` | `bash test-framework/scripts/run-all.sh --include-live` | Probes a pre-existing server left from a prior comparison run (looks for `/tmp/svc-test-{svc\|raw\|obra}`). Does NOT generate code or start a server. SKIP if no worktree exists from a recent comparison run. |
| `autopilot` | "Run test-framework autopilot on scenario S1" | Doc-phase autopilot (skills 1–12): worktree per scenario, pipeline skills produce real artifacts through plan-changeset. Skills 13–17 (land-changeset → write-e2e) require a running server and are currently logged as SIMULATED. Three-way comparison is a manual step (see Fairness Rules). Read `references/autopilot-protocol.md` for scenario definitions and KPIs. |
| `comparison` | "Compare svc vs obra vs raw on [feature]" | Three approaches, same feature, measure delta. **Requires manual foreground orchestration** — cannot be automated. Each approach must run as a separate foreground conversation so interactive skills (AskUserQuestion, review loops) work correctly. See Fairness Rules. |
| `scenario` | `bash test-framework/evals/tier-2/run-tier2.sh` | LLM-driven scenario tests: runs `claude -p` with a skill prompt against a scaffolded workspace and asserts on output structure. ~50K tokens/scenario. Requires `claude` CLI. |
| `skill-test` | *(not yet implemented)* | Planned: single skill, multiple variants, real output required. No runner exists yet. |

## Autopilot Mode

### Worktree Lifecycle

Every scenario runs inside a git worktree. No exceptions.

1. **Open:** `git worktree add /tmp/svc-test-{scenario-id} main`
2. **Work:** All greenfield pipeline skills (per `skills-manifest.json bootstrapStartSequence`) execute inside the worktree. All generated code lands there.
3. **Close:** Either merge to main (`git merge`) or create a PR with findings (`gh pr create`). Then `git worktree remove`.

For three-way comparison, open THREE worktrees:
- `/tmp/svc-test-{id}-svc`
- `/tmp/svc-test-{id}-obra`
- `/tmp/svc-test-{id}-raw`

Clean up all worktrees when the scenario completes. Never leave orphaned worktrees.

### The Loop

```
LOOP:
  1.  PICK scenario (start with S1, or auto-suggest based on gaps)
  2.  OPEN worktree from main
  3.  RUN all pipeline skills in pipeline order
      - Phase 7 produces FULL runnable code (all 8 parts)
      - land-changeset writes files into the worktree
  4.  START server
      - cd into worktree
      - npm install (or equivalent)
      - npm start (or node src/index.js)
      - Wait for http://localhost:3000 to respond
      - If server fails to start: fix the code, re-run Phase 7, try again (max 3 attempts)
  5.  TEST live
      - sync-spec-code against actual source files in the worktree
      - test-journeys against the live server
      - write-e2e generates AND RUNS tests against localhost
  6.  COMPARE: obra approach
      - Open second worktree
      - Run brainstorm -> plan -> execute (parallel agents) -> running app
      - Same scenario, same ACs to measure against
  7.  COMPARE: raw approach
      - Open third worktree
      - Single prompt -> code -> running app
      - Same scenario, same ACs to measure against
  8.  MEASURE three-way delta
      - ACs satisfied (count per approach)
      - Edge cases handled (count per approach)
      - Token cost (total per approach)
      - Test coverage (lines/branches if measurable)
      - Time to running server (wall clock per approach)
  9.  FIND gaps in skills
      - Which skills produced weak output?
      - Which handoffs lost information?
      - Which ACs were missed?
  10. FIX: edit SKILL.md, re-run the skill, verify the fix
      - If the fix breaks something else, revert and try differently
      - Max 3 fix attempts per gap before flagging for human review
  11. COMMIT fixes with descriptive message
  12. SUGGEST next scenario based on coverage gaps
  13. CLOSE worktrees (merge or PR), clean up
  -> Repeat until completion criteria met or token budget exhausted
```

### What "Full Running App" Means

Phase 7 (plan-changeset) produces ALL 8 parts. Not just types. Not just a spec. The change set IS the codebase.

| Part | Contents | Required |
|------|----------|----------|
| `part-01-types` | TypeScript interfaces, enums, shared types | Yes |
| `part-02-data-model` | Database migrations, schema files, seed data | Yes |
| `part-03-tests-unit` | Unit tests written BEFORE implementation (TDD) | Yes |
| `part-04-services` | Backend business logic, domain services | Yes |
| `part-05-api-routes` | Route handlers, middleware, validation | Yes |
| `part-06-components` | Frontend components (if the scenario has UI) | If applicable |
| `part-07-tests-e2e` | Playwright E2E test files | Yes |
| `part-08-config` | package.json, tsconfig.json, docker-compose.yml, .env.example | Yes |

land-changeset writes ALL files into the worktree. Then:

```bash
cd /tmp/svc-test-{id}-svc
npm install
npm start &
# Wait for server
for i in $(seq 1 15); do
  curl -sf http://localhost:3000/health > /dev/null && break
  sleep 2
done
```

If the server does not start, that is a bug in the change set. Fix it:
1. Read the error output
2. Identify the failing file
3. Re-run plan-changeset for that part only
4. Try `npm start` again
5. Repeat up to 3 times. If still broken, log the failure with full error output.

### Multi-Approach Comparison

> **Orchestration requirement:** Comparison mode cannot be run as an automated script. Each approach must be a separate foreground conversation where the operator plays the user role. This is required for fairness — background agents bypass interactive skills entirely, producing an UNFAIR result (confirmed in the 2026-04-04 run: gstack received 0/10 skills invoked because the agent wrote code directly). If you cannot run three sequential foreground sessions, record the comparison as PARTIAL and note which approaches were run fairly.

Every scenario produces running applications from multiple approaches. The comparison is only valid if each approach uses its methodology's skills as designed.

#### Fairness Rules

Background agents CANNOT run interactive skills (AskUserQuestion, iterative review loops). Therefore:

1. **Each approach MUST be run in the FOREGROUND as a sequential conversation**, not as a background Agent. The operator plays the user role, answering skill questions naturally based on the scenario context.
2. **Every skill invocation MUST use the Skill tool**, not inline approximation. If an agent "brainstorms" without invoking `superpowers:brainstorming`, that is NOT a fair test of the superpowers methodology.
3. **Log every skill invoked** with: skill name, input summary (what was passed), output summary (what was produced), and whether the skill asked questions (and what the operator answered).
4. **If a methodology's skill cannot be invoked** (missing dependency, tool not available), record it as SKIPPED with reason — do not approximate it inline.

#### Approach Definitions

**Approach 1 -- Serious Vibe Coding (full 19-skill pipeline):**
- Run all pipeline skills in pipeline order using the Skill tool
- Each skill reads prior phase artifacts from the worktree
- Server runs on port 3000
- **Verification requirement:** Skills 14-18 (verify-promotion, sync-spec-code, test-journeys, write-e2e, analyze-marketing) MUST be run, not skipped

**Approach 2 -- gstack (office-hours + review pipeline):**
- Invoke `/office-hours` with the scenario prompt — answer the 6 forcing questions naturally
- Invoke `/design-consultation` to create DESIGN.md
- Invoke `/autoplan` OR `/plan-ceo-review` → `/plan-design-review` → `/plan-eng-review` sequentially
- Write code guided by the reviewed plan
- Invoke `/qa` against the running server
- Invoke `/review` on the diff
- Server runs on port 3001
- **Log:** Each skill invocation, what questions it asked, what the operator answered

**Approach 3 -- Obra/Superpowers (brainstorm-plan-execute):**
- Invoke `superpowers:brainstorming` — answer clarifying questions naturally, approve design
- Invoke `superpowers:writing-plans` with the brainstorm output
- Invoke `superpowers:test-driven-development` — write failing tests BEFORE implementation
- Invoke `superpowers:executing-plans` with the plan
- Invoke `superpowers:requesting-code-review` on the result
- Invoke `superpowers:verification-before-completion` before declaring done
- Server runs on port 3002
- **Log:** Each skill invocation and its output

**Approach 4 -- Raw (single prompt):**
- One prompt: "Build [scenario description]. Produce a complete, runnable Node.js application."
- No methodology, no phases, no review, no skills
- Server runs on port 3003

#### Universal Expectations (Phase 0)

BEFORE running any approach, derive a checklist of what a user who typed the scenario prompt would expect to see. This checklist must:
- Be derived ONLY from the user's sentence, not from any methodology's specs
- Include sub-items that are independently scorable (1 = met, 0 = not met)
- Cover: does it run, does it show the right data, does it do the core thing, does it address every explicit requirement in the prompt, is it usable on first visit
- Be written to `test-framework/results/{date}/phase-0-expectations.md` BEFORE any approach runs

#### Measurements (per approach)

| Metric | How to measure |
|--------|---------------|
| Universal score | Phase 0 checklist pass rate |
| Skills invoked | Count of methodology skills actually invoked via Skill tool |
| Skills skipped | Count of methodology skills not invoked, with reason |
| ACs satisfied | Check each AC from the svc spec against the running server |
| Vision-to-code traceability | Suite 9 score |
| First-time UX | Suite 8 pass/fail |
| Test coverage | Run unit tests, report pass/fail counts |
| Time to running server | Wall clock from first prompt to server responding |
| Code structure | Count files, modules, separation of concerns |
| Files produced | Total source files (src + views) |
| LOC | Lines of code in source files |

#### Methodology Usage Audit

After all approaches complete, produce `methodology-usage-audit.md` with:
- For each approach: recommended workflow (from that methodology's docs) vs actual workflow (what was invoked)
- Skill-by-skill table: recommended → invoked? → input → output
- Fairness verdict: FAIR / PARTIALLY FAIR / UNFAIR with explanation
- If any approach is UNFAIR, the comparison results for that approach carry a caveat

**Report format:** Side-by-side table in `comparison.json` and `comparison.md`. Include the methodology usage audit as a section. The comparison is only credible if the audit shows all approaches were fairly tested.

### Self-Improvement Protocol

When the autopilot finds a gap, **route through improve-framework** — do not
edit SKILL.md files directly from inside autopilot.

1. **Detect** the gap (failing scenario, benchmark regression, missing capability)
2. **Route to `improve-framework`** which orchestrates the fix:
   - Reads FRAMEWORK-STATE.md (is this already known/fixed/deferred?)
   - Diagnoses via evolve-framework
   - Optionally imports via blend-external
   - Picks implementation route (quick-fix / create-skill / normal pipeline)
3. **Replay** the original failing scenario via test-framework
4. **Update FRAMEWORK-STATE.md** with what was found and fixed

**Only exception:** tiny typo/wording fixes in a single SKILL.md line can be
fixed directly and committed. Anything structural goes through improve-framework.

The autopilot's job is to FIND gaps. improve-framework's job is to FIX them.

### Recursion Guard

improve-framework invokes test-framework for replay verification. To prevent
infinite re-entry:

- **When invoked with `--no-self-improve` context** (i.e., called as a replay
  from improve-framework Step 6): report any new gaps found in the replay
  output, but do NOT route them to improve-framework. Log them to
  FRAMEWORK-STATE.md Known Gaps instead.
- **When invoked normally** (autopilot or direct): route gaps through
  improve-framework as usual, but improve-framework enforces max depth 1.

This ensures the loop always terminates: test → improve → test (replay, no re-entry) → done.

## Evaluation Strategy: pass@k vs pass^k

Formal vocabulary for deciding how to validate a claim or scenario.
Source: ECC eval-harness + continuous-agent-loop skills (MIT, Copyright 2026 Affaan M.).

**pass@k** — at least 1 of k samples succeeds.
Use when: proving a capability exists ("can svc do X at all?"), benchmarking a
new skill during development, exploratory coverage testing, first-time validation
of a new doctrine claim.

**pass^k** — ALL k samples must succeed.
Use when: CI regression gates (must always pass), doctrine claim validation
(C1-C7 require consistent results), G5/G6 pre-flight checks, any scenario
where a 70% success rate means the behavior is unreliable.

**svc application:**

| Scenario | Strategy | Rationale |
|---|---|---|
| First run of a new doctrine claim | pass@1 | Prove it works at all before investing in consistency |
| Doctrine claim promoted to doctrine | pass^3 | Must be consistent to be claimed as a principle |
| C1 variance test | pass^3 (3 pipeline runs, 3 raw runs) | Variance can only be measured across runs |
| C7 worktree isolation | pass^k where k=parallel runs | Single failure = the isolation is broken |
| G5 / G6 pre-flight | pass^1 | A gate that passes 80% of the time is not a gate |
| New skill capability proof | pass@1 | Capability existence, not reliability |
| Regression detection in autopilot | pass^3 | Regressions are unreliable by definition |
| Flaky scenario identified | pass@k, diagnose | Don't promote to pass^k until root cause fixed |

**Known debt:** C1 and C7 currently lack repeat-run variance fixtures (pass^3
protocol). These are the primary doctrine evidence gap items in FRAMEWORK-STATE.md
Known Gaps. Building the fixture infrastructure is the unlock for both claims.

## Doctrine Claims -- ALL Testable

Every doctrine claim has a concrete test that produces numerical evidence. No claim is "structurally untestable." If it cannot be tested, downgrade or remove it from the doctrine.

| # | Claim | Test Method | Pass Criteria |
|---|-------|-------------|---------------|
| C1 | Progressive narrowing reduces output variance | Run the SAME scenario 3x with full pipeline and 3x with single prompt. Diff the outputs pairwise within each group. | Full-pipeline pairwise diffs < single-prompt pairwise diffs |
| C2 | Spec-as-index reduces token usage | On a brownfield project: count tokens to load all files in `src/`. Count tokens to load only files referenced by spec RESOLVED annotations. Report ratio. | Spec-indexed tokens < 50% of full-codebase tokens |
| C3 | Cache-optimized loading order | Load artifacts in doctrine-prescribed order (most-stable-first) across 3 sequential sub-agent tasks. Load same artifacts in random order across 3 tasks. Compare `total_tokens` from task notifications -- cache hits show as lower input tokens on requests 2-3. | Prescribed-order total_tokens < random-order total_tokens across runs 2-3 |
| C4 | Review protocol catches errors single-pass misses | Plant 5 known errors in a spec (contradicting ACs, invalid references, untestable criteria, compound stories, ungrounded preconditions). Run single-pass review. Run full review-gate (self-review + self-judgment + cross-review). Count detections. | Full protocol detects more planted errors than single-pass |
| C5 | Checkpoints prevent cumulative drift | Run 3-task implementation (types, service, handler) WITHOUT checkpoints (one agent, no spec re-reads between tasks). Run WITH checkpoints (separate agent per task, each re-reads spec first). Compare final AC compliance. | Checkpoint version satisfies more ACs |
| C6 | Feature/Enabler/Integration cascade discovers full chain | Give write-spec a Feature. Check if write-journeys Layer 3 identifies Enabler dependencies. Check if write-spec queues cascade specs. | At least 2 Enabler dependencies auto-discovered without manual prompting |
| C7 | Worktree isolation prevents cross-feature contamination | Run TWO features in parallel worktrees simultaneously. After both complete, check: (a) no files modified in both worktrees that shouldn't be, (b) no shared state leakage, (c) each worktree's git status is clean relative to its own changes only. | Zero unexpected shared-file modifications. Each worktree contains only its own feature's changes. |

**For C3:** Use `total_tokens` from sub-agent task notification results as the measurement proxy. If Claude Code does not surface this field, instrument the test with a wrapper that logs token counts from the Anthropic API response headers.

**For C7:** Use the `worktree-manager` skill to create two worktrees. Dispatch parallel agents (one per worktree) using `superpowers:dispatching-parallel-agents`. This is infrastructure the framework already provides -- use it.

## Test Suites

### Suite 1: Pipeline Integrity (Static)

Validates all artifacts exist and cross-reference correctly.

```bash
bash scripts/validate-pipeline-integrity.sh <project-root>
```

Checks: all SKILL.md files exist, manifest matches directories, AC IDs are consistent across specs/journeys, RESOLVED annotations point to real files, UX/UI designs reference valid specs.

### Suite 2: Progressive Narrowing (C1)

Dispatch 6 sub-agents in parallel:
- 3 agents: single prompt -> code (no methodology)
- 3 agents: full svc pipeline -> code

Diff outputs pairwise within each group. Report variance reduction with confidence interval.

The output is RUNNING CODE, not spec documents. Each agent produces files that compile and start.

### Suite 3: Token Efficiency (C2, C3)

**C2:** Count tokens for full `src/` load vs spec-referenced-only load on a real brownfield project. Report ratio.

**C3:** Run 3 sequential sub-agent tasks with prescribed artifact order. Run 3 with random order. Compare total_tokens across the second and third requests in each series.

### Suite 4: Review Protocol Effectiveness (C4)

Plant 5 known errors in a feature spec. Run single-pass review. Run full review-gate. Count detections. The test is adversarial -- it tries to break the review process.

### Suite 5: Checkpoint Drift (C5)

3-task implementation with and without checkpoints. Measure AC compliance at the end. The implementation must COMPILE AND RUN -- not just exist as text.

### Suite 6: Cascade Discovery (C6)

Give write-spec a Feature. Verify that Enabler dependencies are discovered automatically. The cascade must produce additional specs, not just a note saying dependencies exist.

### Suite 7: Worktree Isolation (C7)

Two features, two worktrees, parallel execution. Verify zero cross-contamination. This suite uses real git worktrees and real parallel agents.

## Suite 8: First-Time User Experience

After the server starts, test the FIRST VISIT experience with no profile, no login, no setup:

1. `curl http://localhost:{port}/` — does the homepage show useful content without requiring any user action?
2. Are all vision-level product concepts visible in the UI? (Check vision doc sections 3-4 against what the homepage shows.)
3. Can a user understand what the app does within 5 seconds of landing?

If the first visit shows "No data" or requires setup before showing value, that is a FAILURE of the pipeline. Flag it as a skill gap in write-spec (missing zero-state AC).

## Suite 9: Vision-to-Code Traceability

The most dangerous pipeline failure is information loss at phase boundaries. This suite catches it.

1. Read `docs/specs/vision.md` sections 3 (Who We Serve), 4 (Value Proposition), and 6 (Boundaries).
2. Extract every distinct product concept that implies user-visible behavior (deployment modes, persona types, platform sources, pricing, privacy).
3. For each concept, grep the `src/` directory for evidence it's implemented in code.
4. Score: concepts with code evidence / total concepts.

**Pass criteria:** >= 80% of vision concepts have code evidence. Any concept at 0% is a critical finding — it means the pipeline translated the user's requirement into a spec but then lost it during code generation.

**Root cause mapping for failures:**
- Concept in vision but NOT in spec ACs → write-spec missed it during vision-to-spec traceability
- Concept in spec ACs but NOT in code → plan-changeset missed it during vision cross-check
- Concept in code but NOT working at runtime → land-changeset or verify-promotion gap

## Completion Criteria

The autopilot is DONE when ALL of these are true:

- [ ] All greenfield pipeline skills (per `bootstrapStartSequence`) produced REAL output (no simulations, no outlines, no "interface-tier" hedging)
- [ ] Server runs and responds to HTTP requests from generated code
- [ ] E2E tests execute against the live server (pass or fail -- but they RUN)
- [ ] First-time user experience test passes (useful content on first visit without setup)
- [ ] Three-way comparison completed (svc vs obra vs raw) with numerical results
- [ ] At least 1 SKILL.md improvement committed (a real fix, not a formatting change)
- [ ] All 7 doctrine claims tested with numerical evidence
- [ ] Worktree opened and closed cleanly for every scenario
- [ ] At least 2 scenarios completed (1 greenfield, 1 iteration)
- [ ] Results written to `test-framework/results/` with timestamps
- [ ] Comprehensive comparison report produced

## Scenario Mode (Tier-2 LLM-Driven Behavioral Testing)

Tier-1 evals validate structure (does SKILL.md have self-verify? does frontmatter
declare outputs?). Tier-2 validates **behavior**: given a workspace and a skill prompt,
does the skill produce correct output artifacts?

> **Implementation status:** Tier-2 uses LLM-driven scenario tests — it runs `claude -p`
> with a skill prompt against a scaffolded git workspace and asserts on output structure.
> ~50K tokens per scenario. Requires the `claude` CLI. **True canned-input fixture tests
> (deterministic, no LLM) are not yet implemented.** The `fixtures/` directory and
> `test-write-spec.sh` / `test-chain-vision-spec-journeys.sh` scripts described below are
> the planned target state, not the current implementation.

### Current implementation

```
test-framework/evals/tier-2/
  run-tier2.sh              # runs claude -p with each scenario's prompt
  scenarios/
    write-vision-create.md
    write-spec-greenfield.md
    validate-feature-validate.md
    plan-changeset-manifest.md
    find-opportunity-eval.md
    stage-revenue-eval.md
    mine-builder-eval.md
    framework-self-improve-eval.md
```

### Planned: True Fixture Pattern (not yet implemented)

```
test-framework/evals/tier-2/
  fixtures/
    vision-minimal.md       # canned vision for a simple todo app
    spec-with-8-acs.md      # canned spec with known ACs
    plan-with-5-tasks.json  # canned lane-tasks.json with known graph
  test-write-spec.sh        # feeds vision-minimal.md, asserts spec structure
  test-plan-changeset.sh    # feeds spec-with-8-acs.md, asserts task graph
  test-chain-vision-spec-journeys.sh  # chain fixture: vision → spec → journeys
```

Each fixture would be a minimal, canned artifact — just enough to exercise the skill
contract, no LLM call needed:

- **Input fixture:** canned artifact at the skill's required input path
- **Run:** invoke the skill (or validate its transformation rules against the fixture)
- **Assert:** output artifact has required sections, required fields, traceable references

### Chain Fixture Tests (svc-unique advantage, planned)

Because svc has a defined progression order, fixture tests can be chained:
feed a canned vision.md through write-spec → audit-ac → write-journeys and
assert that each stage's output contains traceable references to the previous
stage's content. This catches skill-to-skill contract drift that tier-1 static
checks cannot detect.

### Running Scenario Tests (current)

```bash
bash test-framework/evals/run-all-evals.sh --tier2
# or individual scenario runner:
bash test-framework/evals/tier-2/run-tier2.sh
```

### When to Add a New Scenario

Add a scenario test when:
- A skill has been edited and behavioral correctness can't be verified structurally
- A blend introduces a new contract (e.g., AP-25 untrusted content fencing)
- A chain integration point is added or changed

## Anti-Patterns

| Do NOT | Why | Instead |
|--------|-----|---------|
| Call a skill "simulated" or "interface-tested" | If it cannot run, the pipeline has a bug | Fix the pipeline so the skill runs for real |
| Produce specs without code | The point is a running application | Phase 7 must generate all 8 code parts |
| Document gaps instead of fixing them | Documentation is not improvement | Edit the SKILL.md, re-run, verify |
| Skip the three-way comparison | The comparison IS the value proposition | Always run svc vs obra vs raw |
| Leave worktrees unclosed | Orphaned worktrees accumulate and confuse | Always clean up: merge, PR, or remove |
| Hedge with "may," "could consider," "if possible" | Tests are pass/fail, not suggestions | State what MUST happen, then do it |
| Report "STRUCTURALLY UNTESTABLE" | Everything is testable with the right infrastructure | Build the infrastructure or downgrade the claim |
| Run only static checks and call it "tested" | Static checks prove structure, not behavior | Run live tests against running code |

## Convert Mode Testing

Bootstrap (greenfield) and convert (iteration) exercise different skill behaviors. Test both.

| Skill | Bootstrap | Convert | Key difference |
|-------|-----------|---------|----------------|
| write-vision | Create from scratch | Proposal with Evidence Table + Approval Gate | Never overwrites existing |
| build-personas | Mode 7 (Auto-Discovery) | Mode 3 (Add New) or Mode 4 (Expand) | Incremental |
| validate-feature | No existing specs | Cross-validates against existing ACs | Validates before creating |
| write-spec | Clean slate | References existing ACs across features | Cross-feature references |
| sync-spec-code | Nothing to sync | Checks existing VERIFIED specs for drift | Finds real inconsistencies |
| write-journeys | Mode 1 (Bootstrap) | Mode 2 (Expand) with prerequisite chaining | Extends, does not replace |

Run at least one convert-mode scenario (S3: add real-time collab to todo-api) to cover these behaviors.

## Statistical Rigor

Single runs prove nothing. For any generative suite, run N times (default N=3) and report:

- Mean, standard deviation, 95% confidence interval
- Effect size (Cohen's d): < 0.2 negligible, 0.2-0.5 small, 0.5-0.8 medium, > 0.8 large
- If CI crosses the null hypothesis, increase N and re-run

A claim is SUPPORTED only when the 95% CI lower bound is on the correct side of the null hypothesis. Otherwise the result is INCONCLUSIVE and requires more runs.

## Results Format

```
test-framework/results/YYYY-MM-DD-HHMMSS/
  scenario-{id}/
    svc/
      worktree-path.txt       <- path to worktree used
      phase-*/                <- artifacts from each phase
      server-log.txt          <- stdout/stderr from npm start
      metrics.json            <- per-skill token/time/artifact counts
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
    all-scenarios.json
    doctrine-evidence.json    <- claim-by-claim numerical evidence
    skill-coverage.json       <- 19/19 must be REAL, not simulated
    improvements.json         <- SKILL.md edits made during this run
```

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Selected mode matches request | Confirm the executed mode (`static`, `live`, `autopilot`, `comparison`, or `scenario`) matches the user's validation goal. | |
| 2 | Evidence is real or labeled partial | Verify server, E2E, scenario, and comparison claims are backed by files under `test-framework/results/` or explicitly marked PARTIAL/SIMULATED. | |
| 3 | Worktree lifecycle is accounted for | Confirm any worktrees opened for tests are either removed, promoted, or reported with their current path and reason. | |
| 4 | Improvement loop is traceable | For framework changes found during testing, check the affected `SKILL.md` edits, validation reruns, and result artifacts are linked. | |

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `test-framework` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-TestModeSelection --evidence command_output:.svc/test-framework-mode.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-StaticOrScenarioRunnerExecution --evidence command_output:.svc/test-framework-runner.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-LiveAutopilotOrComparisonExecution --evidence file:test-framework/results/
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-MethodologyUsageAudit --evidence file:test-framework/results/
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ResultsPersistenceGapRouting --evidence file:FRAMEWORK-STATE.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/test-framework-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

**If `--progressive` flag is present:**
- In framework lane: continue to `evolve-framework --progressive --lane framework`

**If standalone:**
- Report results to user
- If the failure already has a proposal or implementation route, suggest: "Next: run `improve-framework`"
- If the failure still needs diagnosis, suggest: "Next: run `evolve-framework`"

## References

- `references/autopilot-protocol.md` -- Scenario definitions, user simulation rules, KPIs, full invocation order, loop control
- `DOCTRINE.md` -- The claims this skill tests
- `skills-manifest.json` -- Canonical list of all pipeline skills

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
