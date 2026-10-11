---
name: verify-promotion
version: "1.0"
handles_concerns:
  - feature-validation-closeout
  - provider-fidelity
description: >
  After a reviewed branch is promoted, verify the shipped result against specs, tests and
  acceptance criteria, then close the loop into spec and journey state (G7). Use for
  'verify the promotion', 'did it actually ship', post-merge verification.
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
    greenfield: { position: 25, prev: land-changeset }
    brownfield-feature: { position: 21, prev: land-changeset }
    bugfix: { position: 7, prev: land-changeset }
    refactor: { position: 8, prev: land-changeset }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🛡️ [REVIEW-SONNET] — checking deployed artifacts match specs and ACs is verification, not planning. Sonnet 4.6 against the Opus blueprint. See `references/model-routing.md`.

# Verifying Promotion


## Existing release path and inline v4 identities

For a v4 inline plan, verify `node scripts/prepare-plan-handoff.mjs --manifest <manifest-path> --check` and read its SVC_PLAN_BODY release entry for this skill. Treat the entry as planning data: use the existing adapter's identity/preparation operation, read the literal top-level JSON key as data, and complete that adapter's existing pre-use verification before its external action. A command that itself merges, pushes or deploys belongs to the external-action step and cannot be run as an unchecked identity producer. The plan field does not grant execution authority or add a shell runner. Do not interpolate that field into shell source or mark the phase complete because an artifact exists. Failed production/verification keeps this phase incomplete.

Use the actual adapter and launcher outputs to populate existing receipts. `scripts/merge-pr-with-review-receipt.mjs` owns reviewed squash finalization and evidence relocation; its merged-but-unverified result uses the existing recovery path, never a second merge or invented receipt. Preserve complete source/AC binding and required post-promotion observations. Reuse local tier-1 evidence only under the existing exact-input rules; this change adds no cache, pre-push override or cross-commit reuse.

For a framework package release, keep this task in_progress while canonical main runs `./setup --all-hosts` and `bash scripts/check-install-drift.sh --all-hosts`. Record real outputs before completion. A failed host or transactional restoration remains a blocking result; local source tests do not prove installed hosts. Never install the package from an execution worktree.

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

Give each sub-skill scoped context — pass the feature spec path and manifest path explicitly — so it does not re-scan to find artifacts.

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
   - leave other features' journeys unloaded

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
   a finding — route back to `write-e2e` before promotion in a future iteration.
   Verification proves shipped reality, it does not mutate it.

**Context reuse rule:** The feature spec and manifest are already loaded by
verify-promotion. If running sub-skills in the same session, they share this
context. If spawning as subagents, pass the file paths explicitly rather than letting each sub-skill discover artifacts by scanning `docs/specs/`.

**Restart-Boundary Continuation (WI-552) and Verification Escalation Ladder** — First run `node scripts/resolve-continuation.mjs status --wi "$WI"`. With no baton, verify normally and launch no new session. With a `deploy_stamped` or retryable `blocked` baton, this run is the lifecycle controller: run `reconcile` and launch EXACTLY ONCE, never remap the host silently, and on `launched` STOP. A `capability_limited` block is reported as the single blocker. In the launched child session (`SVC_SESSION_ID` matches the baton), run ONLY the declared verification tasks and close with `resolve-continuation.mjs consume --wi "$WI" --result <structured JSON>`; free-text results and stale session ids are freshness violations. Verification is AI-first: try V0 static, V1 live DOM, V2 live interaction in order, and V3 user delegation is the LAST resort (HARD-GATE AP-31), allowed only with a V2 Exhaustion Log listing every V2 mechanism tried and why it failed. Functional claims are never V3 by default; aesthetic claims and structural platform constraints may be V3. `review-gate` G7 FAILs a functional claim that ends at "user confirmed" without that log. Confidence tiers: `VERIFIED` (V0+V1+V2), `VERIFIED-L2` (partial V2 with log), `VERIFIED-USER` (V3 with justification and log), `UNVERIFIED`. Details: `references/restart-boundary-and-escalation.md`.

## Multi-PR Campaign Sampling

When one lane/session closes a campaign of three or more PRs, branches, pages, or equivalent shipped surfaces in the same skill chain, verify-promotion must sample live evidence instead of accepting V0 proof for every item.

1. Build the campaign list from merged PR numbers, branch names, or shipped page/surface identifiers.
2. Run the deterministic sampler:
   ```bash
   node scripts/verification-sampling.mjs PR-101 PR-102 PR-103 PR-104
   ```
   Or pipe newline-separated identifiers into the script.
3. The sample size is `ceil(N/3)`, with first/middle/last included at minimum when `N >= 3`; remaining slots are filled by a stable SHA-256 hash of the sorted campaign list.
4. For every sampled item, produce V1 or V2 evidence. Browser-visible sampled items require a live DOM, screenshot, or interaction receipt; V0 bundle-grep is insufficient.
5. The cumulative verification summary must list every item in the campaign, sampled or not, with `verification_tier`, `sampled: true|false`, and evidence paths. Unsampled items may remain at V0 only when sampled V1/V2 coverage passes and the summary explicitly identifies them as unsampled.
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

**Verification Report and G7 Review** — Compile the report from the manifest reference, sync-spec-code results, AC/QA/E2E coverage, responsive evidence for browser-visible features, campaign samples (3+ shipped items) or a `single_lane_summary`, and findings. G7 passes only with no unresolved critical/high drift, complete or justified AC coverage, current QA/E2E/responsive evidence, and spec/journey state matching what shipped; then mark `VERIFIED-L1` (structural, visual and manual QA), `VERIFIED-L2` (structural and visual) or `VERIFIED-L3` (structural only; for browser-visible features only when visual verification is blocked by a documented pre-existing issue). On failure route back: behavior bug to `diagnose-bug` or the execution/planning path, spec mismatch to `write-spec`, journey mismatch to `write-journeys`. Details: `references/report-and-g7-review.md`.

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

**Post-Verification: Visual Baseline Promotion** — If a track-visuals diff report exists and G7 passed, take the CHANGED entries marked intentional and check each screen's baseline with `git log -1 --format=%ci -- docs/specs/visuals/baseline/<screen>.png`. If another WI promoted it after this branch point, re-capture ONLY those screens against current main first; then run track-visuals in `update` mode. Afterwards delete screenshot files (`.png/.jpg/.webp`) from `.svc/visuals/<WI>/` but keep reports, manifests and logs. Skip when there are no visual changes or no browser-visible surface. Details: `references/visual-baseline-promotion.md`.

## Post-Verification: Landing-tagged WI handler (WI-139)

For any WI whose `**Tags:**` field contains `landing` OR `marketing-page`, an additional post-deploy visual receipt is required before verify-promotion can mark the WI VERIFIED.

### Why this exists

Two prior sessions (Example Marketplace WI-088 iter1, WI-161) shipped landing iterations that passed every textual / contractual check (bundle-grep ✅, lane-tasks ✅, perf budget ✅) while the live deployed page visually fell 50–60% short of the named sector anchor. A bundle string can ship without the section *looking* like the anchor. The fix is a post-deploy live-URL side-by-side that compares the shipped result against the same anchor bank used at planning time.

### Procedure

1. Detect `landing` or `marketing-page` in the WI's Tags field. If absent, skip this section.
2. Locate the pre-implementation side-by-side artifact at `docs/specs/landing/<wi-lower>-side-by-side.jpg` (produced by `benchmark-landing` Step 0b at WI start). If missing, HALT — the WI never went through the gate and cannot be promoted via this skill.
3. Capture a post-deploy live-URL screenshot of the deployed page at 1440×900 via `track-visuals --mode external-anchor` against the production URL (NOT local build). Pass to `scripts/stitch-side-by-side.mjs` together with the same 3 anchors that were used at WI start to produce a post-deploy stitched JPEG. Save to `docs/specs/landing/<wi-lower>-side-by-side-postdeploy.jpg`.
4. Diff against the pre-implementation artifact: the shipped change must be visible at comparison scale (i.e., the post-deploy target tile must look meaningfully different from the pre-implementation target tile in the same way the brief promised). A change that is "present in bundle string" but invisible at 1440×900 fails this check.
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

**Canary Monitoring and Document Sync** — If the feature has a live URL, capture a pre-deploy baseline before deploying (desktop and mobile screenshots, console errors, load time per journey page), then check every 60 seconds for 5 minutes minimum and compare to baseline. Alert levels: CRITICAL page fails to load (stop and report), HIGH new console errors, MEDIUM load time at least 2x, LOW new 404s; alert only on patterns persisting 2+ checks. Finish with a per-page health report and verdict HEALTHY, DEGRADED or BROKEN. For corrective, regression, deploy-affecting or acceptance-critical work, also rerun the same proof post-promotion per `references/pre-post-validation-loop.md` and classify the delta. Then sync docs: read only docs the diff could affect, auto-update factual items (versions, paths, commands), queue narrative changes for user approval, check README/CLAUDE.md/CHANGELOG/VERSION consistency, and clean up TODOS.md (mark completed items, add new TODO/FIXME/HACK from the promotion commit). Details: `references/post-verification-canary-and-doc-sync.md`.

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

**Log Learnings and Update Builder Profile** — Append operational discoveries to `docs/learnings/learnings.jsonl` (date, skill, feature, learning, confidence, saves_minutes). After a successful verification, update `~/.svc/builder-profile.md`: add the project to history, then update skills, financial context, social presence, patterns (comparing against past projects) and gap analysis, and append a changelog line. If the profile file does not exist, skip the profile update. Details: `references/post-verification-learnings-profile.md`.

## What Not To Do

- Do not fix code inline during verification
- Do not skip sync-back into spec/journey state
- Do not treat passing tests alone as sufficient if drift remains

**Test Quality Audit** — After tests pass, audit test QUALITY: a passing test that proves nothing creates false confidence.

| Check | Look for | Severity |
|---|---|---|
| Disabled tests | `.skip()`, `@Disabled`, `xit(`, `xdescribe(` on requirement-linked tests | BLOCKER |
| Circular tests | System generates its own expected values | BLOCKER |
| Assertion strength | `toBeDefined()` / `!= null` where a value assertion is needed | WARNING |
| Expected value provenance | Expected value came from the system under test, not the spec or AC | BLOCKER |

Test quality blockers override an otherwise passing verification; green CI with circular tests is a false green. Reference copy: `references/test-quality-audit.md`.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume (also across sessions and subagents). Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose.

Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; in Codex, mirror only the active step in `update_plan`) happens only in the parent/top-level session: the host exposes TaskList and there is no `SVC_SUBAGENT=1` marker in env. Otherwise skip mirroring — file state is the durable record and the parent re-mirrors after the subagent returns. Subagents do not attempt TaskUpdate calls, because a failed attempt is silent drift between the subagent's intent and the host UI.

Mark this skill's task `completed` in `lane-tasks.json` before leaving, then update the host mirror and evaluate the next task: runnable → mark `in_progress`, persist, and load that skill before doing work; skippable → mark `completed` with a skip reason and evaluate the one after. Per `route-workflow` Task-Graph Execution Protocol.

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
| 12 | Structured evidence receipt present | For completed browser-visible work: the task `skill_receipt` includes `target_class`, `evidence_level`, and `evidence_artifacts` per `references/phase-receipts.md`; `target_class: browser-visible` must not close at `evidence_level: V0`. | |
| 13 | Delivery tier reported | Closeout classification output includes `delivery_tier`; compressed/rush closeouts cite a decision-log rationale and cannot be summarized as full validation. | |
| 14 | Pre/post validation delta classified | For corrective, regression, deploy-affecting, or acceptance-critical work, closeout cites the exact pre and post evidence, comparison classification, iteration count, and pre/post evidence validator result per `references/pre-post-validation-loop.md`; otherwise records why N/A. | |
| 15 | Leftover disposition validated | `git status --short --untracked-files=all` is clean, or every remaining path is covered by a passing ledger per `references/leftover-disposition.md`. Closeout states whether leftovers remain. | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

If a runtime or promoted-state failure proves the parent WI cannot be honestly
verified, emit `BLOCKING_DISCOVERY` per
`references/blocking-discovery-format.md`, validate it, emit `skill_outcome`
with `block_on_discovery`, and leave the parent blocked instead of VERIFIED.

### Chaining

In task-graph mode, follow §Task-graph mode above, then report one sentence before the detail: `VERIFIED (<tier>): checked <the checks that passed>. Still open: <observation, leftovers, or manual issue close — or none>.` Do not treat outcome observation or a manual issue close as done. Then follow `## Handback` at the end of this file; this is the last stage of every lane, and the lane graph, not this skill, names the next stage.

## Post-Compaction Recovery

`.svc/lane-tasks-<WI>.json` is the sole source of truth: take the first `in_progress` (else first unblocked `pending`) task, run `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`, re-read this SKILL.md, and resume. Never ghost-complete: verify `skill_receipt` exists before marking any task complete. If `.svc/.checkpoint-<WI>.checkpoint.json` disagrees on `next_task`, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>`.

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

This skill emits receipt type `verify-promotion (P3 extended with three target types)` per `references/chain-receipt-contract.md`. The receipt is stored as a git note on `refs/notes/svc-receipts` (authoritative) and mirrored under `.svc/receipts/<sha>/<type>.json` (gitignored cache). Before a commit exists it writes to `.svc/receipts/staging/<tree-hash>/<type>.json`; the post-commit hook (`hooks/git/post-commit.d/10-receipt-promote`) promotes it to the SHA mirror and writes the consolidated git note. Self-verify: the receipt exists, passes its schema (`schemas/receipts/<type>.schema.json`), and is reflected in the consolidated git note.

### Chain Receipt Emission (Mandatory Chain — Actionable)

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

### Optional issue close after G7

After the local WI has actually reached `VERIFIED` and the matching PASS `verify-promotion` receipt is present in the durable `refs/notes/svc-receipts` note for `BASE_SHA`, inspect validated `issue_tracker` config and the shared map. If no mapped issue exists or mode is `local-only`, make no GitHub call. With `close_trigger: manual` (the default), print the exact retryable command and leave remote state unchanged:

```bash
node scripts/sync-github-issues.mjs --root <promoted-worktree> --close-wi "$WI" --commit "$BASE_SHA"
```

With `close_trigger: verify-promotion`, run that same command only after the durable note self-check. The CLI revalidates the WI, receipt, commit reachability, and remote marker; this skill never constructs its own PASS proof. A GitHub authentication, network, lock, or API failure records `close-pending` through the CLI and reports the exact retry command, but does not change the local `VERIFIED` status, verification verdict, or emitted receipt. Do not call the close command at `PROMOTED`, from `land-changeset`, or before G7 evidence exists.

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

## Handback

Run the `EMIT` command `svc-next` printed for this stage (it writes the `verify-promotion` receipt and prints `verify-promotion:<sha256>`), then `node "$SVC_ROOT"/scripts/svc-next.mjs --root . --done verify-promotion --receipt verify-promotion:<sha256>` and follow the printed card: do only what its `SKILL` says. `progressive: true` means do not ask a person; it never names the next skill.
