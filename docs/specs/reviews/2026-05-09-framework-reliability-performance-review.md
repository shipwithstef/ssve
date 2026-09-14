# Framework Reliability and Performance Review - 2026-05-09

**Scope:** svc framework repo reliability, quality gates, hooks, routing logic, eval harness, work-item state, and verification discipline.

**Route:** `route-workflow` classified this as framework-lane review work.

**Validation baseline:** `bash test-framework/evals/run-all-evals.sh` currently fails: 84 tier-1 scripts pass, 6 fail, 0 time out. Tiers 1.5-3 were not run.

**Finding count:** 40 total. Severity mix: 11 CRITICAL, 29 HIGH.

## F-001 - CRITICAL - Tier-1 is red on main

**Evidence:** `bash test-framework/evals/run-all-evals.sh` exits 1 with `RESULT: FAIL (6 tier-1 scripts failed)`.

**Impact:** The framework cannot claim deterministic reliability while main fails the mandatory static gate.

**Fix:** Treat current tier-1 failures as release blockers. Add a "known failing validator" waiver mechanism only if each waiver is structured, time-boxed, and blocks promotion after expiry.

## F-002 - CRITICAL - `validate-feature-gate.sh` fails silently on malformed/closed WIs

**Evidence:** `bash test-framework/evals/tier-1/validate-feature-gate.sh` exits 1 with no normal failure report. `bash -x` shows it reaches [WI-146](/workspace/seriousvibecoding/docs/specs/work-items/WI-146.md:1), whose status is `CLOSED-INVALID` and has no `**Lane:**` field.

**Impact:** A validator with no actionable output wastes debugging time and erodes trust in the gate.

**Fix:** Make the parser tolerant of closed-invalid WIs, emit explicit `FAIL: WI-146 missing Lane` when a lane is required, and never let `set -e` abort before the summary.

## F-003 - HIGH - `validate-hook-scripts-loadable.sh` catches a broken installed hook

**Evidence:** `hooks/svc-vibe-auditor.js` uses ESM `import` in a `.js` file without a package `type: module` at [hooks/svc-vibe-auditor.js](/workspace/seriousvibecoding/hooks/svc-vibe-auditor.js:8). `hooks/hooks.json` wires it as `node hooks/svc-vibe-auditor.js` at [hooks/hooks.json](/workspace/seriousvibecoding/hooks/hooks.json:63).

**Impact:** UI-edit visual verification hook is declared but cannot parse under Node's default CommonJS mode.

**Fix:** Rename to `.mjs` or convert to CommonJS. Add this exact failure to the hook-loadability replay fixture.

## F-004 - CRITICAL - Framework self-management validator fails on `discuss-phase`

**Evidence:** `validate-framework-self-management.sh` reports `discuss-phase task-graph heading missing` and `discuss-phase lane-tasks source-of-truth line missing`. `discuss-phase/SKILL.md` still references `docs/logs/lane-tasks.json` at [discuss-phase/SKILL.md](/workspace/seriousvibecoding/discuss-phase/SKILL.md:226).

**Impact:** A newly integrated skill can bypass the cross-host `.svc/lane-tasks-<WI>.json` contract.

**Fix:** Bring `discuss-phase` onto the canonical task-graph boilerplate and add a targeted fixture so future new skills cannot merge with stale `docs/logs/lane-tasks.json` wording.

## F-005 - HIGH - Pipeline decision schema has invalid historical rows

**Evidence:** `validate-pipeline-decisions-schema.sh` reports invalid entries at `.svc/pipeline-decisions.jsonl` lines 78, 79, 96, 98, and 100, including missing `skill` and invalid `wi` patterns.

**Impact:** Decision-log consumers cannot reliably audit route, WI, or skill provenance.

**Fix:** Backfill or migrate invalid rows with explicit schema versioning. Add append-only repair entries rather than silently editing audit history if immutability matters.

## F-006 - HIGH - Knowledge provenance gate is red for a post-gate domain

**Evidence:** `validate-knowledge-domain-provenance.sh` fails `external-canvases` because `CAPABILITIES.md` was created/modified after the 2026-04-30 provenance gate but `.sources.jsonl` is missing or empty.

**Impact:** Recall may inject unverified external facts into future framework work.

**Fix:** Run the research provenance flow for `external-canvases` or remove the unproven knowledge slice.

## F-007 - HIGH - 13 legacy knowledge domains remain unproven

**Evidence:** The same provenance validator warns on `namecheap`, `agent-harnesses`, `mimo`, `gemini-cli-hooks`, `gcp-mcp`, `google-ai-pro`, `agent-evals`, `resend`, `capacitor`, `devops-mcp`, `claude-hooks`, `claude-design`, and `codex`.

**Impact:** Old unproven knowledge can still drive design decisions while only newer slices are gated.

**Fix:** Create a backfill queue with owners, dates, and retirement rules. Mark unbackfilled domains as "legacy-unverified" in recall output.

## F-008 - HIGH - WI closeout evidence validator fails on WI index drift

**Evidence:** `validate-wi-closeout-evidence.sh` fails WI-133. [WI-133](/workspace/seriousvibecoding/docs/specs/work-items/WI-133.md:4) says `VERIFIED`, [DONE.md](/workspace/seriousvibecoding/docs/specs/work-items/DONE.md:65) says verified cannot-reproduce, but [INDEX.md](/workspace/seriousvibecoding/docs/specs/work-items/INDEX.md:57) still says `status:backlog`.

**Impact:** Work-item discovery and closeout audits disagree on whether work is open.

**Fix:** Make DONE/INDEX/WI status sync a single helper command and make the validator report the exact inconsistent files before failing.

## F-009 - HIGH - Preflight rollout is still 0/79 and advisory-only

**Evidence:** `validate-preflight-coverage.sh` reports `coverage: 0 / 79 skills carry a ## Preflight section` while the script always exits 0 at [validate-preflight-coverage.sh](/workspace/seriousvibecoding/test-framework/evals/tier-1/validate-preflight-coverage.sh:45).

**Impact:** Missing inputs, unreadable artifacts, and unwritable outputs are still discovered mid-skill.

**Fix:** Add family-level preflight sections and flip the validator from advisory to blocking once each family is migrated.

## F-010 - HIGH - `Before Starting` context loading is mostly advisory

**Evidence:** `validate-skill-before-starting.sh` reports 72 advisory missing sections and only 5 passes. The script exempts pre-cutoff or undated skills at [validate-skill-before-starting.sh](/workspace/seriousvibecoding/test-framework/evals/tier-1/validate-skill-before-starting.sh:68).

**Impact:** Skills still load context inconsistently, which increases rework and context-token waste.

**Fix:** Convert advisory findings into a migration backlog and make new/edited skills fail if they omit `Before Starting`.

## F-011 - CRITICAL - Stop completion guard wiring discards hook stdin

**Evidence:** `hooks/hooks.json` wires the guard as `printf '%s' | bash hooks/svc-task-completion-guard.sh` at [hooks/hooks.json](/workspace/seriousvibecoding/hooks/hooks.json:138), while the guard reads stdin with `INPUT=$(cat)` at [hooks/svc-task-completion-guard.sh](/workspace/seriousvibecoding/hooks/svc-task-completion-guard.sh:16).

**Impact:** Host-provided Stop payloads are replaced by an empty string, weakening session-id, subagent, and input parsing.

**Fix:** Wire as `bash hooks/svc-task-completion-guard.sh` when the host passes JSON on stdin, or document and test the intended wrapper per host.

## F-012 - HIGH - Completion guard still documents legacy `lane-tasks.json`

**Evidence:** `hooks/hooks.json` describes `.svc/lane-tasks.json` at [hooks/hooks.json](/workspace/seriousvibecoding/hooks/hooks.json:136). The guard comments also mention `.svc/lane-tasks.json` at [hooks/svc-task-completion-guard.sh](/workspace/seriousvibecoding/hooks/svc-task-completion-guard.sh:5).

**Impact:** Users and future agents can wire or debug against the old singular file name.

**Fix:** Replace legacy docs with `.svc/lane-tasks-<WI>.json` and keep `lane-tasks.json` only as an explicitly named legacy compatibility path.

## F-013 - HIGH - Completion guard allows stop after three blocks

**Evidence:** `SVC_COMPLETION_MAX` defaults to 3 and then allows stop at [hooks/svc-task-completion-guard.sh](/workspace/seriousvibecoding/hooks/svc-task-completion-guard.sh:440).

**Impact:** A repeated completion violation can age out during the same session rather than remaining blocked until fixed.

**Fix:** Require an explicit `SVC_COMPLETION_FAIL_OPEN=true` or structured override decision for max-block escape.

## F-014 - HIGH - `svc-wi-pillars-check` is still a soft warning on VERIFIED

**Evidence:** `hooks/hooks.json` says `SOFT WARN` and `Never blocks` for WI pillar verification at [hooks/hooks.json](/workspace/seriousvibecoding/hooks/hooks.json:75).

**Impact:** A WI can be marked verified while pillar coverage is malformed.

**Fix:** Promote VERIFIED transitions to hard block. Keep warnings only for draft/in-progress edits.

## F-015 - HIGH - Preflight hook is fail-open by design

**Evidence:** `hooks/hooks.json` says `Always exits 0 (fail-open)` for `svc-preflight-skill` at [hooks/hooks.json](/workspace/seriousvibecoding/hooks/hooks.json:31).

**Impact:** The framework can know a skill lacks required inputs and still proceed.

**Fix:** Keep fail-open for unknown hosts, but fail-closed for first-party hosts once a skill declares a preflight contract.

## F-016 - HIGH - SessionStart healthcheck only mentions Claude in shared hooks config

**Evidence:** `svc-session-start-healthcheck` scans `~/.claude/skills` per [hooks/hooks.json](/workspace/seriousvibecoding/hooks/hooks.json:89), while provisioned hosts include Claude, Kimi, Codex, Gemini, OpenCode, Antigravity, and Cursor.

**Impact:** Host install drift may be detected in Claude but not surfaced consistently elsewhere.

**Fix:** Make healthcheck host-aware using `scripts/detect-host.sh` and host manifests.

## F-017 - HIGH - Cursor and Antigravity are provisioned without hook enforcement

**Evidence:** `provision/hosts/cursor.json` and `provision/hosts/antigravity.json` set `"hooks": false` while setup advertises both hosts.

**Impact:** Skills install, but critical framework guards do not mechanically run in those hosts.

**Fix:** Mark these hosts as skills-only/limited in route output and block claims of cross-host enforcement until verified wirers exist.

## F-018 - HIGH - Manifest excludes real top-level skills

**Evidence:** `skills-manifest.json` has 77 `includedSkills`, while 79 top-level `SKILL.md` files exist. `base44-environment` and `design-logo` are unmanifested.

**Impact:** Install/setup can see skills that route-workflow and manifest lints do not fully model.

**Fix:** Either add them to the manifest with lane/core-pack decisions or mark them as non-framework addon skills in a separate explicit registry.

## F-019 - HIGH - Skill corpus violates its own 500-line progressive-disclosure norm

**Evidence:** Top offenders include `base44-environment` 1601 lines, `write-journeys` 1406 lines, `design-ui` 1316 lines, `build-personas` 1140 lines, and `validate-feature` 1109 lines.

**Impact:** Large skills consume context, hide critical gates, and slow every triggered session.

**Fix:** Extract mode-specific references and leave only routing, contract, and self-verify in `SKILL.md`.

## F-020 - CRITICAL - `write-journeys` has known P0 coverage debt

**Evidence:** [FRAMEWORK-STATE.md](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:251) records `write-journeys` progressive-disclosure violation, zero tier-2 scenarios, weak self-verify, pending refresh trigger, and no tier-3 judge.

**Impact:** Journey generation is central to acceptance coverage, but one of the largest skills has shallow automated proof.

**Fix:** Split `write-journeys`, add tier-2 journey generation scenarios, and add trace validation for its mandatory process steps.

## F-021 - CRITICAL - Skill execution process is not trace-validated

**Evidence:** [FRAMEWORK-STATE.md](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:363) says skills promise processes that tier-2 tests do not prove they execute. Known gap remains at [FRAMEWORK-STATE.md](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:1720).

**Impact:** A skill can emit the right output artifact while skipping required discovery, verification, or audit steps.

**Fix:** Add machine-readable phase contracts and record phase receipts in lane-tasks or pipeline decisions.

## F-022 - HIGH - Tier-3 coverage remains effectively absent

**Evidence:** [FRAMEWORK-STATE.md](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:364) records tier-3 coverage at 1/35 scenarios. Current repo has 36 tier-2 scenario files but tier-3 only contains runner and judge prompts.

**Impact:** The adversarial judge layer is advertised but does not cover most skills.

**Fix:** Batch tier-3 across all tier-2 outputs with cost ceilings and per-skill regression baselines.

## F-023 - HIGH - Tier-2 assertions are often presence checks rather than process checks

**Evidence:** [FRAMEWORK-STATE.md](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:366) records that `diagnose-bug-typo` passes on strings such as "root cause" and "pattern" rather than substantive execution.

**Impact:** Agents can satisfy tests with placeholder text.

**Fix:** Replace string-existence assertions with structured output schemas and negative fixtures.

## F-024 - HIGH - Route workflow autorun is documented but insufficiently tested

**Evidence:** `route-workflow/SKILL.md` documents autorun at [route-workflow/SKILL.md](/workspace/seriousvibecoding/route-workflow/SKILL.md:163). The earlier reliability review still lists autorun path not tested as R-4 in `proposals/done/2026-04-25-dynamic-deterministic-reliability-review.md`.

**Impact:** The highest-value "one prompt to verified product" claim can regress without detection.

**Fix:** Add recorded behavioral tests for autorun lane creation, human checkpoint behavior, and terminal conditions.

## F-025 - HIGH - State writes lack atomicity and concurrent-session protection

**Evidence:** The open reliability review records `.svc/orchestrator-state.json` and lane-tasks have no atomicity/concurrent-session protection in `proposals/done/2026-04-25-dynamic-deterministic-reliability-review.md`.

**Impact:** Parallel agents can race on lane-tasks or decision logs, corrupting the source of truth.

**Fix:** Introduce `scripts/state-io.mjs` as mandatory writer with lock files, atomic rename, stale-lock recovery, and validator enforcement.

## F-026 - HIGH - Atomic state write validator is advisory-only

**Evidence:** `validate-atomic-state-writes.sh` is described as "Always exits 0; offenders are advisory" in the validator source.

**Impact:** Even after a state-IO standard exists, direct writes can continue.

**Fix:** Flip to blocking for `.svc/*.json`, `.svc/*.jsonl`, work-item indexes, and lane-tasks after migration.

## F-027 - CRITICAL - Runtime verification can still be delegated to the user

**Evidence:** `proposals/done/2026-05-08-runtime-verification-must-not-delegate-to-user.md` documents repeated user-eyeball fallback despite available Playwright automation at lines 5-23.

**Impact:** Behavioral verification quality depends on user intervention rather than framework enforcement.

**Fix:** Add the proposed Stop hook and skill-level checks that block "manually verify" language for behavioral ACs unless automation impossibility is documented.

## F-028 - CRITICAL - End-to-end commitment is not a first-class session mode

**Evidence:** `proposals/done/2026-05-08-end-to-end-execution-without-permission-checkpoints.md` shows repeated pauses after the user committed to full end-to-end completion, with the proposed `execution_mode: end_to_end` starting at line 39.

**Impact:** The framework keeps returning coordination burden to the user at verification seams.

**Fix:** Extend session-contract schema with `execution_mode`, implement natural-continuation rules, and add a Stop hook that blocks question-style trailers under end-to-end mode.

## F-029 - CRITICAL - V0 bundle-grep can be substituted for live verification

**Evidence:** `proposals/done/2026-05-09-bundle-grep-is-not-validation.md` records a 24-PR campaign declared verified after bundle-grep while no wave-4 page was opened in a browser; see lines 17-24 and the hard-gate proposal at lines 64-73.

**Impact:** Static deployment evidence can masquerade as runtime user evidence.

**Fix:** Mechanize V0->V1 transition. Browser-visible changes cannot close as verified without live-DOM or screenshot evidence, or a V2 exhaustion log.

## F-030 - HIGH - Multi-PR verification sampling is not required

**Evidence:** The bundle-grep proposal defines deterministic N/3 sampling for campaigns at lines 75-79.

**Impact:** Large parallel waves optimize for cheap text proof across all PRs and skip any real rendered proof.

**Fix:** Add sampling to `verify-promotion` and make cumulative summaries list verification tier per PR.

## F-031 - HIGH - Mid-task method corrections are misrouted as new goals

**Evidence:** `proposals/done/2026-05-09-intelligent-intent-parsing.md` documents the agent dispatching new work instead of applying a small method correction, with classifier proposal at lines 60-83.

**Impact:** The framework burns tokens and time while missing the user's actual correction.

**Fix:** Add method-correction vs scope-correction vs goal-change classification before rerouting mid-task user messages.

## F-032 - HIGH - User typo normalization is not part of routing

**Evidence:** The same proposal lists recoverable typo examples and a pre-routing normalization step at lines 96-107.

**Impact:** Fast, typo-heavy user messages are parsed shallowly, causing wrong skill selection and over-engineering.

**Fix:** Normalize the user message before route classification and log the normalized interpretation in hidden routing context.

## F-033 - HIGH - Cross-cutting infrastructure does not generate journeys

**Evidence:** `proposals/done/2026-05-09-journey-generator-must-detect-i18n-and-chrome-controls.md` records i18n and chrome-control journey gaps at lines 30-45 and the structural gap at lines 50-66.

**Impact:** User-facing flows such as language switching and theme toggles can ship without journeys because they are treated as infrastructure.

**Fix:** Add `write-journeys --capability=<name>` from capability matrices and generate journeys for cross-cutting user-facing capabilities.

## F-034 - CRITICAL - Chrome controls are not covered as journey sources

**Evidence:** The same proposal lists uncovered Layout/MobileHeader controls at lines 68-78 and proposes `auto-discover-chrome` at lines 81-88.

**Impact:** Global controls reachable from every page can break independently of any feature spec.

**Fix:** Add chrome-control scanner and validator that maps interactive chrome elements to `Chrome-*.feature.md` journeys.

## F-035 - HIGH - `route-workflow` claims live-evidence hook behavior that is not a real hook

**Evidence:** `route-workflow/SKILL.md` says route-workflow checks and invokes live evidence after visual-output skills at [route-workflow/SKILL.md](/workspace/seriousvibecoding/route-workflow/SKILL.md:192), but this is skill text, not a host hook entry in `hooks/hooks.json`.

**Impact:** A model can skip the described behavior and no installed hook will enforce it.

**Fix:** Implement this as an actual Stop/PostToolUse hook or downgrade the wording to an explicit self-verify obligation.

## F-036 - HIGH - SDKG post-task trigger router fail-opens

**Evidence:** `route-workflow/SKILL.md` explicitly says malformed/unreachable SDKG registry returns 0 at [route-workflow/SKILL.md](/workspace/seriousvibecoding/route-workflow/SKILL.md:188).

**Impact:** Competitive/security/perf freshness triggers can silently disappear.

**Fix:** Fail-open only for unrelated sessions; fail-closed or create a repair WI when a registered SDKG instance is malformed in framework work.

## F-037 - HIGH - Tier-1 validators mutate repo state

**Evidence:** Running tier-1 appended test fixture entries to `.svc/framework-gaps.jsonl` and generated new `docs/specs/work-items/evidence/WI-102/*.png` files.

**Impact:** Validation dirties the worktree, complicates review, commits, and reproducibility.

**Fix:** Force validators to use temp fixtures or clean up after themselves. Add a meta-validator that fails if tier-1 changes tracked files or writes untracked evidence.

## F-038 - HIGH - `.svc` active state contains stale completed-file naming inconsistencies

**Evidence:** `.svc/lane-tasks-WI-134.completed-52.json`, `.svc/lane-tasks-WI-137.completed-53.json`, and `.svc/lane-tasks-WI-139.completed-54.json` have filenames saying completed while top-level JSON status is `pending`.

**Impact:** File-name based scripts and human scans will disagree with JSON content.

**Fix:** Add a lane-tasks filename/status parity validator and migrate completed archives to a separate directory.

## F-039 - HIGH - README overstates parallel orchestration capability

**Evidence:** [README.md](/workspace/seriousvibecoding/README.md:75) says subagent dispatch relies on LLM following instructions and no runtime orchestrator; [README.md](/workspace/seriousvibecoding/README.md:76) says multi-agent coordination has no scheduler or lock layer.

**Impact:** The marketing-level promise of many coordinated instances outruns enforcement and lock safety.

**Fix:** Keep the public claim but label it "architecture support, not scheduler" everywhere, and add lock/scheduler WIs before promoting it as operational.

## F-040 - HIGH - Historical proposals remain open without a triage SLA

**Evidence:** Open proposals include critical/high reliability items from 2026-04-25 through 2026-05-09, including deterministic quality hooks, dynamic reliability review, end-to-end mode, bundle-grep validation, intent parsing, and chrome journeys.

**Impact:** The framework repeatedly rediscovers already-filed gaps because proposals are not forced into WIs, rejected, or expired.

**Fix:** Add proposal triage validator: every open proposal older than N days must have `accepted_wi`, `rejected_reason`, or `deferred_until` metadata.

## Priority Execution Order

1. Fix the 6 failing tier-1 validators and their underlying data issues: F-001 through F-008.
2. Repair hook enforcement surfaces: F-011 through F-017, F-027 through F-029, F-035 through F-036.
3. Eliminate validation side effects and state drift: F-025, F-026, F-037, F-038.
4. Harden verification and journey coverage: F-020 through F-024, F-030, F-033, F-034.
5. Reduce token waste and misrouting: F-009, F-010, F-019, F-031, F-032, F-039, F-040.

## Commands Run

```bash
bash test-framework/evals/run-all-evals.sh
bash test-framework/evals/tier-1/validate-framework-self-management.sh
bash test-framework/evals/tier-1/validate-pipeline-decisions-schema.sh
bash test-framework/evals/tier-1/validate-knowledge-domain-provenance.sh
bash test-framework/evals/tier-1/validate-wi-closeout-evidence.sh
bash test-framework/evals/tier-1/validate-feature-gate.sh
bash test-framework/evals/tier-1/validate-hook-scripts-loadable.sh
bash test-framework/evals/tier-1/validate-preflight-coverage.sh
bash test-framework/evals/tier-1/validate-skill-before-starting.sh
```

## Completion Audit

| Requirement | Result |
|---|---|
| Review framework for critical reliability/performance/quality issues | PASS |
| Include skills, hooks, logic, consistency, and harnesses | PASS |
| Aim for 40 high/critical findings | PASS, 40 findings |
| Ground findings in current repo evidence | PASS, each finding cites command output, repo file, state file, or open proposal |
| Avoid quality-reducing recommendations | PASS, recommendations preserve or increase gating while reducing wasted work |
