---
name: test-journeys
version: "1.0"
handles_concerns:
  - e2e-coverage-for-flow
  - flaky-test-quarantine
description: >
  Journey-based QA of real user flows at any URL (local, preview, staging, prod),
  capturing evidence and writing pass/fail back to spec AC tables. Use for 'run QA by
  journey', 'validate journeys', 'regression pass', 'verify this flow on staging'.
phases:
  - { id: P1-Inputs, trigger: always, reads: [], writes: [], evidence_kind: command_output, required_for_completion: true }
  - { id: P2-RuntimeExecution, trigger: always, reads: [], writes: [], evidence_kind: live_dom, required_for_completion: true }
  - { id: P3-EvidenceCapture, trigger: always, reads: [], writes: [], evidence_kind: screenshot, required_for_completion: true }
  - { id: P4-ACClassification, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
inputs:
  required:
    - { path: "docs/specs/journeys/J*.feature.md", artifact: journey-docs }
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
  optional: []
outputs:
  produces:
    - { path: "docs/specs/features/<name>.md", artifact: qa-updated-spec }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Journey QA AC Testing

## Purpose

Run agentic manual QA the way real QA teams operate:

1. Start from user journeys (`docs/specs/journeys/*.feature.md`)
2. Execute runtime flows at a target environment
3. Validate linked acceptance criteria in feature specs
4. Save evidence and update QA status in AC tables

This skill is manual/agentic QA, not test-file generation.

**Announce at start:** "I'm using the test-journeys skill to validate user journeys."

## Phase Receipt Contract

When a `.svc/lane-tasks-<WI>.json` task is active, record each required phase
before completion:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-Inputs --evidence command_output:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-RuntimeExecution --evidence live_dom:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-EvidenceCapture --evidence screenshot:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ACClassification --evidence file:<path>
```

## Product Questions — shared format

When a journey surfaces undefined behavior, compare current ACs with observed behavior; do not invent the expected result. Follow `_shared/product-question-format.md` with `phase: test-journeys`. Reuse accepted decisions and task authorization; ask only unresolved consequential owner choices. Record real decisions in the existing companion or canonical decision artifact. No empty companion or numeric question floor is required. Unresolved consequential decisions block dependent work.

---

## Scope and Inputs

**Scope and Inputs** — Required input is `target_url` (any reachable URL: local, preview, staging, prod); optional `env` (reporting label only), `mode=smoke|regression|feature-ac|exploratory`, `journey`, `feature`. Test whichever URL the user gives (do not assume live-only) and record `target_url` and `env` in every run summary so results are reproducible. Details: `references/routing-and-guardrails.md`.

Pre/post policy:
- For regression, corrective, deploy-validation, or "prove the fix" runs, load
  `references/pre-post-validation-loop.md` before execution.
- Run the selected journey or smoke path against the pre-change/pre-deploy
  target when reachable, then rerun the same journey, account, viewport stage,
  and target class after the fix or deploy.
- SUMMARY.md must classify the comparison as `fixed-by-change`,
  `branch-introduced`, `pre-existing`, or `blocked`. Do not mark ACs verified
  while an acceptance-critical changed signal is unclassified.
- When writing machine-readable evidence, validate it with
  `node scripts/validate-pre-post-validation-evidence.mjs --evidence <path>`.

## Repository Mode Gate

Detect mode from `REPO_MODES.md` before running:

- `bootstrap`: if journey/spec structure is missing, route to `write-journeys` and/or
  `audit-ac` first.
- `convert`: adapt to existing file naming/layout and preserve current conventions.

If ambiguous, default to `convert`.

---

## Prerequisites

**Prerequisites** — Journey docs (`docs/specs/journeys/*.feature.md`), feature specs, and AC tables in the standard `| AC | Description | QA | E2E | Test |` format must exist; if AC tables are missing or malformed, run `audit-ac` first. For browser-visible features, verify responsive coverage staged desktop-first, so mobile fixes are not tangled with desktop defects: Stage 1 desktop `1280x800` runs first and must be clean (defects fixed or filed as HIGH/CRITICAL WIs) before Stage 2 mobile `375x812`; Stage 3 tablet `768x1024` only when UX/UI define tablet behavior. Claiming both viewports covered without staging is a contract violation (mark the untested one `⏭️ staging-blocked` and file a WI); skip viewports only for features with no visual surface, say so in SUMMARY.md, and record `viewport_stage=desktop|mobile|tablet` for every run. Details: `references/prerequisites.md`.

AC tags: when this QA pass produces or repairs an automated check in test source (a
smoke spec, a code-inspection harness, or an E2E follow-up authored inline),
tag the spec acceptance criterion it exercises with a `@AC-<ID>` comment in the
test, using the spec AC ID verbatim (`{SECTION-PREFIX}-{NN}`, e.g. `@AC-NAV-01`,
uppercase — the case is the contract). This is the same machine-readable
test-side anchor `write-e2e` emits; it lets
`node scripts/verify-test-ac-tags.mjs --root .` confirm the tag resolves to a
real spec AC and lets sync-spec-code's `[TEST]`-tier audit derive coverage
instead of hand-copying it. Manual-only QA (no test source touched) writes the
`QA` column as before and emits no tag.

## Core Modes

### 1) `smoke`

**`smoke`** — Run only the critical paths of the selected journeys (auth/session entry, primary action, success state, critical failure guardrail) for fast confidence after a deploy or risky merge. Details: `references/core-modes-basic.md`.

### 2) `regression`

**`regression`** — Run full journey scenarios and all mapped ACs for the selected scope, for release readiness or wide-impact changes. Details: `references/core-modes-basic.md`.

### 3) `feature-ac`

**`feature-ac`** — Run AC-focused QA for one feature spec, still executing through journey flow contexts rather than isolated clicks, when asked to verify feature X against its spec. Details: `references/core-modes-basic.md`.

### 4) `exploratory`

**`exploratory`** — Run unscripted, risk-guided QA around journey transitions and edge states (boundary values, empty states, rapid actions, invalid input, interruption, permission edges, responsive, accessibility, state persistence, concurrency), recording for each issue the exact steps, a screenshot, expected behavior and severity Critical/High/Medium/Low, and route discovered gaps to the right skill. Details: `references/core-modes-basic.md`.

### Cross-System Journey Validation

For OAuth, hosted login, SSO, payments, webhooks, native/WebView handoffs,
deep links, push notifications, sync, streaming tool calls, provider callbacks,
or any journey crossing runtimes/origins/protocols/SDKs/storage layers:

1. Open the relevant System Contract Map at
   `docs/specs/contract-maps/<flow-name>.md`.
2. Validate it with
   `node scripts/validate-system-contract-map.mjs --map <path>`.
3. Execute at least one journey assertion per handoff-table row, including the
   receiver storage/reader named in the map.
4. If the fix is a migration or path swap, attach old-path-fails /
   new-path-passes probe JSON and validate it with
   `node scripts/validate-cross-system-probe-evidence.mjs --evidence <path>`.
5. Mark the journey blocked, not passed, when a provider credential, callback,
webhook delivery, or native runtime needed to falsify the map is unavailable.

### Provider-Visible Analytics And Replay Gate

When the journey request, feature spec, AC, or closeout claim mentions
analytics, telemetry, tracking, PostHog, replay, product analytics, event
visibility, session replay, provider dashboards, or "prove it in the provider",
the journey is not complete until the provider-visible evidence is verified.

Before browser execution:

1. Create a unique run marker and record it in the evidence summary. Prefer the
   project standard name when it exists, such as `HH_E2E_RUN` or
   `E2E_POSTHOG_RUN_ID`; otherwise use a project-scoped marker such as
   `e2e_run_id=<YYYYMMDD>-<journey>-<short-random>`.
2. Apply the marker through the project's shared E2E/login/bootstrap helpers
   before the app initializes. Do not scatter one-off localStorage snippets if a
   shared helper exists.
3. If analytics is consent-gated, set the required Analytics consent state
   before the analytics SDK initializes. A journey that clicks consent after the
   provider SDK was already suppressed or initialized without consent must prove
   the provider event still arrived.
4. Record the provider host/region, project id or project token label, event
   names expected, and the safe marker property that will be queried. Never put
   provider secret keys in SUMMARY.md or evidence files.

After the browser journey passes:

1. Query the provider by exact run marker, governed event name, session id,
   replay id, or provider-distinct id. Do not rely on "latest event" in a shared
   project.
2. Verify each expected product event exists with the expected safe properties.
3. Verify prohibited PII properties are absent from captured events and replay
   metadata. At minimum check for raw password, OTP, full payment card data,
   full address, auth token, session token, and unredacted secret values.
4. When replay/session visibility is in scope, verify the provider has a
   replay/session record linked to the same marker or distinct id.
5. Verify test traffic is identifiable, for example `traffic_type=e2e`,
   `hh_e2e_run=<id>`, or an equivalent project-approved marker.

Write a durable artifact at
`docs/specs/features/test-evidence/<run-dir>/PROVIDER_ANALYTICS_EVIDENCE.md`
containing:

- provider name, region/host, and project identifier label;
- run marker name and value;
- journey id, command, target URL, account role, and timestamp;
- expected event names and actual provider event ids/timestamps;
- expected safe properties and prohibited PII property checks;
- replay/session id and URL when replay is in scope;
- provider query method used, with secrets redacted;
- final result: `PASS`, `FAIL`, or `BLOCKED`.

SUMMARY.md must link this artifact and state `provider_visible=true`. If the
provider cannot be queried because credentials, API access, retention, or
dashboard permissions are unavailable, mark the relevant scenario
`skipped-infeasible` or `BLOCKED` with a follow-up WI. Do not claim
provider-visible analytics or replay evidence from Playwright/browser pass
status alone.

### Base44 E2E Account OTPs

**Base44 E2E Account OTPs** — For Base44 journeys that create or prepare generated E2E auth accounts, load `rules/base44/e2e-otp-connector.md` BEFORE declaring the account gate blocked or adding mailbox automation; prefer an installed mailbox connector, then `base44.auth.verifyOtp(...)` and an immediate password-login preflight. Do not write one-off Gmail OAuth refresh-token scripts while a connector can read the OTP mailbox, and keep OTP values in process memory, never in evidence artifacts or reports. Details: `references/core-modes-basic.md`.

## Execution Workflow

### Step 0.5: Scenario Inventory (before execution)

Enumerate every `# Scenario:` block in the in-scope journey docs and write `<evidence-dir>/scenarios.json` (id, title, journey, ac_ids, status, skip_reason, wi_path). Every scenario ends as exactly one of `executed` (spec AC column updated plus screenshot path), `skipped-infeasible` (runtime blocker with cited evidence and a WI routed to `write-e2e`, `wi_path` filled) or `skipped-user-approved` (quoted approval and timestamp). Efficiency skips are not allowed, because a silently skipped scenario reads as covered: propose the skip to the user or execute. Update statuses as you go. Details: `references/execution-steps.md`.

### Step 1: Select Journey Scope

- Load target journey docs.
- Extract scenarios and expected outcomes.
- For each scenario, identify mapped AC IDs from related feature specs.

If mapping is missing, create a gap note and continue with explicit assumptions.

### Step 2: Preflight Target Environment

Validate:
- `target_url` reachable
- authentication path usable for the scenario
- required test data/state available

If preflight fails, stop with a concise blocker report.

### Step 2.1: Reporter/Runner Env Parity Gate

Before accepting any "blocked: credentials missing" or coverage-reporter result
as truth, verify the reporter uses the same env-loading and account-resolution
contract as the E2E runner.

Required checks:
- The reporter loads the same env files as the runner (`.env`, `.env.local`,
  `.env.test`, CI-provided env, or the repo-local equivalent).
- The reporter recognizes the same role/account-pool credential names as the
  tests, including stream-specific aliases such as
  `TEST_OWNER_EMAIL_STREAM_A`, `TEST_OWNER_EMAIL_STREAM_B`,
  `TEST_CUSTOMER_EMAIL_STREAM_A`, and `TEST_CUSTOMER_EMAIL_STREAM_B` when the
  project uses them.
- Generic aliases such as `TEST_OWNER_EMAIL` and `TEST_CUSTOMER_EMAIL` are not
  treated as the only valid source of journey coverage.

If the runner can execute a journey with available credentials but the reporter
marks the same journey blocked, classify that as a reporter/tooling bug. Fix or
file that bug before using the coverage number for closeout.

### Step 2.5: Static AC Pre-check (Code Inspection — do this BEFORE opening a browser)

Before any browser work, classify each AC by verifiability tier AND intent:

| Tier | AC type | Verification method |
|------|---------|-------------------|
| **S0 — Static** | CSS class presence, Tailwind token wired, HTML attribute set, config value, enum shape | grep/Read source files. Mark PASS/FAIL from code. No browser needed. |
| **S1 — Runtime** | Element *renders correctly*, text visible, click behavior, navigation flow, API response, CSS actually applies visually | Browse tool or Playwright MCP. |
| **S2 — Human** | Subjective visual quality, real-account data requirements that can't be mocked | User delegation. Last resort only. |

**S0 is necessary but not always sufficient:** CSS class presence ≠ correct rendering. A class like `dark:from-purple-950/50` can be present in the source but still fail to render correctly because:
- Tailwind JIT didn't emit the utility into the final CSS (dynamic / concatenated class strings)
- A higher-specificity rule overrides `dark:` variants
- The referenced CSS custom property (e.g., `--background`) isn't defined in the dark theme
- Opacity modifiers like `/50` at color `950` produce a visually-wrong result

**AC tier classifier — match AC phrasing to required tiers:**

| AC phrasing pattern | Required tiers | Example |
|---|---|---|
| "X class is present / wired / set" | S0 only | "dark:bg-background token is applied to Layout root" |
| "X does not show / displays correctly / appears as" | S0 **+ S1** | "CustomerPoints tier card does NOT show light gradient in dark mode" |
| "X renders correctly at breakpoint / in dark mode / with state Y" | S0 **+ S1** (screenshot) | "LoyaltyProgram stat cards render correctly on mobile" |
| "X matches design token / matches baseline" | S0 **+ track-visuals diff** | "Home page matches visual baseline after theme change" |
| "Global grep for pattern X returns 0" | S0 plus an **adjacent-pattern sweep** | see P0-2 in evolution 2026-04-14 |

**Every visual-rendering AC needs at least one screenshot or track-visuals diff, even if S0 passes.** Marking a rendering AC ✅ with only a grep is a contract violation — it blesses a false negative.

For visual-rendering ACs that modify an existing component, existing screen,
shared component, or route, evidence must also cite the Production-Derived Mock Parity Ledger
from `design-ui`. The journey screenshot or `track-visuals` diff must cover the
ledger-listed component usage, current-state comparison, intended final-state
outcome, state, viewport, and AC/journey mapping. A final-only screenshot that
ignores the pre-existing component is not verified.

**Run the S0 check for every AC before launching a browser:**

```bash
# CSS class presence — example: confirm dark: overrides exist on gradient elements
grep -n 'bg-gradient' src/pages/CustomerPoints.jsx | \
  awk '{print $0, (/dark:from/ ? "✅" : "❌ MISSING dark:from")}'

# Configuration value — example: confirm feature flag is wired
grep -rn 'ENABLE_FEATURE_X' src/ --include="*.jsx"
```

**S0 grep discipline — avoid narrow patterns:**

When the AC's PASS criterion is a grep, run BOTH:
1. **Narrow match** (exact AC wording) — proves the specific thing.
2. **Adjacent-pattern sweep** — checks variants the narrow match misses.

Example: `from-{color}-50` was the WI-048 narrow match. The adjacent sweep must also check `via-{color}-50`, `to-{color}-50`, `from-white`, `to-white`, and opacity modifiers. See `references/validation-patterns.md` for the common pattern families.

**S0 evidence format:** `✅ MM-DD (code) <file>:<lines> — <what was confirmed>` — add `+S1 screenshot` or `+track-visuals diff <path>` for visual-rendering ACs.

**Escalate to S1 when:**
- The AC tests runtime behavior (clicks, navigation, data fetch, form submit, toast display), OR
- The AC says the element *does not show / renders / appears* — visual-rendering ACs need S1 even when S0 passes.

**Escalate to S2 only when ALL THREE conditions hold:**

1. The AC requires **personalised real-account data that varies per user** (the user's own tier card, own rewards, own subscription state, own messages). Shared fixtures do not count — those are S1.
2. The personalisation **cannot be provisioned** by an E2E fixture, seeded via the SDK, or emulated with a test account. (If a disposable-fixture script can set up the required state, it's S1.)
3. The `browse` daemon **cannot render the state** even with correct auth — e.g. the state depends on a push notification delivered to a physical device, or a real payment confirmation, or an email delivered to an external inbox.

Record the S2 justification in SUMMARY.md by listing each of the three conditions that apply. Use machine-readable markers on each S2 row: `subjective_or_real_data=true automation_exhausted=true user_only_claim=true`. An S2 call without explicit justification against all three conditions is a contract violation.

**Behavioural / flow ACs on public entry points are not S2 candidates.** Invite acceptance, role selection, signup, clock-in/out, search, filter, add-to-cart, settings changes — these run the same for every account. Even if they require a fresh-state account, use disposable-fixture provisioning (seed via SDK or reset an existing fixture) rather than user-handoff.

**S2 is the last resort, not the default.** Before choosing S2, spend at least one tool-call attempting S1 with the `browse` daemon. If the attempt surfaces a provisioning gap, route it to `write-e2e` (or `provision-fixture`) as `skipped-infeasible` — don't hand off to the user.

### Step 3: Execute Scenario Runtime Flow (Real Browser)

**Step 3: Execute Scenario Runtime Flow (Real Browser)** — Run a browse-daemon pre-flight before any browser work; use the `browse` CLI when healthy, Playwright MCP only if it fails (log the warning), and delegate to the user (S2) only as a last resort after S1 is shown impossible. Use a real browser only for S1 ACs that passed the Step 2.5 code pre-check, bootstrap auth once per session from `e2e/helpers/browse-auth.md` (create it if missing), and verify Given/When/Then outcomes, error, loading and empty states, navigation and responsive behavior. Capture one screenshot per AC verification (PASS and FAIL) at `.svc/visuals/<WI>/<JourneyID>-step<N>-<state>-<viewport>.png` (or `.svc/visuals/adhoc-<date>/`), never elsewhere (track-visuals only reads that tree); every visual AC marked ✅ cites its screenshot path; capture console errors (`browse console --errors`) and network failures (`browse network`). Details: `references/execution-steps.md`.

### Step 4: Update Feature Specs (Source of Truth)

**Step 4: Update Feature Specs** — Write QA column statuses in the AC tables (`✅ MM-DD`, `✅ MM-DD (code) path:line`, `❌ MM-DD`, `⚠️ MM-DD`, `⏭️ reason`, `—`) and add bug blockquotes directly under the relevant AC for failures. Details: `references/misc-sections.md`.

### Step 4.5: Open Work Items for Defects (before Step 5)

Findings that don't become work items don't get prioritised, assigned, or scheduled. Bug blockquotes in specs are not a substitute for a WI file.

- **CRITICAL / HIGH findings:** create `docs/work-items/WI-<NNN>-<slug>.md` before Step 5. Template fields: title, severity, status=OPEN, reproduction (scenario ID + evidence screenshot path), expected vs actual, linked AC IDs, affected files/specs or `unknown: <reason>`, suggested owner skill.
- **MEDIUM findings:** Create a WI unless the user explicitly opts out. Default is create.
- **LOW findings:** Either file a single rolling `WI-auto-<date>-minor-findings.md` or route to `quick-fix`.
- **Spec drift (contradictions between spec and code):** WI routed to `sync-spec-code` with both sides cited.
- **Behavioural defects / regressions:** WI routed to `diagnose-bug`.
- **Skipped-infeasible scenarios** (from Step 0.5): WI routed to `write-e2e` with provisioning requirements noted — E2E fixtures can provision state manual testing cannot.

Each WI file must reference its evidence screenshot under `.svc/visuals/<WI>/`. Cross-link: SUMMARY.md lists all WIs created in this run.

### Step 5: Save Evidence and Summary

**Step 5: Save Evidence and Summary** — Write evidence under `docs/specs/features/test-evidence/{YYYY-MM-DD}-{env}-{journey-or-feature}/`; SUMMARY.md must include target URL and env, mode, viewport coverage, pass/fail counts, blockers and follow-ups, pre/post evidence and classification when corrective, `provider_visible=true|false` (link `PROVIDER_ANALYTICS_EVIDENCE.md` when true), allowed next skills derived from the routing table for this run's findings, and the `node scripts/verify-skill-contract.mjs test-journeys-closeout --summary <SUMMARY.md> --scenarios <scenarios.json> --next <next-skill>` result. Before declaring the run complete, run `node scripts/validate-journey-execution-trace.mjs --summary <run-dir>/SUMMARY.md --scenarios <run-dir>/scenarios.json`. Details: `references/execution-steps.md`.

### Step 6: Commit Results (before declaring done)

A QA run that leaves a dirty tree is not complete. Stage only the affected spec, the run's SUMMARY.md and scenarios.json, and the new WI files (not `git add -A`, which sweeps in unrelated work), commit as `docs(qa): <journey-ids> regression <date> — AC updates + findings`, and do not auto-push; surface the unpushed commit in the final report. If the project requires PRs, branch `qa/<journey-ids>-<date>` first. Details: `references/execution-steps.md`.

## Routing Rules

**Routing Rules** — Route findings automatically, and every route also gets a WI file (Step 4.5): missing or vague ACs -> `audit-ac`; wrong journey transitions -> `write-journeys`; spec-vs-code contradictions -> `sync-spec-code`; behavioural defects or regressions -> `diagnose-bug`; skipped-infeasible scenarios -> `write-e2e` with provisioning needs; stable validated flows -> `write-e2e`; known-limitation ACs (⛔ E2E) -> WI only if the user confirms. Details: `references/routing-and-guardrails.md`.

## Guardrails

1. Do not create separate QA truth docs when feature specs already hold AC status.
2. Keep bug blockquotes current: remove them after re-verification passes.
3. Do not mark AC `✅` without evidence or explicit code verification reference.
4. Keep environment details explicit so results are reproducible.
5. Do not mark browser-visible QA complete without the required viewport evidence or an explicit non-applicability note.
6. **Do not delegate an AC to the user as "awaiting visual confirmation" if a grep or file read can answer it** — and do not mark a visual-rendering AC ✅ on grep alone. CSS class presence, token coverage, config values, and structural attributes are S0 (code inspection). Run Step 2.5 first. User delegation (S2) requires an explicit statement of why S1 also could not work.
7. **Do not skip a scenario for efficiency.** The only allowed skip reasons are `infeasible` (with cited runtime evidence + WI routed to `write-e2e`) or `user-approved` (with quoted approval). "Low value given time" or "inverse of another test" or "requires setup" are not allowed skip reasons — either execute the scenario, file a WI, or surface the proposal to the user for explicit approval.
8. **Do not store screenshots outside `.svc/visuals/<WI>/`** (or `.svc/visuals/adhoc-<date>/` when no WI). Captures elsewhere are structurally dead — they cannot feed `track-visuals` diff/review/promote.
9. **Do NOT claim analytics, telemetry, PostHog, replay, or provider-dashboard visibility from a Playwright/browser pass alone.** Provider-visible claims need the Provider-Visible Analytics And Replay Gate evidence above.

---

## Relationship to E2E

- `test-journeys`: manual/agentic runtime verification and evidence.
- `write-e2e`: durable automated tests after flows are validated.
- Any E2E follow-up, fixture WI, or generated test skeleton from a journey run
  must inherit `write-e2e` selector discipline. Positional role selectors
  (`getByRole(...).first()`, `.last()`, `.nth()`) require a `selector-exception`
  because no stable alternative exists. Validate proposed test artifacts with
  `node scripts/validate-e2e-selector-discipline.mjs --root .`.

Recommended sequence:
1. `test-journeys`
2. Fix defects
3. `write-e2e`

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)

Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. Follow `references/task-graph-chaining-protocol.md`: treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, mark this skill's task `completed` before leaving, then load the next runnable task's skill (marking it `in_progress`) or mark it `completed` with a skip reason. Mirror status to the host UI only from the parent session (Claude `TaskList`/`TaskUpdate`; Kimi `/task` observation; in Codex, mirror only the active step in `update_plan`); a subagent (`SVC_SUBAGENT=1`) leaves mirroring to the parent, because a failed mirror call silently drifts from the file.

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | QA column in AC tables updated | grep for QA status markers in `docs/specs/features/<name>.md` | |
| 2 | Evidence captured under track-visuals path | `test -d .svc/visuals/<WI>/` and `.png` files present | |
| 3 | No blocking unresolved consequential decisions | Apply the shared promotion predicate. Inspect TBD/TODO as evidence-gap warnings: block missing required AC/state/dependency evidence or a consequential owner choice; explicitly defer harmless details without manufacturing answers | |
| 4 | Scenario inventory terminal | every entry in `scenarios.json` has `status != "pending"` and any skipped entry has `skip_reason ∈ {infeasible, user-approved}` with `wi_path` set when infeasible | |
| 5 | WI files created for every HIGH/CRITICAL finding | `ls docs/work-items/WI-*-<date>-*.md` count ≥ count of HIGH/CRITICAL in SUMMARY.md | |
| 6 | Visual-AC screenshots cited | `grep -E '✅.*screenshot=' <spec>.md \| wc -l` ≥ count of visual ACs marked ✅ | |
| 7 | Viewport stage recorded | SUMMARY.md contains `viewport_stage=desktop\|mobile\|tablet`; if `mobile` present, `desktop` is clean (defects fixed or filed as HIGH WI) | |
| 8 | Working tree clean | `git status --short` lists no modified spec files, no untracked files under `docs/specs/features/test-evidence/<run-dir>/`, no untracked WI files from this run | |
| 9 | Close-out uses the latest runtime artifact | final summary cites the latest scenario result, failing assertion, or blocking runtime artifact rather than an earlier hypothesis | |
| 10 | Suggested next skill is allowed by the routing table | `node scripts/verify-skill-contract.mjs test-journeys-closeout --summary docs/specs/features/test-evidence/<run-dir>/SUMMARY.md --scenarios docs/specs/features/test-evidence/<run-dir>/scenarios.json --next <proposed-next-skill>` passes. | |
| 11 | Journey execution trace validates | `node scripts/validate-journey-execution-trace.mjs --summary docs/specs/features/test-evidence/<run-dir>/SUMMARY.md --scenarios docs/specs/features/test-evidence/<run-dir>/scenarios.json` passes | |
| 12 | Pre/post comparison recorded when applicable | For regression, corrective, or deploy-validation runs, SUMMARY.md includes the exact pre and post journey/command evidence, comparison classification, iteration count, and pre/post evidence validator result per `references/pre-post-validation-loop.md`; otherwise states N/A with reason. | |
| 13 | Provider-visible analytics/replay evidence recorded when claimed | If SUMMARY.md says `provider_visible=true`, `PROVIDER_ANALYTICS_EVIDENCE.md` exists, names the run marker, lists provider events/replay checks, checks prohibited PII, and does not use latest-event polling as proof. | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

If journey execution discovers a behavioral blocker that prevents honest AC
validation for the parent WI, emit `BLOCKING_DISCOVERY` per
`references/blocking-discovery-format.md`, validate it, emit `skill_outcome`
with `block_on_discovery`, and record the parent as blocked rather than
validated.

Before presenting a direct next-skill recommendation, validate it:

```bash
node scripts/verify-skill-contract.mjs test-journeys-closeout \
  --summary docs/specs/features/test-evidence/<run-dir>/SUMMARY.md \
  --scenarios docs/specs/features/test-evidence/<run-dir>/scenarios.json \
  --next <proposed-next-skill>
```

This is a hard guard against routing drift. review-gate is not an allowed direct next skill for behavioural regressions found by `test-journeys`.

### Chaining

Apply the task-graph protocol above, then:

**If `--progressive` flag is absent:**
- Report results to user
- If findings include behavioural defects or regressions: suggest `diagnose-bug` (or `quick-fix` for bounded LOW findings), never `review-gate`
- If the selected journeys are stable and validated: suggest `write-e2e`

Not part of progressive chains (invoked standalone or by verify-promotion).

## Post-Compaction Recovery

If context was compacted and you lost framework state, read `.svc/lane-tasks-<WI>.json` (sole source of truth), find the first `in_progress` or else first unblocked `pending` task, re-load the skill with `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`, re-read this SKILL.md, and resume. Never ghost-complete: verify `skill_receipt` exists before marking any task complete. Details: `references/misc-sections.md`.

## Feature Validation Ledger Handoff

**Feature Validation Ledger Handoff** — When a user-facing or admin-facing graph requires `feature_validation_closeout`, write runtime results as `AC ID | journey scenario(s) | PASS/FAIL/BLOCKED — summary | evidence paths` rows ready to copy into `FEATURE_VALIDATION_LEDGER.md`, and name a follow-up WI for every blocked or failed result; never leave the ledger to infer coverage from a generic browser smoke summary. Details: `references/misc-sections.md`.

## Generated Outcome Journey Contract

**Generated Outcome Journey Contract** — For provider-backed generation flows a journey is incomplete until it proves all six lifecycle states (Start, Generate, Draft visible before save, Save, Return via the normal product path, Persisted display with provider/source evidence) or records a blocked WI. Write provider/source, fallback policy and approval, saved outcome and evidence paths into `PROVIDER_FIDELITY_EVIDENCE.md`; a draft-only preview never satisfies a saved-result journey. Details: `references/routing-and-guardrails.md`.

**Boilerplate rationale:** references/phase-receipts.md supersedes duplicate task-graph boilerplate cleanup for journey skills. Chaining now points at `references/task-graph-chaining-protocol.md` instead of carrying host-specific copies; future changes update the shared phase-receipt/task-graph references first and rely on validators rather than hand-maintained journey-skill copies.

## Skill Outcome Contract

When this skill discovers new delivery-graph signals, emit `skill_outcome` per
`references/skill-outcome-contract.md` before completing the task.
