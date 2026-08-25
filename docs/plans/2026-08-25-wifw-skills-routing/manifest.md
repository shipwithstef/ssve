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
| T04 | CREATE | test-framework/fixtures/skill-router/corpus.json | Labeled evaluation corpus (pins, optional recall, ambiguity, negative triggers, budgets) |
| T04 | CREATE | test-framework/evals/tier-1/validate-skill-router.sh | Hermetic tier-1 validator: byte-stability, schema conformance, corpus assertions, offline mode, receipt redaction |
| T05 | MODIFY | FRAMEWORK-STATE.md | Framework self-knowledge row for the router surface |
| T05 | MODIFY | docs/specs/plans/wi-framework-skills-routing-plan.md | Implementation Notes annotation (status + landed-scope pointer) |

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

Untouched environments (walked the taxonomy, found nothing): package registries, container images, cloud resources, CI secrets, external SaaS state, browser profiles, mobile device state, DNS/domains, payment/ledger systems.

## Validation Plan

1. node scripts/lint-skills-manifest.mjs — manifest untouched but guard against drift
2. bash test-framework/evals/tier-1/validate-skill-router.sh — new hermetic validator (byte-stability, corpus, schemas, offline, redaction)
3. TEST_CONCURRENCY=2 bash test-framework/evals/run-all-evals.sh — full tier-1 corpus green
4. bash scripts/check-install-drift.sh --all-hosts --quiet — no install surface change expected; catches accidental packaging drift
5. bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-25-wifw-skills-routing/manifest.md — gate G-plan mechanical pass

## Execution Command Sequence

```bash
cd /home/dianast/app-workspaces/seriousvibecoding/.worktrees/feat-fw-skills-routing
node scripts/lint-skills-manifest.mjs
node scripts/compile-skill-router-index.mjs --check
node scripts/skill-router.mjs validate
TEST_CONCURRENCY=2 bash test-framework/evals/run-all-evals.sh
bash scripts/check-install-drift.sh --all-hosts --quiet
git add -A && git commit -m "feat(routing): JIT skill-routing index compiler + deterministic suggestion router (WI-FW-SKILLS-ROUTING-01)"
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
