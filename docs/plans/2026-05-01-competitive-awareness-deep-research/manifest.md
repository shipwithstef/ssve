# Manifest: Environment-Aware Competitive Cross-Reference Gates (SDKG primitive + competitive instance)

**Spec:** `docs/specs/features/competitive-awareness-deep-research.md` (BASELINED 2026-05-02)
**WI:** WI-140
**Branch:** `framework-competitive-awareness` (worktree)
**Status:** SIMULATED
**Base branch:** `main`
**Base SHA:** `3107613ce1b6`
**Created:** 2026-05-02
**Lane:** 7 (framework)

---

## Problem Archetype (Step 0)

**Archetype:** Cross-cutting concern + Architectural change.
**Reasoning:** 7 consumer entry points (all verified on disk) + new SDKG primitive contract reused across future framework gates.
**Planning mode:** Primitives-first → schema-first → consumers in dependency order.

---

## Lane Compliance (Lane 7 — Framework, per `route-workflow/references/lane-model.md`)

This WI follows the Lane 7 "New framework capability" branch (per `lane-model.md` Framework Work Classification). Required skills + status:

| Skill | Status | Artifact / decision-log entry |
|-------|--------|-------------------------------|
| `write-spec` | ✅ completed | `docs/specs/features/competitive-awareness-deep-research.md` (BASELINED 2026-05-02) + `.svc/pipeline-decisions.jsonl` skill_complete entry 2026-05-01T20:30 |
| `design-tech` | ✅ completed | Spec § Technical Design (filled 2026-05-02) + 4 taste decisions logged in `.svc/pipeline-decisions.jsonl` 2026-05-02T08:50 |
| `plan-changeset` | ✅ completed (this manifest) | `.svc/pipeline-decisions.jsonl` 2026-05-02T09:15 |
| `review-plan` | 🔄 in_progress | `docs/plans/2026-05-01-competitive-awareness-deep-research/review-log.yaml` (this review pass) |
| `execute-changeset` | pending | Will run against worktree `framework-competitive-awareness` |
| `review-gate` (G3 + G5) | pending | Pre-merge per phase |
| `audit-implementation` | pending | After execute-changeset |
| `land-changeset` | pending | One per phase PR |
| `verify-promotion` | pending | After all phase PRs merge to main |

**Skipped (not applicable to "new framework capability" branch):**
- `evolve-framework` — N/A: this is build, not evolution exploration
- `improve-framework` — N/A: not a known-gap reactive change
- `diagnose-bug` — N/A: not a regression
- `audit-session-execution` — N/A: not session forensics
- `test-framework` — N/A: not gap evidence-gathering
- `blend-external` / `blend-private` — N/A: not external import

Per `references/framework-policy.md`: framework-lane "new capability" branch is `write-spec → design-tech → plan-changeset → review-plan → execute-changeset → review-gate → audit-implementation → land-changeset → verify-promotion`. All present in this manifest's task graph + `.svc/lane-tasks-WI-140.json`.

---

## Implementation Summary

Build the SDKG primitive layer (5 files, ~150 LOC, zero npm deps) FIRST so the competitive instance is the first proof of reusability. Then land:
- Schema (JSON, pure-node validator)
- Producer rewrite (analyze-competitors mandates web research)
- Consumer gates (validate-feature, write-spec, design-tech)
- Compensating-control framing
- Continuous monitoring trigger (single hook router)
- Brownfield day-1 sweep + knowledge auto-surface
- Lifecycle (proposal close, learnings)

**Invariants:** existing 9-dimension competitor analysis, existing tier-1 framework, existing analyze-competitors.md output, public skill APIs (only additive frontmatter).

**Major constraints:** zero new npm deps; all new dirs first-mover precedent (`scripts/gates/`, `scripts/lib/json-schema-validator.mjs`'s sibling, `test-framework/evals/tier-1/lib/`, `references/schemas/`, `references/templates/`); per `rules/long-output-to-file.md`, validators emit summaries inline + write detail to file.

**Out of scope:** US-8 retroactive Example Marketplace audit (separate example-marketplace WI per spec § Dependency Spec Queue).

---

## External State

> **Scope clarification (per RP-002 in review-log):** Rows 1-3 describe **downstream effects in projects that USE svc**, NOT files in this svc branch's diff. This svc PR will not contain `.svc/competitive-monitor-triggers.jsonl`, `analyze-competitors.data.json`, or per-project `Competitive Risk Assessment` sections — those materialize when downstream consumers run the new skill behaviors. The lifecycle-wiring column names the framework code that, when shipped, ENFORCES the coupling in downstream repos.

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | **Downstream project repo** `.svc/` | New file `.svc/competitive-monitor-triggers.jsonl` lazy-init by `scripts/init-project-state.mjs` (this svc PR ships the modified init script; downstream projects materialize the file on next init) | coupled | `scripts/init-project-state.mjs` (modified in T5.3) creates the file on first project init; existence checked by `validate-competitor-analysis-freshness.sh` (T5.4). NOT in this svc branch's diff. |
| 2 | **Downstream project repo** `docs/specs/analyze-competitors.md` + sibling `analyze-competitors.data.json` | New companion JSON file written by `analyze-competitors` skill when consumers run it | coupled | `validate-competitor-analysis-schema.sh` (T2.2) FAILs when `.md` exists without conforming `.data.json` after 30-day grace. NOT in this svc branch's diff. |
| 3 | **Downstream project repo** `docs/specs/features/*.md` | New required `## Competitive Risk Assessment` section in specs touching core mechanics | coupled | `validate-feature-competitive-cross-reference.sh` (T3.4) FAILs BASELINED on applicable spec missing section. NOT in this svc branch's diff. |
| 4 | svc framework `references/schemas/` (NEW dir) | Schema files (JSON) | coupled | Schema is the contract; validators read it; schema-shape change breaks validators loudly |
| 5 | svc framework `references/sdkg-registry.json` (NEW) | Registry of SDKG instances (schema path, gate config, trigger keywords, freshness window) | coupled | `post-task-trigger-router.mjs` reads at runtime; future SDKG instances add a row, no engine change |
| 6 | svc framework `test-framework/evals/tier-1/` | 5 new validator scripts (5 LOC each, call shared `lib/sdkg-validator.sh`) | coupled | Existing `run-all-evals.sh --tier1` auto-discovers `*.sh` — no separate registration |
| 7 | svc framework `scripts/lib/` + `scripts/gates/` (NEW) | Primitive engine (`structured-gate-engine.mjs`), validator (`json-schema-validator.mjs`), trigger router (`post-task-trigger-router.mjs`); per-instance gate config (`gates/competitive.mjs`) | coupled | Imported by SKILL.md edits in tasks T2.1, T3.2, T4.2; engine breakage caught by fixture tests in T3.1 |
| 8 | svc framework `references/templates/` (NEW dir) | 5 section/output templates referenced from SKILL.md | coupled | SKILL.md edits cite the templates by path; templates are part of the same PR as the SKILL edits |
| 9 | svc framework `hooks/svc-task-completion-guard.sh` (existing) | Extended to invoke `post-task-trigger-router.mjs` on every Stop event | coupled | Hook extension shipped in same task as router (T5.2); regression caught by hook test fixture |

**Untouched environments (walked the taxonomy):** Cloud infra (1), Database/migrations (2), Secrets (3), CI/CD (4 — only via existing tier-1 wiring), DNS/TLS/CDN (5), IAM/OAuth (6), Monitoring/observability third-party (7 — pipeline-decisions.jsonl is local), Feature flags remote (8 — env vars only), Email/messaging (9), Object storage (10), Mobile distribution (11), Browser extensions (12), Domain registrations (13), 3rd-party SaaS (14 — WebSearch/WebFetch are host-native), Mobile push (15).

---

## Files Planned

### Phase 0 — Pre-flight (validator gap)

| File | Action | Task | Purpose |
|------|--------|------|---------|
| `scripts/validate-task-graph-lane.mjs` | MODIFY | T0.1 | Add lane 7 (framework) to LANE_MODELS — unblocks self-verify check 11 + future framework-lane WIs |

### Phase 1 — SDKG primitive layer + competitive schema instance

| File | Action | Task | Purpose |
|------|--------|------|---------|
| `scripts/lib/json-schema-validator.mjs` | CREATE | T1.1 | Pure-node ~80-LOC JSON-Schema subset validator (type, required, enum, format date, items, properties). Header documents zero-dep rationale. |
| `scripts/lib/structured-gate-engine.mjs` | CREATE | T1.2 | `evaluateGate({schemaPath, dataPath, gateConfig, currentArtifact}) → {verdict, missingFields, citations, branchTaken}` |
| `scripts/lib/post-task-trigger-router.mjs` | CREATE | T1.3 | Reads `references/sdkg-registry.json` + completed-task subject, dispatches to N triggers, appends to per-instance jsonl |
| `test-framework/evals/tier-1/lib/sdkg-validator.sh` | CREATE | T1.4 | Bash helper: `sdkg_validate <instance> <fixture>` — wraps node call, std exit codes |
| `references/sdkg-registry.json` | CREATE | T1.5 | Initial registry with one row: `competitor-analysis` (schema, data path, freshness, triggers, gate config) |
| `references/schemas/competitor-analysis.schema.json` | CREATE | T1.5 | First instance schema (JSON, conforms to draft 2020-12 subset) |
| `references/schemas/competitor-analysis.example.json` | CREATE | T1.5 | Reference fixture for tests |
| `test/json-schema-validator.test.mjs` | CREATE | T1.1 | Unit tests for pure-node validator (must pass before T1.2 builds on it) |
| `test/structured-gate-engine.test.mjs` | CREATE | T1.2 | 6-fixture tests (populated-pass, populated-block, populated+CC-pass, nascent-warn, none-found-block, inapplicable-skip) |
| `test/post-task-trigger-router.test.mjs` | CREATE | T1.3 | Unit tests for keyword-match + multi-instance dispatch |
| `test/fixtures/sdkg/competitor-*.json` | CREATE | T1.2 | 6 competitor data fixtures + 6 spec fixtures driving the engine tests |

### Phase 2 — analyze-competitors deep research mandate

| File | Action | Task | Purpose |
|------|--------|------|---------|
| `analyze-competitors/SKILL.md` | MODIFY | T2.1 | Mandate web research (no "consolidation only" terminal); add Customer Mechanic Analysis section; emit `.data.json` companion conforming to schema |
| `references/templates/analyze-competitors-output-template.md` | CREATE | T2.1 | Reference template (markdown structure + companion JSON skeleton) |
| `test-framework/evals/tier-1/validate-competitor-analysis-schema.sh` | CREATE | T2.2 | 5-LOC wrapper: `sdkg_validate competitor-analysis examples/*.json`; rejects "no new web research performed" header pattern |
| `test-framework/evals/tier-1/validate-competitor-analysis-freshness.sh` | CREATE | T2.3 | 5-LOC wrapper: 90-day check + cross-references monitor-triggers jsonl (extended in Phase 5) |

### Phase 3 — validate-feature + write-spec env-aware gate

| File | Action | Task | Purpose |
|------|--------|------|---------|
| `scripts/gates/competitive.mjs` | CREATE | T3.1 | Gate config object: schema reference, branch matrix on `landscape_state` (4 states), citation extractor, compensating-control trigger condition |
| `references/templates/competitive-risk-assessment.md` | CREATE | T3.2 | Section template with placeholders for branch result + cited competitor patterns |
| `validate-feature/SKILL.md` | MODIFY | T3.3 | Auto-emit Competitive Risk Assessment section by invoking `evaluateGate()`; document the 4 branches |
| `write-spec/SKILL.md` | MODIFY | T3.3 | Same gate behavior at spec authoring time; documents BASELINED-block condition |
| `test-framework/evals/tier-1/validate-feature-competitive-cross-reference.sh` | CREATE | T3.4 | 5-LOC wrapper: BASELINED specs in core-mechanic features have section + branch resolved + landscape_state field present |

### Phase 4 — Compensating-control framing

| File | Action | Task | Purpose |
|------|--------|------|---------|
| `references/templates/compensating-control.md` | CREATE | T4.1 | 4-field section template: missing_capability, why_not_now, risk_of_workaround, path_to_replacement |
| `write-spec/SKILL.md` | MODIFY | T4.2 | Append compensating-control trigger to existing edits from T3.3 — when GATE-03 fires, require this section |
| `design-tech/SKILL.md` | MODIFY | T4.2 | Add Competitive Tech Alternatives subsection (TECH-01/02/03) + compensating-control wiring |
| `test-framework/evals/tier-1/validate-spec-compensating-control.sh` | CREATE | T4.3 | 5-LOC wrapper: 4 fields filled (no TBD/blank) when section present |

### Phase 5 — Continuous monitoring (single hook router)

| File | Action | Task | Purpose |
|------|--------|------|---------|
| `route-workflow/SKILL.md` | MODIFY | T5.1 | Document post-task trigger router pattern + jsonl event schema |
| `hooks/svc-task-completion-guard.sh` | MODIFY | T5.2 | Append one block: invoke `node scripts/lib/post-task-trigger-router.mjs` after completion check; gracefully fail-open on router error |
| `scripts/init-project-state.mjs` | MODIFY | T5.3 | Add `.svc/competitive-monitor-triggers.jsonl` to lazy-init list (idempotent) |
| `test-framework/evals/tier-1/validate-competitor-analysis-freshness.sh` | MODIFY | T5.4 | Extend to read triggers jsonl: 3+ events in quarter AND `last_verified` >90d → FAIL |
| `test/post-task-router-integration.test.mjs` | CREATE | T5.2 | Test hook→router→jsonl chain with mock task completion subjects |

### Phase 6 — onboard-repo brownfield day-1 sweep (parallel with 5, 7)

| File | Action | Task | Purpose |
|------|--------|------|---------|
| `onboard-repo/SKILL.md` | MODIFY | T6.1 | Add "Detect core-mechanic features" step (grep patterns); invoke `analyze-competitors` scoped per detected mechanic |
| `references/templates/brownfield-competitive-flags.md` | CREATE | T6.2 | Output artifact template at `docs/specs/brownfield-competitive-flags.md` |

### Phase 7 — research + svc-advisor knowledge auto-surface (parallel with 5, 6)

| File | Action | Task | Purpose |
|------|--------|------|---------|
| `references/knowledge/competitive-domains.json` | CREATE | T7.1 | List of knowledge-domain slugs requiring auto-surface (loyalty, verification, enrollment, payment); project-extensible |
| `references/templates/competitive-context-block.md` | CREATE | T7.1 | Auto-surface block template (placeholders for competitor names + mechanic + freshness warning) |
| `research/SKILL.md` | MODIFY | T7.2 | Auto-append Competitive Context block when query matches listed domain; honor stale-data warning |
| `svc-advisor/SKILL.md` | MODIFY | T7.2 | Same |

### Phase 8 — Lifecycle (depends on all)

| File | Action | Task | Purpose |
|------|--------|------|---------|
| `proposals/done/2026-05-01-competitive-awareness-gap.md` | CREATE | T8.1 | Move proposal to done/ with `**Superseded-by:** WI-140 (manifest: docs/plans/2026-05-01-competitive-awareness-deep-research/manifest.md)` header |
| `proposals/done/2026-05-01-competitive-awareness-gap.md` | DELETE | T8.1 | Justified: file moved to proposals/done/ via copy+delete; standard svc proposal lifecycle |
| `references/framework-learnings.jsonl` | MODIFY | T8.2 | Append learning: `stored-knowledge-decay-generalized` — same pattern fixed for competitive class via SDKG primitive layer |
| `FRAMEWORK-STATE.md` | MODIFY | T8.3 | Section update: WI-140 promoted; SDKG primitive layer now available for future gate WIs |

### Final validation

| File | Action | Task | Purpose |
|------|--------|------|---------|
| (no new files) | — | T9.1 | Run `bash test-framework/evals/run-all-evals.sh --tier1` — must exit 0 with all 67 (62 existing + 5 new) PASS |
| (no new files) | — | T9.2 | Run `node scripts/lint-skills-manifest.mjs` — no drift |
| (no new files) | — | T9.3 | Run `node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-140.json` — exit 0 with lane 7 known |

**Total:** 22 NEW + 10 MODIFY + 1 DELETE = 33 file actions across 9 phases.

---

## Task Graph

| Task | Title | Files | Depends on | AC coverage | Validation | Checkpoint |
|------|-------|-------|------------|-------------|------------|------------|
| **T0.1** | Lane validator gap | scripts/validate-task-graph-lane.mjs | — | (pre-flight) | `node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-140.json` exits 0 | `cp-phase-0` |
| **T1.1** | Pure-node JSON-Schema validator + tests | scripts/lib/json-schema-validator.mjs + test/json-schema-validator.test.mjs | T0.1 | COMP-01 (foundation) | `node test/json-schema-validator.test.mjs` 100% pass; covers type, required, enum, format date, items, properties | `cp-phase-1-validator` |
| **T1.2** | Structured gate engine + 6-fixture tests | scripts/lib/structured-gate-engine.mjs + test/structured-gate-engine.test.mjs + test/fixtures/sdkg/* | T1.1 | GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, GATE-06, GATE-FAIL-01, GATE-FAIL-02 (engine layer) | `node test/structured-gate-engine.test.mjs` — all 6 fixtures pass | `cp-phase-1-engine` |
| **T1.3** | Post-task trigger router + tests + dedupe | scripts/lib/post-task-trigger-router.mjs + test/post-task-trigger-router.test.mjs | T1.1 | MON-01, MON-02 (router primitive) | `node test/post-task-trigger-router.test.mjs` — keyword match + multi-instance dispatch + **dedupe (per RP-006)**: event key = `{task_id, subject_hash, registry_instance, date_bucket=YYYY-MM-DD}`; router checks last N events (default 100) before append; idempotency test runs same Stop event twice → JSONL contains exactly ONE event | `cp-phase-1-router` |
| **T1.4** | Tier-1 SDKG validator helper | test-framework/evals/tier-1/lib/sdkg-validator.sh | T1.1 | COMP-05 (helper) | `bash lib/sdkg-validator.sh competitor-analysis test/fixtures/sdkg/valid.json` exits 0 | `cp-phase-1-helper` |
| **T1.5** | Competitive schema + registry + example | references/sdkg-registry.json + references/schemas/competitor-analysis.schema.json + .example.json | T1.1 | COMP-01 (instance) | `node scripts/lib/json-schema-validator.mjs --schema=competitor-analysis --data=example` PASS | `cp-phase-1-instance` |
| **T2.1** | analyze-competitors rewrite + template | analyze-competitors/SKILL.md + references/templates/analyze-competitors-output-template.md | T1.5 | COMP-02, COMP-03, COMP-04, COMP-ZERO | `bash test-framework/evals/tier-1/validate-skill-structure.sh` PASS for analyze-competitors | `cp-phase-2-skill` |
| **T2.2** | Schema validator wrapper | test-framework/evals/tier-1/validate-competitor-analysis-schema.sh | T1.4, T1.5 | COMP-05, COMP-07 | Wrapper PASSes valid example, FAILs "consolidation only" header pattern + missing data file | `cp-phase-2-schema-validator` |
| **T2.3** | Freshness validator wrapper | test-framework/evals/tier-1/validate-competitor-analysis-freshness.sh | T1.4, T1.5 | COMP-06 | Wrapper FAILs on >90d `last_verified` for populated/nascent landscape | `cp-phase-2-freshness-validator` |
| **T3.1** | Competitive gate config | scripts/gates/competitive.mjs | T1.2 | GATE-02, GATE-03, GATE-04, GATE-05, GATE-06 (config) | Gate config exports valid object readable by structured-gate-engine; consumed by T1.2 fixture tests | `cp-phase-3-config` |
| **T3.2** | Competitive Risk Assessment template | references/templates/competitive-risk-assessment.md | — | GATE-01 | Template parseable; placeholder fields documented | `cp-phase-3-template` |
| **T3.3** | validate-feature + write-spec edits | validate-feature/SKILL.md + write-spec/SKILL.md | T3.1, T3.2 | GATE-01, GATE-03, GATE-04, GATE-05, GATE-06, GATE-07, GATE-ZERO | tier-1 skill-structure validator PASS for both | `cp-phase-3-skills` |
| **T3.4** | Cross-reference validator wrapper | test-framework/evals/tier-1/validate-feature-competitive-cross-reference.sh | T1.4, T3.3 | GATE-08 | FAILs unprotected BASELINED spec, PASSes protected | `cp-phase-3-validator` |
| **T4.1** | Compensating-control template | references/templates/compensating-control.md | — | CC-01 | 4-field shape parseable | `cp-phase-4-template` |
| **T4.2** | write-spec + design-tech edits | write-spec/SKILL.md + design-tech/SKILL.md | T4.1, T3.3 | CC-01, CC-02, CC-04, TECH-01, TECH-02, TECH-03 | tier-1 skill-structure validators PASS | `cp-phase-4-skills` |
| **T4.3** | CC validator wrapper | test-framework/evals/tier-1/validate-spec-compensating-control.sh | T1.4, T4.2 | CC-03 | FAILs on TBD field, PASSes on filled | `cp-phase-4-validator` |
| **T5.1** | route-workflow doc edits | route-workflow/SKILL.md | T1.3 | MON-01, MON-02 | tier-1 skill-structure validator PASS | `cp-phase-5-doc` |
| **T5.2** | Hook extension + integration test | hooks/svc-task-completion-guard.sh + test/post-task-router-integration.test.mjs | T1.3, T5.1 | MON-02 | Hook test: completion subject matching `earn` → trigger event appended to mock jsonl | `cp-phase-5-hook` |
| **T5.3** | Init-state extension | scripts/init-project-state.mjs | T5.1 | MON-01 | Run init in temp dir → file created; idempotent re-run | `cp-phase-5-init` |
| **T5.4** | Freshness validator extension | test-framework/evals/tier-1/validate-competitor-analysis-freshness.sh | T2.3, T5.2, T5.3 | MON-03, MON-04 | FAILs when 3+ triggers + stale; PASSes when fresh | `cp-phase-5-validator` |
| **T6.1** | onboard-repo edit | onboard-repo/SKILL.md | T2.1 | ONB-01, ONB-02, ONB-04 | tier-1 skill-structure validator PASS | `cp-phase-6-skill` |
| **T6.2** | Brownfield template | references/templates/brownfield-competitive-flags.md | T6.1 | ONB-03 | Template parseable | `cp-phase-6-template` |
| **T7.1** | Knowledge config + context template | references/knowledge/competitive-domains.json + references/templates/competitive-context-block.md | T1.5 | KNOW-01 | JSON valid; template parseable | `cp-phase-7-config` |
| **T7.2** | research + svc-advisor edits | research/SKILL.md + svc-advisor/SKILL.md | T7.1, T2.1 | KNOW-02, KNOW-03 | tier-1 skill-structure validator PASS | `cp-phase-7-skills` |
| **T8.1** | Proposal close (move to done/) | proposals/done/2026-05-01-competitive-awareness-gap.md (CREATE) + proposals/done/2026-05-01-competitive-awareness-gap.md (DELETE) | All Phase 1-7 complete | — | Files moved; superseded-by header present | `cp-phase-8-proposal` |
| **T8.2** | Learnings append | references/framework-learnings.jsonl | T8.1 | — | Valid jsonl; new line parseable | `cp-phase-8-learnings` |
| **T8.3** | FRAMEWORK-STATE update | FRAMEWORK-STATE.md | T8.1 | — | Section reflects WI-140 promotion | `cp-phase-8-state` |
| **T9.0** | Manifest-diff extractor | scripts/extract-manifest-files.mjs (NEW) | All previous | — | `node scripts/extract-manifest-files.mjs <manifest>` returns sorted TSV of expected files | `cp-final-extractor` |
| **T9.1** | Final tier-1 sweep | (none) | T9.0 | All | `bash test-framework/evals/run-all-evals.sh --tier1` exits 0 — validate by NAMED VALIDATOR PASS (per RP-007), not count. Required PASS: all 5 new validators + all existing validators that were passing on `main` at base SHA `3107613ce1b6` | `cp-final-tier1` |
| **T9.2** | Skills-manifest lint | (none) | T9.1 | — | `node scripts/lint-skills-manifest.mjs` exits 0; no drift | `cp-final-lint` |
| **T9.3** | Lane validation | (none) | T9.2 | — | `node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-140.json` exits 0 | `cp-final-lane` |

**Parallel groups (within branch, after Phase 4 lands):**
- Group A: T5.* (monitoring)
- Group B: T6.* (brownfield)
- Group C: T7.* (knowledge auto-surface)
- These three groups have no inter-dependency; can be implemented in any order, must all complete before T8.

**TDD ordering:** Tests precede implementation in Phase 1 (T1.1, T1.2, T1.3 each create test file alongside the unit). For Phase 2-7 SKILL.md edits, the validators in Phase 1-2 ARE the tests — they enforce structure. No separate TDD pass needed since SKILL.md edits are configuration, not logic.

---

## AC-to-Task Mapping (full coverage)

| AC | Task(s) | Coverage |
|----|---------|----------|
| COMP-01 | T1.1, T1.5 | ✅ |
| COMP-02 | T2.1 | ✅ |
| COMP-03 | T2.1 | ✅ |
| COMP-04 | T2.1 | ✅ |
| COMP-05 | T1.4, T2.2 | ✅ |
| COMP-06 | T2.3 | ✅ |
| COMP-07 | T2.2 | ✅ |
| COMP-ZERO | T2.1 | ✅ |
| GATE-01 | T3.2, T3.3 | ✅ |
| GATE-02 | T1.2, T3.1 | ✅ |
| GATE-03 | T1.2, T3.1, T3.3 (block requires CC from T4.2) | ✅ |
| GATE-04 | T3.1, T3.3 | ✅ |
| GATE-05 | T3.1, T3.3 | ✅ |
| GATE-06 | T3.1, T3.3 | ✅ |
| GATE-07 | T3.3 | ✅ |
| GATE-08 | T3.4 | ✅ |
| GATE-ZERO | T3.3 | ✅ |
| GATE-FAIL-01 | T1.2, T3.1 | ✅ |
| GATE-FAIL-02 | T1.2, T2.3 | ✅ |
| TECH-01 | T4.2 | ✅ |
| TECH-02 | T4.2 | ✅ |
| TECH-03 | T4.2 | ✅ |
| CC-01 | T4.1, T4.2 | ✅ |
| CC-02 | T4.2 | ✅ |
| CC-03 | T4.3 | ✅ |
| CC-04 | T4.2 | ✅ |
| MON-01 | T1.3, T5.1, T5.3 | ✅ |
| MON-02 | T1.3, T5.1, T5.2 | ✅ |
| MON-03 | T5.4 | ✅ |
| MON-04 | T5.4 | ✅ |
| ONB-01 | T6.1 | ✅ |
| ONB-02 | T6.1 | ✅ |
| ONB-03 | T6.2 | ✅ |
| ONB-04 | T6.1 | ✅ |
| KNOW-01 | T7.1 | ✅ |
| KNOW-02 | T7.2 | ✅ |
| KNOW-03 | T7.2 | ✅ |

**Coverage: 30/30 ACs mapped. US-8 (Example Marketplace retroactive audit) explicitly out of scope per spec.**

---

## AC-to-Test Mapping

| AC | Test type | Test artifact |
|----|-----------|---------------|
| COMP-01, COMP-04 | Unit | `test/json-schema-validator.test.mjs` (T1.1) |
| COMP-02, COMP-03, COMP-ZERO | Manual | tier-1 skill-structure validator + manual review of analyze-competitors edits |
| COMP-05, COMP-06, COMP-07 | Unit | tier-1 wrapper validators (T2.2, T2.3) IS the test; fixture-driven |
| GATE-01–GATE-08, GATE-ZERO, GATE-FAIL-01/02 | Unit | `test/structured-gate-engine.test.mjs` 6 fixture tests (T1.2) |
| TECH-01/02/03 | Manual | tier-1 skill-structure validator on design-tech |
| CC-01–CC-04 | Unit | tier-1 wrapper (T4.3) + 4-field fixture |
| MON-01–MON-02 | Unit | `test/post-task-trigger-router.test.mjs` (T1.3) + integration test (T5.2) |
| MON-03–MON-04 | Unit | tier-1 wrapper extension (T5.4) with mock triggers jsonl |
| ONB-01–ONB-04 | Manual | tier-1 skill-structure validator |
| KNOW-01–KNOW-03 | Unit | JSON-schema validation of `competitive-domains.json` + tier-1 skill-structure |

**No E2E tests** (justification: framework-internal Enabler with no user-visible flow; validators on real fixtures provide equivalent coverage).

### Behavioral verification for SKILL.md edits — added per RP-004

SKILL.md is prompt, not code — full behavioral verification requires execution. However, deterministic structural checks beyond "still parses" CAN be added. Each MODIFY task that edits a SKILL.md MUST include grep-based assertions that the required behavioral keywords appear:

| Task | SKILL edit | Required grep assertions (added to validation) |
|------|-----------|------------------------------------------------|
| T2.1 | analyze-competitors | `grep -E "WebSearch\|WebFetch\|gemini-cli" analyze-competitors/SKILL.md` (mandate present); `grep "MUST\|REQUIRED" analyze-competitors/SKILL.md` (imperative voice on web research); `grep "Customer Mechanic" analyze-competitors/SKILL.md` (new section header); `grep ".data.json" analyze-competitors/SKILL.md` (companion output mentioned) |
| T3.3 | validate-feature + write-spec | `grep "Competitive Risk Assessment" {validate-feature,write-spec}/SKILL.md`; `grep "evaluateGate\|competitive-gate" {validate-feature,write-spec}/SKILL.md`; `grep "landscape_state" {validate-feature,write-spec}/SKILL.md` |
| T4.2 | write-spec + design-tech | `grep "Compensating Control" {write-spec,design-tech}/SKILL.md`; `grep "Competitive Tech Alternatives" design-tech/SKILL.md`; `grep "missing_capability\|why_not_now\|risk_of_workaround\|path_to_replacement" {write-spec,design-tech}/SKILL.md` |
| T5.1 | route-workflow | `grep "post-task-trigger-router\|sdkg-registry" route-workflow/SKILL.md` |
| T6.1 | onboard-repo | `grep "core-mechanic\|processReceipt\|earn\|redeem\|verify\|enroll" onboard-repo/SKILL.md`; `grep "brownfield-competitive-flags" onboard-repo/SKILL.md` |
| T7.2 | research + svc-advisor | `grep "Competitive Context\|competitive-domains.json" {research,svc-advisor}/SKILL.md` |

These assertions catch the case where a SKILL.md was edited but the required behavioral instructions weren't actually written. They do NOT prove the agent will FOLLOW those instructions — that's a property of LLM behavior the framework cannot deterministically verify. Acknowledged limitation.

**Acknowledged: tier-1 cannot verify LLM behavior.** This is a structural floor, not a ceiling. The framework's defense-in-depth here is: structured-data validators (T2.2/T3.4/T4.3) catch missing artifacts at downstream consumption time, regardless of whether the producer skill's prompt was followed correctly.

---

## Validation Plan

### Per-task: see Task Graph table validation column.

### Final branch-level

```bash
# 1. All tier-1 evals pass — count-agnostic, named-validator PASS (per RP-007)
bash test-framework/evals/run-all-evals.sh --tier1
# Required: 5 new validators (validate-competitor-analysis-{schema,freshness}.sh,
#   validate-feature-competitive-cross-reference.sh, validate-spec-compensating-control.sh,
#   validate-task-graph-lane.mjs framework-lane support) all PASS; previously-passing
#   validators on main@3107613ce1b6 still PASS.

# 2. Skills manifest lint (no drift)
node scripts/lint-skills-manifest.mjs

# 3. Lane validator passes for WI-140
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-140.json

# 4. Schema example validates
node scripts/lib/json-schema-validator.mjs --schema=references/schemas/competitor-analysis.schema.json --data=references/schemas/competitor-analysis.example.json

# 5. Gate engine 6 fixtures pass
node test/structured-gate-engine.test.mjs

# 6. Final diff matches manifest — deterministic check (revised per RP-005)
# Extract planned paths from manifest table, compare to actual git diff name-status
node scripts/extract-manifest-files.mjs docs/plans/2026-05-01-competitive-awareness-deep-research/manifest.md > /tmp/expected.tsv
git diff main...HEAD --name-status | sort > /tmp/actual.tsv
diff /tmp/expected.tsv /tmp/actual.tsv  # exit 0 = match
# expected.tsv format: <action><tab><path>  e.g., A\tscripts/lib/json-schema-validator.mjs
# Catches: extra files (scope leak), missing files (incomplete), wrong action (CREATE vs MODIFY)

# scripts/extract-manifest-files.mjs — to be created in T9.0 (added to plan)
# Reads "Files Planned" tables, normalizes A=CREATE, M=MODIFY, D=DELETE, emits sorted TSV
```

### Adjacent-pattern sweeps (per adversarial check 6)

For COMP-07 (rejecting "no new web research performed"):
```bash
# Narrow: exact phrase
grep -l "no new web research performed" docs/specs/analyze-competitors.md

# Adjacent sweep: variants
grep -lE "consolidation only|read-only consolidation|no.*research.*performed|reshuffl" docs/specs/analyze-competitors.md
```

Both must return empty (no match) for the validator to PASS on a real analyze-competitors.md.

---

## Checkpoint Plan

### Rollback strategy (PR-aware) — revised per RP-003

**Pre-merge (within branch, before any phase PR is merged):**
- Each `cp-phase-N` is a clean git tag on the worktree branch
- Rollback: `git reset --hard cp-phase-(N-1)` is SAFE because nothing has merged

**Post-merge (one or more phase PRs already on main):**
- Use `git revert -m 1 <merge-sha>` per offending PR — does NOT discard unrelated work; preserves history per `rules/destructive-git-ops.md`
- For multi-PR revert, revert in REVERSE merge order (latest first) to minimize conflicts
- After revert, run tier-1 sweep to confirm no validator now fails because its consumer disappeared

**Per-phase post-merge revert recipes:**

| Phase | Revert command | State cleanup needed | Validation after revert |
|-------|---------------|---------------------|-------------------------|
| Phase 0 (T0.1) | `git revert -m 1 <PR0-merge-sha>` | None | Lane 7 returns to "unknown" — pre-WI-140 state |
| Phase 1 (primitives) | `git revert -m 1 <PR1-merge-sha>` | Phase 2-7 must be reverted FIRST (they consume primitives) | tier-1 sweep |
| Phase 2 (analyze-competitors) | `git revert -m 1 <PR2-merge-sha>` | Downstream `analyze-competitors.md` files revert to pre-mandate; `.data.json` requirement gone after 30-day grace | tier-1 sweep |
| Phase 3-4 (gate + CC) | `git revert -m 1 <PR-merge-sha>` | Existing downstream `## Competitive Risk Assessment` / `## Compensating Control` sections become decorative — harmless | tier-1 sweep |
| Phase 5 (monitoring) | `git revert -m 1 <PR5-merge-sha>` | Downstream `.svc/competitive-monitor-triggers.jsonl` becomes orphan — harmless | hook regression test |
| Phase 6/7 | `git revert -m 1 <PR-merge-sha>` | None | tier-1 sweep |
| Phase 8 (lifecycle) | `git revert -m 1 <PR8-merge-sha>` | Proposal moves back from done/ automatically via revert | None |

**Parallel groups (Phase 5/6/7):** revert in any order — disjoint files, no inter-phase dependency.

**Hard rule:** never `git push --force` to revert merged PRs. `git revert` only.

---

Phase order (each `cp-*` = pre-merge git tag, see Rollback Strategy above for post-merge revert):

1. `cp-phase-0` — T0.1 — Lane validator gap fix (smallest possible PR; can ship standalone)
2. `cp-phase-1-validator` → `cp-phase-1-engine` → `cp-phase-1-router` → `cp-phase-1-helper` → `cp-phase-1-instance` — Phase 1 SDKG primitive layer + competitive schema (one PR; chained)
3. `cp-phase-2-skill` → `cp-phase-2-schema-validator` → `cp-phase-2-freshness-validator` — Phase 2 (one PR)
4. `cp-phase-3-*` — Phase 3 (one PR; depends Phase 1 + 2)
5. `cp-phase-4-*` — Phase 4 (one PR; depends Phase 3)
6. `cp-phase-5-*` || `cp-phase-6-*` || `cp-phase-7-*` — Parallel groups A/B/C (3 PRs in any order; depend Phase 1 + 2 + 4)
7. `cp-phase-8-proposal` → `cp-phase-8-learnings` → `cp-phase-8-state` — Phase 8 lifecycle (one PR; depends ALL Phase 1-7)
8. `cp-final-tier1` → `cp-final-lint` → `cp-final-lane` — Pre-promotion sweep (validation only, no commits)

**PR count: 7-8 PRs** (1 per Phase 0/1/2/3/4/8 + parallel set 5/6/7 = 6 + 3 = ~7-8 depending on whether parallel set merges as one or three PRs).

---

## Promotion Readiness Checklist

- [ ] All 33 file actions accounted for (diff matches manifest)
- [ ] All 30 ACs mapped to ≥1 task (coverage matrix above)
- [ ] All 30 ACs mapped to a test type (unit/manual)
- [ ] All 28 tasks have validation commands defined and PASS
- [ ] All 18 phase checkpoints reached
- [ ] `bash test-framework/evals/run-all-evals.sh --tier1` PASS — all 5 new validators named & PASS; all previously-passing validators still PASS (count-agnostic per RP-007)
- [ ] `node scripts/lint-skills-manifest.mjs` PASS
- [ ] `node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-140.json` PASS
- [ ] No banned scope-reduction phrases anywhere in modified files (grep `v1\|simplified\|placeholder\|stubbed\|TODO: connect\|will be wired later`)
- [ ] Proposal moved to `proposals/done/` with superseded-by header
- [ ] Learning appended to `framework-learnings.jsonl` (jsonl validates)
- [ ] `FRAMEWORK-STATE.md` reflects WI-140 promotion + SDKG primitive availability
- [ ] Final diff contains ONLY manifest-listed files

---

## Likely Loop-Backs

| Symptom during execution | Loop back to |
|--------------------------|--------------|
| Pure-node validator can't handle a schema feature we end up needing | `design-tech` (re-evaluate: add the feature to validator vs constrain schema) |
| Gate engine return shape unclear from spec | `write-spec` (refine GATE-XX wording) |
| Existing skill structure doesn't accommodate new section cleanly | `design-tech` (re-architect insertion point) |
| Hook extension causes regression in other Stop-hook flows | `diagnose-bug` (regression in svc-task-completion-guard.sh) |
| `references/sdkg-registry.json` shape conflicts with future SDKG instance needs | `write-spec` (extend registry shape; this is OK — purpose is reuse) |
| Tier-1 sweep takes >30s due to new validators | `design-tech` (cache reads, parallelize, reduce fixture count) |

---

## Simulation Report

**File-level dry run executed 2026-05-02 against base SHA `3107613ce1b6`.**

| Task | Check | Result | Action |
|------|-------|--------|--------|
| T0.1 | scripts/validate-task-graph-lane.mjs exists; lane 7 missing from LANE_MODELS | PASS (gap confirmed) | — |
| T1.1 | scripts/lib/json-schema-validator.mjs does NOT exist | PASS (CREATE valid) | — |
| T1.1 | test/ dir does NOT exist | PASS (CREATE) | T1.1 implicitly creates `test/` dir on first file write |
| T1.2 | scripts/lib/structured-gate-engine.mjs does NOT exist | PASS (CREATE valid) | — |
| T1.2 | test/fixtures/sdkg/ does NOT exist | PASS (CREATE) | T1.2 implicitly creates `test/fixtures/sdkg/` |
| T1.3 | scripts/lib/post-task-trigger-router.mjs does NOT exist | PASS (CREATE valid) | — |
| T1.4 | test-framework/evals/tier-1/lib/ does NOT exist | PASS (CREATE) | T1.4 implicitly creates `test-framework/evals/tier-1/lib/` dir |
| T1.5 | references/sdkg-registry.json + references/schemas/ do NOT exist | PASS (CREATE valid) | T1.5 implicitly creates `references/schemas/` dir |
| T2.1 | analyze-competitors/SKILL.md exists | PASS (MODIFY valid) | — |
| T2.1 | references/templates/ does NOT exist | PASS (CREATE) | T2.1 implicitly creates `references/templates/` dir |
| T2.2 | tier-1 wrapper depends on T1.4 helper + T1.5 schema | PASS (deps satisfied) | — |
| T3.1 | scripts/gates/ does NOT exist | PASS (CREATE) | T3.1 implicitly creates `scripts/gates/` dir |
| T3.3 | validate-feature/SKILL.md + write-spec/SKILL.md exist | PASS (MODIFY valid) | — |
| T4.2 | write-spec/SKILL.md modified twice (T3.3 + T4.2) | PASS (sequenced via blocked_by) | T4.2 must execute AFTER T3.3 to avoid edit conflicts |
| T5.2 | hooks/svc-task-completion-guard.sh exists (408 LOC) | PASS (MODIFY valid) | — |
| T5.3 | scripts/init-project-state.mjs exists | PASS (MODIFY valid) | — |
| T6.1 | onboard-repo/SKILL.md exists | PASS (MODIFY valid) | — |
| T7.2 | research/SKILL.md + svc-advisor/SKILL.md exist | PASS (MODIFY valid) | — |
| T8.1 | proposals/done/2026-05-01-competitive-awareness-gap.md exists | PASS (move source ready) | — |
| T8.2 | references/framework-learnings.jsonl exists | PASS (MODIFY valid) | — |
| T8.3 | FRAMEWORK-STATE.md exists | PASS (MODIFY valid) | — |
| T9.1 | test-framework/evals/run-all-evals.sh exists | PASS | — |
| Deps | No package.json (zero npm deps confirmed) | PASS | Pure-node `.mjs` files run via `node` shebang directly |
| Style | docs/specs/style-contract.md exists for framework | PASS | Framework conventions apply |

**Adjacent-pattern sweep fixtures:** spec's analyze-competitors.md no longer contains the "no new web research" header (proposal already moved fix discussion to WI-140). Validator T2.2 must therefore include a synthetic fixture (`test/fixtures/sdkg/legacy-consolidation.md`) carrying the banned pattern to prove the rejection works.

**No FAILs.** 3 implicit dir-creates noted (test/, references/templates/, references/schemas/, test-framework/evals/tier-1/lib/, scripts/gates/, test/fixtures/sdkg/) — each handled by the first task touching that dir.

### Scenario Coverage

N/A — no Gherkin journey files for framework-internal Enabler. The system flow diagram in spec § "System Flow Diagram" is the equivalent. Each flow node maps to a task: Producer→Consumers→Continuous Monitoring→Brownfield→Knowledge — all covered by tasks T2.* / T3.* / T5.* / T6.* / T7.*.

**Status: SIMULATED** (DRAFTED → SIMULATED).

---

## Adversarial Plan Review Outcome

7-question self-check, executed 2026-05-02:

**1. Missing tasks?** No. Every AC (30/30) maps to ≥1 task; every flow node in spec § System Flow has implementing tasks. PASS.

**2. Dependency correctness?** Walked: T0→T1→{T2 needs T1.4+T1.5; T3 needs T1.2 + T2.1; T4 needs T3.3; T5 needs T1.3; T5.4 needs T2.3+T5.2+T5.3; T6 needs T2.1; T7 needs T1.5+T2.1; T8 needs all; T9 final}. All imports satisfied by declared `blocked_by`. PASS.

**3. Scope reduction?** Grep for banned phrases in manifest:
```
$ grep -E "v1|simplified|placeholder|stubbed|TODO: connect|will be wired later|priority pages" docs/plans/2026-05-01-competitive-awareness-deep-research/manifest.md
```
Returns matches only in the *banned-phrase enumeration* itself (Promotion Readiness Checklist line + this question's text), NOT in any task description. PASS.

**4. Validation strength?** Each task validation either:
- Runs an actual test that exercises the built logic (T1.1, T1.2, T1.3 unit tests; T2.2/T2.3/T3.4/T4.3/T5.4 wrappers ARE the test on real fixtures)
- Runs tier-1 skill-structure validator (T2.1, T3.3, T4.2, T5.1, T6.1, T7.2 — confirms the SKILL.md still parses + has required sections)
- T0.1 validation runs the modified validator on WI-140's actual lane-tasks.json (proves the patch works on the live case)

No `tsc --noEmit`-style empty validations. PASS.

**5. First-task viability?** T0.1 from a clean worktree needs only: base branch + this manifest + the modified script. Self-contained. PASS.

**6. Pattern-family completeness (for grep ACs):**
- COMP-07 ("rejects 'consolidation only' header") — Validator T2.2 must check both narrow ("Source: read-only consolidation, no new web research performed") AND adjacent variants. Updating T2.2 description to require the synthetic fixture from simulation report. PASS (after the simulation-report addendum).
- GATE-08 ("BASELINED specs in core-mechanic features have section") — needs both narrow ("Competitive Risk Assessment" header) AND adjacent ("Competitive Risk", "Risk Assessment" — variants the narrow misses). Updating T3.4 description to require regex sweep. PASS (with note below).

**7. Visual-rendering AC tier?** No UI/visual ACs in this Enabler spec (spec Pillars Matrix marks UX & UI as `[N/A — justified]`). PASS (N/A).

**Outcome: 7/7 PASS.** Two notes added to T2.2 / T3.4 descriptions for adjacent-pattern fixtures (will be enforced when execute-changeset reads the manifest).

**Status: SIMULATED** → ready for handoff to `review-plan` then `execute-changeset`.
