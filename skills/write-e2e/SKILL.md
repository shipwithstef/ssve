---
name: write-e2e
version: "1.0"
handles_concerns:
  - e2e-coverage-for-flow
  - flaky-test-quarantine
  - test-data-seeding
  - mocking-vs-fixtures
description: Write E2E tests that behave exactly like a real user in a real browser — click what users click, see what users see, never use shortcuts a user can't use. Use when writing new E2E tests, reviewing test code, fixing flaky tests, or expanding test coverage. Triggers on "write e2e", "add tests", "test this feature", "fix flaky test", "e2e coverage", "playwright test", "acceptance test", or when the user wants automated tests for a feature. This skill does NOT cover demo video recording (use demo-recorder for that).
phases:
  - id: P1-JourneyACPreflight
    trigger: always
    reads: ["docs/specs/journeys/J*.feature.md", "docs/specs/features/<name>.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-FrontendSurfaceRead
    trigger: always
    reads: ["frontend source", "toast/notification components", "routes/pages"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-SelectorPlan
    trigger: always
    reads: ["frontend source", "journey docs", "feature ACs"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-TestImplementation
    trigger: always
    reads: ["journey docs", "frontend source", "existing E2E tests"]
    writes: ["e2e/specs/**/*.spec.ts"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-RuntimeVerification
    trigger: always
    reads: ["e2e/specs/**/*.spec.ts", "runtime app"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-CloseoutSelfVerify
    trigger: always
    reads: ["latest test output", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/journeys/J*.feature.md", artifact: journey-docs }
  optional:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
outputs:
  produces:
    - { path: "e2e/specs/**/*.spec.ts", artifact: e2e-tests }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Agentic E2E Testing with Playwright

**Announce at start:** "I'm using the write-e2e skill to write end-to-end tests."

## Deployment & Repository Mode
- **Production-Only Platforms:** See [references/deployment.md](references/deployment.md) for testing on Base44, Vercel, etc.
- **Repository Mode Gate:** Detect mode from \`REPO_MODES.md\`.

## Step 0: Pre-Flight — Read the Frontend Before Writing (MANDATORY)
**Before writing any selector or assertion, READ the actual component source code.**
- Identify ARIA roles and landmarks.
- Verify text content and hierarchy.
- Especially read the toast/notification component.
- See [references/deployment.md](references/deployment.md) for pre-flight details.

**Gemini CLI pre-flight (MANDATORY on Gemini):** before any multi-file E2E work, run `bash hooks/svc-gemini-context-check.sh`. Blocks at POOR tier (>4 MB chat JSON). See [references/gemini-context-budget.md](../../references/gemini-context-budget.md). This is WI-085 archetype — Gemini spent 40 min blaming selectors when "fix not deployed" had fallen out of attention.

**Deploy-before-validate (MANDATORY for post-deploy E2E runs):** before running a spec that claims to validate a fix is live, run `node scripts/verify-deploy-status.mjs`. Confirms HEAD is pushed, auto-deploy elapsed-time has passed, and optional health-check sha matches HEAD. Requires `## Deployment Contract` section in repo's `docs/specs/router-context.md`. This is G2 from the 2026-04-19 WI-085 audit.

## Workflow
1.  **Analyze Journey:** Read the target journey and ACs. For generated journey
    docs, first run `node scripts/verify-journey-e2e-bridge.mjs <journey-file>`
    and fix or file the bridge gap before writing tests.
2.  **Locate Surface:** Find the source code for the affected components/pages.
3.  **Define Selectors:** Use semantic, resilient selectors based on ARIA roles.
4.  **Write Test:** Implement the Playwright spec following established patterns.
5.  **Verify:** Run the test against a live URL or local server, then run
    `node scripts/validate-e2e-selector-discipline.mjs --root .`.
6.  **Tag the AC in source (`@AC-<ID>`):** Every test self-tags the spec
    acceptance criterion (or criteria) it exercises with a `@AC-<ID>` comment
    adjacent to the test, where `<ID>` is the spec AC ID verbatim
    (`{SECTION-PREFIX}-{NN}`, e.g. `@AC-NAV-01`). The tag is the machine-readable
    test-side anchor; without it the spec's E2E/Test columns and
    sync-spec-code's `[TEST]`-tier audit are hand-copied and rot silently. Use
    the exact uppercase AC ID — the case is the contract, not decoration.
7.  **Write back the spec Test/E2E columns:** From the `@AC-<ID>` tags the test
    now carries, set the AC's `E2E` column to `✅` and its `Test` column to
    `{spec-file}:{test-name-or-line}` in the feature spec's 5-column AC table
    (the shared `| AC | Description | QA | E2E | Test |` format). This closes the
    `audit-ac`:122-126 ownership gap — write-e2e is the declared owner of those
    two columns. Then run
    `node scripts/verify-test-ac-tags.mjs --root .` to prove every emitted
    `@AC-<ID>` resolves to a real spec AC (no orphan tags from a renamed or
    removed criterion). Fix any orphan before closeout.

For flaky-test fixes, regression tests, coverage-reporter corrections, or any
test added to prove a behavioral fix, load
`references/pre-post-validation-loop.md`. Capture the pre-change failure or
blocked status with the exact Playwright command when reachable, then rerun the
same command after the test/app/reporter change and classify the comparison.
Do not replace a failing command with a broader suite in closeout unless the
broader suite includes and reports the exact selected test.
For machine-readable evidence, run
`node scripts/validate-pre-post-validation-evidence.mjs --evidence <path>` and
include the result in the closeout.

## Reporter/Runner Env Parity

Any E2E coverage reporter, run-summary parser, or journey coverage script
created or modified alongside tests must use the same env-loading and
account-resolution contract as the tests it reports on.

Do not add parallel "credentials missing" checks that only look for generic
aliases such as `TEST_OWNER_EMAIL` or `TEST_CUSTOMER_EMAIL` when the runner can
also use account pools or stream-specific aliases such as
`TEST_OWNER_EMAIL_STREAM_A`, `TEST_OWNER_EMAIL_STREAM_B`,
`TEST_CUSTOMER_EMAIL_STREAM_A`, and `TEST_CUSTOMER_EMAIL_STREAM_B`.

If a reporter says a journey is blocked, prove the E2E runner would also be
blocked under the same env contract. Otherwise fix the reporter before treating
the coverage result as acceptance evidence.

## Base44 Generated Account OTPs

When writing or repairing E2E tests for a Base44 project that provisions
generated auth accounts, read `rules/base44/e2e-otp-connector.md`.

Base44 SDK registration may create the auth user while leaving password login
blocked until email OTP verification. Prefer an installed mailbox connector for
the forwarded test-domain inbox, then call `base44.auth.verifyOtp(...)` and run
an immediate password-login preflight.

Do not introduce project-owned Gmail OAuth refresh-token scripts unless no
connector path exists and the mailbox capture is implemented as maintained
harness code with ignored secrets, redacted output, and E2E-account allowlists.

## Standards & Best Practices
- **Fix the App, Not the Test:** Core testing philosophy. See [references/principles.md](references/principles.md).
- **Avoid Shortcuts:** Never use user-impossible hacks. See [references/principles.md](references/principles.md).
- **Playwright Anti-Patterns:** See [references/anti-patterns.md](references/anti-patterns.md) for what NOT to do.
- **Examples:** See [references/examples.md](references/examples.md) for production-grade test patterns.

## Selector Discipline

Selectors must follow this hierarchy:

1. Stable product affordance: `getByRole` with a user-visible accessible name,
   `getByLabel`, `getByPlaceholder`, or `getByText` scoped to the right surface.
2. Stable app contract: `data-testid` when the UI lacks a reliable accessible name.
3. Container-scoped role: locate the named panel, row, dialog, or form first, then
   find the role inside it.
4. Content-disambiguated role: add `{ name: ... }` or a visible text anchor.
5. Positional selector only as last resort.

`getByRole(...).first()`, `.last()`, and `.nth()` are forbidden unless the test has
an adjacent `selector-exception` comment explaining why no stable alternative exists
and why the position is stable. Run:

```bash
node scripts/validate-e2e-selector-discipline.mjs --root .
```

If the validator fails, change the test or add a justified exception before closeout.

## Close-Out Rule
- The final user-facing summary MUST be anchored to the latest runtime artifact, not an earlier hypothesis.
- Cite the latest failing assertion, latest error signature, or latest passing command from the most recent run.
- If the latest artifact supersedes an earlier blocker, say so explicitly and drop the stale blocker from the summary.

## Audit Mode

When invoked with `--audit` to review existing E2E coverage:

1. Glob `e2e/specs/**/*.spec.ts`
2. For each spec: check journey coverage — which journeys and ACs are tested?
3. Check selector health: are selectors semantic and resilient?
4. Check flakiness signals: retries, waits, timeouts
5. Report: spec-by-spec PASS/WARN/FAIL + coverage gap list

## Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Journey/AC target was read first | cite the journey file and any feature-spec ACs used for the test | |
| 2 | Frontend source was read before selectors were written | cite the page/component files and the toast/notification surface if assertions depend on it | |
| 3 | Selectors are semantic, not brittle | run `node scripts/validate-e2e-selector-discipline.mjs --root .`; justify any `selector-exception` positional role selector | |
| 4 | Test run evidence exists | cite the latest `playwright test` command or equivalent runtime artifact | |
| 5 | Close-out summary matches the latest artifact | final summary quotes or paraphrases the latest failing assertion, latest error signature, or latest passing command rather than an older blocker | |
| 6 | Deploy-before-validate was honored when relevant | if the run claims to validate a live fix, cite `node scripts/verify-deploy-status.mjs` or repo-local equivalent evidence | |
| 7 | Pre/post test comparison recorded when applicable | For regression, flaky-test, reporter, or fix-proving work, cite the exact pre-change command/output, post-change rerun, comparison classification, iteration count, and pre/post evidence validator result per `references/pre-post-validation-loop.md`; otherwise state why N/A. | |
| 8 | Persona trace preserved | for user/admin-facing tests, cite the journey/spec persona ID or path that made this test critical; do not use generic `customer`, `admin`, `all users`, `PASS`, or `satisfied` as the persona proof | |
| 9 | AC tag emitted + columns written back | each test carries a `@AC-<ID>` comment naming the spec AC it exercises; the spec's E2E/Test columns are set for those ACs; `node scripts/verify-test-ac-tags.mjs --root .` reports zero orphan tags | |

If any check FAILs, fix before continuing. If a failure is upstream of the test, report that blocker directly from the latest artifact.

If the latest artifact proves a production or upstream blocker that prevents
honest parent verification, emit `BLOCKING_DISCOVERY` per
`references/blocking-discovery-format.md`, validate it, emit `skill_outcome`
with `block_on_discovery`, and do not mark this task PASS/VERIFIED.

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-JourneyACPreflight --evidence command_output:.svc/write-e2e-preflight.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-FrontendSurfaceRead --evidence command_output:.svc/write-e2e-source-read.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-SelectorPlan --evidence command_output:.svc/write-e2e-selector-plan.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-TestImplementation --evidence file:e2e/specs/<name>.spec.ts
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-RuntimeVerification --evidence command_output:.svc/write-e2e-test-run.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-CloseoutSelfVerify --evidence command_output:.svc/write-e2e-self-verify.log
```

## Pipeline Continuation
### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## Skill Outcome Contract

When this skill discovers new delivery-graph signals, emit `skill_outcome` per
`references/skill-outcome-contract.md` before completing the task.
