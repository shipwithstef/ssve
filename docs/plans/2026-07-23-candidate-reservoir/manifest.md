# WI-508 Candidate Reservoir Implementation Manifest

**Feature spec:** `docs/specs/features/candidate-reservoir.md`
**Master design:** `docs/specs/plans/CANDIDATE_HARNESS_PLAN.md`
**Branch:** `framework-WI-508-candidate-reservoir-triage`
**Status:** CHANGE-SET-APPROVED
**Base branch / SHA:** `origin/main` / `4a586240ad3b52946627565d1ee5c6af4a295e52`
**Created:** 2026-07-23
**Execution mode:** `inline`
**Archetype:** bounded feature
**Delivery tier:** full

## Implementation Summary

Create one Node CLI that validates/imports candidate mirrors into scoped native SQLite, evaluates repository-contained target paths, ranks with the exact `/cos` formula, transitions candidates terminally, projects decisions through a durable outbox to the framework JSONL ledger, and exports deterministic Git mirrors. Commit a portable 50-item consumer-experience pool and a hermetic Tier-1 validator that exercises all public commands and cross-storage failure seams.

Invariants:

- No network, Supabase, customer database, package dependency, implicit WI creation, or target-file content read/write.
- Every candidate statement binds `project_id`, `item_scope`, and `candidate_id` as appropriate.
- Imported derived values are ignored; grounding and composite are recomputed.
- Terminal state is monotonic; identical retries heal projections; conflicts fail closed.
- Stored mirror paths are repository-relative and re-contained under the current real root.
- Existing unrelated framework/Gemini residue is preserved, classified, and cleaned through an auditable stash rather than discarded.

## Files Planned

| File | Action | Task | Purpose |
|---|---|---|---|
| test-framework/evals/tier-1/validate-candidate-harness.sh | CREATE | task-1-proof | Hermetic public-CLI, schema, formula, containment, recovery, and isolation proof |
| docs/specs/candidates/consumer-experience-pool.json | CREATE | task-1-proof | Top-level object with `schema_version`, `topic`, `project_id`, `item_scope`, and a `candidates` array of exactly 50 records whose `id` values are CAND-001..050 |
| `scripts/candidate-harness.mjs` | CREATE | task-2a-core, task-2b-rank, task-2c-triage | CLI, resolver, SQLite schema/store, grounding, scoring, outbox, mirror export |
| `docs/specs/features/candidate-reservoir.md` | CREATE | task-3-closeout | Bind AC test references/status after focused proof |
| `docs/specs/journeys/J-FW-06-candidate-reservoir-triage.feature.md` | CREATE | task-3-closeout | Replace planned proof wording with implemented/local evidence |
| `docs/specs/plans/CANDIDATE_HARNESS_PLAN.md` | CREATE | task-3-closeout | Mark implemented architecture/probe results |
| `docs/specs/contract-maps/candidate-triage-projection.md` | CREATE | task-3-closeout | Mark confirmation/falsification probes verified |
| `docs/specs/work-items/WI-508.md` | CREATE | task-3-closeout | Record execution/review/validation state |
| `FRAMEWORK-STATE.md` | MODIFY | task-3-closeout | Register framework capability and current evidence |
| `references/knowledge/svc/CAPABILITIES.md` | MODIFY | task-3-closeout | Add native candidate reservoir capability to the SVC knowledge registry |
| proposals/done/2026-07-23-framework-improvement-candidate-reservoir.md | CREATE | task-3-closeout | Preserve proposal history with completion evidence |
| `.svc/pipeline-decisions.jsonl` | MODIFY | all lane tasks | Commit canonical rows already emitted by their owning skills; task-3 performs no manual append |
| `.svc/session-contract.jsonl` | MODIFY | route-workflow only | Commit the existing canonical WI session/worktree authority row; task-3 performs no manual append |
| `.svc/lane-tasks-WI-508.json` | CREATE | all lane tasks | Cross-host graph created during routing; every skill records status/phases, and closeout commits accumulated receipts |
| `docs/specs/decisions/candidate-reservoir.md` | CREATE | planning artifact | Alternatives and choices |
| `docs/specs/features/candidate-reservoir-questions.md` | CREATE | planning artifact | Forty-question product/system agreement bank |
| `docs/specs/journeys/JOURNEY_INDEX.md` | MODIFY | planning artifact | Register J-FW-06 |
| `docs/specs/explorations/candidate-reservoir/PROBLEM_BRIEF.md` | CREATE | planning artifact | AC-derived exploration criteria |
| `docs/specs/explorations/candidate-reservoir/SOLUTION_MAP.md` | CREATE | planning artifact | Three paradigms and six approaches |
| `docs/specs/explorations/candidate-reservoir/ANALYSIS.md` | CREATE | planning artifact | AC trade-off matrix |
| `docs/specs/explorations/candidate-reservoir/COMPARISON.md` | CREATE | planning artifact | Prototype outcomes |
| `docs/specs/explorations/candidate-reservoir/DECISION.md` | CREATE | planning artifact | Selected baseline and runner-up |
| `docs/specs/explorations/candidate-reservoir/prototypes/sqlite-outbox-probe.mjs` | CREATE | planning artifact | Outbox crash/replay prototype |
| `docs/specs/explorations/candidate-reservoir/prototypes/json-file-probe.mjs` | CREATE | planning artifact | JSON lost-update prototype |
| `docs/plans/2026-07-23-candidate-reservoir/manifest.md` | CREATE | planning artifact | This execution contract |
| `docs/plans/2026-07-23-candidate-reservoir/review-log.yaml` | CREATE | planning artifact | Canonical plan-review findings, responses, and terminal decision |
| `docs/plans/2026-07-23-candidate-reservoir/tier1-baseline.log` | CREATE | planning artifact | Pre-implementation aggregate Tier-1 result |
| docs/plans/2026-07-23-candidate-reservoir/tier1-after.log | CREATE | task-3-closeout | Post-implementation aggregate Tier-1 result for mechanical delta comparison |
| docs/specs/test-evidence/WI-508/pre-post-evidence.json | CREATE | task-3-closeout | Machine-checked missing-harness red to full focused green comparison |
| docs/specs/reviews/candidate-reservoir-exec-cross-model.md | CREATE | review-exec | Human-readable G6 external-review findings, evaluations, fixes, and verdict |
| docs/specs/reviews/candidate-reservoir-exec-review-log.yaml | CREATE | review-exec | Machine-checked G6 adversarial-round count and bounded dispositions |
| docs/specs/reviews/candidate-reservoir-cross-model.md | CREATE | review-cross-model | Dedicated security-sensitive lens over the canonical G6 cross-family findings and receipts |

The inline orchestrator has the full BASELINED design and will implement directly; §3a code blueprints are intentionally omitted under the recorded `inline` execution mode. The 18 entries in the cross-host lane graph represent routed skill gates; the five tasks below are implementation checkpoints inside execute-changeset. The accepted proposal began as an untracked planning artifact and was relocated by the closeout patch, so only its durable `proposals/done/` path belongs to the Git changeset.

.svc/company-link.json is a machine-local, ignored optional input. The implementation reads its `app_id` but neither creates nor commits it.

## Task Graph

### task-1-proof — Seed contract and failing-first focused validator

- Files: seed JSON; focused validator.
- Dependencies: none.
- ACs: CAND-01..06, GROUND-01..06, SCORE-01..06, TRIAGE-01..06, ISOLATE-01..07.
- Work: author exactly 50 valid records and a portable Bash harness using temporary repositories, `SVC_CANDIDATE_DB`, and `SVC_CANDIDATE_DECISIONS`; assert missing implementation fails first, then retain the same proof for task 2.
- Deterministic seed grounding: CAND-001..010 each declare `target_files: ["README.md"]` (1/1 in the repository); CAND-011..050 each declare one distinct `src/candidates/CAND-NNN.mjs` path (0/1). The byte-exact top-10 fixture therefore has a stable grounding dimension independent of directory enumeration.
- Validation: `bash -n test-framework/evals/tier-1/validate-candidate-harness.sh` and a Node seed-schema/count check; the public harness portion is expected red before task 2.
- Checkpoint: validated worktree state `wi-508-proof-contract`; do not commit until the single final receipt-bearing commit.
- Parallel group: sequential foundation.

### task-2a-core — Implement CLI, identity, and SQLite core

- Files: `scripts/candidate-harness.mjs`.
- Dependencies: task-1-proof.
- ACs: CAND-04; SCORE-01..02; ISOLATE-01..05, ISOLATE-07 schema/contention foundation.
- Work: strict mutually-exclusive argv grammar, root/project identity precedence, environment overrides, mirror schema validation, `DatabaseSync` availability error, scoped schema version 1 migration, prepared statements, bounded busy handling, and cleanup. Import `withStateLock` from the exact existing path `scripts/state-io.mjs`; do not use a nonexistent `scripts/lib/state-io.mjs` path.
- Validation: `CANDIDATE_TEST_GROUP=core bash test-framework/evals/tier-1/validate-candidate-harness.sh`.
- Checkpoint: validated worktree state `wi-508-harness-core`; do not create a non-exempt intermediate commit.
- Parallel group: sequential implementation A.

### task-2b-rank — Implement import, grounding, scoring, and output

- Files: `scripts/candidate-harness.mjs`.
- Dependencies: task-2a-core.
- ACs: CAND-01..06, GROUND-01..06, SCORE-01..06, ISOLATE-03..06.
- Work: additive scoped import with transactional refusal of same-scope cross-mirror reassignment; metadata-only lexical + `realpath` target containment; exact `validCount / totalCount`; unrounded composite formula; total ordering by composite DESC then candidate `id` ASC as the sole secondary key; two-decimal display; deterministic project/scope/source mirror export. The focused validator contains a byte-exact expected top-10 fixture inline, including a deliberate composite-score tie whose lower candidate ID must appear first.
- Validation: `CANDIDATE_TEST_GROUP=rank bash test-framework/evals/tier-1/validate-candidate-harness.sh` and the exact user top-10 command with isolated state.
- Checkpoint: validated worktree state `wi-508-harness-rank`; do not create a non-exempt intermediate commit.
- Parallel group: sequential implementation B.

### task-2c-triage — Implement terminal transitions and cross-storage recovery

- Files: `scripts/candidate-harness.mjs`.
- Dependencies: task-2b-rank.
- ACs: TRIAGE-01..06, ISOLATE-05..07 plus retry/mirror aspects of CAND-03.
- Work: unambiguous scoped lookup, exact WI grammar, monotonic promote/reject transitions, deterministic SHA-256 event IDs, SQLite outbox, locked JSONL event-ID dedupe, repository-relative source mirror, current-root re-containment on every export, idempotent replay, and no lock/temp residue.
- Ledger resolution: `${SVC_CANDIDATE_DECISIONS}` when set, otherwise `<current-repository-root>/.svc/pipeline-decisions.jsonl`. Harness-owned candidate events append through the durable outbox; task-3 performs no separate/manual append. Every committed validator invocation sets the override to a temporary ledger.
- Validation: `CANDIDATE_TEST_GROUP=triage bash test-framework/evals/tier-1/validate-candidate-harness.sh`, the full focused validator, and both exploration probes.
- Checkpoint: validated worktree state `wi-508-harness-triage`; do not create a non-exempt intermediate commit.
- Parallel group: sequential implementation C.

### task-3-closeout — Bind proof, framework state, and accepted proposal

- Files: spec, journey, master design, contract map, WI, framework state/capabilities, proposal move, route/decision/task graph artifacts.
- Dependencies: task-2c-triage.
- ACs: all 31 evidence/status annotations; no behavioral expansion.
- Work: record implemented/local proof without claiming deployed/live state; move the accepted proposal to `proposals/done`; update capability/state registries; commit canonical append-only audit rows already emitted by their owning skills without manually appending/re-emitting them; validate all JSONL rows parse and candidate triage `event_id` values are unique; run persistence verification for the multi-file batch.
- Validation: focused validator; manifest linter; pipeline integrity; contract-map validator; journey bridge; file-persistence verification; full Tier-1 with baseline failures classified independently.
- Checkpoint: `wi-508-framework-closeout`.
- Parallel group: sequential closeout.

## AC-to-Task Mapping

| ACs | Task(s) | Implementation responsibility |
|---|---|---|
| CAND-01..06 | task-1-proof, task-2a-core, task-2b-rank | strict validation/import/rank/top; total order is unrounded composite DESC then candidate ID ASC; exact 50-seed contract |
| GROUND-01..06 | task-1-proof, task-2b-rank | metadata-only lexical + realpath containment and exact ratios |
| SCORE-01..06 | task-1-proof, task-2a-core, task-2b-rank | role/schema validation, live grounding dimension, exact unrounded sort/two-decimal display |
| TRIAGE-01..06 | task-1-proof, task-2c-triage | monotonic terminal commands, durable audit outbox, no WI/customer mutation |
| ISOLATE-01..07 | task-1-proof, task-2a-core, task-2b-rank, task-2c-triage | identity fallback, zero hardcoding, overrides, scope predicates, transactions/contention |

## AC-to-Test Mapping

| ACs | Type | Test surface |
|---|---|---|
| CAND-01..06 | E2E CLI | full rank/top, invalid matrix, re-import, tie, seed-count fixtures |
| GROUND-01..06 | E2E CLI + filesystem assertions | mixed paths, escapes, external/broken symlinks, empty targets, before/after target hash |
| SCORE-01..06 | E2E CLI | boundary/invalid authored scores, formula fixture, precision/tie, stale derived fields, output columns |
| TRIAGE-01..06 | E2E CLI + SQLite/JSONL inspection | promote/reject/retry/conflict, event count/payload, no WI/customer writes |
| ISOLATE-01..07 | E2E CLI + static scan | app_id/origin/basename, source scan, temp paths, identical IDs across projects, bounded contention |

## Prerequisite Alignment Matrix

| Task | UX/UI | Technical design | Style | Persona trace |
|---|---|---|---|---|
| task-1-proof | N/A internal CLI | Master design verification + contract-map probes | portable Bash Tier-1 conventions | S4/J-FW-06 needs explainable, retry-safe proof |
| task-2a/2b/2c | N/A internal CLI | G4-passed schema, diagrams, state machine, outbox, containment | `.mjs` shebang, explicit named functions, `scripts/state-io.mjs` `withStateLock` | S4/J-FW-06 high-volume shortlist without project leakage |
| task-3-closeout | N/A internal CLI | evidence must match BASELINED design; no expanded behavior | concise operational Markdown/state conventions | S4/J-FW-06 evidence labels distinguish local from live |

No UX, UI, design-system, Base44, provider, or browser-visible mock-parity artifact applies.

## Lane Compliance

| Skill | Status | Citation available before execution |
|---|---|---|
| route-workflow | completed | `.svc/lane-tasks-WI-508.json` task 1; `.svc/pipeline-decisions.jsonl` WI-508 route row |
| improve-framework | parent active; discovery/proposal complete | `proposals/done/2026-07-23-framework-improvement-candidate-reservoir.md`; closes after verify-promotion |
| write-spec | completed | `docs/specs/features/candidate-reservoir.md`; task 3 phase receipts |
| write-journeys | completed | `docs/specs/journeys/J-FW-06-candidate-reservoir-triage.feature.md`; task 18 receipts |
| audit-ac | completed | task 4 phase receipts and `.svc/audit-ac-self-verify.log` |
| design-tech + G4 | completed | `docs/specs/plans/CANDIDATE_HARNESS_PLAN.md`; `.svc/design-tech-g4-review.log` |
| explore-solutions | completed | `docs/specs/explorations/candidate-reservoir/DECISION.md` |
| plan-changeset | completed | this manifest; task 7 receipts |
| review-plan | in progress | task 8; `review-log.yaml` is the gate output |
| review-security | pending mandatory gate | task 12 after review-cross-model; verifies containment, ledger, SQLite, and no customer/database access |
| review-cross-model | pending mandatory gate | task 17 after review-exec; provides the required cross-model implementation review |
| execute/review/audit/test/land/verify | pending, graph-enforced | tasks 9..17 in `.svc/lane-tasks-WI-508.json` |
| design-ux, design-ui, track-visuals, test-journeys, write-e2e, Base44, audit-session, deploy | skipped | `.svc/pipeline-decisions.jsonl` WI-508 route-workflow phase 7 row; headless local CLI rationale |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem outside repo | default `~/.svc/store.db` candidate component | decoupled-justified | project/scope keys isolate rows; Git mirrors reconstruct state; explicit DB override makes tests hermetic |
| 3 | Out-of-tree/version-controlled | repository/worktree may move after import | coupled | only repository-relative `source_mirror`; every export re-resolves under current real root; moved-repo fixture |
| 8 | Database/migrations | `candidate_schema`, `candidates`, `candidate_decision_outbox` in local SQLite | coupled | idempotent ordered schema init in harness; newer version fails closed; rollback never deletes state automatically |
| 15 | Runtime filesystem | SQLite journal/locks, state-file lock, atomic mirror temp files | coupled | bounded DB timeout; `state-io.mjs` cleanup; `finally` closes DB; validator asserts no temp/lock residue |
| ad-hoc | Local config | ignored `.svc/company-link.json` read-only identity input | decoupled-justified | malformed config fails visibly; absence falls back to Git/basename; harness never writes it |

Untouched environments (taxonomy walked): 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14.

The home database intentionally outlives a branch/worktree: it is operator state, not a deploy artifact. Decoupling is safe because every row is scoped, no executable paths are stored, the current repository is re-resolved on use, and the Git mirror is the recovery/inspection path. The optional company link is likewise operator-controlled input; visible parse failure prevents silent identity drift.

## Validation Plan

Task-level:

```bash
bash -n test-framework/evals/tier-1/validate-candidate-harness.sh
CANDIDATE_TEST_GROUP=core bash test-framework/evals/tier-1/validate-candidate-harness.sh
CANDIDATE_TEST_GROUP=rank bash test-framework/evals/tier-1/validate-candidate-harness.sh
CANDIDATE_TEST_GROUP=triage bash test-framework/evals/tier-1/validate-candidate-harness.sh
bash test-framework/evals/tier-1/validate-candidate-harness.sh
node docs/specs/explorations/candidate-reservoir/prototypes/sqlite-outbox-probe.mjs
node docs/specs/explorations/candidate-reservoir/prototypes/json-file-probe.mjs
```

Final branch:

```bash
candidate_tmp="$(mktemp -d)"
SVC_CANDIDATE_DB="$candidate_tmp/store.db" SVC_CANDIDATE_DECISIONS="$candidate_tmp/decisions.jsonl" node scripts/candidate-harness.mjs --file docs/specs/candidates/consumer-experience-pool.json --top 10
node scripts/validate-system-contract-map.mjs --map docs/specs/contract-maps/candidate-triage-projection.md
node scripts/validate-cross-system-probe-evidence.mjs --evidence docs/specs/test-evidence/WI-508/pre-post-evidence.json
node scripts/verify-journey-e2e-bridge.mjs docs/specs/journeys/J-FW-06-candidate-reservoir-triage.feature.md
node scripts/lint-skills-manifest.mjs
bash test-framework/scripts/validate-pipeline-integrity.sh .
bash scripts/verify-file-persistence.sh --from-git-status
bash test-framework/evals/run-all-evals.sh > docs/plans/2026-07-23-candidate-reservoir/tier1-after.log 2>&1 || true
node - <<'NODE'
const fs = require('fs');
const parse = p => {
  const s = fs.readFileSync(p, 'utf8');
  const summary = [...s.matchAll(/^>>> Tier 1 Result: (\d+) scripts passed, (\d+) failed \((\d+) timed out\)$/gm)];
  if (summary.length !== 1) throw new Error(`${p}: missing or ambiguous Tier 1 summary`);
  const failures = [...s.matchAll(/^  FAIL: ([^ ]+\.(?:sh|mjs))(?: \(rc=\d+\)| — timed out.*)$/gm)].map(m => m[1]).sort();
  if (failures.length !== Number(summary[0][2])) throw new Error(`${p}: failure detail/summary mismatch`);
  return failures;
};
const baseline = new Set(parse('docs/plans/2026-07-23-candidate-reservoir/tier1-baseline.log'));
const added = parse('docs/plans/2026-07-23-candidate-reservoir/tier1-after.log').filter(x => !baseline.has(x));
if (added.length) throw new Error(`new Tier-1 failures: ${added.join(', ')}`);
NODE
rm -rf "$candidate_tmp"
```

The temporary directory is resolved by `mktemp -d`, used only for candidate proof, and removed after the commands. The aggregate baseline is captured before implementation and the after-run delta command must print no newly added failure line; no focused failure may be waived. `node:sqlite` warnings go to stderr and are excluded from the byte-exact stdout ranking fixture.

## Execution Command Sequence

```bash
cd /workspace/seriousvibecoding/.worktrees/framework-WI-508-candidate-reservoir-triage
git branch --show-current
git rev-parse HEAD

# Planning-time baseline: create once before any implementation file exists.
test -f docs/plans/2026-07-23-candidate-reservoir/tier1-baseline.log || bash test-framework/evals/run-all-evals.sh > docs/plans/2026-07-23-candidate-reservoir/tier1-baseline.log 2>&1 || true

# task-1-proof: apply the reviewed seed + validator patch, then prove syntax/schema.
bash -n test-framework/evals/tier-1/validate-candidate-harness.sh
node -e 'const p=require("./docs/specs/candidates/consumer-experience-pool.json"); if(!p || !Array.isArray(p.candidates)) throw new Error("expected {candidates:[]}"); const ids=p.candidates.map(x=>x.id); const want=Array.from({length:50},(_,i)=>`CAND-${String(i+1).padStart(3,"0")}`); if(ids.length!==50) throw new Error(`count ${ids.length}`); if(new Set(ids).size!==50) throw new Error("duplicate ids"); if(JSON.stringify([...ids].sort())!==JSON.stringify(want)) throw new Error("id sequence mismatch"); console.log("seed ok")'
if [[ ! -e scripts/candidate-harness.mjs ]]; then
  if bash test-framework/evals/tier-1/validate-candidate-harness.sh > /tmp/wi508-red.log 2>&1; then echo 'FAIL: validator passed with no implementation'; exit 1; fi
  grep -q 'candidate-harness.mjs' /tmp/wi508-red.log || { echo 'FAIL: validator did not attempt the harness'; exit 1; }
fi

# RECOVERY_IF_FAIL task-1: correct only the two task-1 files; do not reset or delete other residue.

# task-2a-core: CLI, identity, schema and strict validation.
CANDIDATE_TEST_GROUP=core bash test-framework/evals/tier-1/validate-candidate-harness.sh

# task-2b-rank: import, grounding, formula and total ordering.
CANDIDATE_TEST_GROUP=rank bash test-framework/evals/tier-1/validate-candidate-harness.sh
candidate_tmp="$(mktemp -d)"
SVC_CANDIDATE_DB="$candidate_tmp/store.db" SVC_CANDIDATE_DECISIONS="$candidate_tmp/decisions.jsonl" node scripts/candidate-harness.mjs --file docs/specs/candidates/consumer-experience-pool.json --top 10
rm -rf "$candidate_tmp"

# task-2c-triage: terminal state, outbox, ledger and mirror recovery.
CANDIDATE_TEST_GROUP=triage bash test-framework/evals/tier-1/validate-candidate-harness.sh
bash test-framework/evals/tier-1/validate-candidate-harness.sh

# RECOVERY_IF_FAIL task-2a/2b/2c: retain the uncommitted worktree, correct only the current task paths, and rerun that group. No checkpoint commit exists to revert.

# task-3-closeout: apply evidence/state patches; that reviewed patch relocates the
# still-untracked proposal content to proposals/done without a pre-commit git mv.
test -f proposals/done/2026-07-23-framework-improvement-candidate-reservoir.md
bash scripts/verify-file-persistence.sh --from-git-status
node scripts/lint-skills-manifest.mjs
bash test-framework/scripts/validate-pipeline-integrity.sh .
bash test-framework/evals/run-all-evals.sh > docs/plans/2026-07-23-candidate-reservoir/tier1-after.log 2>&1 || true
# Run the exact summary/detail parser from Validation Plan; it fails on a missing summary,
# a detail-count mismatch, or any validator absent from the baseline failure set.
node -e 'const fs=require("fs");const parse=p=>{const s=fs.readFileSync(p,"utf8");const m=[...s.matchAll(/^>>> Tier 1 Result: (\d+) scripts passed, (\d+) failed \((\d+) timed out\)$/gm)];if(m.length!==1)throw Error(`${p}: bad summary`);const f=[...s.matchAll(/^  FAIL: ([^ ]+\.(?:sh|mjs))(?: \(rc=\d+\)| — timed out.*)$/gm)].map(x=>x[1]).sort();if(f.length!==Number(m[0][2]))throw Error(`${p}: detail mismatch`);return f};const b=new Set(parse("docs/plans/2026-07-23-candidate-reservoir/tier1-baseline.log"));const a=parse("docs/plans/2026-07-23-candidate-reservoir/tier1-after.log").filter(x=>!b.has(x));if(a.length)throw Error(`new failures: ${a.join(", ")}`)'
node -e 'const fs=require("fs"); for(const p of [".svc/pipeline-decisions.jsonl",".svc/session-contract.jsonl"]){ for(const [i,l] of fs.readFileSync(p,"utf8").trim().split("\n").entries()) try{JSON.parse(l)}catch(e){throw new Error(`${p}:${i+1}: ${e.message}`)} }'
node -e 'const fs=require("fs");const rows=fs.readFileSync(".svc/pipeline-decisions.jsonl","utf8").trim().split("\n").map(JSON.parse).filter(x=>x.skill==="candidate-harness"&&x.event_id); if(new Set(rows.map(x=>x.event_id)).size!==rows.length) throw new Error("duplicate candidate event_id")'
git add -- \
  .gitignore \
  .svc/lane-tasks-WI-508.json .svc/pipeline-decisions.jsonl .svc/session-contract.jsonl \
  FRAMEWORK-STATE.md references/knowledge/svc/CAPABILITIES.md scripts/candidate-harness.mjs \
  test-framework/evals/tier-1/validate-candidate-harness.sh \
  docs/specs/candidates/consumer-experience-pool.json \
  docs/specs/features/candidate-reservoir.md docs/specs/features/candidate-reservoir-questions.md \
  docs/specs/journeys/J-FW-06-candidate-reservoir-triage.feature.md docs/specs/journeys/JOURNEY_INDEX.md \
  docs/specs/plans/CANDIDATE_HARNESS_PLAN.md docs/specs/contract-maps/candidate-triage-projection.md \
  docs/specs/work-items/WI-508.md docs/specs/decisions/candidate-reservoir.md \
  docs/specs/test-evidence/WI-508/pre-post-evidence.json \
  docs/specs/reviews/candidate-reservoir-exec-cross-model.md \
  docs/specs/reviews/candidate-reservoir-exec-review-log.yaml \
  docs/specs/reviews/candidate-reservoir-cross-model.md \
  docs/specs/security/candidate-reservoir-review.md \
  docs/specs/audit/candidate-reservoir-analysis.md \
  docs/specs/explorations/candidate-reservoir \
  docs/plans/2026-07-23-candidate-reservoir \
  proposals/done/2026-07-23-framework-improvement-candidate-reservoir.md
printf '%s\n' \
  .gitignore \
  .svc/lane-tasks-WI-508.json .svc/pipeline-decisions.jsonl .svc/session-contract.jsonl \
  FRAMEWORK-STATE.md references/knowledge/svc/CAPABILITIES.md scripts/candidate-harness.mjs \
  test-framework/evals/tier-1/validate-candidate-harness.sh \
  docs/specs/candidates/consumer-experience-pool.json \
  docs/specs/features/candidate-reservoir.md docs/specs/features/candidate-reservoir-questions.md \
  docs/specs/journeys/J-FW-06-candidate-reservoir-triage.feature.md docs/specs/journeys/JOURNEY_INDEX.md \
  docs/specs/plans/CANDIDATE_HARNESS_PLAN.md docs/specs/contract-maps/candidate-triage-projection.md \
  docs/specs/work-items/WI-508.md docs/specs/decisions/candidate-reservoir.md \
  docs/specs/test-evidence/WI-508/pre-post-evidence.json \
  docs/specs/reviews/candidate-reservoir-exec-cross-model.md \
  docs/specs/reviews/candidate-reservoir-exec-review-log.yaml \
  docs/specs/reviews/candidate-reservoir-cross-model.md \
  docs/specs/security/candidate-reservoir-review.md \
  docs/specs/audit/candidate-reservoir-analysis.md \
  docs/specs/explorations/candidate-reservoir/ANALYSIS.md \
  docs/specs/explorations/candidate-reservoir/COMPARISON.md \
  docs/specs/explorations/candidate-reservoir/DECISION.md \
  docs/specs/explorations/candidate-reservoir/PROBLEM_BRIEF.md \
  docs/specs/explorations/candidate-reservoir/SOLUTION_MAP.md \
  docs/specs/explorations/candidate-reservoir/prototypes/json-file-probe.mjs \
  docs/specs/explorations/candidate-reservoir/prototypes/sqlite-outbox-probe.mjs \
  docs/plans/2026-07-23-candidate-reservoir/manifest.md \
  docs/plans/2026-07-23-candidate-reservoir/review-log.yaml \
  docs/plans/2026-07-23-candidate-reservoir/tier1-after.log \
  docs/plans/2026-07-23-candidate-reservoir/tier1-baseline.log \
  proposals/done/2026-07-23-framework-improvement-candidate-reservoir.md | sort > /tmp/wi508-expected-staged.txt
git diff --cached --name-only | sort > /tmp/wi508-staged.txt
diff -u /tmp/wi508-expected-staged.txt /tmp/wi508-staged.txt
git commit -m "Baseline Candidate Reservoir framework capability" -m "SVC-Work-Item: WI-508" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>"

# execute-changeset emits its exec-record for this exact commit. The mandatory
# review-exec, review-cross-model, review-security, audit-implementation and
# test-framework tasks then emit their own receipts before land-changeset runs:
node scripts/emit-receipt.mjs --type exec-record --wi WI-508 --sha HEAD --body .svc/exec-record-WI-508.json

# RECOVERY_IF_FAIL task-3: classify focused versus aggregate failures, repair only WI-508 paths, and rerun all gates.

```

The focused validator internally creates a temporary home/state directory, exports both candidate-state overrides for every harness invocation, and asserts the real pre-test `~/.svc/store.db` presence/hash is unchanged. Bare validator calls above are therefore hermetic by construction and the aggregate Tier-1 discovery path exercises the same invariant.

There is one non-exempt implementation commit, after all worktree checkpoints pass. The owning review/audit skills emit receipts for that exact SHA before push; the displayed `check-chain-receipts` is expected to fail until those downstream receipts exist and is rerun successfully by land-changeset. `FRAMEWORK-STATE.md` is mutated only inside the active `improve-framework` lane with a targeted patch after focused proof; if the policy guard refuses it, execution stops and does not bypass the guard.

Land-changeset, outside this execute-time sequence, preserves only the two pre-existing default-checkout Gemini paths and refuses changed scope:

```bash
git -C /workspace/seriousvibecoding status --short > /tmp/wi508-default-before.txt
printf '%s\n' ' M .svc/competitive-monitor-triggers.jsonl' ' M .svc/pipeline-decisions.jsonl' > /tmp/wi508-expected-default.txt
diff -u /tmp/wi508-expected-default.txt /tmp/wi508-default-before.txt
git -C /workspace/seriousvibecoding stash push -m "pre-WI-508 Gemini residue 2026-07-23" -- .svc/competitive-monitor-triggers.jsonl .svc/pipeline-decisions.jsonl
git -C /workspace/seriousvibecoding stash show --name-only stash@{0} | sort > /tmp/wi508-stashed-paths.txt
printf '%s\n' .svc/competitive-monitor-triggers.jsonl .svc/pipeline-decisions.jsonl | sort > /tmp/wi508-expected-stash.txt
diff -u /tmp/wi508-expected-stash.txt /tmp/wi508-stashed-paths.txt
test -z "$(git -C /workspace/seriousvibecoding status --short)"
node scripts/check-chain-receipts.mjs --sha HEAD
```

Land-changeset then owns push/PR/squash. Verify-promotion recomputes receipts and replays proof on the final squash SHA.

## Checkpoint Plan

| Order | Checkpoint | Rollback anchor |
|---|---|---|
| 1 | `wi-508-proof-contract` | uncommitted validated worktree diff; repair only proof/seed paths |
| 2 | `wi-508-harness-core` | uncommitted validated worktree diff; repair harness core without discarding proof files |
| 3 | `wi-508-harness-rank` | uncommitted validated worktree diff; repair ranking paths without discarding core |
| 4 | `wi-508-harness-triage` | uncommitted validated worktree diff; repair triage paths without discarding ranking |
| 5 | `wi-508-framework-closeout` | single final commit; use a normal `git revert` if post-commit review rejects it |

Final squash promotion may replace checkpoint SHAs; chain receipts must be recomputed on the final squash SHA.

## Simulation Report

| Task | Check | Check command | Output | Result / action |
|---|---|---|---|---|
| task-1-proof | seed and validator absent | `test ! -e <each CREATE path>` | exit 0 for both | PASS; add planned layer |
| task-1-proof | Tier-1 auto-discovers shell validators | inspect `test-framework/evals/run-all-evals.sh` glob | tier-1 shell glob loop present | PASS; validator itself exports isolated state and hashes the real default DB before/after |
| task-3 | aggregate failure parser | apply the Validation Plan parser to `tier1-baseline.log` | one summary, three failure details, counts agree | PASS; parser fails closed on output-format drift |
| task-2a | harness absent | `test ! -e scripts/candidate-harness.mjs` | exit 0 | PASS (CREATE) |
| task-2a | native SQLite available | `node -e 'const {DatabaseSync}=require("node:sqlite"); const d=new DatabaseSync(":memory:"); d.close(); console.log("ok")' 2>&1` | `ok` plus ExperimentalWarning on stderr | PASS; validator diffs stdout only |
| task-2a | exact atomic helper path/exports | `node -e "import('./scripts/state-io.mjs').then(m=>console.log(Object.keys(m).sort().join(',')))"` | `NO_WRITE,appendJsonlLine,readJsonAtomic,stateIoDefaults,updateJsonAtomic,withStateLock,writeJsonAtomic,writeJsonlAtomic` | PASS; import `withStateLock` from `scripts/state-io.mjs` |
| task-2b/2c | prototypes exist | `test -f .../sqlite-outbox-probe.mjs && test -f .../json-file-probe.mjs` | exit 0 | PASS |
| task-3 | all MODIFY targets exist | targeted `test -f` over spec, journey, plan, map, WI, state, capabilities | exit 0 | PASS |
| task-3 | proposal lifecycle | inspect the accepted proposal and `proposals/done` destination before applying closeout patch | source was an untracked planning artifact; destination directory exists | PASS; closeout patch creates the durable done artifact only |
| all | new package dependency | inspect root package manifest | no root package manifest and no import outside built-ins/local helper | PASS |
| all | ORM/customer schema | scan Files Planned table | no ORM/customer path | PASS; Base44 N/A |

No unresolved FAIL or WARN remains.

## Scenario Coverage

| Journey | Scenario | Steps | Tasks | Coverage |
|---|---|---:|---|---|
| J-FW-06 | Import and inspect complete pool | 6 | task-1, task-2a, task-2b | 6/6 |
| J-FW-06 | Strongest top-N | 4 | task-1, task-2b | 4/4 |
| J-FW-06 | Invalid mirror no side effects | 5 | task-1, task-2a, task-2b | 5/5 |
| J-FW-06 | Promote into supplied WI | 5 | task-1, task-2c | 5/5 |
| J-FW-06 | Reject with reason | 5 | task-1, task-2c | 5/5 |
| J-FW-06 | Retry/conflict | 4 | task-1, task-2c | 4/4 |
| J-FW-06 | Cross-project/concurrent isolation | 6 | task-1, task-2a, task-2b, task-2c | 6/6 |

## Adversarial Self-Check

1. Missing tasks: none; every AC group and journey step maps to task-1/task-2a/2b/2c, with task-3 binding evidence.
2. Dependencies: task-1 creates the proof contract; task-2a provides schema/identity, task-2b adds ranking, task-2c adds terminal projection, and task-3 consumes full passing proof.
3. Scope reduction: no banned deferral language in task descriptions/actions/done conditions.
4. Validation: public CLI plus DB/JSONL/filesystem inspection tests behavior; aggregate validators cover framework wiring.
5. First-task viability: seed schema and portable Bash proof can be authored from spec/manifest in a clean worktree.
6. Pattern families: static no-hardcoding scan includes company/user/home/proprietary/customer-DB variants, not one literal.
7. Visual tier: N/A, no rendered surface.
8. Mock parity: N/A, no UI MODIFY.
9. Provider fidelity: N/A, no provider/generated output.
10. Persona trace: S4 and J-FW-06 appear in task alignment and test intent.

## Promotion Readiness Checklist

- [ ] All three implementation/proof files exist and match the BASELINED contracts.
- [ ] Exactly 50 unique sequential seed IDs validate.
- [ ] All 31 ACs map to task and test evidence.
- [ ] Focused validator and exact top-10 command pass with isolated state.
- [ ] Equal unrounded composites sort by candidate ID ASC and match the validator's byte-exact inline fixture.
- [ ] System Contract Map and falsification probes pass.
- [ ] tier1-after.log introduces zero named failing validator absent from tier1-baseline.log, verified by the fail-closed Node summary/detail parser.
- [ ] Candidate-harness decision `event_id` values are unique; task-3 emits no manual route/session ledger row.
- [ ] No ORM schema or migration is in scope.
- [ ] No untracked scratch files or SQLite/journal/lock/temp residue remains.
- [ ] Final diff contains only manifest-listed WI-508 files plus canonical receipt artifacts.
- [ ] Review-plan, review-exec, review-security, audit-implementation, land, and promoted replay receipts bind the final applicable tree/SHA.
