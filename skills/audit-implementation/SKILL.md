---
name: audit-implementation
version: "1.0"
handles_concerns:
  - build-ship-alignment
description: >
  Deep correctness audit of implemented code in the worktree before landing.
  Runs after execute-changeset and review-gate, verifies the implementation
  against specs, ACs, and journeys with evidence-graded findings. Use when
  "audit the implementation", "check correctness", "systems analysis",
  "is it ready to ship", "pre-landing audit", or automatically in progressive
  mode for features with new data models, external integrations, or concurrency.
phases:
  - id: P1-UpstreamContextScopeConcern
    trigger: always
    reads: [".svc/receipts/<sha>/plan-manifest.json#ac_digests (WI-381 baton: AC nav index, read FIRST; keep diffing against the live spec below — the baton never replaces the audit's evidence source)", "docs/specs/features/<name>.md", "docs/plans/<date>-<name>/manifest.md", "docs/specs/journeys/J*.feature.md", "git diff main..HEAD", "concerns/REGISTRY.json"]
    writes: [".svc/audit-implementation-context.log", ".svc/concern-hits.jsonl when concern scan runs"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-SpecialistDispatchCoverageLedger
    trigger: always
    reads: ["git diff main..HEAD", "docs/specs/features/<name>.md", "docs/plans/<date>-<name>/manifest.md"]
    writes: ["docs/specs/audit/<name>-analysis.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-HypothesisGeneration
    trigger: always
    reads: ["docs/specs/audit/<name>-analysis.md", "docs/specs/features/<name>.md"]
    writes: ["docs/specs/audit/<name>-analysis.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-SubsystemBehaviorAudit
    trigger: always
    reads: ["manifest-listed files", "docs/specs/features/<name>.md", "docs/specs/journeys/J*.feature.md"]
    writes: ["docs/specs/audit/<name>-analysis.md"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-FindingsConvergenceReport
    trigger: always
    reads: ["docs/specs/audit/<name>-analysis.md", "validation command output"]
    writes: ["docs/specs/audit/<name>-analysis.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["docs/specs/audit/<name>-analysis.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
    - { path: "docs/plans/<date>-<name>/manifest.md", artifact: implementation-manifest }
  optional:
    - { path: "docs/specs/journeys/J*.feature.md", artifact: journey-docs }
    - { path: "docs/specs/explorations/<name>/DECISION.md", artifact: solution-decision }
    - { path: "docs/specs/vision.md", artifact: vision }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "docs/specs/security/<name>-review.md", artifact: security-review, note: "When present, security specialist reads this first and focuses on implementation gaps not covered by the design-level review" }
outputs:
  produces:
    - { path: "docs/specs/audit/<name>-analysis.md", artifact: audit-implementation-report }
chain:
  lanes:
    greenfield: { position: 23, prev: review-gate, next: land-changeset }
    brownfield-feature: { position: 18, prev: review-gate, next: land-changeset }
    bugfix: { position: 5, prev: review-gate, next: land-changeset }
    refactor: { position: 5, prev: review-gate, next: land-changeset }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🛡️ [REVIEW-SONNET] + Codex cross-model when available — correctness audit against a spec is verification work; Sonnet 4.6 against an Opus blueprint is the designed split. Codex as adversarial second opinion. See `references/model-routing.md`.

# Systems Analysis

## Runtime v2 lifecycle boundary

Consume the single frozen final-review result and name every invalidated lens. A PASS advances only
to final-SHA binding; it does not mean released, live, delivery verified, outcome observed, or
learning promoted. Follow `schemas/release-lifecycle-v2.schema.json`.

Evidence-driven correctness audit of implemented code before landing.
Review-protocol catches design issues in the diff. This skill goes deeper —
traces behavior end-to-end, tests hypotheses about failure modes, and produces
findings graded by evidence strength.

Derived from petekp/claude-code-setup exhaustive-audit-implementation (MIT,
Copyright 2024 Pete Petrash). Adapted for svc's spec-first pipeline
with AC-traced verification.

**Announce at start:** "I'm using audit-implementation to audit the implementation for correctness before landing."

## When To Run

**Always** (in progressive mode) for:
- New data models or schema changes
- External integrations (APIs, services, payment, auth)
- Concurrency or real-time features
- Security-sensitive paths (auth, permissions, secrets)

**Skip** for:
- Pure UI changes with no data/API layer
- Documentation-only changes
- Config changes with no behavioral impact

### Invocation Modes

This skill has two invocation modes. The orchestrator selects which one to use
when dispatching the skill — there is no CLI flag parsed at runtime; the mode
is conversational and recorded in the task's `mode` argument.

**How the orchestrator selects mode:**

1. The orchestrator reads the change set (manifest + diff scope from
   `plan-changeset` output).
2. It evaluates the change against the criteria below.
3. It dispatches `audit-implementation` with one of:
   - `mode: full` (default if unspecified) — the full Process below
   - `mode: light` — the 5-minute checklist
4. The selected mode is written into the task entry of
   `.svc/lane-tasks-<WI>.json` under `args.mode`, and surfaced in the
   `skill_receipt.validation_output` field of the completed task so a
   reviewer can audit the choice.

This mirrors how other multi-mode skills declare modes
(`build-personas`, `write-journeys`, `vision-grounding-lab`).

#### Mode: `light`

Use when a change is below the "Always" threshold but above the "Skip" threshold
(e.g., framework-internal enablers, small utility additions, SKILL.md text
updates).

**Light checklist (5 minutes):**
1. Scope drift — `git diff --name-only main..HEAD` vs manifest: any unplanned files?
2. AC spot-check — pick the 3 highest-risk ACs, trace them through the diff.
3. Residue scan — stale TODO/FIXME, dead code, orphaned imports, temp flags.
4. Tier-1 validator sweep — do all relevant validators still pass?
5. Output: a 10-line markdown block (not a full report) appended to the task's
   `skill_receipt.validation_output` field in `lane-tasks-<WI>.json`.

**Selection criteria for `mode: light`:**
- No new data model + no external integration + no concurrency + no security surface
- <200 LOC changed
- No journey changes

**Reject `mode: light` (use `mode: full`) when:**
- Any of the "Always" conditions above are met
- >200 LOC changed
- Breaking changes to existing behavior

## Failure Modes To Prevent

1. Surface scans that don't follow behavior end-to-end
2. Reporting suspicions as bugs without evidence
3. Cosmetic findings that miss correctness risks
4. Missing the gap between what the spec promises and what the code does

## Process

This skill runs **inside the worktree** where the code lives.

### Phase 0: Load Upstream Context

Read everything the pipeline has produced:

| Source | What to extract |
|--------|----------------|
| Feature spec | ACs — these are the MUST-verify criteria |
| Feature spec revision log | Any ACs that changed mid-pipeline — verify code matches the REVISED version, not the original |
| Manifest | Task list, file-touch plan, validation commands |
| Journeys | User flows that exercise this feature — trace through code |
| Solution decision | What paradigm was chosen and why — check if implementation matches |
| Domain profile | Domain conventions — check if respected |

**Build the verification contract:** for each AC, write what the code MUST do
to satisfy it. This becomes the audit checklist.

### Phase 0.5: Scope Drift Check

Before analyzing correctness, verify scope:

1. `git diff --name-only main..HEAD` → actual changed files
2. Read manifest file set → planned changed files
3. Diff the two lists:
   - Files in diff but NOT in manifest → **UNPLANNED** (flag)
   - Files in manifest but NOT in diff → **MISSING** (flag)
4. For each UNPLANNED file: is the change related to a planned task
   (dependency resolution, test fixture, auto-generated)? If yes: JUSTIFIED.
   If no: SCOPE CREEP — flag for review.
5. Report scope drift findings before proceeding to correctness audit.

If SCOPE CREEP files exist, ask: remove the unplanned changes? Or accept
with justification? Do not silently include unplanned work in the audit.

Source: gstack review/SKILL.md (scope drift detection), MIT, Copyright 2025 Garry Tan.

### Phase 0.6: Concern Coverage Check

Before specialist dispatch, run the concern scanner against the implemented diff to surface subject-matter lenses that should engage:

```bash
node <SKILLS_PATH>/scripts/scan-concerns.mjs \
  --project <repo-root> \
  --paths <changed-files>
```

For each matched concern:

1. **CRITICAL** — verify a `required_skill` produced an artifact under `docs/specs/` (e.g., manage-finops cost analysis, review-security findings). If no artifact exists AND no waiver in PR body → finding class **CONCERN-UNADDRESSED**, severity HIGH, evidence-grade **direct** (cite the registry entry path).
2. **HIGH** — verify either an artifact OR an ack in PR body. Missing both → finding class **CONCERN-UNACKED**, severity MEDIUM.
3. **MEDIUM** — surface in audit report appendix as advisory. Not a finding unless the change introduces a new violation pattern (e.g., new `setInterval` without cleanup matching `memory-leak-risk`).
4. **LOW** — log to `.svc/concern-hits.jsonl`, do not surface in main report.

The concern check is in addition to specialist findings — a PR can pass specialist review but fail concern coverage. The audit report's headline summary must list both.

### Phase 1: Specialist Dispatch (parallel)

Before the main correctness audit, dispatch focused specialist subagents
based on diff scope. Each specialist gets the diff + feature spec ACs +
their focused checklist. Findings merge into the audit report.

**Select specialists based on diff scope:**

| Specialist | Dispatch when | Checklist |
|---|---|---|
| testing | always | (1) Every AC has at least one negative-path test (invalid input, timeout, auth failure). (2) Edge cases: empty collections, max-length strings, concurrent access, boundary values. (3) No test isolation violations (shared state, order-dependent, global mocks). (4) No flaky patterns (timing-dependent assertions, network calls in unit tests). (5) Security-specific tests exist for auth, injection, and privilege escalation paths. |
| security | always (NEVER_GATE) | (1) All user input is validated and parameterized — no string concatenation in queries. (2) Auth middleware present on every mutation endpoint — grep for unprotected handlers. (3) No hardcoded secrets, API keys, or credentials in source (check against .env.example). (4) Cryptographic choices are current — no MD5/SHA1 for passwords, no ECB mode, keys >= 256 bits. (5) Rate limiting on authentication endpoints. (6) CORS not set to wildcard in production config. |
| performance | >100 LOC changed OR database queries touched | (1) N+1 query patterns — loops that execute a query per iteration instead of batch. (2) Missing database indexes on columns used in WHERE/JOIN/ORDER BY. (3) Algorithmic complexity — O(n^2) or worse in hot paths, unbounded list operations. (4) Missing pagination on list endpoints. (5) Blocking operations in async contexts (sync file I/O, CPU-bound loops on event loop). |
| data-migration | migration files present (NEVER_GATE) | (1) Migration is reversible — DOWN migration exists and restores prior state. (2) No data loss — columns/tables being dropped have data preserved or migrated first. (3) Lock duration — large table ALTERs use online DDL or batched approach. (4) Backfill strategy — NOT NULL columns on existing tables have a default or backfill step. (5) Multi-phase safety — breaking changes split across deploy-compatible migrations. |
| api-contract | API routes or response shapes changed | (1) No breaking changes to existing response shapes consumed by clients. (2) New required fields have defaults for backwards compatibility. (3) Error response format is consistent with existing endpoints. (4) Versioning strategy applied if breaking change is necessary. (5) Rate limiting and pagination present on new list endpoints. |
| maintainability | >200 LOC changed | (1) No dead code or unused imports introduced. (2) No magic numbers or string constants — extract to named constants. (3) No DRY violations — same logic duplicated across 3+ locations. (4) Conditional side effects — no `if (condition) { sideEffect(); return; }` hidden in getters. (5) Module boundaries respected — no cross-layer imports (controller importing from another controller). |

**NEVER_GATE:** security and data-migration always run regardless of finding
history. Other specialists may be skipped if they consistently produce zero
findings (adaptive gating — evolve over time based on project data).

**Dispatch:** Use parallel Agent subagents. Each receives:
- The git diff (`git diff main..HEAD`)
- The feature spec ACs
- Their specialist checklist (from this table's Focus column)

**Merge:** Deduplicate findings by file:line. If multiple specialists flag
the same location, keep the highest severity. Attribute each finding to its
specialist source.

> **Review-station wave (WI-382 — Claude host).** This specialist fan-out + merge
> is the same mechanical contract the post-exec review station lifts up to span
> skills/review-exec/G5/audit/visual as ONE read-only wave over a single frozen diff. On
> Claude host, audit's specialists run as lenses inside that wave and merge via
> `scripts/review-station-merge.mjs` (this exact dedup-by-file:line / keep-highest
> rule); receipts emit post-barrier. See `references/parallel-review-station.md`.
> Non-Claude hosts run audit serially as today.

Specialist findings feed into Phase 2 hypotheses — a security finding
becomes a hypothesis to test in the correctness audit.

Source: gstack review/SKILL.md (Review Army), MIT, Copyright 2025 Garry Tan.

### Phase 2: Build Coverage Ledger

Map the implemented code into subsystems before deep analysis:

| Subsystem | Entrypoints | Files | ACs Covered | Risk | Status |
|-----------|-------------|-------|-------------|------|--------|
| API routes | `src/routes/*.ts` | 4 files | AC-01, AC-02 | High | planned |
| Data model | `src/models/*.ts` | 2 files | AC-03 | High | planned |
| Services | `src/services/*.ts` | 3 files | AC-01, AC-04 | Medium | planned |
| Components | `src/components/*.tsx` | 5 files | AC-05, AC-06 | Low | planned |

Prioritize by: AC criticality → side effects → concurrency → auth → recent churn.

### Phase 2: Generate Hypotheses

For each high/medium-risk subsystem, write 2-3 concrete, falsifiable hypotheses
BEFORE reading the code deeply:

**Good hypotheses** (tied to ACs and behavior boundaries):
- "AC-03 says items persist across sessions, but the code uses in-memory storage that resets on restart"
- "The retry logic in the payment service can double-charge because idempotency keys aren't checked"
- "The journey J01 step 'user sees updated list' assumes real-time sync, but the implementation uses polling with a 30s delay"

**Bad hypotheses** (vague, unfalsifiable):
- "The code might have bugs"
- "Error handling could be better"

### Phase 3: Audit One Subsystem At A Time

For each subsystem:

1. **Trace the happy path** from entrypoint to response
2. **Trace error paths** — what happens on invalid input, timeout, DB failure?
3. **Trace cleanup/shutdown** — any resources leaked? Connections unclosed?
4. **Compare against ACs** — does the implementation actually satisfy each AC it claims to cover?

**Vibe Audit (Masterclass UI):**
For features with a "Vibe Contract," the auditor MUST re-score the final implementation against the **Aesthetic Scoring Rubric** (Precision, Resonance, Novelty, Efficiency, Maturity).
- **Target**: Aggregate Score 90+.
- **Check**: Does the visual grit and interaction physics match the technical Motion Schema in `vibe-contract.json`?

5. **Compare against journeys** — walk through the Gherkin steps, does each map to working code?
6. **Run validation commands** from the manifest — do they still pass?

**Parallel subsystem audit with subagents:**

When subagents are available, assign one subsystem per subagent. Each subagent
receives a scoped context — use this template:

```
You are auditing one subsystem of a feature for correctness.

## Constraints
- Audit ONLY the files listed below. Do NOT scan directories or grep the codebase.
- If you need to check a consumer of an export, report the question back to the
  orchestrator — do not search for it yourself.
- Trace behavior through YOUR files only. Report boundary assumptions
  (what you expect other subsystems to provide) rather than verifying cross-boundary.

## Your subsystem files (disjoint — no other auditor has these)
[INSERT only files from the manifest assigned to this subsystem]

## AC slice
[INSERT only the AC rows this subsystem covers]

## Hypotheses to test
[INSERT hypotheses from Phase 2 for this subsystem]

## Validation commands
[INSERT relevant validation commands from manifest]
```

File disjointness is enforced by the orchestrator. Cross-subsystem questions
(e.g., "does service A call service B correctly?") are reported back and
resolved in Phase 5 convergence, not by individual subagents scanning beyond
their boundary.

### Phase 4: Classify Findings

Every finding must separate observation from inference:

```markdown
### Finding F-<N>: <title>

**Severity:** Critical | High | Medium | Low
**Confidence:** Confirmed | Likely | Needs follow-up
**Type:** Bug | Race condition | Security | AC violation | Spec drift | Dead code
**Location:** <file:line>
**AC Impact:** <which AC is affected>

**Observed:** <what the code actually does — exact citation>
**Expected:** <what the AC/spec/journey says should happen>
**Evidence:** <command output, test result, code trace>
**Checked:** <what was verified to rule out false positive>
**Fix:** <smallest credible fix>
```

**Confidence levels:**
- **Confirmed**: directly demonstrated by code, failing test, or hard contradiction
- **Likely**: strong reasoning but not directly reproduced
- **Needs follow-up**: suspicious but evidence incomplete

### Phase 5: Convergence

After all subsystems:

1. **Deduplicate** cross-cutting findings
2. **Re-rank** by AC impact (AC violation > bug > style)
3. **Sweep for residue**: stale TODO/FIXME, dead code, orphaned imports, temp flags
4. **List coverage gaps** — which ACs were NOT fully verified and why

### Output: `docs/specs/audit/<name>-analysis.md`

```markdown
# Systems Analysis: <feature name>

**Date:** <timestamp>
**Branch:** <branch name>
**Spec:** <feature spec path>

## Verification Contract
| AC | What code must do | Verified? |
|----|-------------------|-----------|
| AC-01 | ... | ✅ Confirmed |
| AC-02 | ... | ⚠️ Likely OK (see F-2) |
| AC-03 | ... | ❌ Violation (see F-1) |

## Coverage Ledger
| Subsystem | Risk | Status | Findings |
|-----------|------|--------|----------|
| API routes | High | done | F-1, F-2 |
| Data model | High | done | none |
| Services | Medium | done | F-3 |

## Findings

### F-1: <title>
...

## Residue
<TODO/FIXME count, dead code, orphaned imports>

## Unverified Surfaces
<what was not checked and why>

## Verdict
- [ ] READY TO LAND — no Critical/High findings
- [ ] BLOCKED — Critical findings must be fixed first
- [ ] CONDITIONAL — High findings should be fixed, Medium acceptable
```

## Evidence Standard

Strongest to weakest:
1. Failing test
2. Reproducible path with exact steps
3. Direct code contradiction with citations
4. Command/search output
5. Static reasoning

Static reasoning alone → "Likely", not "Confirmed".

For corrective, regression, deploy-affecting, or acceptance-critical work, audit
the implementation evidence against `references/pre-post-validation-loop.md`.
Findings that rely on "tests passed" must say whether the same selected command,
journey, probe, or visual capture was run before and after the change. Treat any
unclassified acceptance-critical delta as a High finding until it is classified
as fixed-by-change, pre-existing, branch-introduced, or blocked.
When a pre/post evidence JSON is present, run or cite
`node scripts/validate-pre-post-validation-evidence.mjs --evidence <path>`.

## Anti-Patterns

- Scanning files without tracing behavior end-to-end
- Reporting style issues as findings
- Calling something dead code without a consumer search
- Claiming a bug without showing the violated AC or broken behavior
- Hiding uncertainty — mark "Needs follow-up" honestly

## Audit Mode

When invoked with `--audit` on existing code (no active worktree):

Same process but against main branch. Useful for periodic health checks.

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `audit-implementation` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-UpstreamContextScopeConcern --evidence command_output:.svc/audit-implementation-context.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SpecialistDispatchCoverageLedger --evidence file:docs/specs/audit/<name>-analysis.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-HypothesisGeneration --evidence file:docs/specs/audit/<name>-analysis.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-SubsystemBehaviorAudit --evidence command_output:.svc/audit-implementation-subsystems.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-FindingsConvergenceReport --evidence file:docs/specs/audit/<name>-analysis.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/audit-implementation-self-verify.log
```

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

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Analysis report exists | `test -f docs/specs/audit/<name>-analysis.md` | |
| 2 | Every AC has a verification row | count AC rows vs spec AC count | |
| 3 | No Critical findings unresolved | grep for `Critical` + check if fixed | |
| 4 | Verdict section present | grep for `## Verdict` | |
| 5 | Pre/post validation evidence audited | For corrective, regression, deploy-affecting, or acceptance-critical work, the audit report cites the exact pre and post evidence plus pre/post evidence validator result, or flags the missing/unclassified delta. | |

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

**If verdict is READY TO LAND or CONDITIONAL (no Critical):**
- If `--progressive`: invoke `land-changeset --progressive --lane <lane>`
- If not progressive: suggest "Ready to land. Run `land-changeset`"

**If verdict is BLOCKED:**
- Stop the chain. Report Critical findings.
- Route back to `execute-changeset` for fixes in the worktree.
- After fixes: re-run `audit-implementation`.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## External State Diff Scan (WI-121)

After the change has merged, run a post-merge external-state diff scan to catch
drift introduced by emergency fixes, partial reverts, or cross-merge collisions.

### Steps

1. Read the plan's External State Lifecycle table from the WI doc.
2. For each declared environment, verify the lifecycle wiring is intact:
   - Taxonomy 1 (host filesystem): are the symlinks under <SKILLS_PATH>/ live?
   - Taxonomy 2 (host config): does settings.json contain the declared hooks?
   - Taxonomy 4 (.svc/): do the declared files exist with the expected schema?
   - Taxonomy 12 (downstream framework artifacts): does `node scripts/lint-skills-manifest.mjs` pass?
3. For each external write the diff actually performed, verify it appears in the
   plan's table. Emit `external-state-undeclared` HIGH-severity for misses.
4. Report drift in the audit findings with severity HIGH and a remediation pointer
   (e.g. re-run setup, re-emit hook config, restore symlink).

This is the **Audit** stage of the 4-stage external-state gate. See
`references/external-state-lifecycle-protocol.md`.

## Skill Outcome Contract

When this skill discovers new delivery-graph signals, emit `skill_outcome` per
`references/skill-outcome-contract.md` before completing the task.

When an audit finding blocks the parent WI from being correctly VERIFIED, emit
`BLOCKING_DISCOVERY` per `references/blocking-discovery-format.md`, validate the
artifact, and request `block_on_discovery`. Informational or non-blocking audit
findings stay in the audit report.

## Chain Receipt Emission (Mandatory Chain)

This skill emits receipt type `audit-implementation` per the contract in
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
cat <<'JSON' | node scripts/emit-receipt.mjs --type audit-implementation --wi $WI --sha "$BASE_SHA"
{
  "wi": "$WI",
  ...{verdict, findings, ac_coverage}
}
JSON
```

This writes to `.svc/receipts/<sha>/audit-implementation.json` (or staging if pre-commit)
AND attaches it to the consolidated git note on `refs/notes/svc-receipts`.

Self-verify: `node scripts/check-chain-receipts.mjs --sha HEAD` shows this
receipt type as present + schema-valid.

Reference: `references/chain-receipt-contract.md`.
