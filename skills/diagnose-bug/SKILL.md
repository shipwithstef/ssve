---
name: diagnose-bug
version: "1.0"
handles_concerns:
  - auth-surface
  - oauth-callback
  - paid-external-api
description: >
  Root-cause-first diagnosis for broken behavior, regressions or production issues;
  produces a bugfix brief with repro, root cause, smallest fix and proof plan. Use for
  "bug", "regression", "this broke", "why is X failing". Not for new features.
phases:
  - { id: P1-Inputs, trigger: always, reads: ["latest reproduction", "current expected behavior and spec/code conflicts", "affected dependencies and applicable mode"], writes: [], evidence_kind: command_output, required_for_completion: true }
  - { id: P2-Reproduction, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P3-RootCause, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P4-FixPlan, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P5-PillarRevisit, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
inputs:
  required: []
  optional:
    - { path: "docs/specs/features/*.md", artifact: feature-spec }
outputs:
  produces:
    - { path: "docs/specs/bugfix/<name>-brief.md", artifact: diagnose-bug }
chain:
  lanes:
    bugfix: { position: 1, next: plan-changeset }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** Root-cause reasoning uses the configured executor. Start from local reproduction/spec/code evidence; use authorized research only for consequential unresolved external facts. Resolve routes through `references/model-routing.md`, not a hardcoded provider.

# Bugfix Brief

Bug work is not feature discovery.

A bugfix lane should answer: what is broken, why is it broken, what is the smallest
safe fix, and how do we prove it is fixed?

This skill is influenced by systematic debugging approaches: reproduce first, isolate
the fault, reason about root cause, then define the correction and verification.

**Announce at start:** "I'm using the diagnose-bug skill to plan a root-cause-first fix."

## Applicability (derived from P1-P5 and the mode branches)

- **P1-Inputs:** Select the latest reproduction, current expected behavior, relevant spec/code conflicts and affected dependencies. Record which mode and conditional investigations apply.
- **P2-Reproduction / P3-RootCause:** Reproduce and trace the causal path; supersede older theories when newer evidence contradicts them. Follow dependent callers/writers that can change the diagnosis.
- **P4-FixPlan / P5-PillarRevisit:** Define the smallest complete correction and focused proof-of-fix; retain the risk/pillar and Self-Verify contracts below.
- E2E/live-device evidence depends on the affected user/platform surface. Cross-system tracing, deployment pre-check, bisect and external research apply only when the diagnosis requires them. Existing sufficient local evidence does not require a paid provider.
- An explicit owner request for diagnosis only or no edits controls the scope. Do not activate implementation or deploy merely because paths auto-deploy. Report-only requests do not authorize project-file mutation; when a task graph is already authorized, retain unexecuted downstream work as pending with the owner-scope limitation recorded, not falsely completed. The deployment pre-check selects the later implementation route only when implementation is authorized.

## Phase Receipt Contract

When a `.svc/lane-tasks-<WI>.json` task is active, record each required phase
before completion:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-Inputs --evidence command_output:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-Reproduction --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-RootCause --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-FixPlan --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-PillarRevisit --evidence file:<path>
```

## Product Questions — MANDATORY format

When diagnosis exposes an unresolved consequential product decision, use `_shared/product-question-format.md` with `phase: diagnose-bug`. Reuse clear owner authorization and accepted behavior; expose current spec/code conflicts and meaningful alternatives before dependent coding. Do not ask again when the accepted spec already determines the restoration. No question quota or empty companion is required.

## When To Use

- Existing behavior is wrong
- A regression broke something that worked before
- A work item is classified as `bugfix` or `regression`
- The repo is brownfield and the correction should not go through full feature authoring

## Flags

| Flag | Behavior |
|------|----------|
| *(none)* | Full Lane 4 — diagnosis + implementation tasks created, all pending, stop hook enforces completion |
| `--diagnose-only` | Diagnosis + Changeset Brief only. Creates task graph with Tasks 2-3 (plan-changeset, execute-changeset) marked `manual` so stop hook doesn't block on them. Use when implementation CANNOT be performed by `execute-changeset` alone — e.g. the fix lives in a resource that requires an external deploy step (Base44 **pages** via `coding/write`, Base44 **entity schemas** via `coding/write`, Shopify app metadata, Cloudflare zone config via API). When the owner has authorized implementation, do NOT select this platform-handoff mode for resources that auto-deploy from git push alone (Base44 **backend functions**, Base44 **components**, Vercel-on-push repos, Cloudflare Workers with git integration) — those fit normal `execute-changeset`. Run the Auto-Deploy Pre-check (see Step 0 below) before setting this flag. |
| `mode: e2e-test` / `--mode=e2e-test` | Diagnose a failing, flaky, or misleading E2E/Playwright test. Read the latest trace/screenshot/error first, bisect whether the failure persists, check helper-app parity, tenant/scope setup, transient assertions, and selector ambiguity before proposing app or test changes. |
| `--retroactive` | Retroactive mode — reads committed diff instead of reproducing from broken state. Equivalent to "code is already in main." |
| `--progressive` | Chain immediately to next skill after self-verify passes. |

## E2E Test Diagnosis Mode

See [references/advanced-diagnosis.md](references/advanced-diagnosis.md#e2e-test-diagnosis-mode) — invoke this mode when the failing artifact is an E2E test.

## Cross-System Falsification Mode

See [references/advanced-diagnosis.md](references/advanced-diagnosis.md#cross-system-falsification-mode) — invoke when the bug spans runtimes/origins/protocols/storage layers.

## Inputs

**Read in this order — do not skip ahead to code:**

1. The work-item file (`docs/specs/work-items/WI-*.md`)
2. The relevant journey(s) and ACs for the affected feature area
3. Any reproduction evidence
4. Code paths — only after steps 1-3 are complete

## Outputs

Update the work item with:

- reproduction steps
- expected behavior
- actual behavior
- root cause summary
- smallest safe fix surface
- verification plan
- whether specs need updating after the fix
- **Pillar Revisit Audit** — mandatory walk of all 8 pillars per `references/pillars-coverage-matrix.md` (see Process Step 4.4)
- **pattern scan results** — mandatory grep of the codebase for the same class of defect elsewhere (see Process Step 4.5)
- **register discoveries** — decomposition of findings into independent work items with WI files, INDEX update, and priority routing (see Process Step 5.5)
- **affected artifacts** — list of specs, journeys, ACs, e2e tests, feedback memories, and rule files that need updating because of this bug (derived from the Pillar Revisit Audit)
- **learnings** — rule, feedback memory, or code-style entry that would have prevented the bug, framed so a future agent catches it before merge
- **Pillars Coverage Matrix** — final post-fix state of all 8 pillars in the canonical format from `references/pillars-coverage-matrix.md`. Required at close-out; the matrix is what `review-gate` and `land-changeset` validate.

Optional output:

- a short bugfix brief section in the work item, or a linked brief file if the repo prefers that pattern

## Process

### Step 0 Pre-flight: Gemini Context Budget (MANDATORY on Gemini CLI)

Before diagnosis, on Gemini CLI:
```bash
bash hooks/svc-gemini-context-check.sh
```
Blocks at POOR tier (>4 MB chat JSON). Diagnosis requires holding spec + code + reproduction in attention simultaneously — impossible at POOR tier. On Claude Code this is a no-op. See [references/gemini-context-budget.md](../../references/gemini-context-budget.md). G1 from 2026-04-19 WI-085 audit.

**0. Task Graph Setup — MANDATORY** — MANDATORY before any diagnosis: make sure `.svc/lane-tasks-<WI>.json` holds the task graph for this lane and Task {T} has its `process_tasks`. If the file and process_tasks already exist, skip setup and hydrate; if the file exists without them, add only Task {T}'s process_tasks (never overwrite the file); if there is no file, initialize it with `node scripts/task-graph.mjs init` and populate it. Update the file before the task system on each completion, and do not mark Task {T} completed while process tasks remain open. Details: `references/process.md`.

### 0.3. Bug-Domain Classification — MANDATORY FIRST HYPOTHESIS GATE

**Before any "what code is broken" hypothesis, classify which DOMAIN the bug lives in.** Agents default to code-bug hypotheses and chase React state races / SDK quirks / framework internals for hours when the real cause is fixture state, platform quirk, or test-logic error. Forced classification at turn 1 prevents this.

For every diagnose-bug invocation, answer:

| Domain | Signals | Resolution path |
|---|---|---|
| **Code** | Error traces land inside `src/` or `base44/functions/`; bug reproduces with any test data | Hypothesize code bugs; read source |
| **Test-logic** | Error is in the test spec itself (wrong assertion, wrong locator, timing assumption); bug reproduces for any fixture | Fix the test; don't touch app code |
| **Test-fixture** | Test account / seeded entity / test database has wrong shape; bug does NOT reproduce for real users | Fix the fixture; don't touch app code OR test logic |
| **Platform** | Upstream service behavior (cache, consistency, auth, rate limit) differs from what code assumes | Workaround in app or test; file upstream issue |

Classify BEFORE reading the code. Write the classification in the brief. If you're not sure, say "ambiguous — will refine after Step 0.4–0.5 evidence" and revisit at Step 1.6 (root cause).

**WI-087 archetype (2026-04-19):** 8 hours chasing Code-domain hypotheses (H1 useEffect clobber, H2 Radix race, H13 state cascade) when the real bug was Test-fixture (test account didn't own seeded location) + Platform (filter-query cache not invalidated by entity API). One forced classification round at turn 1 would have flipped the whole investigation immediately.

### 0.35. Read the Failing File's Own Comments — MANDATORY BEFORE HYPOTHESIS

Before generating cause hypotheses, read every comment in the failing file that starts with SKIP / TODO / FIXME / KNOWN ISSUES / XXX / NOTE — and any multi-line block comment whose first line mentions the same symbol/test/feature. The previous author may have already documented the cause.

Mechanical check:
```bash
grep -nE "SKIP|TODO|FIXME|KNOWN|XXX|NOTE" <failing-file-path>
```

If a SKIP comment explains WHY a test was skipped or is marked un-skipped, that comment IS the diagnosis. Do not restart investigation — verify whether the comment's stated cause still applies, then fix or escalate.

**WI-087 archetype (2026-04-19):** the spec at `e2e/specs/journeys/WI081-sop-friendly-toggle.spec.ts:150-170` had a SKIP-comment block explicitly naming the root cause ("test account is TEAM MEMBER, not OWNER"). Every investigation round (Base44 AI × 2, Claude) missed it because we anchored on "the upstream WI-085 fix should have resolved this" instead of reading the test's own prior documentation.

**0.4. Pre-Lock Rejection — reject WIs with pre-specified fixes** — Before reading the spec or code, scan the WI file for pre-specified fixes (`## Proposed fix/solution`, `## Plan`, `## Resolution`, diff or code fences proposing changes, "Option A (preferred)", PR-body or commit drafts) and HALT if any are present; `## Symptom`, `## Reproduction`, `## Evidence`, `## Impact`, open questions and outcome-style ACs are fine. If the WI came from a `BLOCKING_DISCOVERY`, external report or earlier pattern-match, strip the fix proposal and commit `chore(wi-###): strip pre-locked fix per diagnose-bug 0.4`; if the user authored or anchored the fix, ask once whether to strip it (recommended) or run `--retroactive` validation. Never proceed silently with a pre-locked conclusion; skipped under `--retroactive`. Details: `references/process.md`.

**0.5. Spec/Journey/AC Anchor — MANDATORY BEFORE ANY CODE EXPLORATION** — MANDATORY before opening any code (when `docs/specs/` exists): read the relevant journey step(s) and ACs (copy the covering AC verbatim, or record a spec gap), answer who the persona is, what they were trying to do, what the spec says SHOULD happen, and whether this is a code defect or a spec gap. Then write a 2-4 file reading list derived from the spec, read only those files (NEVER launch a broad Explore subagent), classify each finding as match, drift or gap, and file independent surprises as new WIs per Step 5.5. Details: `references/process.md`.

### 0.6. Persistence Bisect — MANDATORY for empty/zero visibility symptoms

For any symptom matching "expected record/entity/item visible, got empty/zero/not
found" or "after save/upload/create, the page shows nothing", bisect persistence
before reading frontend rendering code.

Run a direct authenticated SDK/API probe against the same entity and scope the
test or user action wrote:

```bash
node scripts/classify-persistence-bisect.mjs --records .svc/<WI>-persistence-records.json
```

The records file can be a raw array or `{ "records": [...] }` captured from the
project SDK/API query.

| Result | Meaning | Next search space |
|---|---|---|
| `CLASS_A_NOT_PERSISTED` | Backend rejected, stripped, rolled back, blocked, or failed to store the data | Write response, RLS/security rules, schema allowlists, `secureOperation`, validation, transactions, idempotency |
| `CLASS_B_PERSISTED_UI_SCOPE` | Data exists but UI/test does not read it | Tenant/scope mismatch, query operators, cache keys, query enabled state, helper-app parity |

Do not inspect React rendering, fallback copy, or empty-state components until this
bisect is complete. If the direct probe cannot run, record why and route to
`base44-environment` for backend/schema/readback proof instead of guessing.
Check `_shared/backend-query-gotchas.md` before interpreting an empty Base44,
Supabase, Firebase, or similar backend result as proof of non-persistence.

### 1. Reproduce

**Before reading any code, write the structured repro in this form:**

```
Trigger:  [the action the user or system performed]
Expected: [what should have happened]
Actual:   [what happened instead]
```

**Temporal qualifier check (MANDATORY):** If the report says "after doing X, Y is wrong" or "when I upload/save/click X, it shows Y" — X is part of the repro, not background. Classify the bug by causal structure before looking at any code:

| Classification | Meaning | First thing to trace |
|---|---|---|
| **Action bug** | X itself doesn't complete — data never persisted | The write path (mutation, save handler, entity update) |
| **Propagation bug** | X completes but the effect doesn't reach Y — stale cache, wrong query key, missing invalidation | The invalidation path (onSuccess, queryClient.invalidateQueries, query keys used by readers vs writers) |
| **Rendering bug** | Data reaches Y correctly but Y displays it wrong — fallback, null guard, field mismatch | The rendering/fallback code only |

**Do NOT start reading code until you've written the structured repro and chosen one of these three causal categories.** Jumping to code exploration before this step causes category errors — the agent finds the nearest plausible-looking bug (often a rendering fallback) instead of the actual broken path.

If repro is not yet reliable, record the best-known repro and the uncertainty — then still classify by causal category before exploring.

### 2. Define expected behavior

By this point, Step 0.5 already gave you the spec/journey/AC. Use it.

If Step 0.5 found spec coverage, copy the relevant AC or journey step verbatim — that IS the expected behavior. Do not paraphrase it, do not derive it from code behavior.

If Step 0.5 found no spec coverage, use the strongest remaining source:

1. **Existing spec or journey** — what the product spec says should happen (found in Step 0.5; if present, this is authoritative)
2. **User-visible contract in code/tests/docs** — what an explicit test or contract says
3. **Current shipped behavior before regression** — only valid for regressions; if it worked before, the pre-regression behavior is the ground truth
4. **Explicit stakeholder intent** — user's own words from the bug report

Do not silently invent the expected behavior. Do not derive expected behavior from the current broken code.

### 3. Isolate the fault surface

Identify the smallest relevant subsystem:

- UI state/rendering
- request validation
- business logic
- integration boundary
- persistence/data model
- background process

**For propagation-class bugs (from Step 1):** verify these three things in order before any other code reading:

1. **Does the action persist?** Read the mutation/save handler. Confirm the entity field is actually written (not just local state updated).
2. **Does the reader see the updated data?** Find the query key the affected view reads from. Find all `invalidateQueries` calls in the action's `onSuccess`. Confirm the keys match. A mismatch here is the most common propagation bug — the save invalidates `['locations']` but the reader queries `['batch-location-data']`.
3. **Does the renderer display it correctly?** Only check the rendering/fallback code AFTER confirming steps 1 and 2 are not the issue.

Skipping to step 3 when the bug report says "after I did X, Y is wrong" is a category error. Step 3 (rendering) is a valid root cause only when steps 1 and 2 are verified clean.

### 4. Write root cause

Summarize:

- immediate cause
- enabling condition
- why the system allowed it

If true root cause is still unknown, say so plainly and log the current best hypothesis.

**4.4. Pillar Revisit Audit — MANDATORY** — MANDATORY before proposing a fix: walk all 8 pillars in `references/pillars-coverage-matrix.md` (product fit, journey, AC, UX, UI, tech architecture, cost model, operations) and record `affected`, `unaffected` or `unknown` with one-line evidence under **Pillar Revisit Audit:** in the work item. `unaffected` means you opened the artifact and confirmed; "probably fine" is a self-verify failure. Affected pillars are bundled into the fix or filed as follow-up WIs, and unresolved ones block close-out. Then sync `eval_matrix` in `.svc/lane-tasks-<WI>.json` (`UPDATED - WI-NNN`, `UNCHANGED - VERIFIED - <file:line>`, or `N/A - <reason>`); the PreToolUse eval gate blocks `TaskUpdate(completed)` until all 8 entries are non-null. Details: `references/process.md`.

### 4.5. Pattern scan — MANDATORY

Before proposing a fix, grep the codebase for the same class of defect elsewhere. A bug that surfaced in one place almost always exists in others that nobody has noticed yet. The mandate: **find all instances, not just the reported one.**

Pattern scan types (pick the ones that match the root cause):

| Root cause class | Scan to run | Expected finding |
|---|---|---|
| Silent prop-shape mismatch between component and callers | Grep each shared component's exported prop destructure vs every call site's passed props; flag any mismatch | Other components exported one shape, called with another |
| Missing null/undefined guard | Grep for `.foo.bar` patterns on values with the same shape as the broken one | Other call sites will crash the same way |
| Stale cache invalidation | Grep for the cache key + all its writers; check every writer invalidates | Other writers skip invalidation |
| Missing auth/permission check | Grep the endpoint pattern; check every similar endpoint has the check | Other endpoints are unguarded |
| Race condition on shared state | Grep every writer to the shared state; check locking/ordering | Other writers race too |
| Schema drift between layers | Grep the field name across frontend/backend/DB; check all three agree | Other fields drift too |
| Dead error path / unhandled rejection | Grep `await` or `.then` without corresponding `.catch`/try-catch | Other async calls swallow errors |

Document the scan in the work item under **Pattern Scan:**

```markdown
## Pattern Scan

**Scope:** <what was grepped — exact patterns, directories, file types>
**Findings:** <list every hit, file:line — or "no other instances found">
**Followups:** <new work items created for each additional instance, or "none needed">
```

If the pattern scan finds additional broken instances, the bugfix scope expands to cover them OR new WIs are filed for each, depending on severity and safety of bundling.

Skipping the pattern scan is a self-verify failure. If the root cause is so specific that no scan is possible (e.g., a one-time data corruption event in a single row), document that explicitly: "Pattern scan: N/A — root cause is non-generalizable. Reason: ..."

### 4.6 Risk-Flag Classification — MANDATORY

Before defining the smallest safe fix, classify it against the shared
risk-flag table (`scripts/lib/risk-flags.mjs`, AC-553-1). This step itself is
mandatory and cheap (one table lookup); the flags it MAY set are what is
mechanically expensive. Unmatched work — the common case (docs-only,
parser-only, copy-only, most bugfixes) — matches zero flags and pays zero
extra plan/exec contract cost downstream. Do not skip the classification just
because you expect the answer to be "none."

| Flag | Set when the fix... |
|---|---|
| `runtime_concurrency` | touches code invoked by more than one process/session/hook concurrently (locks, PID files, race-prone check-then-write) |
| `external_state_writer` | writes or backs up state OUTSIDE the git-tracked tree (host config, `~/.claude/settings.json`, provisioned symlinks, an external DB row) |
| `config_schema_migration` | changes the on-disk shape of a config/schema file other readers already depend on |
| `lossless_rmw` | reads a file, mutates part of it, and rewrites the whole file (read-modify-write) where other/unknown entries must survive byte-for-byte |
| `idempotent_rewriter` | the same fix logic may run more than once (retries, re-invocation, resumed session) and must not double-apply or corrupt an already-applied baseline |
| `cross_runtime_integration` | (pre-existing flag) the fix spans two host runtimes/protocols/storage layers |

Record the result in the work item under a `**Risk Flags:**` line —
`**Risk Flags:** runtime_concurrency, external_state_writer` or
`**Risk Flags:** none` — and set the `flags` array in
`.svc/lane-tasks-<WI>.json` to the same list. These flags are the sole input
to `validate-task-graph-lane.mjs`'s design-tech skip-denial gate (AC-553-2)
and to `plan-changeset`'s `plan-contract.json` risk-triggered sections
(AC-553-3/4). Declare accurately: a false negative here means those
mechanical checks never fire for a change that actually needed them; a false
positive only costs one extra `design-tech` pass.

### 5. Define smallest safe fix

Specify:

- file/class/module scope
- behavior to preserve
- behavior to change
- whether this is a code-only fix or requires spec/journey updates

**5.5. Register Discoveries — MANDATORY** — MANDATORY before defining proof of fix: if the diagnosis surfaced several independent corrections (root-cause fix, pattern-scan siblings, pillar follow-ups, spec/journey drift, missing ACs or e2e), decompose them, create a WI file for each (canonical schema, heading `# WI-NNN: title`, `Status: identified`, `Source: diagnose-bug WI-<parent>`), update `docs/specs/work-items/INDEX.md`, rank them (the reported bug first) and point `**Next:**` at the top child. NEVER ask the user "implement or file?"; if there is only one correction, write "Register Discoveries: single correction - no decomposition needed." and continue to Step 6. Details: `references/process.md`.

### 6. Define proof of fix

List the exact validation:

- targeted unit/integration test
- manual repro replay
- journey or regression verification
- monitoring/log check if needed

### 6.5 Emit the impact-triad subsumption receipt

Write `.svc/impact-triad/WI-N/task-N.json` using `schemas/change-impact-triad.schema.json`. Map `breaks_what` to the affected-artifact and pattern-scan evidence, `intended_behavior` to Step 2, and `product_surface` to the Pillar Revisit Audit. `subsumed_by` must name those phases plus Step 6 proof artifacts and the verify-promotion plan.

Run `node scripts/classify-change-risk.mjs --staged --json` and bind the receipt to its exact SHA. If mapped coverage is missing, create a child task with owner, blockers, and validation before the receipt can pass; prose acknowledgement is not closure. High risk requires behavioral/runtime proof at the task checkpoint and exact binding to the one final different-family `review-exec` task even when the richer bug phases subsume the three questions.

## Causal Chain Summary (cutting-edge technique #6)

After completing the diagnosis (all phases + root cause), emit a structured causal chain so the prevention level is reusable by other skills:

```yaml
symptom: "<what failed, observably>"
proximate_cause: "<direct cause — what broke>"
root_cause: "<why the proximate cause existed>"
systemic_cause: "<why the system allowed the root cause to exist>"
prevention: "<structural change that prevents this CLASS of failure>"
```

Append it to `.svc/causal-chains.jsonl` (gitignored, ephemeral per-session):

```bash
echo '{"ts":"'"$(date -Iseconds)"'","symptom":"...","proximate":"...","root":"...","systemic":"...","prevention":"..."}' >> .svc/causal-chains.jsonl
```

This chain feeds:
- **`manage-learnings`** — capture the `prevention` level as a learning candidate
- **`evolve-framework`** — detect `systemic` causes that recur across multiple skills
- **future `diagnose-bug` runs** — check whether a new bug matches a known `systemic` cause before re-deriving it

## Retroactive Mode — code already committed

See [references/advanced-diagnosis.md](references/advanced-diagnosis.md#retroactive-mode--code-already-committed) — invoke when the code is already committed and you are reconstructing the root cause.

## Regression vs Bugfix

- **Bugfix**: behavior is wrong or incomplete
- **Regression**: behavior used to work and stopped working

Regression briefs should explicitly capture the last-known-good behavior and how confidence in that expectation was established.

## Iron Law: No Fixes Without Root Cause

**Do not propose a fix until the root cause is identified.** A patch without root-cause understanding may fix only the symptom, introduce bugs in adjacent code, or mask a deeper architectural problem.

1. **Reproduce** (Step 1).
2. **Hypothesize** - a concrete, falsifiable hypothesis about the root cause.
3. **Scope lock** - restrict investigation to the smallest relevant subsystem (`scripts/worktree.sh freeze <directory>` if available) so you do not "fix" unrelated code.
4. **Trace** the data flow end to end. When the fault surface spans components (API -> service -> DB -> response), add logging at EVERY component boundary in one pass, run once, and read all boundary logs together.
5. **Verify** with code evidence that confirms or refutes. For cross-system flows, the probe needs both a confirmation and a falsification check and must pass `scripts/validate-cross-system-probe-evidence.mjs`.
6. **If refuted**, form a new hypothesis. Maximum 3 attempts, then escalate.
7. **If confirmed**, go to Step 5 (smallest safe fix).

**3-attempt escalation:** after 3 failed hypotheses, STOP investigating and do NOT start guessing fixes. Report what was tried, what was ruled out and the best current hypothesis; say whether this looks like a design problem (wrong architecture, especially if all 3 targeted code-level causes) or a code problem; then ask the user for domain knowledge or pair debugging.

Common root-cause patterns (race, null access, state-machine violation, stale cache, schema mismatch, off-by-one) with verification tips: `references/iron-law-no-fixes-without-root-cause.md`.

## What Not To Do

- Do not turn a small bug into a full feature-spec rewrite
- Do not skip root cause and jump to patch ideas
- Do not patch widely when a smaller safe fix is available
- Do not update product specs unless intended behavior actually changes
- Do not investigate for more than 3 hypotheses without escalating
- **Do not skip the pattern scan** — a bug in one place almost always has siblings
- **Do not treat "code is committed" as "work item is done"** — run retroactive Lane 4 and verify end-to-end
- **Do not propose a new skill to handle out-of-band fixes** — `diagnose-bug` in retroactive mode IS the framework's answer
- **Do not launch a broad Explore subagent before reading the spec** — the spec names the relevant components; read them directly with Read/Grep. Broad exploration without spec context costs 10x more and answers the wrong question ("what does the code do?" instead of "does the code match the spec?")
- **Do not derive expected behavior from the broken code** — broken code describes actual behavior, not expected. Expected behavior comes from spec/journey/AC or user intent, never from reading what the code currently does and calling that correct

**Routing After This Skill** — Implementation goes to `plan-changeset` or the direct execution flow; a user-facing or admin-facing bugfix MUST run `write-e2e` before close-out; drift goes to `sync-spec-code`; a missing capability goes to `validate-feature`; retroactive mode chains `write-e2e` -> `review-gate` -> `land-changeset` -> `verify-promotion`. With `--diagnose-only`, emit a Changeset Brief (file, line, before/after, rationale, confidence, test surface), set Tasks 2-3 to `manual` and mark Task 1 completed. Every output MUST end with the `**Next:**` trailer. Details: `references/routing-after-this-skill.md`.

## Pipeline Continuation

### Task-graph mode (when authorized; source of truth: `.svc/lane-tasks-<WI>.json`)

Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In the parent Codex session, mirror only the active step in `update_plan`. These instructions apply only when a task graph is authorized; report-only and terminal-answer boundaries below remain controlling.

When a task graph is authorized, read and update `.svc/lane-tasks-<WI>.json` first. Complete the diagnosis only after the brief and actual required phase evidence are ready. Follow `references/task-graph-chaining-protocol.md` for task status, conditions, skill loading and parent-only UI mirroring; subagents do not call TaskUpdate. Preserve the explicit owner diagnosis-only/no-edit boundary and the mode-specific handoffs below.

### Self-Verify

For an explicit report-only request with no project-file mutation authorized, apply the substantive reasoning checks to the report; file/task-graph persistence checks are not applicable. State that scope and leave implementation unexecuted; do not fabricate phase receipts or files. Otherwise, before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Bugfix brief file exists | `test -f docs/specs/bugfix/<name>-brief.md` or brief section in work item | |
| 2 | Has reproduction steps and root cause section | grep for "Reproduce", "Root cause", "Expected behavior" in brief | |
| 3 | No blocking unresolved consequential decisions | Apply the shared promotion predicate. Inspect TBD/TODO as evidence-gap warnings: block missing required AC/state/dependency evidence or a consequential owner choice; explicitly defer harmless details without manufacturing answers | |
| 4 | Pillar Revisit Audit run | grep for "Pillar Revisit Audit" section with all 8 pillars, each marked affected/unaffected with evidence | |
| 5 | No unresolved `affected` pillars | Every `affected` pillar must be bundled into the fix OR filed as a follow-up WI with ID | |
| 6 | Pattern scan run and documented | grep for "Pattern Scan" section with Scope/Findings/Followups OR explicit N/A justification | |
| 7 | Register Discoveries completed | grep for "Register Discoveries" section — either decomposed WIs with IDs or explicit "single correction — no decomposition needed" | |
| 8 | Affected artifacts list present | grep for "Affected artifacts" — specs, journeys, ACs, e2e, memories | |
| 9 | Learnings captured | grep for "Learnings" — rule/memory that would have caught the bug | |
| 10 | write-e2e path identified for user-facing surfaces | If surface is user-facing, brief must name the e2e that covers the fix (existing or new) | |
| 11 | Retroactive mode handled correctly | If code already in main, brief must say "retroactive mode" and compare committed diff vs brief prescription | |
| 12 | Pillars Coverage Matrix complete | grep for "Pillars Coverage Matrix" with all 8 pillars populated, no blank cells, no TODO, no un-verified `[UNCHANGED]` | |
| 13 | Task graph written | `test -f .svc/lane-tasks-<WI>.json` — file must exist with ≥7 tasks and Task 1 = `completed` | |
| 14 | All process tasks completed | TaskList — all 10 `diagnose-bug|*` tasks must be `completed`. `diagnose-bug|fault-isolate` subject must reflect the causal classification from `diagnose-bug|repro-classify` (not the placeholder "[DYNAMIC]" text) | |
| 15 | Close-out uses the latest evidence | final brief/summary cites the latest reproduction artifact, failing assertion, or runtime log rather than an earlier superseded theory | |
| 16 | Risk-Flag Classification run | grep for `**Risk Flags:**` line in the WI, and confirm `.svc/lane-tasks-<WI>.json` `flags` matches it (AC-553-1) | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

### Chaining

Apply the canonical task-graph protocol above. If the owner requested diagnosis only or no edits, return the requested diagnosis and stop before implementation; the platform-routing branch below does not override that scope.

**`--diagnose-only` mode (after self-verify passes):**
1. Emit the Changeset Brief (see format above)
2. Set Tasks 2-3 to `"status": "manual"` in `lane-tasks.json`
3. Mark Task 1 `completed` in `lane-tasks.json`
4. Emit: `**Next:** implement via [platform path] per changeset brief above, then resume Task 4: \`review-gate\``
5. Do NOT invoke `plan-changeset` or `execute-changeset`

**If `--progressive` flag is present AND self-verify passed:**
- Check `--skip` list. If this skill is in the skip list, pass through to next.
- Invoke next skill: `plan-changeset --progressive --lane bugfix`

**If `--progressive` flag is absent:**
- Report results to user
- Emit the mandatory `**Next:**` trailer per `route-workflow` Output Protocol — typically `**Next:** \`write-e2e\` ...` for user-facing bugfixes, or `**Next:** \`plan-changeset\` ...` for internal fixes

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
