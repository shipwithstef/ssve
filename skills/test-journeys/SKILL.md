---
name: test-journeys
version: "1.0"
handles_concerns:
  - e2e-coverage-for-flow
  - flaky-test-quarantine
description: >
  Journey-first manual QA that validates real user flows against journey scenarios
  and mapped acceptance criteria. Use when the user says "run QA by journey",
  "validate journeys", "manual QA pass", "regression pass", "smoke test with ACs",
  or "verify this flow on staging/local/prod". This skill verifies runtime behavior
  at any reachable URL (localhost, preview, staging, production), captures evidence,
  and writes QA status back to feature spec AC tables.
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

## Product Questions — MANDATORY format

When a journey surfaces undefined behavior, compare current ACs with observed behavior; do not invent the expected result. Follow `_shared/product-question-format.md` with `phase: test-journeys`. Reuse accepted decisions and task authorization; ask only unresolved consequential owner choices. Record real decisions in the existing companion or canonical decision artifact. No empty companion or numeric question floor is required. Unresolved consequential decisions block dependent work.

---

## Scope and Inputs

Required input:
- `target_url`: any reachable app URL (`http://localhost:3000`, preview URL, staging, prod)

Optional inputs:
- `env=local|preview|staging|prod|custom` (reporting label only)
- `mode=smoke|regression|feature-ac|exploratory`
- `journey=<journey-id-or-file>`
- `feature=<feature-spec-file>`

Environment policy:
- Do not assume "live-only". Test whichever URL the user provided.
- Record `target_url` and `env` in every run summary.

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

---

## Repository Mode Gate

Detect mode from `REPO_MODES.md` before running:

- `bootstrap`: if journey/spec structure is missing, route to `write-journeys` and/or
  `audit-ac` first.
- `convert`: adapt to existing file naming/layout and preserve current conventions.

If ambiguous, default to `convert`.

---

## Prerequisites

Before testing:

1. Journey docs exist: `docs/specs/journeys/*.feature.md`
2. Feature specs exist: `docs/specs/features/*.md`
3. AC tables use the standard format:
   `| AC | Description | QA | E2E | Test |`

If AC tables are missing or malformed, run `audit-ac` first.

When this QA pass produces or repairs an automated check in test source (a
smoke spec, a code-inspection harness, or an E2E follow-up authored inline),
tag the spec acceptance criterion it exercises with a `@AC-<ID>` comment in the
test, using the spec AC ID verbatim (`{SECTION-PREFIX}-{NN}`, e.g. `@AC-NAV-01`,
uppercase — the case is the contract). This is the same machine-readable
test-side anchor `write-e2e` emits; it lets
`node scripts/verify-test-ac-tags.mjs --root .` confirm the tag resolves to a
real spec AC and lets sync-spec-code's `[TEST]`-tier audit derive coverage
instead of hand-copying it. Manual-only QA (no test source touched) writes the
`QA` column as before and emits no tag.

For browser-visible features, responsive verification is baseline scope **staged desktop-first**:

- **Stage 1 — Desktop (`1280x800`)** is MANDATORY first pass. Run the full scenario set at desktop, capture evidence, file WIs for defects. Do not proceed to Stage 2 until Stage 1 defects are either fixed or filed as HIGH/CRITICAL WIs.
- **Stage 2 — Mobile (`375x812`)** runs after Stage 1 is clean. Repeating scenarios on mobile before desktop defects are fixed produces duplicate failure noise and no new signal.
- **Stage 3 — Tablet (`768x1024`)** only when UX/UI docs define tablet-specific behavior or a distinct layout.
- A single-pass claim that "both viewports are covered" without staging is a contract violation. Mark the untested viewport `⏭️ staging-blocked` with reason "desktop baseline not yet clean" and file a follow-up WI.
- Only skip viewport coverage entirely when the feature has no visual surface; record that explicitly in SUMMARY.md.
- Record `viewport_stage=desktop|mobile|tablet` in SUMMARY.md for every run.

---

## Core Modes

### 1) `smoke`

Run only critical paths for selected journeys:
- Auth/session entry
- Primary user action
- Success state visibility
- Critical failure guardrail

Use for fast confidence after deploy or risky merges.

### 2) `regression`

Run full journey scenarios and all mapped ACs for selected scope.

Use for release readiness or wide-impact changes.

### 3) `feature-ac`

Run AC-focused QA for one feature spec while still executing through journey flow
contexts (not isolated clicks).

Use when a team asks for "verify feature X against spec".

### 4) `exploratory`

Run unscripted, risk-guided QA around journey transitions and edge states.
Record discovered gaps and route them to the right skill.

**Exploratory testing patterns** (run through each in the browser):

| Pattern | What to try | Looking for |
|---------|------------|-------------|
| **Boundary values** | Min/max lengths, zero, negative, huge numbers | Crashes, truncation, overflow |
| **Empty states** | Fresh account, no data, cleared filters | Missing empty state UI, errors |
| **Rapid actions** | Double-click submit, rapid navigation, back/forward | Duplicate submissions, race conditions |
| **Invalid input** | SQL injection, XSS payloads, Unicode, emoji, RTL text | Security holes, encoding bugs |
| **Interruption** | Refresh mid-form, close tab mid-upload, network offline | Lost data, stuck states |
| **Permission edges** | Access URLs directly without auth, tamper with IDs in URL | Auth bypass, IDOR |
| **Responsive** | Resize to mobile/tablet/desktop breakpoints | Broken layout, unreachable elements |
| **Accessibility** | Tab through all interactive elements, screen reader flow | Missing focus indicators, broken tab order |
| **State persistence** | Refresh page, navigate away and back, close and reopen | Lost form data, reset state |
| **Concurrency** | Open same page in two tabs, edit same resource | Conflicts, stale data |

For each discovered issue, record:
- What you tried (exact steps)
- What happened (screenshot)
- What should have happened (from spec/journey/common sense)
- Severity: Critical / High / Medium / Low

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

For Base44 journeys that create or prepare generated E2E auth accounts, load
`rules/base44/e2e-otp-connector.md` before declaring the account gate blocked or
adding mailbox automation. The preferred path is an installed mailbox connector
for the forwarded test-domain inbox, followed by `base44.auth.verifyOtp(...)`
and an immediate password-login preflight.

Do not add one-off Gmail OAuth refresh-token scripts while a connector can read
the OTP mailbox. OTP values must stay in process memory and must not appear in
evidence artifacts or final reports.

---

## Execution Workflow

### Step 0.5: Scenario Inventory — MANDATORY BEFORE EXECUTION

Before running any scenarios, build and persist the complete inventory.

1. Enumerate every `# Scenario:` block in the in-scope journey docs.
2. Write to `<evidence-dir>/scenarios.json` with schema:
   ```json
   [
     { "id": "J04-scenario-01", "title": "...", "journey": "J04",
       "ac_ids": ["EMP-21", "EMP-22"],
       "status": "pending",
       "skip_reason": null, "wi_path": null }
   ]
   ```
3. Every scenario MUST end in exactly one of these terminal statuses:

   | Status | When allowed | Required artefact |
   |---|---|---|
   | `executed` | scenario was actually run | spec AC column updated + screenshot filepath |
   | `skipped-infeasible` | runtime environment blocks the scenario (fresh-account requirement, external dependency, backend flag off) with cited evidence | mandatory WI routed to `write-e2e` with the provisioning gap recorded — `wi_path` filled |
   | `skipped-user-approved` | user explicitly said "don't run this one" | quoted approval + timestamp in the entry |

   **Efficiency skips are NOT an allowed terminal state.** If the runner believes a scenario is low-value to execute, they must either surface the proposal to the user (who chooses `skipped-user-approved`) or execute it.

4. Update status as execution proceeds.

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

**Critical: S0 is NECESSARY but not always SUFFICIENT.** CSS class presence ≠ correct rendering. A class like `dark:from-purple-950/50` can be present in the source but still fail to render correctly because:
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
| "Global grep for pattern X returns 0" | S0, but MUST also run **adjacent-pattern sweep** | see P0-2 in evolution 2026-04-14 |

**Any visual-rendering AC MUST include at least one screenshot or track-visuals diff, even if S0 passes.** Marking a rendering AC ✅ with only a grep is a contract violation — it blesses a false negative.

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
- The AC says the element *does not show / renders / appears* — visual-rendering ACs REQUIRE S1 even when S0 passes.

**Escalate to S2 ONLY when ALL THREE conditions hold:**

1. The AC requires **personalised real-account data that varies per user** (the user's own tier card, own rewards, own subscription state, own messages). Shared fixtures do not count — those are S1.
2. The personalisation **cannot be provisioned** by an E2E fixture, seeded via the SDK, or emulated with a test account. (If a disposable-fixture script can set up the required state, it's S1.)
3. The `browse` daemon **cannot render the state** even with correct auth — e.g. the state depends on a push notification delivered to a physical device, or a real payment confirmation, or an email delivered to an external inbox.

Record the S2 justification in SUMMARY.md by listing each of the three conditions that apply. Use machine-readable markers on each S2 row: `subjective_or_real_data=true automation_exhausted=true user_only_claim=true`. An S2 call without explicit justification against all three conditions is a contract violation.

**Behavioural / flow ACs on public entry points are NEVER S2 candidates.** Invite acceptance, role selection, signup, clock-in/out, search, filter, add-to-cart, settings changes — these run the same for every account. Even if they require a fresh-state account, use disposable-fixture provisioning (seed via SDK or reset an existing fixture) rather than user-handoff.

**S2 is LAST RESORT, not the default.** Before choosing S2, spend at least one tool-call attempting S1 with the `browse` daemon. If the attempt surfaces a provisioning gap, route it to `write-e2e` (or `provision-fixture`) as `skipped-infeasible` — don't hand off to the user.

**Important:** Do NOT delegate an AC to the user as "awaiting visual confirmation" if a grep or file read can answer it. But also do NOT mark a visual-rendering AC ✅ based on grep alone — class presence ≠ correct rendering.

### Step 3: Execute Scenario Runtime Flow (Real Browser)

**Browser pre-flight — MANDATORY before any browser work:**

```bash
BROWSE="$HOME/gstack/browse/dist/browse"
if $BROWSE status 2>&1 | grep -q "Status: healthy"; then
  echo "✅ browse daemon ready — using gstack browse (low token cost, auth persists)"
  USE_BROWSE=true
else
  echo "⚠️  WARNING: browse daemon unavailable — falling back to Playwright MCP"
  echo "   Why this matters:"
  echo "   • Token cost: ~3-5x higher (MCP schema overhead per call vs plain Bash)"
  echo "   • Auth state: resets between commands — must re-login each run"
  echo "   • Startup: cold-start per session vs ~100ms persistent daemon"
  echo "   Fix permanently: bash $(cd "$(dirname "$0")" && pwd)/scripts/install-browse.sh" # or bash <SKILLS_PATH>/scripts/install-browse.sh from the installed skills root
  USE_BROWSE=false
fi
```

Use a real browser for S1 ACs only (runtime behavior that passed the S0 pre-check). Tools in order:
1. **Browse tool** (`browse` CLI) — persistent headless Chromium daemon, lowest token cost, login state persists across commands. See `references/browse-integration.md` for setup. **Use this when pre-flight passes.**
2. **Playwright MCP** (`browser_navigate`, `browser_click`, `browser_snapshot`, `browser_take_screenshot`) — fallback ONLY when pre-flight shows browse unavailable. **Log the warning above before proceeding.**
3. **User delegation (S2)** — LAST RESORT. Only after confirming S1 cannot work (needs real account data, auth flow too expensive). State the reason explicitly.

**Auth bootstrap — run once per session before any journey testing:**

Check for a project auth helper first:
```bash
# Project-specific auth sequence (preferred — avoids per-run login)
ls e2e/helpers/browse-auth.md 2>/dev/null && cat e2e/helpers/browse-auth.md
```

If `browse-auth.md` exists, follow it. If it doesn't exist, perform login manually and then **create it** so the next run doesn't repeat this work:

```bash
# Template: e2e/helpers/browse-auth.md
# Role: owner | employee | customer
# 1. browse goto <app-url>
# 2. browse snapshot -i   # find Sign In button ref
# 3. browse click @eN     # click Sign In
# 4. browse fill @eM "email@example.com"
# 5. browse fill @eK "password"
# 6. browse click @eJ     # submit
# 7. browse snapshot -i   # confirm logged-in state (look for dashboard/home)
# Save this sequence → next run starts from step 1, already authenticated
# (browse daemon persists cookies for the full session)
```

For each scenario:

**Navigate and interact (browse CLI):**
```bash
browse goto <target_url>           # navigate
browse snapshot -i                 # ARIA tree with @refs
browse click @e3                   # click by ref
browse fill @e4 "test@example.com" # fill input
browse screenshot /tmp/evidence.png # capture evidence
browse console --errors            # check JS errors
browse viewport 375x812           # test mobile
browse responsive /tmp/prefix      # desktop+tablet+mobile screenshots in one command
```

**Playwright MCP fallback (only when browse pre-flight FAILED — log warning first):**
```
browser_navigate → target_url
browser_snapshot → capture initial state
browser_click → interact with elements
browser_fill_form → enter test data
browser_take_screenshot → evidence
```

**Verify observable outcomes:**
- Page content matches expected state from journey Given/When/Then
- Error states render correctly (not raw stack traces)
- Loading states appear and resolve
- Empty states show correct messaging
- Navigation flows match UX design
- Responsive behavior preserves the same AC outcomes at the required viewports

**Capture evidence for each AC — storage is cohesive with track-visuals:**

- Every screenshot goes to `.svc/visuals/<WI>/<JourneyID>-step<N>-<state>-<viewport>.png` (the canonical track-visuals path). When no WI is active (ad-hoc regression), use `.svc/visuals/adhoc-<YYYY-MM-DD>/`. The `test-evidence/` directory holds only SUMMARY.md + metadata + `scenarios.json` — NO screenshot originals. Reference canonical paths from there.
- One screenshot per AC verification (PASS AND FAIL) — a PASS without a captured state is not verified. For state machines (clock-in → on-shift → on-break → off-shift) capture each transition state.
- Every visual AC marked ✅ in a spec's QA column MUST cite its screenshot path: `✅ MM-DD screenshot=logs/visuals/<WI>/<file>`.
- Console errors captured via `browse console --errors` (or `browser_console_messages`).
- Network failures captured via `browse network` (or `browser_network_requests`).

**Why this path:** `track-visuals` baseline/diff/review/promote workflows (FRAMEWORK-STATE 2026-04-13 visual screenshot lifecycle) operate on `.svc/visuals/<WI>/`. Journey captures stored anywhere else are structurally dead — they cannot be diffed against a baseline or promoted to golden. Using the shared namespace means a later `track-visuals diff` after a fix ships can consume journey captures without adaptation.

For all ACs: run Step 2.5 (code inspection) first. Only escalate to browser (S1) for runtime behavior ACs, and to user (S2) for ACs requiring real account data that cannot be automated.

### Step 4: Update Feature Specs (Source of Truth)

Write QA column statuses in AC tables:
- `✅ MM-DD`
- `✅ MM-DD (code) path:line`
- `❌ MM-DD`
- `⚠️ MM-DD`
- `⏭️ reason`
- `—`

For failures, add bug blockquotes directly under the relevant AC section.

### Step 4.5: Open Work Items for Defects — MANDATORY BEFORE STEP 5

Findings that don't become work items don't get prioritised, assigned, or scheduled. Bug blockquotes in specs are not a substitute for a WI file.

- **CRITICAL / HIGH findings:** MUST create `docs/work-items/WI-<NNN>-<slug>.md` before Step 5. Template fields: title, severity, status=OPEN, reproduction (scenario ID + evidence screenshot path), expected vs actual, linked AC IDs, affected files/specs or `unknown: <reason>`, suggested owner skill.
- **MEDIUM findings:** Create a WI unless the user explicitly opts out. Default is create.
- **LOW findings:** Either file a single rolling `WI-auto-<date>-minor-findings.md` or route to `quick-fix`.
- **Spec drift (contradictions between spec and code):** WI routed to `sync-spec-code` with both sides cited.
- **Behavioural defects / regressions:** WI routed to `diagnose-bug`.
- **Skipped-infeasible scenarios** (from Step 0.5): WI routed to `write-e2e` with provisioning requirements noted — E2E fixtures can provision state manual testing cannot.

Each WI file must reference its evidence screenshot under `.svc/visuals/<WI>/`. Cross-link: SUMMARY.md lists all WIs created in this run.

### Step 5: Save Evidence and Summary

Evidence path:
- `docs/specs/features/test-evidence/{YYYY-MM-DD}-{env}-{journey-or-feature}/`

Summary output must include:
- target URL + env
- mode
- viewport coverage used (desktop/mobile/tablet or non-applicable with reason)
- pass/fail counts by journey and by feature AC table
- unresolved blockers and routed follow-ups
- pre/post validation command or journey id, evidence paths, comparison
  classification, and iteration count when the run is corrective or
  deploy-validation
- `node scripts/validate-pre-post-validation-evidence.mjs --evidence <path>`
  result when machine-readable pre/post evidence is applicable
- `provider_visible=true|false`; when true, link
  `PROVIDER_ANALYTICS_EVIDENCE.md` and state the exact run marker used
- allowed next skills derived from the routing table for this run's findings
- the closeout validator command and result:
  `node scripts/verify-skill-contract.mjs test-journeys-closeout --summary <SUMMARY.md> --scenarios <scenarios.json> --next <next-skill>`

Before declaring the run complete, validate that the runtime trace is terminal and
backed by evidence:

```bash
node scripts/validate-journey-execution-trace.mjs \
  --summary docs/specs/features/test-evidence/<run-dir>/SUMMARY.md \
  --scenarios docs/specs/features/test-evidence/<run-dir>/scenarios.json
```

### Step 6: Commit Results — MANDATORY BEFORE DECLARING DONE

A QA run that leaves a dirty working tree is not complete. Committing the findings is part of the skill's output, not a follow-up chore.

```bash
git add docs/specs/features/<affected-spec>.md \
        docs/specs/features/test-evidence/<run-dir>/SUMMARY.md \
        docs/specs/features/test-evidence/<run-dir>/scenarios.json \
        docs/work-items/WI-*-<date>-*.md
git commit -m "docs(qa): <journey-ids> regression <YYYY-MM-DD> — AC updates + findings

<1-3 line summary of pass/fail counts + top findings>
Next: <routed follow-ups>"
```

- Do NOT `git add -A` — stage only spec updates, SUMMARY.md, scenarios.json, and WI files. Screenshots under `.svc/visuals/<WI>/` follow the project's `.gitignore` policy; if they are ignored (common for `*.png`), note that in SUMMARY.md — evidence is ephemeral in that case and the SUMMARY is the durable record.
- Do NOT auto-push. Pushing is the user's call; surface the unpushed commit in the final report so they can decide.
- If the project requires PRs (no direct commits to main), create a branch named `qa/<journey-ids>-<date>` before staging.

---

## Routing Rules

Route findings automatically. Every routing entry below also produces a WI file (see Step 4.5) — routing without a WI is incomplete.

- Missing ACs or vague AC wording -> `audit-ac` + WI
- Missing/incorrect journey transitions -> `write-journeys` + WI
- Spec-vs-code contradictions -> `sync-spec-code` + WI
- Behavioural defects / regressions -> `diagnose-bug` + WI
- Skipped-infeasible scenarios (from Step 0.5) -> `write-e2e` + WI with provisioning requirements
- Stable validated flow ready for automation -> `write-e2e`
- Pre-existing known-limitation ACs (⛔ E2E column) -> WI only if user confirms

---

## Guardrails

1. Do not create separate QA truth docs when feature specs already hold AC status.
2. Keep bug blockquotes current: remove them after re-verification passes.
3. Do not mark AC `✅` without evidence or explicit code verification reference.
4. Keep environment details explicit so results are reproducible.
5. Do not mark browser-visible QA complete without the required viewport evidence or an explicit non-applicability note.
6. **Do NOT delegate an AC to the user as "awaiting visual confirmation" if a grep or file read can answer it.** CSS class presence, token coverage, config values, and structural attributes are S0 (code inspection). Run Step 2.5 first. User delegation (S2) requires an explicit statement of why S1 also could not work.
7. **Do NOT skip a scenario for efficiency.** The only allowed skip reasons are `infeasible` (with cited runtime evidence + WI routed to `write-e2e`) or `user-approved` (with quoted approval). "Low value given time" or "inverse of another test" or "requires setup" are NOT allowed skip reasons — either execute the scenario, file a WI, or surface the proposal to the user for explicit approval.
8. **Do NOT store screenshots outside `.svc/visuals/<WI>/`** (or `.svc/visuals/adhoc-<date>/` when no WI). Captures elsewhere are structurally dead — they cannot feed `track-visuals` diff/review/promote.
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

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | QA column in AC tables updated | grep for QA status markers in `docs/specs/features/<name>.md` | |
| 2 | Evidence captured under track-visuals path | `test -d .svc/visuals/<WI>/` and `.png` files present | |
| 3 | No unresolved questions | grep for TBD, TODO, open questions in updated specs | |
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

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

**If `--progressive` flag is absent:**
- Report results to user
- If findings include behavioural defects or regressions: suggest `diagnose-bug` (or `quick-fix` for bounded LOW findings), never `review-gate`
- If the selected journeys are stable and validated: suggest `write-e2e`

Not part of progressive chains (invoked standalone or by verify-promotion).

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

## Feature Validation Ledger Handoff

When a user-facing or admin-facing feature graph requires
`feature_validation_closeout`, write runtime results so they can be copied
directly into `FEATURE_VALIDATION_LEDGER.md`:

| AC ID | Journey scenario(s) | Runtime result | Evidence path(s) |
|---|---|---|---|
| `<AC-ID>` | `<journey file + scenario/tag>` | `PASS|FAIL|BLOCKED — <summary>` | `<report/screenshot/log path>` |

Every blocked or failed runtime result must name the follow-up WI. Do not leave
the ledger to infer coverage from a generic browser smoke summary.

## Generated Outcome Journey Contract

For provider-backed generation flows, a journey is incomplete until it proves
all lifecycle states or records a blocked WI:

| State | Required evidence |
|---|---|
| Start | The user can reach the generation entry point. |
| Generate | The requested provider is invoked or the approved fallback is recorded. |
| Draft | The generated draft/result is visible before save. |
| Save | The user saves or commits the generated result. |
| Return | The user leaves and returns or reloads through the normal product path. |
| Persisted display | The saved result is still visible with provider/source evidence linked. |

Write provider/source, fallback policy, fallback approval, saved outcome, and
evidence paths into `PROVIDER_FIDELITY_EVIDENCE.md`; do not let a draft-only
preview satisfy a saved-result journey.

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

**Boilerplate rationale:** references/phase-receipts.md supersedes duplicate task-graph boilerplate cleanup for journey skills. The duplicated host-specific chaining blocks stay temporarily for host readability; future changes should update the shared phase-receipt/task-graph references first and use validators instead of hand-maintaining divergent journey-skill copies.

## Skill Outcome Contract

When this skill discovers new delivery-graph signals, emit `skill_outcome` per
`references/skill-outcome-contract.md` before completing the task.
