---
name: verify-promotion
version: "1.0"
handles_concerns:
  - feature-validation-closeout
  - provider-fidelity
description: Use after a reviewed branch has been promoted to verify that the promoted implementation matches specs, passes tests, satisfies acceptance criteria, and closes the loop back into spec/journey state — triggers G7 review
phases:
  - { id: P1-PromotionEvidence, trigger: always, reads: [], writes: [], evidence_kind: command_output, required_for_completion: true }
  - { id: P2-SpecACVerification, trigger: always, reads: [".svc/receipts/<sha>/plan-manifest.json#ac_digests (WI-381 baton: AC nav index; still verify against the live spec — baton routes attention, never replaces the AC source)"], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P3-RuntimeRegression, trigger: always, reads: [], writes: [], evidence_kind: command_output, required_for_completion: true }
  - { id: P4-StateCloseout, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
    - { path: "docs/plans/<date>-<name>/manifest.md", artifact: implementation-manifest }
  optional:
    - { path: "docs/specs/visuals/", artifact: visual-evidence }
outputs:
  produces:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec, status: VERIFIED }
chain:
  lanes:
    greenfield: { position: 25, prev: land-changeset, next: null }
    brownfield-feature: { position: 20, prev: land-changeset, next: null }
    bugfix: { position: 7, prev: land-changeset, next: null }
    refactor: { position: 7, prev: land-changeset, next: null }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🛡️ [REVIEW-SONNET] — checking deployed artifacts match specs and ACs is verification, not planning. Sonnet 4.6 against the Opus blueprint. See `references/model-routing.md`.

# Verifying Promotion

## Runtime v2 product outcome boundary

Require deploy/canary evidence, executed rollback readiness, all declared live probes, and a durable
metric observation window. Only then may delivery become `DELIVERY_VERIFIED`. Outcome remains open
through observation, delta and `NEXT_DECISION_RECORDED`; framework learning is downstream of consumed
product evidence. Follow `schemas/release-lifecycle-v2.schema.json`.

Verification is the final proof pass after promotion.

It confirms that the promoted branch state:

- matches the intended behavior
- satisfies ACs
- passes QA and E2E
- syncs back into specs and journeys

**Announce at start:** "I'm using the verify-promotion skill to verify the promoted implementation."

## Phase Receipt Contract

When a `.svc/lane-tasks-<WI>.json` task is active, record each required phase
before completion:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-PromotionEvidence --evidence command_output:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SpecACVerification --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-RuntimeRegression --evidence command_output:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-StateCloseout --evidence file:<path>
```

## Inputs

Read:

| Artifact | Path | Purpose |
|----------|------|---------|
| Feature spec | `docs/specs/features/<name>.md` | ACs, implementation notes |
| Implementation manifest | `docs/plans/<date>-<name>/manifest.md` | File set, AC/test mapping |
| Promotion evidence | squash-diff / validation summary | Promotion truth |
| Live environment | localhost / preview / staging | QA and E2E runtime proof |
| Verification patterns | `references/verification-patterns.md` | 4-level verification hierarchy (L3-L4 for promotion) |
| Anti-patterns | `references/anti-patterns.md` | AP-13: treating existence as implementation |

## Verification Passes

Each sub-skill receives scoped context — do NOT invoke them bare. Pass the
feature spec path and manifest path explicitly so they don't re-scan to find
artifacts.

1. `sync-spec-code` — pass: `--feature docs/specs/features/<name>.md`
   - convert PLANNED -> RESOLVED (with tier tags)
   - detect DRIFT / REVERTED
   - scope: only the ACs and annotations in THIS feature spec, not all specs

2. `audit-ac` — pass: `--feature docs/specs/features/<name>.md`
   - ensure AC table still matches real implementation
   - scope: single feature, not all-features mode

3. `test-journeys` — pass: `--journeys docs/specs/journeys/J*-<name>.feature.md`
   - verify runtime behavior across journeys relevant to THIS feature only
   - for browser-visible features, require explicit desktop + mobile evidence (and tablet when the UX/UI contract defines a distinct tablet layout)
   - do NOT load journeys for other features

4. **Run E2E regression spec first, then broader suite** — execute tests that already exist, don't author new ones.

   **Priority 1: Run the WI-specific regression spec (if one was written by `write-e2e`):**
   ```bash
   # Pattern: WI<number>-*regression*.spec.ts or named after the WI
   npx playwright test e2e/specs/journeys/WI<number>-*.spec.ts --config=e2e/playwright.config.ts
   ```
   This is the primary post-deploy verification. A PASS here confirms the fix is live
   and production behavior matches what `write-e2e` validated. If `write-e2e` ran
   pre-deploy and the spec passed against pre-fix production, this run is the first
   meaningful validation of the fix itself.

   **Priority 2: Broader smoke or journey suite:**
   ```bash
   npx playwright test 2>/dev/null || npm test 2>/dev/null || echo "no test runner found"
   ```
   If E2E coverage is insufficient (tests don't exist for shipped ACs), this is
   a finding — route back to `write-e2e` BEFORE promotion in a future iteration.
   Verification proves shipped reality, it does not mutate it.

**Context reuse rule:** The feature spec and manifest are already loaded by
verify-promotion. If running sub-skills in the same session, they share this
context. If spawning as subagents, pass the file paths explicitly — do NOT let
each sub-skill independently discover artifacts by scanning `docs/specs/`.

## Verification Escalation Ladder

**Verification is AI-first. User handoff is the LAST option, not a shortcut.**

When a verification claim needs proof, attempt tiers in order. Do not skip to a higher tier without exhausting the lower one. Every skip to a higher tier requires a documented reason in the verification report.

**HARD-GATE — AP-31: behavioral runtime verification is the agent's job, not the user's.** Punting to V3 ("open the app on your phone, tap X, confirm Y") without an explicit V2 exhaustion log citing every V2 mechanism attempted and the specific technical reason each failed is `runtime-verification-user-delegation` HIGH severity per `references/anti-patterns.md` AP-31. Visual aesthetic review IS legitimate V3 scope. Behavioral verification (button registers click, body interactivity restored, navigation flips correctly, deploy markers present) is NEVER the legitimate V3 scope. If you find yourself writing "the final eyeball is yours" or "open the app on your phone" for a behavioral AC, STOP — return to V0/V1/V2 and exhaust them first. The cost asymmetry favors the agent: ~$0.05 to run a Playwright probe vs. erodes-user-trust to punt.

| Tier | What | When | Cost |
|---|---|---|---|
| **V0 — Static/structural** | Grep committed diff, confirm deploy state `ready`, check router-context deploy matrix satisfied | Always first. Confirms shipped code matches intent. | ~10s |
| **V1 — Live DOM** | Navigate to affected URL via `browse` daemon or Playwright MCP. Assert DOM elements exist with correct attributes, CSS classes applied, aria-labels, data-testids, role-account visibility | After V0. Confirms production render. | ~30s |
| **V2 — Live interaction** | Login via E2E account pool; trigger interaction; observe handler fires via network request or console. For gesture/touch: try (a) Playwright device descriptor with `hasTouch:true`, (b) CDP `Input.dispatchTouchEvent` (trusted events), (c) React fiber direct invocation of the handler prop, (d) existing E2E suite replay, (e) add a testability seam (data-testid + imperative API) and retry | After V1 when behavior is interaction-gated. | ~2min |
| **V3 — User delegation** | Ask user to verify on real device / paste screenshot / confirm aesthetic quality | LAST RESORT. Only after V2 exhaustion log documents every V2 mechanism attempted and the specific technical reason each failed. | minutes–hours |

### V2 Exhaustion Log (mandatory before V3)

When V2 cannot complete, the verification report MUST include:

```markdown
## V2 Exhaustion Log

Attempted V2 mechanisms (in order):

1. <mechanism name> — <failure signature> — <technical reason it couldn't complete>
2. <mechanism name> — <failure signature> — <technical reason>
3. ...

**V3 handoff justification:** <structural platform constraint OR aesthetic/subjective claim OR named technical limitation>
```

**"I didn't think to try X" is not a valid V2 exhaustion.** Reference `references/verification-patterns.md` for the catalog of V2 techniques.

### Classification rules

- **Functional claim** (element present, handler fires, class applied, network request made, aria-label exists) → V1 or V2. NEVER V3 by default.
- **Aesthetic claim** (looks polished, feels native, color is right, spacing feels off) → V3 is valid after V1 confirms the structural primitives are in place.
- **Structural platform constraint** (Base44 auth domain-scoped pre-deploy; OS-level Chrome overscroll not JS-driven) → V3 is valid; cite the constraint in the exhaustion log.

### AI-first enforcement

`review-gate` G7 FAILs any verification report whose evidence trail ends at "user confirmed" for a functional claim without a V2 exhaustion log. See `references/anti-patterns.md` AP-28 (Premature User Handoff).

**Confidence tiers in the report:**

- `VERIFIED` — V0+V1+V2 all PASS (full AI verification)
- `VERIFIED-L2` — V0+V1+partial V2 PASS; one V2 mechanism hit a documented technical limit; exhaustion log present
- `VERIFIED-USER` — V3 handoff with justification (structural constraint or aesthetic claim); V2 exhaustion log present
- `UNVERIFIED` — no tier passed; cannot declare VERIFIED

## Multi-PR Campaign Sampling

When one lane/session closes a campaign of three or more PRs, branches, pages, or equivalent shipped surfaces in the same skill chain, verify-promotion MUST sample live evidence instead of accepting V0 proof for every item.

1. Build the campaign list from merged PR numbers, branch names, or shipped page/surface identifiers.
2. Run the deterministic sampler:
   ```bash
   node scripts/verification-sampling.mjs PR-101 PR-102 PR-103 PR-104
   ```
   Or pipe newline-separated identifiers into the script.
3. The sample size is `ceil(N/3)`, with first/middle/last included at minimum when `N >= 3`; remaining slots are filled by a stable SHA-256 hash of the sorted campaign list.
4. For every sampled item, produce V1 or V2 evidence. Browser-visible sampled items require a live DOM, screenshot, or interaction receipt; V0 bundle-grep is insufficient.
5. The cumulative verification summary MUST list every item in the campaign, sampled or not, with `verification_tier`, `sampled: true|false`, and evidence paths. Unsampled items may remain at V0 only when sampled V1/V2 coverage passes and the summary explicitly identifies them as unsampled.
6. Any bundle-grep/static proof section must self-label with `Verification tier: V0`.
7. Before closeout, run `node scripts/validate-verification-closeout-summary.mjs --summary <SUMMARY.md>`. The validator blocks unqualified `VERIFIED` or `complete` wording while any browser-visible row remains V0-only.

### Multi-PR summary shape

```yaml
multi_pr_campaign:
  seed: "<sampler seed>"
  sample_size: <ceil(N/3), first/middle/last minimum>
  items:
    - id: "PR-101"
      sampled: true
      verification_tier: "V1"
      evidence:
        - "docs/logs/verify-promotion/PR-101-live-dom.md"
    - id: "PR-102"
      sampled: false
      verification_tier: "V0"
      evidence:
        - "docs/logs/verify-promotion/PR-102-bundle-grep.md"
```

### Single-lane summary shape

When there is no multi-PR campaign but the closeout summarizes one shipped
surface, include the same sampled-row fields so cumulative summaries cannot
hide V0-only evidence:

```yaml
single_lane_summary:
  item: "WI-123"
  target_class: "browser-visible"
  verification_tier: "V1"
  sampled: true
  evidence:
    - "docs/logs/verify-promotion/WI-123-live-dom.md"
```

If the only evidence is bundle-grep/static proof, write `Verification tier: V0`
and do not use unqualified `VERIFIED` or `complete` wording for browser-visible
work.

## Verification Report

Compile:

- manifest reference
- sync-spec-code results
- AC coverage
- QA coverage
- E2E coverage
- responsive / viewport evidence coverage for browser-visible features
- multi-PR campaign sample seed, selected items, verification tier per item, and evidence paths when a campaign has three or more shipped items
- single_lane_summary with `verification_tier`, `sampled`, and evidence paths
  when the closeout has no PR list
- findings

## G7 Review

G7 checks:

- no unresolved critical/high drift
- AC coverage is complete or explicitly justified
- QA, E2E, and responsive evidence are current
- spec/journey state reflects what shipped

If G7 passes:

- feature status -> `VERIFIED` with confidence tier:
  - `VERIFIED-L1`: structural + visual + manual QA (human inspected pages in browser)
  - `VERIFIED-L2`: structural + visual (screenshots captured at desktop + mobile, visual diff reviewed)
  - `VERIFIED-L3`: structural assertions only (tests pass, build passes, no visual evidence)

  **For browser-visible features:** L3 is acceptable ONLY when visual verification is blocked by a documented, pre-existing issue (e.g., auth-gated pages untestable). The tier goes in the WI status: `**Status:** VERIFIED-L3 (no visual evidence — auth-gated pages untestable)`. This makes the confidence level transparent to non-technical stakeholders.

If G7 fails:

- route back based on failure type:
  - behavior bug -> `diagnose-bug` or execution/planning path
  - spec mismatch -> `write-spec`
  - journey mismatch -> `write-journeys`

### Auto-Invoke On-Demand Skills

After G7 passes and the WI is marked VERIFIED, check for post-completion signals:

| Signal | Skill | Insertion Point | Why |
|--------|-------|-----------------|-----|
| This was the last WI in the current milestone and "what's next?" is unknown | `roadmap-evaluation` | After WI close-out | Produces prioritized milestone roadmap with cost estimates |
| Milestone complete; no active WIs; readiness for launch/hackathon/VC unknown | `assess-market-readiness` | After last WI in milestone closes | Produces 0-100 readiness score that gates launch vs continue-building |
| Milestone complete; no active WIs; journeys exist; shipped behavior changed; next step is roadmap/readiness handoff | `write-journeys --refresh --all` | Before roadmap/readiness handoff | Refreshes journey contracts before strategic planning consumes stale flows |
| Project just shipped and builder profile needs pattern/history update | `mine-builder` | After verify-promotion in Mode 3 (post-project update) | Captures project history and failure patterns for future sessions |

If any on-demand skill is inserted, update `.svc/lane-tasks-<WI>.json` with the new task (or create a new WI if the current one is already VERIFIED). Log the insertion as a `taste` decision in `.svc/pipeline-decisions.jsonl`.
Validate the milestone refresh trigger with `node scripts/check-journey-refresh-trigger.mjs --state <state.json>` before skipping it.

## Post-Verification: Visual Baseline Promotion

If track-visuals diff report exists for this feature/WI and G7 passed:

1. Read the diff report — identify CHANGED entries marked intentional.
2. **Staleness check for competing branches:** For each affected screen, check
   if the golden baseline was updated after this WI's branch point:
   ```bash
   git log -1 --format=%ci -- docs/specs/visuals/baseline/<screen>.png
   ```
   If the baseline was updated more recently (another WI promoted while this one
   was in flight), flag those screens for **re-capture before promoting** —
   the current WI's screenshots may be based on a stale state.
3. If no staleness conflicts: invoke track-visuals in `update` mode for
   affected screens.
4. If staleness conflicts: re-capture ONLY the conflicting screens against
   current main, then promote.
5. After promotion: delete screenshot files (`.png/.jpg/.webp`) from
   `.svc/visuals/<WI>/`. Preserve review reports, manifests, and
   analysis logs — these are retained for platform improvement.

Skip this step if: no visual changes, or feature has no browser-visible surface.

## Post-Verification: Landing-tagged WI handler (WI-139)

For any WI whose `**Tags:**` field contains `landing` OR `marketing-page`, an additional post-deploy visual receipt is REQUIRED before verify-promotion can mark the WI VERIFIED.

### Why this exists

Two prior sessions (Example Marketplace WI-088 iter1, WI-161) shipped landing iterations that passed every textual / contractual check (bundle-grep ✅, lane-tasks ✅, perf budget ✅) while the live deployed page visually fell 50–60% short of the named sector anchor. A bundle string can ship without the section *looking* like the anchor. The fix is a post-deploy live-URL side-by-side that compares the shipped result against the same anchor bank used at planning time.

### Procedure

1. Detect `landing` or `marketing-page` in the WI's Tags field. If absent, skip this section.
2. Locate the pre-implementation side-by-side artifact at `docs/specs/landing/<wi-lower>-side-by-side.jpg` (produced by `benchmark-landing` Step 0b at WI start). If missing, HALT — the WI never went through the gate and cannot be promoted via this skill.
3. Capture a post-deploy live-URL screenshot of the deployed page at 1440×900 via `track-visuals --mode external-anchor` against the production URL (NOT local build). Pass to `scripts/stitch-side-by-side.mjs` together with the same 3 anchors that were used at WI start to produce a post-deploy stitched JPEG. Save to `docs/specs/landing/<wi-lower>-side-by-side-postdeploy.jpg`.
4. Diff against the pre-implementation artifact: the shipped change MUST be visible at comparison scale (i.e., the post-deploy target tile must look meaningfully different from the pre-implementation target tile in the same way the brief promised). A change that is "present in bundle string" but invisible at 1440×900 fails this check.
5. Include both the pre-implementation and post-deploy artifact paths in the WI's verify-promotion receipt under `landing_visual_receipt`.
6. If the diff fails (post-deploy target tile is visually identical to pre-implementation, or the change is too subtle to see at the comparison scale), escalate per the Verification Escalation Ladder. Do NOT mark VERIFIED.

### Receipt entry shape

```yaml
landing_visual_receipt:
  pre_implementation: docs/specs/landing/<wi-lower>-side-by-side.jpg
  post_deploy:        docs/specs/landing/<wi-lower>-side-by-side-postdeploy.jpg
  visible_at_1440x900: true | false
  honest_judgment:    "<one-line aesthetic read of the post-deploy result>"
```

The tier-1 validator `validate-landing-side-by-side-exists.sh` enforces that any landing/marketing-page-tagged WI in VERIFIED state has at minimum the pre-implementation artifact on disk.

## Post-Verification: Canary Monitoring

If the feature has a live URL (localhost or deployed), run a canary check.

For corrective, regression, deploy-affecting, or acceptance-critical
verification, also apply `references/pre-post-validation-loop.md`: identify the
exact command, journey, probe, or visual capture that proves the shipped change,
cite its pre-change/pre-deploy evidence when reachable, rerun the same proof
post-promotion, and classify the delta. A broad green suite can support the
verdict, but it does not replace an unclassified pre/post delta for the
acceptance-critical path.
When a machine-readable pre/post evidence file exists, validate it with
`node scripts/validate-pre-post-validation-evidence.mjs --evidence <path>` and
cite the result.

### Baseline Capture (BEFORE deploy)

Before any deployment, capture the pre-deploy baseline for every page in the feature's journeys:

1. Screenshot each page at desktop and mobile at minimum
2. Record console errors (if any pre-existing)
3. Measure page load time
4. Store as the comparison baseline

### Active Monitoring Loop

After deploy, monitor every 60 seconds for 5 minutes (5 checks minimum):

1. Open the app in browser (gstack browse)
2. For each page in the feature's key journeys:
   - Take a screenshot
   - Capture console errors
   - Measure page load time (performance.timing or equivalent)
   - Check for new 404 responses in network tab
3. Compare each metric against the pre-deploy baseline

### Alert Severity

| Severity | Condition | Action |
|----------|-----------|--------|
| CRITICAL | Page fails to load entirely | Stop monitoring, report immediately |
| HIGH | New console errors not present in baseline | Flag for investigation |
| MEDIUM | Page load time >= 2x baseline | Flag as performance regression |
| LOW | New 404 requests not present in baseline | Note in report |

**Transient tolerance:** only alert on patterns that persist across 2+ consecutive checks.
A single spike that resolves on the next check is logged but not alerted.

### Health Report

Produce a per-page status table at the end of monitoring:

```
CANARY HEALTH REPORT
Page                    | Load Time | Console Errors | Status
----------------------- | --------- | -------------- | -------
/dashboard              | 1.2s (ok) | 0 new          | HEALTHY
/dashboard/settings     | 3.8s (2x) | 2 new          | DEGRADED
/checkout               | TIMEOUT   | N/A            | BROKEN
```

Final verdict:
- **HEALTHY** — all pages healthy, no new errors, load times within tolerance
- **DEGRADED** — non-blocking issues found (MEDIUM/LOW alerts), feature works but needs attention
- **BROKEN** — any CRITICAL alert fired, or HIGH alerts persisted across all checks

## Post-Verification: Document Sync

After verification passes, reconcile documentation.

### Update Classification

Not all doc updates are equal. Classify each before acting:

- **Auto-update** (apply without asking): factual corrections — version numbers, file paths,
  command syntax, API signatures that changed in the diff
- **Ask-user** (present and wait for approval): narrative changes — rewording feature descriptions,
  changing architecture explanations, modifying onboarding guides, altering project positioning

### Reconciliation Steps

1. Read ONLY project docs that the shipped diff could affect. Check the diff
   file list (use the manifest's file set, or `git log --format=%H -1 -- docs/plans/` to find the promotion commit, then `git diff <commit>~1..<commit> --name-only`) — if no docs were touched
   and no public API changed, skip doc reconciliation entirely.
2. For touched docs: cross-reference the diff — does the doc still match?
3. Apply auto-updates; queue ask-user updates and present them as a batch

### Cross-Doc Consistency Checks

After updates, verify consistency across documents:

- README feature list matches CLAUDE.md capabilities section
- CHANGELOG latest version matches VERSION file
- Any "Getting Started" commands in README still work with current codebase
- Architecture diagrams reference files/modules that still exist

If any inconsistency is found, fix it (auto-update) or flag it (ask-user).

### TODOS.md Cleanup

1. Read TODOS.md (if it exists)
2. Mark completed items — cross-reference against the shipped diff to identify which TODOs were addressed
3. Scan for new TODO/FIXME/HACK comments introduced by the promotion.
   Use the promotion commit (from manifest or merge commit), not main..HEAD
   (which is empty after merge):
   ```bash
   # Find the promotion merge commit
   PROMO_COMMIT=$(git log --merges --format=%H -1)
   git diff "${PROMO_COMMIT}^..${PROMO_COMMIT}" | grep -E '^\+.*\b(TODO|FIXME|HACK)\b'
   ```
4. Add any new items to TODOS.md with file location and context

### VERSION Guard

Never bump VERSION during document sync. If the VERSION file needs updating,
flag it and ask the user — version bumps belong in `land-changeset` Step 2a.

For a consumer with `schemas/mobile-build-contract.json`, promotion additionally
requires the canonical mobile release receipt and inspected artifact metadata.
Reject a development receipt (`mode: dev`) as promotion evidence. Require all
of the following before marking the promotion verified:

- receipt mode is `release`, and its source commit is the release checkpoint
  represented by the promoted source tree;
- application id and, for iOS, bundle id equal the contract's canonical
  identity rather than a worktree-suffixed development identity;
- version/build code is above both the recorded remote floor and ledger floor,
  and the receipt proves exactly one canonical allocation at land;
- version/build code, version name, source SHA, canonical identity, and artifact
  path are exactly equal across the receipt, freshly inspected metadata, and
  the exact configured artifact filename; the artifact resolves to a real
  regular, non-symlink file; and the engine-computed SHA-256 equals
  `artifact_sha256` in both receipt and metadata; and
- the release-ledger row for that code is `committed`, with no reuse of a
  `failed` or development allocation, and binds the same source SHA, platform,
  artifact path, and artifact SHA-256.

Do not trust a receipt and paired JSON metadata alone. Invoke the configured,
repository-reviewed `commands.inspect_artifact` argv directly without a shell
against the real artifact, save that fresh output, then run
`scripts/mobile-build-identity.mjs verify` against the release receipt and fresh
artifact metadata. The verifier must independently open the regular file,
reject symlinks, render and compare the exact configured filename, compute its
SHA-256, and confirm the ledger binding. Any mismatch, missing remote-floor
evidence, development receipt, uncommitted reservation, absent artifact, or
untrusted/stale inspection blocks `VERIFIED`; route back to `land-changeset`
rather than editing canonical version state during verification.

This closes the loop — documentation matches shipped reality.

## Post-Verification: Log Learnings

Append operational discoveries from this run to `docs/learnings/learnings.jsonl`:

```json
{"date": "<date>", "skill": "verify-promotion", "feature": "<name>", "learning": "<what was discovered>", "confidence": "high|medium|low", "saves_minutes": <estimate>}
```

Examples of learnings worth logging:
- "The Prisma migration script needs `--force` flag in CI"
- "Auth middleware must be loaded before rate limiter"
- "The empty state component doesn't render without at least one CSS import"

These compound across sessions — `route-workflow` reads them to make better recommendations.

## Post-Verification: Update Builder Profile

After a successful verification, update the global builder profile
(`~/.svc/builder-profile.md`) to capture what this project taught us
about the builder. This is how the pipeline gets smarter across projects.

1. **Add project to history:**
   ```markdown
   ### <Project Name> — shipped
   - **What:** <one sentence>
   - **When:** <start date> → <ship date>
   - **Stack:** <what was built with>
   - **Reached:** shipped / launched / revenue
   - **Revenue:** <if any>
   - **Reusable assets:** <code, infra, domain, learnings>
   ```

2. **Update skills** — did the builder learn a new framework, tool, or pattern?
3. **Update financial context** — did revenue start? New subscriptions? Entity registered?
4. **Update social presence** — did they grow followers? Launch on ProductHunt? Start a newsletter?
5. **Run pattern detection** — compare this project's timeline, decisions, and outcome
   against past projects. If a pattern emerges or is reinforced, append to Builder Patterns:
   ```markdown
   - **[pattern-id] <description>** — confidence: <1-10>, observed: <N> times
     Source: <which projects>
     Pipeline action: <what changes>
   ```
6. **Run gap analysis** — what blocked them this time? What tool would have saved time?
7. **Append changelog entry:**
   ```markdown
   - <date>: Post-project update from <project name> — <what changed>
   ```

If the builder profile does not exist at `~/.svc/builder-profile.md`, skip this step
(the builder has not been profiled yet — `route-workflow` handles initial creation).

## What Not To Do

- Do not fix code inline during verification
- Do not skip sync-back into spec/journey state
- Do not treat passing tests alone as sufficient if drift remains

## Test Quality Audit

After confirming tests pass, audit test QUALITY. A passing test that proves nothing is worse than a missing test — it creates false confidence.

| Check | What to look for | Severity |
|---|---|---|
| Disabled/skipped tests | `.skip()`, `@Disabled`, `xit(`, `xdescribe(` on requirement-linked tests | BLOCKER |
| Circular test patterns | System generates its own expected values (test compares output to output) | BLOCKER |
| Assertion strength | `toBeDefined()` or `!= null` where value/behavioral assertion is needed | WARNING |
| Expected value provenance | Expected value came from the system under test, not from the spec or AC | BLOCKER |

**Rule:** Test quality blockers override an otherwise passing verification. A green CI with circular tests is a false green.

## Pipeline Continuation

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
| 1 | Spec/WI status updated to VERIFIED | For features: `grep "**Status:** VERIFIED" docs/specs/features/<name>.md`. For bugfixes/WIs: `grep "**Status:** VERIFIED" docs/specs/work-items/WI-<NNN>.md` | |
| 2 | INDEX.md row updated (for WI-tracked work) | `grep "VERIFIED" docs/specs/work-items/INDEX.md` — row for this WI must show VERIFIED, not `identified` or `in-progress`. Skip if work is not WI-tracked. | |
| 3 | Server was running during verification | curl pre-flight passed before E2E step | |
| 4 | Test files exist | `TEST_COUNT > 0` pre-flight passed | |
| 5 | Tests pass | Run test suite; all pass | |
| 6 | Journey files matched glob | `ls docs/specs/journeys/J*-<name>.feature.md` returned ≥ 1 file | |
| 7 | QA complete | AC tables have current QA status, no unresolved critical/high drift | |
| 8 | Canary health report (browser-visible) | For features with browser-visible surfaces: per-page health report table produced with Load Time + Console Errors + Status (HEALTHY/DEGRADED/BROKEN). Skip with explicit justification if no browser surface. | |
| 9 | Visual evidence captured (browser-visible) | For features with browser-visible surfaces: at least 1 desktop + 1 mobile screenshot per affected page captured post-deploy. Skip with explicit justification if no browser surface. | |
| 10 | Pre-existing test failures compared | For each test failure: ran the same test against main (pre-change state). Classified as BRANCH-INTRODUCED (must fix) or PRE-EXISTING (log + link to existing WI). No unclassified failures. |
| 11 | Visual baseline promoted (browser-visible) | For features with intentional visual changes: golden baseline at `docs/specs/visuals/baseline/` updated, manifest rows have `last_verified_by` set to this WI, ephemeral screenshot files in `.svc/visuals/<WI>/` cleaned. Skip if no visual changes. | |
| 12 | Structured evidence receipt present | For completed browser-visible work: the task `skill_receipt` includes `target_class`, `evidence_level`, and `evidence_artifacts` per `references/phase-receipts.md`; `target_class: browser-visible` MUST NOT close at `evidence_level: V0`. | |
| 13 | Delivery tier reported | Closeout classification output includes `delivery_tier`; compressed/rush closeouts cite a decision-log rationale and cannot be summarized as full validation. | |
| 14 | Pre/post validation delta classified | For corrective, regression, deploy-affecting, or acceptance-critical work, closeout cites the exact pre and post evidence, comparison classification, iteration count, and pre/post evidence validator result per `references/pre-post-validation-loop.md`; otherwise records why N/A. | |
| 15 | Leftover disposition validated | `git status --short --untracked-files=all` is clean, or every remaining path is covered by a passing ledger per `references/leftover-disposition.md`. Closeout states whether leftovers remain. | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

If a runtime or promoted-state failure proves the parent WI cannot be honestly
verified, emit `BLOCKING_DISCOVERY` per
`references/blocking-discovery-format.md`, validate it, emit `skill_outcome`
with `block_on_discovery`, and leave the parent blocked instead of VERIFIED.

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

**If `--progressive` flag is present AND self-verify passed:**
- This is the end of all lanes. Report completion.

**If `--progressive` flag is absent:**
- Report results to user
- Pipeline complete. No further skills to chain.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.


## Modes (added by WI-SPINE-003)

This skill supports a `--infra` flag for infra lanes.

## Skill Outcome Contract

When this skill discovers new delivery-graph signals, emit `skill_outcome` per
`references/skill-outcome-contract.md` before completing the task.

## Delivery Graph Closeout Classification

For mutating, deploy-affecting, end-to-end, corrective, and framework-evolution
runs, compute and record one closeout classification with
`scripts/classify-delivery-graph-closeout.mjs`. Do not label a run
`framework-complete` unless every required evidence family is `satisfied` or
validly `n/a`, and every required or conditional task is completed or covered by
a registry-backed skip ledger.

Include the selected `delivery_tier.mode` in the closeout summary. If the tier
is `compressed` or `rush`, cite the decision-log entry and reduced-scope
rationale; do not present the result as full framework validation unless the
graph's `delivery_tier.validation_policy.blocked_behind_explicit_override` is
empty and every mandatory validation skill ran or has a registry-backed skip.

For user-facing or admin-facing feature work, `feature_validation_closeout` is
one of those evidence families. It can be marked `satisfied` only after
`scripts/validate-feature-closeout-ledger.mjs` passes for the feature spec and
`FEATURE_VALIDATION_LEDGER.md`. If the ledger is missing or invalid, close the
graph as `runtime-accepted` or `blocked`, not `framework-complete`.

For provider-backed or generated-output work, `provider_fidelity` is also a
closeout evidence family. It can be marked `satisfied` only after
`scripts/validate-provider-fidelity-evidence.mjs --evidence <path>` passes.
Wrong-provider fallback, mock/placeholder output, uploaded substitutes, and
draft-only saved states force `runtime-accepted` or `blocked` unless explicitly
approved fallback evidence is present.

## Leftover-Disposition Closeout

Before declaring promoted work complete, run `git status --short --untracked-files=all`. If any path remains, cite a ledger that follows `references/leftover-disposition.md` and run `node scripts/validate-leftover-disposition.mjs --ledger <path>`. The closeout summary must state whether leftovers remain and how they were disposed.

## Chain Receipt Emission (Mandatory Chain)

### Production verification capability boundary

When detached automation launches the canonical verifier, bind it to the exact
current SHA and consume the capability at execution. The only accepted argv is
`node scripts/svc-auto-drive.mjs <exact-head-sha>` (an absolute path ending in
that exact repository script is equivalent). Arbitrary Node scripts, added
flags, or a different SHA are denied before launch. Use
`scripts/svc-owner-recovery.mjs promote-mint` and `promote-exec` with the same
repo/worktree/WI/generation/task/environment tuple and identical command argv,
as shown by the local-land boundary in `land-changeset`.

This skill emits receipt type `verify-promotion (P3 extended with three target types)` per the contract in
`references/chain-receipt-contract.md`. The receipt is stored as a git
note on `refs/notes/svc-receipts` (authoritative) and mirrored under
`.svc/receipts/<sha>/<type>.json` (gitignored cache).

If the skill runs before a commit exists, it writes to
`.svc/receipts/staging/<tree-hash>/<type>.json` — the post-commit hook
(`hooks/git/post-commit.d/10-receipt-promote`) promotes to SHA mirror
and writes the consolidated git note.

Self-verify: receipt at `.svc/receipts/<sha>/<type>.json` exists, passes
its schema (`schemas/receipts/<type>.schema.json`), and is reflected in
the consolidated git note.


## Chain Receipt Emission (Mandatory Chain — Actionable)

After producing the canonical output, emit a SHA-keyed receipt:

```bash
BASE_SHA="$(git rev-parse HEAD)"
cat <<'JSON' | node scripts/emit-receipt.mjs --type verify-promotion --wi $WI --sha "$BASE_SHA"
{
  "wi": "$WI",
  ...{passes, p3_target_type, p3_outcome, verdict}
}
JSON
```

This writes to `.svc/receipts/<sha>/verify-promotion--<WI>.json` (or staging if pre-commit)
and attaches it to the consolidated git note on `refs/notes/svc-receipts`
under identity `slot::verify-promotion::<WI>::<sha>`.

Self-verify: `node scripts/check-chain-receipts.mjs --sha HEAD --wi $WI --consumer verify-promotion` shows this
receipt type as present + schema-valid.

Only after that self-verification succeeds, append the promoted WI to shared
memory. Run from the clean promoted primary checkout and bind the exact SHA:

```bash
node scripts/svc-wi-promotion-indexer.mjs index \
  --repo "$(git rev-parse --show-toplevel)" \
  --wi "$WI" \
  --sha "$BASE_SHA" \
  --summary "<one-line verified change summary>"
node scripts/svc-wi-promotion-indexer.mjs query \
  --repo "$(git rev-parse --show-toplevel)" --wi "$WI"
```

Missing, failing, stale, or mismatched G7 evidence must make indexing fail.
An exact duplicate is an idempotent no-op; corrections append with an explicit
supersession id rather than deleting promotion history.

Reference: `references/chain-receipt-contract.md`.
