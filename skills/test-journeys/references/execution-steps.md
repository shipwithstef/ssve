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

### Step 4.5: Open Work Items for Defects — MANDATORY BEFORE STEP 5

Findings that don't become work items don't get prioritised, assigned, or scheduled. Bug blockquotes in specs are not a substitute for a WI file.

- **CRITICAL / HIGH findings:** MUST create `docs/work-items/WI-<NNN>-<slug>.md` before Step 5. Template fields: title, severity, status=OPEN, reproduction (scenario ID + evidence screenshot path), expected vs actual, linked AC IDs, affected files/specs or `unknown: <reason>`, suggested owner skill.
- **MEDIUM findings:** Create a WI unless the user explicitly opts out. Default is create.
- **LOW findings:** Either file a single rolling `WI-auto-<date>-minor-findings.md` or route to `quick-fix`.
- **Spec drift (contradictions between spec and code):** WI routed to `sync-spec-code` with both sides cited.
- **Behavioural defects / regressions:** WI routed to `diagnose-bug`.
- **Skipped-infeasible scenarios** (from Step 0.5): WI routed to `write-e2e` with provisioning requirements noted — E2E fixtures can provision state manual testing cannot.

Each WI file must reference its evidence screenshot under `.svc/visuals/<WI>/`. Cross-link: SUMMARY.md lists all WIs created in this run.

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
