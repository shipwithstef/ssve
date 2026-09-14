# WI-FW-SKILLS-ROUTING-01 — JIT skill routing changeset (base 494f074)

**Spec:** docs/specs/plans/wi-framework-skills-routing-plan.md (Proposed; sections 1/3/7 are the outcome/scope/verification contract)
**Branch:** feat-fw-skills-routing (worktree .worktrees/feat-fw-skills-routing)
**Status:** DRAFTED
**Base SHA:** 494f0749250ccf8c3e52e7dbd7a55128a0800b78
**Timestamp:** 2026-08-25T23:10:00Z
**Execution mode:** inline (orchestrator executes with full context loaded — §3a blueprints skipped per WI-386)
**Risk Flags:** idempotent_rewriter

## Implementation Summary

Implements the Wave 1 + Wave 2 core of the routing plan: a deterministic, offline,
content-addressed skill-routing index compiler plus a shared suggestion-only router
library and CLI. Deterministic pins (explicit name/alias, lane/task-graph state,
concern-registry signals) resolve before optional lexical ranking; budgets cap
candidate cards; every decision emits a privacy-safe receipt. Semantic retrieval is
stubbed at the provider boundary and always records degraded mode in this scope —
no network calls, no embeddings. All skills default to suggest-only invocation
policy; nothing is auto-loaded by this changeset.

Invariants:
- Optional capability discovery may be probabilistic; critical governance may not.
  Concern-required skills/rules surface as required pins regardless of rank or budget cut.
- The compiled index is derived data: canonical inputs are skills-manifest.json,
  SKILL.md frontmatter descriptions, concerns/REGISTRY.json, and
  references/skill-routing-overrides.json. Identical inputs produce byte-identical output.
- No host hook wiring changes in this changeset; hosts adopt via follow-up waves.

Constraints:
- Tier-1 validators stay hermetic (<5s target for the new validator): no network,
  no LLM calls, no browser launch.
- No edits to hooks/ in this changeset (adapter integration is Wave 6).
- Scope Reduction Prohibition acknowledged: Waves 0/3/4/6 are not silently dropped;
  they are explicitly deferred as follow-up WIs with their exit criteria intact
  (recorded in .svc/pipeline-decisions.jsonl taste entry, 2026-08-25).

## Files Planned

| Task | Action | File(s) | Purpose |
|---|---|---|---|
| T01 | CREATE | schemas/skill-routing-index.schema.json | Index record + envelope JSON Schema (versioned) |
| T01 | CREATE | schemas/skill-router-decision.schema.json | Normalized decision/receipt JSON Schema |
| T02 | CREATE | references/skill-routing-overrides.json | Framework-owned registry: aliases, trigger fixtures, invocation policies, risk, repo_signals per skill |
| T02 | CREATE | scripts/compile-skill-router-index.mjs | Deterministic compiler manifest+frontmatter+concerns+overrides → index; fails on dup names, missing files, invalid policies, unknown rule ids |
| T02 | CREATE | references/skill-routing-index.json | Generated, committed, content-addressed index artifact |
| T03 | CREATE | scripts/lib/skill-router.mjs | Shared library: load/pins/exact/lexical/policy-rerank/budget-cut/receipt/offline-degraded |
| T03 | CREATE | scripts/skill-router.mjs | CLI: compile / route / validate subcommands emitting normalized decision JSON |
| T03 | MODIFY | .gitignore | Ignore runtime receipts stream .svc/skill-router/ |
| T04 | CREATE | test-framework/fixtures/skill-router/corpus.json | Labeled evaluation corpus (pins, optional recall, ambiguity, negative triggers, budgets) |
| T04 | CREATE | test-framework/evals/tier-1/validate-skill-router.sh | Hermetic tier-1 validator: byte-stability, schema conformance, corpus assertions, offline mode, receipt redaction |
| T05 | MODIFY | FRAMEWORK-STATE.md | Framework self-knowledge row for the router surface |
| T05 | MODIFY | docs/specs/plans/wi-framework-skills-routing-plan.md | Implementation Notes annotation (status + landed-scope pointer) |
| T05 | MODIFY | docs/plans/2026-08-25-wifw-skills-routing/manifest.md | Planning artifact self-ownership (parity closure per WI-562 precedent) |
| T05 | MODIFY | docs/plans/2026-08-25-wifw-skills-routing/plan-contract.json | Planning artifact self-ownership |
| T05 | MODIFY | docs/specs/receipts/WI-FW-SKILLS-ROUTING-01.receipts.json | Story-receipts seed for this WI |
| T05 | MODIFY | docs/specs/research-log.md;docs/plans/2026-08-25-wifw-skills-routing/review-log.yaml | Research entry preserved from prior session; review-plan gate log (rounds 1-3 + bounded exit) |
| T06 | MODIFY | test-framework/evals/tier-1/validate-concern-compiler-v2.mjs;concerns/REGISTRY.json;concerns/cache-strategy-symmetry.md;concerns/paid-analytics-api.md;concerns/paid-cdn-egress.md;concerns/paid-external-api.md;concerns/paid-geocoding-api.md;concerns/paid-llm-api.md;concerns/paid-ml-inference-api.md;concerns/paid-notification-api.md;concerns/paid-ocr-vision-api.md;concerns/paid-payment-api.md;concerns/paid-search-api.md;concerns/paid-storage-api.md;concerns/paid-streaming-api.md;concerns/paid-translation-api.md | Exec-review F-EXEC-020 remediation: repair 14 dangling required_rules references to the never-created paid-api-integration-checklist rule (silent critical-pin failure); regenerate REGISTRY.json via canonical builder |

## Task Graph

```json
{
  "tasks": [
    { "id": "T01", "title": "Routing index + decision schemas", "blocked_by": [] },
    { "id": "T02", "title": "Overrides registry + deterministic compiler + generated index", "blocked_by": ["T01"] },
    { "id": "T03", "title": "Router library + CLI", "blocked_by": ["T02"] },
    { "id": "T04", "title": "Evaluation corpus + tier-1 validator", "blocked_by": ["T03"] },
    { "id": "T05", "title": "Docs/state sync + full tier-1 green", "blocked_by": ["T04"] }
  ]
}
```

## AC-to-Task Mapping

| AC | Source (plan §7) | Task(s) |
|---|---|---|
| AC-R1 explicit selection 100% correct | §7.1 | T03, T04 |
| AC-R2 lane/task-graph pinned selection 100% | §7.1 | T03, T04 |
| AC-R3 concern/critical signal activation 100% recall | §7.1 | T03, T04 |
| AC-F1 zero forbidden auto-invocations | §7.1 | T02 (policy defaults), T04 |
| AC-A1 ambiguity fixtures choose approved fallback | §7.1 | T03, T04 |
| AC-N1 negative triggers produce no targeted invocation | §7.1 | T02, T04 |
| AC-O1 lexical Recall@5 ≥ 97% on reviewed corpus | §7.1 | T03, T04 |
| AC-B1 D1 budget ≤ 8 cards; overflow drops lowest-ranked optional | §7.2 | T03, T04 |
| AC-D1 byte-stable compilation | plan §4.2 | T02, T04 |
| AC-D2 invalid inputs fail compile loudly | plan §4.2 | T02, T04 |
| AC-OFF1 offline exact/lexical routing functional; semantic absent → degraded recorded | §7.3 | T03, T04 |
| AC-P1 receipts fingerprint-only, no raw prompt/secrets | §7.3 | T03, T04 |
| AC-H1 normalized host-facing decision shape validates against schema | §4.9 | T01, T03, T04 |

## AC-to-Test Mapping

| AC | Test type | Evidence |
|---|---|---|
| AC-R1..R3, A1, N1 | Unit/corpus (tier-1 hermetic runner) | validate-skill-router.sh corpus assertions |
| AC-F1 | Unit | policy enum check + zero-load assertion in corpus run |
| AC-O1 | Corpus metric | Recall@5 computed over labeled optional set; floor asserted ≥ 0.97 |
| AC-B1 | Unit | budget-cut case in corpus |
| AC-D1 | Reproducibility | compile twice → sha256 equal; committed artifact matches recompile |
| AC-D2 | Negative compile cases | fixture malformed inputs → non-zero exit + named reason |
| AC-OFF1 | Unit/env | route run with networkless stub env; degraded_mode recorded |
| AC-P1 | Output inspection | receipt contains intent_fingerprint, never raw intent string beyond hash |
| AC-H1 | Schema validation | decision output validated against skill-router-decision.schema.json |

Manual/E2E: N/A-with-reason — framework-lane infrastructure with no UI surface; host adapter behavior is Wave 6 scope.

## Prerequisite Alignment Matrix

| Prerequisite | Artifact | Trace into this changeset |
|---|---|---|
| Product plan verification contract | docs/specs/plans/wi-framework-skills-routing-plan.md §7 | AC table above maps 1:1 to corpus labels |
| Local framework evidence | concerns/REGISTRY.json signals shape | Compiler consumes file_path_patterns/packages/env_vars exactly as svc-rule-injector.mjs globs them |
| Manifest roles doctrine | AGENTS.md §9 manifest array roles | Router treats includedSkills as install surface; corePackForRouting as suggestable baseline filter |
| Research evidence | docs/specs/research-log.md entry 2026-08-25 (JIT skill discovery) | Hybrid design constraints; semantic-only rejection honored via degraded-mode stub |
| Style contract | Existing scripts conventions (.mjs shebang, fail-closed exits) | All new Node files follow scripts/*.mjs house style |

Persona/UX/UI traces: N/A-with-reason — framework lane, no user-facing screens.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | Repo working tree (generated artifacts) | references/skill-routing-index.json regenerated from canonical inputs | coupled | tier-1 validate-skill-router.sh recompiles and byte-diffs against committed artifact; drift fails CI before land |
| 2 | Runtime local state (.svc/, gitignored) | append-only decision receipts stream | decoupled-justified | Receipts are observational telemetry only; no production policy reads them back this wave. Drift monitoring: receipts schema version stamped; mismatched-version entries ignored by readers |
| 3 | Environment variables (read-only knobs) | SVC_SKILL_ROUTER_MODE=off/shadow/suggest/active; SVC_SEMANTIC_ROUTER_ENDPOINT unset ⇒ degraded | coupled | Library reads mode knob each invocation; unknown values fail closed to off; documented in CLI help text emitted by scripts/skill-router.mjs |
| 4 | Host hook surfaces | untouched in this changeset | decoupled-justified | No wiring edits; Wave 6 owns adapters. Detection of accidental coupling: changeset diff contains no hooks/ paths (asserted at review-gate) |

Untouched environments (walked the taxonomy, found nothing): (1) package registries, (2) container images, (3) cloud resources, (4) CI secrets, (5) external SaaS state, (6) browser profiles, (7) mobile device state, (8) DNS/domains, (9) payment/ledger systems.

## Rollback

Commit-scoped reversal, cheapest first (destructive-git-ops pre-checks mandatory before any history-altering command):

1. Pre-land: `git revert --no-edit c13ee18` reverts the implementation commit non-destructively; the recorded SHA is proven by `git log` on this branch. Never hard-reset without the destructive-git-ops evidence preamble.
2. Post-land: single revert commit reverting the squash-merge on main; generated artifact references/skill-routing-index.json is regenerated from canonical inputs at any time via the compiler, so reverts never lose source truth.
3. Rollback validation: after either step, focused tier-1 must pass and `node scripts/compile-skill-router-index.mjs --check` must be skipped only when the artifact is intentionally absent.

## Gate Sequencing Invariant

Lane-task statuses record autonomous-resume reality: implementation was executed while this review-plan gate was already in flight (owner-mandated single-session chain). The enforced invariant is that NO promotion occurs until every gate task is completed — land-changeset stays blocked_by review-gate, review-exec, and audit-implementation in the cross-host graph, and the squash-merge happens only after they complete.

## Crash, Concurrency, and Rerun Semantics

- Compiler: writes a temp file then atomic rename; a crash leaves the prior committed artifact intact (immutable baseline = committed bytes; rolling rollback = regenerate from canonical inputs).
- Receipt stream: appends go through `scripts/state-io.mjs` `appendJsonlLine` under its advisory state lock; concurrent routers serialize per-file; partial lines from a SIGKILL mid-append are tolerated by readers scanning line-by-line and ignoring the trailing unterminated fragment.
- Rerun safety: compile is byte-stable (attempt N == attempt 1), so re-execution of any task cannot corrupt the index; route is read-only against canonical inputs plus an append-only telemetry stream.

## Inline Execution Contracts

Execution mode is `inline` (WI-386): blueprints skipped because the orchestrator executes with full context. Determinism is carried by these frozen module contracts instead of code payloads:

| Module | Exported surface |
|---|---|
| scripts/compile-skill-router-index.mjs | `compile(root) -> string` (index JSON text), `extractDescription(raw) -> string`; CLI main guarded by direct-execution check |
| scripts/lib/skill-router.mjs | `loadIndex`, `loadConcerns`, `globToRe`, `matchConcern`, `resolvePins`, `route(options) -> decision`, `writeReceipt`, `validateDecision`, constants `BUDGETS`, `KERNEL_TEXT`, `POLICY_VERSION` |
| scripts/skill-router.mjs | CLI subcommands `compile|validate|route` delegating to the two modules above |
| Compiler alias contract | aliases normalize (trim+lowercase) into a global owner map; a second owner for one alias fails compilation with `alias collision: "<alias>" declared by both <a> and <b>` |

## Scope-Boundary Notes

- Active-mode selection exists mechanically but cannot fire this wave: every compiled invocation_policy is suggest-only, and the gates require implicit-allowed plus confidence/margin/risk pass-through. Corpus case zero-forbidden-auto-invocations-all-policies-conservative pins this. Advertising the flag is forward-compatible surface, not a live behavior change.
- The Recall@5 floor is provisional by design (plan §7.1 labels it initial): the corpus is bootstrapped from reviewed plan labels rather than sampled live sessions; Wave 0 baseline capture replaces it with session-derived fixtures. Circularity risk is bounded because labels were fixed before router implementation and negative/forbidden cases constrain gaming.

## Lane Compliance Evidence

Every skill in the framework-lane graph, with artifact or cited skip:

| Skill | Disposition | Artifact / citation |
|---|---|---|
| write-spec | skipped | docs/specs/plans/wi-framework-skills-routing-plan.md §1/§3/§7 is the spec (lane-tasks task 1 skip_reason) |
| plan-changeset | completed | this manifest + .svc phase receipts P1-P4/P6 (task 2) |
| review-plan | in progress | mechanical TIER-1 PASS + external plan-review rounds under .svc/external-review/wifw-skills-routing-01/plan* (task 3) |
| execute-changeset | completed in worktree commit c13ee18 + this remediation | implementation files per Files Planned; process receipts for test-journeys(tier-1-corpus) and sync-spec-code(implementation-notes) bound by sha256 (task 4) |
| review-gate | pending → runs post-execution against staged diff | task 5 |
| review-exec | pending → self-review + external exec review | task 6 |
| audit-implementation | pending | task 7 |
| land-changeset | pending | task 8 |
| verify-promotion | pending | task 9 |

Mandatory chain order validated mechanically: `node scripts/validate-task-graph-lane.mjs` PASS — plan-changeset, review-plan, execute-changeset, review-gate, review-exec, audit-implementation, land-changeset, verify-promotion contiguous at positions 1-8, zero missing.


## Validation Plan

1. node scripts/lint-skills-manifest.mjs — manifest untouched but guard against drift
2. bash test-framework/evals/tier-1/validate-skill-router.sh — new hermetic validator (byte-stability, corpus, schemas, offline, redaction)
3. TEST_CONCURRENCY=2 bash test-framework/evals/run-all-evals.sh — full tier-1 corpus green
4. bash scripts/check-install-drift.sh --all-hosts --quiet — no install surface change expected; catches accidental packaging drift
5. bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-25-wifw-skills-routing/manifest.md — gate G-plan mechanical pass

## Execution Command Sequence

```bash
cd /home/user/app-workspaces/seriousvibecoding/.worktrees/feat-fw-skills-routing
node scripts/lint-skills-manifest.mjs
node scripts/compile-skill-router-index.mjs --check
node scripts/skill-router.mjs validate
bash test-framework/evals/tier-1/validate-skill-router.sh
TEST_CONCURRENCY=2 bash test-framework/evals/run-all-evals.sh
bash scripts/check-install-drift.sh --all-hosts --quiet
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-25-wifw-skills-routing/manifest.md
git add schemas/skill-routing-index.schema.json \
  schemas/skill-router-decision.schema.json \
  references/skill-routing-overrides.json \
  references/skill-routing-index.json \
  scripts/compile-skill-router-index.mjs \
  scripts/lib/skill-router.mjs \
  scripts/skill-router.mjs \
  test-framework/fixtures/skill-router/corpus.json \
  test-framework/evals/tier-1/validate-skill-router.sh \
  FRAMEWORK-STATE.md \
  docs/specs/plans/wi-framework-skills-routing-plan.md \
  docs/specs/receipts/WI-FW-SKILLS-ROUTING-01.receipts.json \
  docs/specs/research-log.md \
  .gitignore \
  docs/plans/2026-08-25-wifw-skills-routing/manifest.md \
  docs/plans/2026-08-25-wifw-skills-routing/plan-contract.json
git commit -m "feat(routing): JIT skill-routing index compiler + deterministic suggestion router (WI-FW-SKILLS-ROUTING-01)" -m "Co-authored-by: opencode/x-preview-f-free <opencode@example.invalid>"
```

RECOVERY_IF_FAIL: if the new tier-1 validator fails on byte-stability, re-run the compiler and inspect the diff of the generated artifact; canonical-input drift (manifest/frontmatter/concerns edited mid-run) is the only permitted cause — re-commit regenerated artifact together with its inputs. If corpus assertions fail, fix router logic, never loosen corpus labels.

## Checkpoint Plan

| Checkpoint | When | Blocking condition |
|---|---|---|
| Compile determinism | after T02 | two compiles differ → stop, fix ordering |
| Corpus green | after T04 | any labeled fixture wrong → stop, fix router |
| Full tier-1 | after T05 | any unrelated regression → stop, bisect before landing |

## Promotion Readiness Checklist

- [x] No ORM/schema migration touched (N/A — no app database in framework repo)
- [x] No hooks/ paths in diff (Wave 6 boundary held)
- [x] Tier-1 hermetic budget respected (new validator <5s, no network)
- [x] External State section complete with coupling wiring
- [x] plan-contract.json adjacent with matched risk flag only (idempotent_rewriter)
- [x] Deferred waves recorded as explicit follow-ups, not silent omissions

## Pre-Implementation Simulation Report

- Disk layer: none of the CREATE targets exist today (verified by ls); MODIFY targets exist (FRAMEWORK-STATE.md, plan doc).
- Planned layer: T02 writes the overrides registry and generated index before T03 library loads it — import order safe. T03 CLI imports only from scripts/lib/skill-router.mjs (no cycles). T04 validator invokes the CLI via node, matching C6 tool availability (node present).
- Journey walkthrough: N/A — no journey scenarios in framework lane; corpus fixtures play the scenario role (each Given/When/Then maps to a corpus label consumed by T04).
- Result: all-PASS, proceed.
