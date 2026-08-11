# WI-507 Changeset Manifest — Company Operating Fleet and Promotion Memory

**Spec:** `docs/specs/work-items/WI-507.md`
**Branch:** `WI-507-fleet-integration`
**Status:** REVIEWED — three-round bounded review complete; zero unresolved HIGH/CRITICAL findings
**Base:** `main` / `origin/main` at `5f02728ac8794283c317791a077c645f8420cc9e`
**Created:** 2026-07-22
**Archetype:** architectural change with cross-cutting integration
**Execution mode:** inline
**Delivery tier:** full

## 1. Implementation Summary

Extend the existing dependency-free company-state engine into a generic parent-resolving operating surface, add the 15 canonical proposer-only brain skills, and add promotion-bound memory plus non-mutating diagnostics. Claude and Gemini receive two fail-open SessionStart hooks: a cached company briefing and a three-line promoted-WI delta.

The framework remains company-neutral. Concrete topology exists only in .svc/company-link.json and the parent company-state/apps.json. Existing JSONL histories, legacy roles, hook entries, and repository-local company state remain backward compatible. No diagnostic may edit a source, spec, trace, or snapshot.

### Load-bearing invariants

1. Resolution precedence is explicit `--state-dir`, then canonical repository link, then repository-local `company-state/`; malformed links deny rather than guessing.
2. Open-item updates use the existing lock, strict JSONL parsing, atomic append/rewrite recovery, merge-by-id semantics, and monotonic item ids.
3. Immune Mesh enforcement is driven only by explicit `risk_domains`; legacy cards remain valid and a proposer cannot self-review.
4. All 15 skills are generic, terminal, proposer-only, and registered on every provisioned host without replacing legacy ledger role names.
5. Memory accepts only a verified promoted commit and is idempotent by repository, WI, and commit; WIP trees are rejected.
6. Diagnostics are read-only and dependency-free. The topology store is user-scoped; contract paths remain contained in registered repositories.
7. Session hooks are bounded, fail open, and never expose raw ledger contents beyond the briefing/delta contract. Cache lifetime is 30 seconds.
8. Cross-repository creation is limited to the three named JSON files. Existing dirty parent-repo files and all product files remain byte-identical.
9. Local validation, branch review, merge, installation, and live `/cos` resolution are separately evidenced.

## 2. Files Planned

### Framework runtime, hooks, and contracts

| File | Action | Task | Purpose |
|---|---|---|---|
| `scripts/company-state.mjs` | MODIFY | Task 1 | Parent resolution, SLA/open-item commands, v1.0.0 app registry commands, explicit Immune Mesh validation, canonical/legacy role compatibility. |
| `references/company-operating-fleet.md` | MODIFY | Tasks 1-2 | Document canonical roles, schemas, proposer-only boundary, link resolution, mesh, and operating examples. |
| `scripts/svc-wi-promotion-indexer.mjs` | CREATE | Task 3 | Gate and idempotently index only G7-verified promoted WI summaries; query bounded deltas. |
| `scripts/worktree-topology.mjs` | CREATE | Task 3 | Snapshot registered repository/worktree/spec/merge state into `~/.svc/worktree-topology.db`. |
| `scripts/cross-app-contract-guard.mjs` | CREATE | Task 3 | Validate the parent app registry and report contained contract/version drift without mutation. |
| `scripts/auto-healer.mjs` | CREATE | Task 3 | Classify Playwright trace and DOM-diff evidence and emit a remediation route without editing. |
| `land-changeset/SKILL.md` | MODIFY | Task 3 | Preserve merge evidence required by promotion indexing. |
| `verify-promotion/SKILL.md` | MODIFY | Task 3 | Invoke promotion indexing only after G7 succeeds and report index evidence. |
| `hooks/cos-briefing.mjs` | CREATE | Task 4 | Resolve company state and emit cached SessionStart briefing with 30-second TTL. |
| `hooks/svc-delta-preload.mjs` | CREATE | Task 4 | Emit at most three promoted-WI delta lines at SessionStart. |
| `scripts/wire-hooks.mjs` | MODIFY | Task 4 | Register both fail-open Claude SessionStart hooks idempotently. |
| `scripts/wire-gemini-hooks.mjs` | MODIFY | Task 4 | Register both fail-open Gemini SessionStart hooks idempotently. |

### Universal skill surface and synchronized registries

| File | Action | Task | Purpose |
|---|---|---|---|
| cos/SKILL.md | CREATE | Task 2 | Chief-of-staff synthesis and bounded `/cos` briefing. |
| growth-lead/SKILL.md | CREATE | Task 2 | Growth hypotheses and experiment cards. |
| fin-analyst/SKILL.md | CREATE | Task 2 | Finance evidence and spend peer review. |
| product-lead/SKILL.md | CREATE | Task 2 | Product prioritization and validation cards. |
| market-intel/SKILL.md | CREATE | Task 2 | Market and competitor evidence cards. |
| counsel/SKILL.md | CREATE | Task 2 | Legal issue spotting and legal peer review, not legal advice. |
| security-ops/SKILL.md | CREATE | Task 2 | Security risk assessment and peer review. |
| customer-cs/SKILL.md | CREATE | Task 2 | Customer-success signals and retention cards. |
| revops/SKILL.md | CREATE | Task 2 | Revenue-operation funnel and process cards. |
| comms/SKILL.md | CREATE | Task 2 | Draft-only communication cards. |
| tax-auditor/SKILL.md | CREATE | Task 2 | Tax evidence checklist and escalation cards, not tax advice. |
| privacy-dpo/SKILL.md | CREATE | Task 2 | Privacy assessment and privacy peer review. |
| infra-sre/SKILL.md | CREATE | Task 2 | Reliability evidence and peer review. |
| procurement/SKILL.md | CREATE | Task 2 | Vendor comparison and approval cards, never purchase. |
| growth-eng/SKILL.md | CREATE | Task 2 | Instrumentation and experiment implementation proposals. |
| `skills-manifest.json` | MODIFY | Task 2 | Register all 15 skills in included and router-suggestable surfaces. |
| `README.md` | MODIFY | Task 2 | Synchronize the generated first-party skill registry. |
| `EXTERNAL_ADDONS.md` | MODIFY | Task 2 | Synchronize the core-pack registry. |
| `route-workflow/SKILL.md` | MODIFY | Task 2 | Synchronize the Core Pack routing contract. |
| `route-workflow/references/routing-rules.md` | MODIFY | Task 2 | Add deterministic company-fleet triggers and canonical skill names. |
| `FRAMEWORK-STATE.md` | MODIFY | Tasks 2-4 | Record only the locally proven fleet/memory capability before promotion. |
| `CLAUDE.md` | MODIFY | Task 2 | Refresh the explicit included-skill count after the registry grows from 85 to 100. |
| `references/context-loading-registry.json` | MODIFY | Task 2 | Register bounded company-operations context loading for all 15 new skills. |

`REPO_MODES.md` is intentionally unchanged: the 15 terminal operating skills are not added to `bootstrapStartSequence`. `skills-manifest.json laneDefinitions` is also unchanged because these are independently invoked terminal skills, not inserted into the framework delivery lane.

### Focused evaluation surface

| File | Action | Task | Purpose |
|---|---|---|---|
| test-framework/evals/tier-1/validate-company-fleet-integration.sh | CREATE | Tasks 1-4 | Hermetic CLI, schema, mesh, memory, topology, contract, healer, hook, and generic-source assertions. |
| test-framework/evals/tier-1/validate-company-fleet-skills.sh | CREATE | Task 2 | Validate the exact 15 skill contracts, proposer-only boundary, and registration. |
| `test-framework/evals/tier-1/validate-contracts.sh` | MODIFY | Audit correction | Register the shared `company-state/decisions-pending.jsonl` producer contract used by all 15 proposer-only roles. |
| `test-framework/evals/tier-2/run-tier2.sh` | MODIFY | Task 2 | Accept an exact scenario-name allowlist and optional results directory so the 15 fleet evaluations are bounded and auditable. |
| test-framework/evals/tier-2/scenarios/cos-eval.md | CREATE | Task 2 | `/cos` routing and synthesis comprehension. |
| test-framework/evals/tier-2/scenarios/growth-lead-eval.md | CREATE | Task 2 | Growth-lead routing comprehension. |
| test-framework/evals/tier-2/scenarios/fin-analyst-eval.md | CREATE | Task 2 | Finance routing comprehension. |
| test-framework/evals/tier-2/scenarios/product-lead-eval.md | CREATE | Task 2 | Product routing comprehension. |
| test-framework/evals/tier-2/scenarios/market-intel-eval.md | CREATE | Task 2 | Market routing comprehension. |
| test-framework/evals/tier-2/scenarios/counsel-eval.md | CREATE | Task 2 | Legal routing comprehension. |
| test-framework/evals/tier-2/scenarios/security-ops-eval.md | CREATE | Task 2 | Security routing comprehension. |
| test-framework/evals/tier-2/scenarios/customer-cs-eval.md | CREATE | Task 2 | Customer-success routing comprehension. |
| test-framework/evals/tier-2/scenarios/revops-eval.md | CREATE | Task 2 | Revenue-operations routing comprehension. |
| test-framework/evals/tier-2/scenarios/comms-eval.md | CREATE | Task 2 | Communications routing comprehension. |
| test-framework/evals/tier-2/scenarios/tax-auditor-eval.md | CREATE | Task 2 | Tax routing comprehension. |
| test-framework/evals/tier-2/scenarios/privacy-dpo-eval.md | CREATE | Task 2 | Privacy routing comprehension. |
| test-framework/evals/tier-2/scenarios/infra-sre-eval.md | CREATE | Task 2 | Reliability routing comprehension. |
| test-framework/evals/tier-2/scenarios/procurement-eval.md | CREATE | Task 2 | Procurement routing comprehension. |
| test-framework/evals/tier-2/scenarios/growth-eng-eval.md | CREATE | Task 2 | Growth-engineering routing comprehension. |

### Pipeline artifacts and external state

| File | Action | Task | Purpose |
|---|---|---|---|
| `docs/specs/work-items/WI-507.md` | MODIFY | plan/closeout | Exact requirements and proof-state lifecycle. |
| docs/specs/tech/wi-507-company-operating-fleet.md | CREATE | design-tech | G4 architecture, exact persistent schemas, flows, cost, operations, security, and rollback. |
| `docs/plans/2026-07-22-company-operating-fleet/manifest.md` | MODIFY | plan | This deterministic execution contract. |
| docs/plans/2026-07-22-company-operating-fleet/review-log.yaml | CREATE | review-plan | Independent G2 findings and dispositions. |
| `.svc/lane-tasks-WI-507.json` | MODIFY | orchestration | Durable chain and five execution process tasks. |
| `.svc/session-contract.jsonl` | MODIFY | orchestration | Refresh the same authorized WI-507 session during the long-running full-delivery chain. |
| `.svc/competitive-monitor-triggers.jsonl` | MODIFY | orchestration | Preserve the framework-generated append-only trigger emitted while executing WI-507 task 3.5. |
| .svc/wi507-checkpoint-paths.json | PRESENT | orchestration | Tracked exact cumulative staged-path allowlists authored during reviewed planning for resumable task commit-tree checkpoints. |
| .svc/external-review-artifacts/WI-507/external-state-precheck.json | CREATE | Task 5 | Gitignored durable pre-mutation branch/status/dirty hashes and planned-target states retained through G7; orchestration evidence is kept outside the SHA-keyed receipt namespace. |
| test-framework/results/WI-507/tier2-fleet-routing.log | CREATE | Task 2 | Bounded 15-scenario command, result summary, duration, and retry evidence. |
| /home/svc-user/app-workspaces/example-company/.svc/company-link.json | CREATE | Task 5 | External: generic self-link for parent resolution. |
| /home/svc-user/app-workspaces/example-company/company-state/apps.json | CREATE | Task 5 | External: v1.0.0 registry for parent and product repositories. |
| /home/svc-user/app-workspaces/example-marketplace/.svc/company-link.json | CREATE | Task 5 | External: link the product repository to parent company state. |

Review-exec and audit artifacts are generated under their standard `docs/specs/reviews/`, `docs/specs/audit/`, and ignored `.svc/receipts/` surfaces. They are evidence, not implementation scope. No file deletion is planned.

### Planned path-state proof

| Path family | Expected before execution | Simulation proof |
|---|---|---|
| 15 repo-root <brain>/SKILL.md files | absent | `test ! -e` for each exact file; repo-root skill placement is established by `review-plan/SKILL.md` and `strategic-decision/SKILL.md`. |
| 15 test-framework/evals/tier-2/scenarios/<brain>-eval.md files | absent | `test ! -e` for each exact file; the existing `test-framework/evals/tier-2/scenarios/` directory and scenario convention were inspected. |
| two Tier-1 fixtures, four scripts, and two hooks | absent | exact `test ! -e` assertions are recorded in the preflight log. |
| design-tech, checkpoint allowlist, external precheck, and Tier-2 result artifacts | design/allowlist present; runtime artifacts absent | Exact state is recorded before execution; ignored `.svc` evidence remains through G7. |
| every MODIFY row | present regular file | exact `test -f` assertions are recorded before Task 1. |
| three absolute external JSON targets | absent | exact precheck is persisted before any Task 5 create; a changed precondition blocks. |

CREATE paths are plain text because the current mechanical checker treats every backticked future path as an already-required dependency. The explicit path-state preflight above supplies the missing CREATE/absent half; MODIFY paths remain machine-checked by `verify-plan-mechanical.sh`.

### 2a. Inline execution boundary

`mode:inline` is selected because the current orchestrator has loaded the live spec, current engine/hook/registry sources, external repository instructions and state, and the prior incomplete planning attempt. Exact behavior is constrained by the function contracts below and focused tests. Duplicate full-file code payloads are intentionally omitted under the inline receipt exemption.

## 3. Task Graph

| Task | Title | Files | Depends on | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| Task 1 | Core CLI engine | `company-state.mjs`, reference, focused fixture | reviewed plan | AC-1 | Syntax plus focused CLI fixture twice | `wi507-cli-green` |
| Task 2 | Fifteen universal skills | 15 skills, 15 scenarios, registries/docs, skill fixture | Task 1 | AC-2 | skill structure, contracts, manifest lint, focused fleet-skill fixture | `wi507-skills-green` |
| Task 3 | Promotion memory and diagnostics | four scripts, land/verify contracts, focused fixture | Task 2 | AC-3, AC-6 | syntax, hermetic promotion/topology/contract/healer matrix | `wi507-memory-green` |
| Task 4 | SessionStart hooks | two hooks, two wire scripts, focused fixture | Task 3 | AC-4 | syntax, temporary-home Claude/Gemini wiring, cache/delta matrix | `wi507-hooks-green` |
| Task 5a | External links and worktree-source resolution | three external JSON files | Task 4 | AC-5 partial | pre/post hashes, validate-only setup manifests, direct CLI/hook parent resolution | `wi507-external-links` |

The five implementation tasks execute serially in the single sanctioned WI-507 worktree. There is no code-writing delegation and no parallel inner worktree. Review-exec, audit, landing, and verification remain separate lane tasks after the implementation tree is frozen.

### Task 1 function contract

- Add `resolveCompanyContext()` that canonicalizes `--repo` or cwd to its Git root, validates a strict v1.0.0 link, and returns `{ stateDir, companyRepo, appId, source }` with the stated precedence.
- Retain `resolve-state-dir` output compatibility; add `resolve --json` context fields without removing current fields.
- Materialize `open-items.jsonl` by strict ordered merge. Mutations run under a company-state scoped lock and reuse atomic JSONL recovery.
- `open-item` generates the next stable `OI-YYYYMMDD-NNN` id under the lock; `check-item` and `close-item` require an existing non-closed item and append sparse events. Duplicate close with the same outcome is an idempotent no-op; conflicting re-close denies.
- `briefing` emits deterministic overdue, due-soon, and on-track sections plus next actions. `dashboard --json` emits counts, open items, pending decisions, registry health, and mesh health without dumping ledger bodies.
- `register-app`, `list-apps`, and `validate-apps` enforce schema v1.0.0, unique ids/canonical paths, allowed status, regular contained contract files, stable ordering, lock, and atomic write.
- Extend decision validation with optional `risk_domains`/`peer_reviews`; require the mapped independent peer and evidence, reject any block, preserve cards that omit risk domains.
- Add canonical role aliases while accepting historical `chief-of-staff`, `financial-analyst`, and `customer-success` records.

### Task 2 skill contract

Each skill uses this literal frontmatter shape; only `name`, the trigger-oriented `description`, and role-specific input/output artifacts vary:

```yaml
---
name: <canonical-brain-name>
version: "1.0"
description: >
  <unique trigger phrases and disambiguation from adjacent brains>
inputs:
  required:
    - { path: ".svc/company-link.json or company-state/", artifact: company-context }
  optional: []
outputs:
  produces:
    - { path: "company-state/decisions-pending.jsonl", artifact: reviewable-decision-card }
chain:
  lanes: {}
  terminal: true
  progressive: false
  self_verify: true
  human_checkpoint: true
---
```

`chain.terminal` is the checked-in create-skill convention and is enforced by `validate-terminal-skill-frontmatter.sh`; empty `chain.lanes` prevents accidental insertion into the framework delivery lane. Each body announces itself, resolves company state through the CLI, limits itself to evidence-backed proposal/card writes, declares `live-evidence: not-applicable (no visible artifact)`, contains a three-row Self-Verify table, and explains task-graph continuation. Regulated skills state that they provide issue spotting/checklists rather than professional advice. `comms`, `procurement`, and every other specialist explicitly prohibit sending/purchasing/external mutation. The focused fixture also requires unique trigger phrases and explicit disambiguation for `growth-lead`/`growth-eng`, `revops`/`fin-analyst`, and `counsel`/`privacy-dpo`/`tax-auditor`.

Each Tier-2 scenario contains one exact natural-language invocation, the single expected canonical skill name, at least one adjacent skill that must not be selected, an assertion that company context is resolved before analysis, and a proposer-only refusal assertion appropriate to the role (for example, `comms` drafts but does not send and `procurement` compares but does not purchase). `run-tier2.sh` accepts only the 15 exact scenario names supplied on argv and `SVC_TIER2_RESULTS_DIR`; an unknown/missing scenario or any skipped assertion is nonzero.

### Task 3 script contracts

- `svc-wi-promotion-indexer.mjs index` accepts repository, WI, promoted SHA, and summary. It verifies the SHA is an ancestor of promoted `origin/main`, requires a schema-valid passing `verify-promotion` receipt for that SHA from the consolidated `refs/notes/svc-receipts` envelope (with mirror fallback only through the existing receipt reader), rejects a dirty/WIP target, and atomically upserts one entry in `~/.svc/wi-promotion-index.jsonl`. `query` returns only bounded summaries. Ordering is explicit: `verify-promotion` completes its checks and emits its SHA-bound receipt first; then its post-receipt continuation invokes the indexer and records the query output in the task graph. `land-changeset` preserves merge evidence but does not index.
- `worktree-topology.mjs refresh` reads apps.json, executes argument-safe `git worktree list --porcelain` and merge-base/status probes for each canonical repo, and atomically writes schema v1 data to `~/.svc/worktree-topology.db`. `show` is read-only.
- `cross-app-contract-guard.mjs` validates app registry containment and reads each declared contract. Matching contract names are grouped and versions/hashes compared; missing, escaping, unreadable, or divergent entries make the command nonzero with structured evidence.
- `auto-healer.mjs diagnose` reads an extracted trace directly, or a trace zip through argument-array `unzip` probes when `unzip` is available, plus an optional DOM-diff JSON. Missing `unzip` for a zip input emits structured `insufficient_evidence` and exits nonzero; it never silently passes. It emits `code_regression`, `spec_drift`, `environment`, or `insufficient_evidence`, confidence, evidence, and a recommended framework route. A tree-hash oracle proves it never mutates inputs or repository files.

### Task 4 hook contracts

- Hooks resolve adjacent installed framework scripts using `import.meta.url`; no shell command construction or fixed checkout path.
- `cos-briefing` hashes the canonical company-state path and freshness inputs, stores atomic cache JSON at `${XDG_CACHE_HOME:-<user-home>/.cache}/svc/cos-briefing/<sha256-of-state-dir>.json`, and reuses it only while `age < 30_000`. Corrupt, future, or stale cache is ignored.
- `svc-delta-preload` queries promoted memory and emits no more than three single-line summaries.
- Both read SessionStart JSON defensively, derive cwd without trusting interpolated shell text, cap output size, and exit zero with no output on malformed/missing optional state.
- Claude and Gemini wiring is idempotent and preserves existing hook arrays. Both wirers add `--remove-company-session-hooks`, which removes only command entries owned by `cos-briefing.mjs` and `svc-delta-preload.mjs`; normal wiring also prunes those owned entries when the installed target is absent.

### Task 5 exact external mutation

Before mutation, read each target repository's local `AGENTS.md`/`CLAUDE.md`, record branch/status, and hash all dirty paths in .svc/external-review-artifacts/WI-507/external-state-precheck.json. For each target: absent means create atomically with `O_EXCL`; present with the exact planned SHA-256 means record `already-current` and continue without writing; present with any other content means halt. This makes partial-failure resume deterministic. Do not stage or commit external files. The parent apps registry contains stable entries for the parent and `example-marketplace`, with owner values stored only there. Pre-merge setup runs only the installer’s built-in `SVC_SETUP_VALIDATE_ONLY=1` mode, which permits worktree source inspection without host mutation; direct hook/CLI proof uses the exact WI worktree source. Global host installs and installed-hook proof are owned by `verify-promotion` from promoted primary `main`, before any worktree cleanup. Direct and installed-hook proofs from `example-marketplace` must report the parent's canonical `company-state/`, then confirm all pre-existing dirty-path hashes are unchanged.

The precheck artifact is ignored orchestration evidence retained through G7, with this exact schema:

```json
{
  "schema_version": 1,
  "recorded_at": "RFC3339",
  "repositories": [
    {
      "path": "/canonical/absolute/path",
      "branch": "branch-name",
      "status_porcelain": "exact git status --porcelain text",
      "dirty_paths": [{"path": "repo-relative-path", "sha256": "64-hex"}]
    }
  ],
  "targets": [
    {
      "path": "/absolute/target.json",
      "state": "absent|exact|divergent",
      "before_sha256": null,
      "planned_sha256": "64-hex"
    }
  ]
}
```

## 4. AC-to-Task Mapping

| AC | Tasks |
|---|---|
| AC-1 | Task 1 |
| AC-2 | Task 2 |
| AC-3 | Task 3 |
| AC-4 | Task 4 |
| AC-5 | Task 5a plus `verify-promotion` installed-host proof |
| AC-6 | plan/review, Tasks 3-5, review-exec, audit, land, verify |

## 5. AC-to-Test Mapping

| AC | Type | Proof |
|---|---|---|
| AC-1 | E2E | Hermetic temp parent/product repositories exercise the public CLI and JSONL/app/mesh behavior. |
| AC-2 | E2E | Tier-1 static contracts plus one Tier-2 routing scenario for each canonical skill. |
| AC-3 | E2E | Temporary Git repositories, fake G7 receipts, worktrees, contracts, traces, and DOM diffs exercise each public CLI. |
| AC-4 | E2E | Temporary host homes and repositories invoke both installed-style SessionStart hooks with a controllable clock. |
| AC-5 | Manual | Owner-machine host installation and live resolution from the named product repository. |
| AC-6 | Manual | Canonical receipts, sanctioned squash merge, final-SHA verification, and promoted index query. |

## Prerequisite Alignment Matrix

**Section 6.** This heading retains the exact mechanical-check label while providing a stable section number for review citations.

| Task | UX | UI/style | Technical design | Persona/differentiation |
|---|---|---|---|---|
| Task 1 | Existing deterministic CLI/JSON output and `/cos` briefing categories | N/A — no visible UI | Spec schemas, lock/atomic invariants, explicit mesh mapping | Internal operator roles from `references/company-operating-fleet.md`; generic framework invariant |
| Task 2 | Slash-command invocation and reviewable card output | N/A — Markdown skill contracts | Terminal proposer-only skill contract and company resolver | Exact 15 named operating seats; specialist separation is the differentiation |
| Task 3 | Bounded diagnostic JSON/text | N/A — headless scripts | Promotion gate/idempotency, contained paths, no-mutation oracle | Maintainer/operator workflow only |
| Task 4 | Bounded SessionStart briefing/delta | N/A — terminal host output | TTL/freshness cache, fail-open hook contract, argument-array subprocesses | Chief-of-staff operator context only |
| Task 5a + verify | `/cos` from product repo resolves parent state | N/A — terminal live proof | External-state lifecycle, worktree proof, then promoted installed-source proof | Concrete identity exists only in repository-local data |

No browser route, component, asset, ORM, Base44, provider output, or package dependency is in scope.

## 7. Lane Compliance

**Lane:** `framework`, from `skills-manifest.json` → `laneDefinitions.framework.skills`. `route-workflow` and `validate-feature` are not members of that authoritative lane and are therefore not represented as lane steps.

| Skill/gate | Disposition |
|---|---|
| `test-framework` | Mandatory focused fleet fixtures, full Tier 1, and exact 15-scenario Tier 2 proof after implementation; decision at `.svc/pipeline-decisions.jsonl:807`. |
| `evolve-framework` | Satisfied by the owner-authored, baselined WI-507 evolution proposal; decision at `.svc/pipeline-decisions.jsonl:808`. |
| `blend-external` | Explicit N/A because no external pattern source supplies this repository-native architecture; decision at `.svc/pipeline-decisions.jsonl:809`. |
| `blend-private` | Explicit N/A because no private source was nominated or required; decision at `.svc/pipeline-decisions.jsonl:810`. |
| `improve-framework` | Satisfied by the exact owner-authorized WI, branch, worktree, task list, and terminal gates; decision at `.svc/pipeline-decisions.jsonl:811`. |
| `recall-stack-knowledge` | Explicitly skipped after the targeted memory pass found no WI-507 implementation precedent; decision at `.svc/pipeline-decisions.jsonl:812`. |
| `plan-blast-radius` | Satisfied by this manifest's exhaustive scope and external-state lifecycle tables; decision at `.svc/pipeline-decisions.jsonl:813`. |
| `track-topology-diff` | Pre-implementation skip is justified because Task 3 creates the first compatible topology diagnostic; hermetic and promoted proof remain mandatory; decision at `.svc/pipeline-decisions.jsonl:814`. |
| `refresh-competitors` | Explicit N/A for an internal architecture with no market-facing or vendor-selection requirement; decision at `.svc/pipeline-decisions.jsonl:815`. |
| `write-spec` | Satisfied by the owner-authorized baselined Work Item spec `docs/specs/work-items/WI-507.md`; decision recorded at `.svc/pipeline-decisions.jsonl:804`. |
| `design-ux` | Explicit N/A for a background enabler with no human-visible flow; decision at `.svc/pipeline-decisions.jsonl:805`. |
| `design-ui` | Explicit N/A for no component, route, asset, or rendered artifact; decision at `.svc/pipeline-decisions.jsonl:806`. |
| `design-tech` / G4 | Completed and PASS; exact schemas, diagrams, cost, operations, and rollback at `docs/specs/tech/wi-507-company-operating-fleet.md`; decision evidence at `.svc/pipeline-decisions.jsonl:801-803`; task graph task 0. |
| `plan-changeset` | Reconstructed in this manifest after the owner-authorized loopback. |
| `review-plan` | Mandatory next blocker; the prior capability-probe receipt is rejected as review evidence. |
| `execute-changeset` | Five serial process tasks, blocked on reviewed plan. |
| `review-exec` | Mandatory independent frozen-diff G6 review. |
| `audit-implementation` | Mandatory AC/file/wiring and external-state audit. |
| `land-changeset` | Mandatory sanctioned squash merge with receipt envelope. |
| `verify-promotion` | Mandatory promoted install/live resolution/G7/index proof. |
| Browser/visual test gates | Explicit N/A: no visual artifact, browser route, or rendered state. |

## 8. External State

| Class | State | Coupling and lifecycle |
|---|---|---|
| Host filesystem | Claude/Gemini SessionStart hooks plus skill installs for `claude`, `kimi`, `codex`, `gemini`, `opencode`, `mimo-code`, `antigravity`, and `cursor` | Pre-merge setup is validate-only for Claude/Gemini and writes no host state. The repository pre-commit hook calls setup with its worktree override, but setup re-points `SCRIPT_DIR` to canonical main and the hook does not rerun drift after that refresh; therefore a branch commit can proceed while new worktree-only skills remain uninstalled. A post-commit symlink scan proves no host target points into `.worktrees/`. Immediately after merge and before worktree cleanup, promoted primary `main` refreshes and drift-checks all eight. Rollback explicitly unwires the two hooks, prunes only the 15 exact orphan skill symlinks, then reinstalls the resulting promoted main. |
| Out-of-tree version-controlled | Three planned JSON files in parent/product repos | Coupled only in Task 5a. Persist precheck in .svc/external-review-artifacts/WI-507/external-state-precheck.json; absent targets use exclusive create, exact targets are idempotent no-ops, divergent targets block. Rollback removes only an exact hash that the precheck recorded as absent. Never stage/commit/reset/stash external repos. |
| Existing user residue | Parent `open-items.jsonl` and two checklist modifications | Explicitly protected. Hash before and after; no command may rewrite, stage, stash, or clean them. |
| Shared user runtime | `~/.svc/wi-promotion-index.jsonl`, `~/.svc/worktree-topology.db`, hook cache | Schema/versioned, atomic, idempotent. Fixtures isolate via `SVC_STATE_HOME` and `XDG_CACHE_HOME`. Live index is written only after G7; rollback retains auditable promotion history and adds correction rather than deleting history. |
| Git/GitHub | Branch, task checkpoint refs, notes, PR, review receipt, squash merge | Each green task writes a commit-tree object and `refs/svc/checkpoints/WI-507/task-N` without moving the branch or invoking hooks; every parent is re-derived from the prior ref after resume, and staged paths are checked against .svc/wi507-checkpoint-paths.json. Refs are deleted only after G7. `land-changeset` owns PR/merge; missing checks or stale receipts block. Final squash receives a fresh tree-bound envelope. |
| Downstream framework docs | Installed skills, manifest registry, framework state | Updated to current proof level; promoted/verified wording waits for G7. |

No SaaS account, secret, database service, CI workflow, network API, production deployment, billing system, or user data is created or mutated.

## 9. Simulation Report

| Task | Check | Result | Action |
|---|---|---|---|
| Task 1 | `scripts/company-state.mjs` and operating reference exist; target commands do not | PASS (MODIFY) | Extend existing lock/atomic helpers and preserve commands. |
| Task 1 | Parent and product already contain compatible `company-state/` histories | PASS | Test legacy role/card/open-item reads; do not migrate. |
| Task 2 | All 15 skill targets are absent | PASS (CREATE) | Use create-skill contract and shared template with role-specific boundaries. |
| Task 2 | Manifest/doc sync surfaces exist | PASS (MODIFY) | Run linter and relevant tier-1 validators after batch. |
| Task 3 | Four script targets are absent; land/verify contracts exist | PASS | Use Node built-ins and checked-in receipt helpers only. |
| Task 3 | No root package manager is available | PASS | No dependency installation; use argument-safe Git/unzip subprocesses. |
| Task 4 | Hook targets are absent; both wire scripts expose SessionStart entries | PASS | Add idempotent entries without replacing current hooks. |
| Task 5 | Three external JSON targets are absent | PASS (CREATE) | Exclusive create after rechecking; preserve dirty parent residue. |
| Task 5 | Parent repo is dirty; product repo is clean | WARN acknowledged | Hash/protect dirty paths, prohibit external Git mutation, verify status afterward. |
| Task 5 | `setup` contains validate-only and canonical-main worktree guards | PASS | Preflight grep plus inspected `SVC_SETUP_VALIDATE_ONLY` and Git-common-dir repoint branches; no override is used by Task 5. |
| land | pre-commit hook invokes the documented setup worktree override | PASS | Inspected hook and setup: override still re-points source to canonical main; post-commit symlink scan is mandatory. |
| all | No company-specific identity belongs in framework | PASS | Focused source scan excludes external instance JSON and test fixture placeholders. |

### Scenario coverage

| Journey | Scenario | Steps | Tasks | Coverage |
|---|---|---:|---|---|
| Company context | Product repo resolves parent state | link, validate, resolve, brief | Tasks 1, 4, 5 | 4/4 |
| SLA control | Open, check, brief, close | lock, append, merge, categorize, idempotent close | Task 1 | 5/5 |
| Immune Mesh | Regulated card independent review | declare, map, evidence, allow/deny | Task 1 | 4/4 |
| Fleet routing | Invoke each of 15 brains | route, resolve, analyze, propose, self-verify | Task 2 | 5/5 each |
| Promotion memory | Verified WI becomes next-session delta | merge evidence, G7, index, query, hook | Tasks 3, 4 plus land/verify | 5/5 |
| Diagnostics | Detect topology/contract/test drift | snapshot, compare, classify, route | Task 3 | 4/4 |

No unresolved simulation FAIL remains. The one WARN is an explicit protected-residue lifecycle, not permission to mutate it.

## 10. Validation Plan

### Task-level checks

```bash
set -euo pipefail
# Task 1
node --check scripts/company-state.mjs
bash test-framework/evals/tier-1/validate-company-fleet-integration.sh

# Task 2
bash test-framework/evals/tier-1/validate-company-fleet-skills.sh
bash test-framework/evals/tier-1/validate-skill-structure.sh
bash test-framework/evals/tier-1/validate-contracts.sh
bash test-framework/evals/tier-1/validate-self-verify-sections.sh
bash test-framework/evals/tier-1/validate-terminal-skill-frontmatter.sh
bash -n test-framework/evals/tier-2/run-tier2.sh
node scripts/lint-skills-manifest.mjs

# Task 3
node --check scripts/svc-wi-promotion-indexer.mjs
node --check scripts/worktree-topology.mjs
node --check scripts/cross-app-contract-guard.mjs
node --check scripts/auto-healer.mjs
bash test-framework/evals/tier-1/validate-company-fleet-integration.sh

# Task 4
node --check hooks/cos-briefing.mjs
node --check hooks/svc-delta-preload.mjs
node --check scripts/wire-hooks.mjs
node --check scripts/wire-gemini-hooks.mjs
bash test-framework/evals/tier-1/validate-company-fleet-integration.sh
```

### Branch and framework checks

```bash
set -euo pipefail
bash scripts/verify-plan-mechanical.sh docs/plans/2026-07-22-company-operating-fleet/manifest.md
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-507.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-507.json
grep -q 'SVC_SETUP_VALIDATE_ONLY' ./setup
test -f test-framework/evals/tier-1/validate-terminal-skill-frontmatter.sh
node -e 'const c=require("./.svc/wi507-checkpoint-paths.json"); if (!c.cumulative["task-final"]) process.exit(1)'
node scripts/lint-skills-manifest.mjs
bash test-framework/evals/run-all-evals.sh --tier1
git diff --check
bash scripts/verify-file-persistence.sh --from-git-status
SVC_SETUP_VALIDATE_ONLY=1 ./setup --host claude
SVC_SETUP_VALIDATE_ONLY=1 ./setup --host gemini
```

The general Tier 1.5/3 suites remain optional enrichment. WI-507 instead runs exactly its 15 Tier-2 scenarios through the reviewed scenario-name selector. `run-tier2.sh` accepts only exact checked-in scenario basenames, rejects zero or unknown arguments, preserves argv order, and uses `SVC_TIER2_RESULTS_DIR` when set. For each `<scenario>` it writes `<scenario>.txt` whose first line is exactly `verdict=pass` or `verdict=fail`, plus `<scenario>-output.txt` and `<scenario>-stream.json`; it writes `summary.txt` last. Any missing result, skip, provider/tool outage, timeout, or failed assertion exits nonzero. `SVC_TIER2_VALIDATE_SELECTION_ONLY=1` validates selection and emits the resolved list without invoking a provider, allowing `validate-company-fleet-skills.sh` to test zero, valid, duplicate, and unknown argv behavior. Budget: 75 minutes and USD 15 estimated maximum for the first batch. A failed scenario may be retried once by exact name; a second failure or budget breach blocks AC-2 and escalates. The command transcript and retry disposition are retained at `test-framework/results/WI-507/tier2-fleet-routing.log`. Pass requires the exact 15 named result files, every first line `verdict=pass`, zero failed assertions, and zero skipped scenarios.

The genericity scan is mechanically scoped to shipped framework/runtime surfaces; instance-specific pipeline artifacts under `docs/plans/`, `docs/specs/work-items/`, and `.svc/` are intentionally excluded:

```bash
set -euo pipefail
command -v git >/dev/null
command -v grep >/dev/null
if git diff -U0 5f02728ac8794283c317791a077c645f8420cc9e -- \
    scripts hooks references/company-operating-fleet.md route-workflow test-framework skills-manifest.json \
    cos growth-lead fin-analyst product-lead market-intel counsel security-ops \
    customer-cs revops comms tax-auditor privacy-dpo infra-sre procurement growth-eng | \
    grep -E '^\+[^+].*(example-company|example-marketplace|/home/svc-user)'; then
  echo "company-specific identity leaked into framework runtime surface" >&2
  exit 1
fi
# Expected outcome: no matches.
```

## Execution Command Sequence

**Section 11.** This heading retains the exact mechanical-check label while providing a stable section number for review citations.

```bash
set -euo pipefail

svc_check_checkpoint_paths() {
  local checkpoint_name="$1"
  git diff --cached --name-only -z | node --input-type=module -e '
    import fs from "node:fs";
    const [name, file] = process.argv.slice(1);
    const cfg = JSON.parse(fs.readFileSync(file, "utf8")).cumulative;
    const collect = (key, out={exact:[],prefix:[],required:[]}, seen=new Set()) => {
      if (seen.has(key)) throw new Error(`checkpoint inheritance cycle at ${key}`);
      seen.add(key);
      const row=cfg[key]; if (!row) throw new Error(`unknown checkpoint ${key}`);
      if (row.inherit) collect(row.inherit,out,seen);
      out.exact.push(...(row.exact||[]));
      out.prefix.push(...(row.prefix||[]));
      out.required.push(...(row.required_staged||[]));
      return out;
    };
    const allowed=collect(name);
    const staged=fs.readFileSync(0).toString("utf8").split("\0").filter(Boolean);
    if (staged.length === 0) { console.error("checkpoint staged set is empty"); process.exit(1); }
    const bad=staged.filter(p=>!allowed.exact.includes(p)&&!allowed.prefix.some(x=>p.startsWith(x)));
    const missing=[...new Set(allowed.required)].filter(p=>!staged.includes(p));
    if (bad.length) { console.error(`undeclared staged paths: ${bad.join(", ")}`); process.exit(1); }
    if (missing.length) { console.error(`required staged paths missing: ${missing.join(", ")}`); process.exit(1); }
  ' "$checkpoint_name" .svc/wi507-checkpoint-paths.json
}

# 0. Commit the independently reviewed planning baseline before implementation.
git add .svc/lane-tasks-WI-507.json .svc/pipeline-decisions.jsonl .svc/wi507-checkpoint-paths.json \
  docs/specs/work-items/WI-507.md docs/specs/tech/wi-507-company-operating-fleet.md \
  docs/plans/2026-07-22-company-operating-fleet/manifest.md \
  docs/plans/2026-07-22-company-operating-fleet/review-log.yaml
git diff --cached --check
git commit -m 'plan(WI-507): baseline company operating fleet' \
  -m 'Co-Authored-By: Codex CLI <contact-b6b620a2d4@example.invalid>'
# Emit plan-manifest and review-plan receipts bound to this real planning commit.

# 1. Reassert the exact sanctioned worktree, reviewed graph, and base ancestry.
test "$(git branch --show-current)" = "WI-507-fleet-integration"
git merge-base --is-ancestor 5f02728ac8794283c317791a077c645f8420cc9e HEAD
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-507.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-507.json
# If origin/main has advanced, rebase only through the sanctioned worktree flow,
# update the manifest base, invalidate receipts, and rerun plan review before code.
# RECOVERY_IF_FAIL: stop. Do not recreate/switch worktrees or rewrite claims.

# 2. Task 1: patch the CLI/reference and add its focused fixture; run twice.
node --check scripts/company-state.mjs
bash test-framework/evals/tier-1/validate-company-fleet-integration.sh
bash test-framework/evals/tier-1/validate-company-fleet-integration.sh
git add scripts/company-state.mjs references/company-operating-fleet.md test-framework/evals/tier-1/validate-company-fleet-integration.sh .svc/lane-tasks-WI-507.json
svc_check_checkpoint_paths task-1
TASK1_TREE="$(git write-tree)"
TASK1_COMMIT="$(git commit-tree "$TASK1_TREE" -p HEAD -m 'WI-507 checkpoint: core CLI engine')"
git update-ref refs/svc/checkpoints/WI-507/task-1 "$TASK1_COMMIT"
# RECOVERY_IF_FAIL: patch forward in Task 1 files; preserve all JSONL fixtures and external repos.

# 3. Task 2: create the 15 skills/scenarios, synchronize registries, validate persistence.
bash test-framework/evals/tier-1/validate-company-fleet-skills.sh
bash test-framework/evals/tier-1/validate-skill-structure.sh
bash test-framework/evals/tier-1/validate-contracts.sh
bash test-framework/evals/tier-1/validate-self-verify-sections.sh
bash test-framework/evals/tier-1/validate-terminal-skill-frontmatter.sh
node scripts/lint-skills-manifest.mjs
bash scripts/verify-file-persistence.sh --from-git-status
git add cos growth-lead fin-analyst product-lead market-intel counsel security-ops customer-cs revops comms tax-auditor privacy-dpo infra-sre procurement growth-eng test-framework/evals/tier-2/scenarios test-framework/evals/tier-2/run-tier2.sh skills-manifest.json README.md EXTERNAL_ADDONS.md route-workflow/SKILL.md route-workflow/references/routing-rules.md FRAMEWORK-STATE.md CLAUDE.md test-framework/evals/tier-1/validate-company-fleet-skills.sh .svc/lane-tasks-WI-507.json
svc_check_checkpoint_paths task-2
TASK1_COMMIT="$(git rev-parse refs/svc/checkpoints/WI-507/task-1)"
TASK2_TREE="$(git write-tree)"
TASK2_COMMIT="$(git commit-tree "$TASK2_TREE" -p "$TASK1_COMMIT" -m 'WI-507 checkpoint: universal fleet skills')"
git update-ref refs/svc/checkpoints/WI-507/task-2 "$TASK2_COMMIT"
# RECOVERY_IF_FAIL: correct the named skill/registry contract and rerun; do not prune existing skills.

# 4. Task 3: implement and prove promotion/topology/contract/healer scripts.
node --check scripts/svc-wi-promotion-indexer.mjs
node --check scripts/worktree-topology.mjs
node --check scripts/cross-app-contract-guard.mjs
node --check scripts/auto-healer.mjs
bash test-framework/evals/tier-1/validate-company-fleet-integration.sh
git add scripts/svc-wi-promotion-indexer.mjs scripts/worktree-topology.mjs scripts/cross-app-contract-guard.mjs scripts/auto-healer.mjs land-changeset/SKILL.md verify-promotion/SKILL.md test-framework/evals/tier-1/validate-company-fleet-integration.sh .svc/lane-tasks-WI-507.json
svc_check_checkpoint_paths task-3
TASK2_COMMIT="$(git rev-parse refs/svc/checkpoints/WI-507/task-2)"
TASK3_TREE="$(git write-tree)"
TASK3_COMMIT="$(git commit-tree "$TASK3_TREE" -p "$TASK2_COMMIT" -m 'WI-507 checkpoint: promotion memory diagnostics')"
git update-ref refs/svc/checkpoints/WI-507/task-3 "$TASK3_COMMIT"
# RECOVERY_IF_FAIL: keep diagnostics non-mutating and promotion gate fail-closed.

# 5. Task 4: wire and prove both SessionStart hosts with temporary homes.
node --check hooks/cos-briefing.mjs
node --check hooks/svc-delta-preload.mjs
node --check scripts/wire-hooks.mjs
node --check scripts/wire-gemini-hooks.mjs
bash test-framework/evals/tier-1/validate-company-fleet-integration.sh
git add hooks/cos-briefing.mjs hooks/svc-delta-preload.mjs scripts/wire-hooks.mjs scripts/wire-gemini-hooks.mjs test-framework/evals/tier-1/validate-company-fleet-integration.sh .svc/lane-tasks-WI-507.json
svc_check_checkpoint_paths task-4
TASK3_COMMIT="$(git rev-parse refs/svc/checkpoints/WI-507/task-3)"
TASK4_TREE="$(git write-tree)"
TASK4_COMMIT="$(git commit-tree "$TASK4_TREE" -p "$TASK3_COMMIT" -m 'WI-507 checkpoint: SessionStart hooks')"
git update-ref refs/svc/checkpoints/WI-507/task-4 "$TASK4_COMMIT"
# RECOVERY_IF_FAIL: fail open at the hook boundary; preserve existing hook arrays.

# 6. Task 5a: after reading each external repo's instructions and recording status/hashes,
# use apply_patch to create only the three reviewed JSON files, then validate
# both installer manifests without mutation and prove directly from worktree source.
SVC_WI507_ROOT="$(git rev-parse --show-toplevel)"
git check-ignore -q .svc/external-review-artifacts/WI-507/external-state-precheck.json
SVC_SETUP_VALIDATE_ONLY=1 ./setup --host claude
SVC_SETUP_VALIDATE_ONLY=1 ./setup --host gemini
(cd /home/svc-user/app-workspaces/example-marketplace && node "$SVC_WI507_ROOT/scripts/company-state.mjs" resolve --json)
(cd /home/svc-user/app-workspaces/example-marketplace && node "$SVC_WI507_ROOT/scripts/company-state.mjs" briefing)
(cd /home/svc-user/app-workspaces/example-marketplace && printf '%s\n' '{"source":"startup","cwd":"/home/svc-user/app-workspaces/example-marketplace"}' | node "$SVC_WI507_ROOT/hooks/cos-briefing.mjs")
# Require both outputs to name the canonical parent company-state directory.
# RECOVERY_IF_FAIL: remove only unchanged newly-created targets if rollback is needed; never touch prior residue.

# 7. Run full Tier-1 and the bounded mandatory Tier-2 routing suite, then create
# a real branch commit containing the cumulative implementation and graph state.
bash test-framework/evals/run-all-evals.sh --tier1
mkdir -p test-framework/results/WI-507 test-framework/evals/results/tier-2/WI-507
SVC_TIER2_RESULTS_DIR=test-framework/evals/results/tier-2/WI-507 \
  timeout 4500 bash test-framework/evals/tier-2/run-tier2.sh \
  cos-eval growth-lead-eval fin-analyst-eval product-lead-eval market-intel-eval \
  counsel-eval security-ops-eval customer-cs-eval revops-eval comms-eval \
  tax-auditor-eval privacy-dpo-eval infra-sre-eval procurement-eval growth-eng-eval \
  2>&1 | tee test-framework/results/WI-507/tier2-fleet-routing.log
test "${PIPESTATUS[0]}" -eq 0
SVC_TIER2_SCENARIOS=(cos-eval growth-lead-eval fin-analyst-eval product-lead-eval market-intel-eval counsel-eval security-ops-eval customer-cs-eval revops-eval comms-eval tax-auditor-eval privacy-dpo-eval infra-sre-eval procurement-eval growth-eng-eval)
test "$(find test-framework/evals/results/tier-2/WI-507 -maxdepth 1 -name '*-eval.txt' | wc -l)" -eq 15
for SVC_SCENARIO in "${SVC_TIER2_SCENARIOS[@]}"; do
  test "$(head -n 1 "test-framework/evals/results/tier-2/WI-507/$SVC_SCENARIO.txt")" = 'verdict=pass'
done
git add .svc/lane-tasks-WI-507.json .svc/pipeline-decisions.jsonl
svc_check_checkpoint_paths task-final
git diff --cached --check
git commit -m 'feat(WI-507): add company operating fleet and promotion memory' \
  -m 'Co-Authored-By: Codex CLI <contact-b6b620a2d4@example.invalid>'
bash test-framework/evals/tier-1/validate-company-fleet-integration.sh
bash test-framework/evals/tier-1/validate-company-fleet-skills.sh
node scripts/lint-skills-manifest.mjs

# The pre-commit setup refresh resolves from canonical main and does not recheck
# branch-only skills. Prove it installed no worktree-rooted host symlinks.
for SVC_SKILLS_PATH in "$HOME/.claude/skills" "$HOME/.kimi/skills" "$HOME/.codex/skills" "$HOME/.gemini/skills" "$HOME/.config/opencode/skills" "$HOME/.mimocode/skills" "$HOME/.gemini/antigravity/skills" "$HOME/.cursor/skills"; do
  if find "$SVC_SKILLS_PATH" -maxdepth 1 -type l -lname '*/.worktrees/*' 2>/dev/null | grep -q .; then
    echo "host skill symlink points into .worktrees: $SVC_SKILLS_PATH" >&2
    exit 1
  fi
done

# 8. Freeze the committed tree, run review-exec and audit-implementation, and
# patch forward in a new commit for any accepted finding. Every patch invalidates
# prior diff-bound receipts and mapped tests, which must be reissued.

# 9. Push, create/reuse the exact PR, and squash only through land-changeset.
# Reissue the complete receipt envelope for the final squash SHA.

# 10. From promoted primary main, install and drift-check every provisioned host
# before any worktree cleanup. Repeat example-marketplace direct and installed-hook
# proof, complete verify-promotion and emit its receipt, then index/query WI-507.
SVC_PRIMARY_ROOT="/workspace/seriousvibecoding"
cd "$SVC_PRIMARY_ROOT"
test "$(git branch --show-current)" = main
git fetch origin main
git merge --ff-only origin/main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
SVC_PROMOTED_SHA="$(git rev-parse HEAD)"
for SVC_HOST_NAME in claude kimi codex gemini opencode mimo-code antigravity cursor; do
  ./setup --host "$SVC_HOST_NAME"
  bash scripts/check-install-drift.sh --host "$SVC_HOST_NAME"
done
test "$(readlink -f "$HOME/.claude/skills/cos")" = "$SVC_PRIMARY_ROOT/cos"
test "$(readlink -f "$HOME/.gemini/skills/cos")" = "$SVC_PRIMARY_ROOT/cos"
(cd /home/svc-user/app-workspaces/example-marketplace && printf '%s\n' '{"source":"startup","cwd":"/home/svc-user/app-workspaces/example-marketplace"}' | node "$HOME/.claude/skills/hooks/cos-briefing.mjs")
(cd /home/svc-user/app-workspaces/example-marketplace && printf '%s\n' '{"source":"startup","cwd":"/home/svc-user/app-workspaces/example-marketplace"}' | node "$HOME/.gemini/skills/hooks/cos-briefing.mjs")
# Require both installed-hook outputs to name the parent company-state path.
node scripts/check-chain-receipts.mjs --sha "$SVC_PROMOTED_SHA"
node scripts/svc-wi-promotion-indexer.mjs index --repo "$SVC_PRIMARY_ROOT" --wi WI-507 --sha "$SVC_PROMOTED_SHA" --summary "15-brain company fleet and promotion memory"
node scripts/svc-wi-promotion-indexer.mjs query --repo "$SVC_PRIMARY_ROOT" --wi WI-507
```

## 12. Checkpoint and Rollback Plan

| Checkpoint | Rollback anchor | Recovery |
|---|---|---|
| `wi507-cli-green` | `refs/svc/checkpoints/WI-507/task-1` commit-tree plus focused logs | Use `git diff` against the ref to identify drift and patch Task 1 forward; no branch movement or external state. |
| `wi507-skills-green` | `refs/svc/checkpoints/WI-507/task-2` commit-tree plus registry logs | Diff Task 1→Task 2 by exact paths, correct with apply_patch, and rerun manifest/structure checks. |
| `wi507-memory-green` | `refs/svc/checkpoints/WI-507/task-3` commit-tree plus temporary-home fixture logs | Diff the Task 3 ref, patch scripts forward, and retain append-only promotion evidence. |
| `wi507-hooks-green` | `refs/svc/checkpoints/WI-507/task-4` commit-tree plus host-wiring fixture | Diff the Task 4 ref and correct idempotent wiring; no global pre-merge install. |
| `wi507-external-links` | .svc/external-review-artifacts/WI-507/external-state-precheck.json plus planned-content hashes | Exact-current is a no-op; divergent content halts; remove only an unchanged hash recorded absent, and never reset/clean/stash external repos. |
| host SessionStart wiring | ~/.claude/settings.json and ~/.gemini/settings.json owned command entries | Before landing a revert, run the currently installed `node ~/.claude/skills/scripts/wire-hooks.mjs --remove-company-session-hooks` and Gemini equivalent, assert neither settings file contains `cos-briefing.mjs` or `svc-delta-preload.mjs`, then install the reverted promoted main. |
| 15 installed fleet skills | Exact skill-name symlinks under the eight declared host skill directories | After a promoted revert, inspect only `cos`, `growth-lead`, `fin-analyst`, `product-lead`, `market-intel`, `counsel`, `security-ops`, `customer-cs`, `revops`, `comms`, `tax-auditor`, `privacy-dpo`, `infra-sre`, `procurement`, and `growth-eng`. In each of `~/.claude/skills`, `~/.kimi/skills`, `~/.codex/skills`, `~/.gemini/skills`, `~/.config/opencode/skills`, `~/.mimocode/skills`, `~/.gemini/antigravity/skills`, and `~/.cursor/skills`, unlink only an exact named symlink whose target no longer exists; assert every remaining exact symlink resolves. Never prune directories, non-symlinks, or unrelated skills. |
| `wi507-reviewed-tree` | frozen tree hash and G6/audit receipts | Patch forward, invalidate/reissue receipts, rerun focused/full tests. |
| `wi507-promoted` | PR, squash SHA, final receipt envelope, installed-source hashes | Corrective PR and reinstall; retain append-only G7/index history with correction evidence. |

Checkpoint refs materialize recovery anchors without moving the WI branch or firing commit hooks. They are removed only after G7 and final receipt verification; early abandonment retains them for recovery. Whole-change rollback is a sanctioned revert/corrective PR. It does not delete historical JSONL events, promotion records, worktree topology, Git notes, unrelated external changes, or company state. Host installs are refreshed from the resulting promoted main; exact orphan-symlink cleanup is bounded by the row above and is followed by a resolving-target assertion across all eight hosts.

## 13. Promotion Readiness Checklist

- [ ] AC-1..AC-6 map to implementation and proof.
- [ ] Independent review-plan has no unresolved HIGH/CRITICAL finding.
- [ ] All 15 skill contracts are registered and all 15 Tier-2 routing scenarios execute and pass with a recorded log.
- [ ] The exact scoped `rg` genericity command is empty across runtime, hooks, references, routing, tests, manifest, and all 15 skill directories; pipeline artifacts are explicitly excluded.
- [ ] Parent resolution, SLA merge/idempotence, apps schema, and mesh tests pass twice.
- [ ] Promotion memory rejects WIP/unverified input and idempotently indexes G7 evidence.
- [ ] Topology, contract guard, and healer are non-mutating and path-contained.
- [ ] Claude/Gemini SessionStart wiring preserves existing hooks and TTL/delta limits.
- [ ] All planned file batches pass persistence verification.
- [ ] Manifest lint, focused checks, and full Tier-1 pass before and after commit.
- [ ] Parent dirty-path hashes and product repository state are unchanged outside three reviewed JSON files.
- [ ] Independent review-exec and audit-implementation pass on the final tree.
- [ ] Branch is pushed and squash-merged only through `land-changeset`.
- [ ] Final squash SHA has a fresh complete receipt envelope.
- [ ] Promoted skill installs are drift-free on all eight provisioned hosts; Claude/Gemini SessionStart wiring is live, and no global symlink resolves under `.worktrees/`.
- [ ] `/cos` from `example-marketplace` resolves the parent briefing through installed source.
- [ ] G7 passes and the promotion index query returns WI-507 only after verification.

## 14. Adversarial Self-Review

1. **Missing tasks:** PASS — all runtime, registry, synchronized docs, tests, hooks, install, external-state, and mandatory gate work is named.
2. **Dependency correctness:** PASS — engine precedes skills, memory precedes consumers, hooks precede install/live proof.
3. **Scope reduction:** PASS — all 15 brains, four diagnostics, both hosts, cross-repo links, G6/audit/land/G7 remain mandatory.
4. **Validation strength:** PASS — public CLIs and hooks run against hermetic repos; live proof runs only after promoted install.
5. **First-task viability:** PASS — existing engine helpers, schemas, legacy files, exact worktree/base, and focused fixture path are known.
6. **Pattern completeness:** PASS — Claude and Gemini SessionStart hooks are wired; all eight provisioned hosts are installed and checked after promotion; legacy role names are preserved.
7. **External-state safety:** PASS — only absent targets are created, dirty parent paths are hash-protected, no external Git mutation is allowed.
8. **Visual tier:** N/A — no visual or browser artifact.
9. **Provider fidelity:** N/A — no external model/provider output is generated.
10. **Professional-risk boundary:** PASS — legal/tax/security/privacy skills advise via evidence/checklists and require human checkpoints.

**Self-review result:** PASS. `review-plan` is the mandatory independent blocker before implementation.
