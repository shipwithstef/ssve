# Implementation Manifest — WI-556 Final-SHA Mandatory-Skill Coverage

## Header

| Field | Value |
|---|---|
| Spec | proposals/2026-08-21-framework-improvement-final-sha-mandatory-skill-coverage.md (accepted protocol; ACs AC-1..AC-10 verbatim) plus docs/specs/work-items/WI-556.md |
| Branch | feature-final-sha-skill-coverage (framework lane, worktree under .worktrees/) |
| Status | DRAFTED (lifecycle: DRAFTED → SIMULATED → EXECUTING → CHECKPOINTED → PROMOTED → VERIFIED) |
| Base branch / SHA | main @ 75986ebecabafc599c6acdcdf2617db8b91b0c4a |
| Created | 2026-08-22T07:17:46Z |
| **Execution Mode** | **inline** (WI-386) — orchestrator executes with full context loaded (checker internals, merge finalizer, receipt contract read this session); no zero-context dispatch worker planned for fail-closed receipt-authority code. Consequence: Changeset Blueprint SKIPPED per WI-386 double-spend rule. Recorded in the plan-manifest receipt mode:"inline"; absent mode fails closed to dispatch semantics, so the field is load-bearing. |
| **Risk Flags** | runtime_concurrency, external_state_writer, lossless_rmw — declared sections in adjacent plan-contract.json (verify-plan-mechanical Check 11) |

## Implementation Summary

**What changes:** SVC gains one canonical completion verdict per governed final SHA. A content-addressed skill-coverage receipt (index over the route's compiled mandatory set) is emitted into the Git note envelope on the GitHub-created squash SHA by an atomic merge-finalization contract; check-chain-receipts strictly validates any such receipt by recomputing every referenced child (never trusting the embedded verdict); a --coverage mode prints the human-readable per-skill table naming every missing/invalid entry and why it was mandatory.

**Invariants:** the five-type chain (REQUIRED_TYPES_FULL), quick-fix tiering, slot identity slot::type::wi::sha[::phase], and NOTE_REQUIRED_CONSUMERS authority rules are unchanged; emitting coverage creates no commit (AC-6); recomputation makes forged verdicts fail closed (AC-8); envelope RMW preserves sibling receipts of both shapes (lossless); no evidence-carrier bypass for mixed commits (AC-7).

**Constraints:** binary truth YES/NO/UNKNOWN-INFRA_FAILURE; AUTHORIZED_NA needs registered policy condition plus decision evidence, silence is MISSING; skill-load alone cannot satisfy phase-required tasks; receipts carry digests never secrets; enforcement arming beyond strict-validate-if-present is an explicit owner decision recorded post-replay (proposal Human Checkpoint honored).

## Architecture Decisions

| # | Decision | Rationale | Alternative rejected |
|---|---|---|---|
| D1 | Coverage receipt is an index; checker recomputes referenced children against slot identity, tree, graph digest | Tamper resistance without a new trust root (AC-8) | Trusting embedded verdict (forgeable) |
| D2 | Compiled required[] lives inside the receipt; verifyCoverage RECOMPILES the applicable set from the canonicalized commit-tree lane-tasks (sorted keys, volatile state excluded) and requires exact task_id+skill multiset equality with the receipt - digest equality is necessary, never sufficient (grok R2#2); graph source falls back to the candidate-tree blob fetched during finalization when squash tree omits it, so consumer repos that do not track .svc keep legacy behavior via emission-skip instead of permanent UNKNOWN (codex C1 refinement of cursor-agent #1); normalized-graph digests cached by blob OID plus canonicalizer version for range reconcile | Recompute anchor defeats under-compilation AND pruned-inventory forgery | Trusting digest equality alone (grok R2#2); live-file reads; per-SHA uncached tree reads in 16-worker reconcile |
| D3 | AUTHORIZED_NA validated against schema-enum conditions (no_product_surface, external_grade_addon, conditional_route_rule) plus decision-evidence digest | Conditional truth without prose-only skips (AC-3) | Free-text reason string (unfalsifiable) |
| D4 | Phase depth via producer binding: each entry names required_phases plus an evidence receipt_type drawn from a schema-enum producer map whose types are emitted only after those phases (exec-record ⇒ execute phases; review-plan ⇒ mechanical+adversarial plan phases); evidence identities are receipt slots by construction, so a skill-load artifact can never satisfy | Skill-load does not prove phases ran (AC-4) | Reading exec-record.receipt.phases[] (field absent from schemas/receipts/exec-record.schema.json — verified Pass 3); self-asserted phases arrays (forgeable prose) |
| D5 | Finalizer sequence: ONE consolidated pre-merge gh pr view snapshot (identity+provenance+freshness behindBy===0; refuse BEFORE merge on stale base) -> squash-only refusals (--auto/--rebase/--merge) -> gh pr merge from tmpdir cwd gated status===0 -> REPLACE the terminal process.exit(merge.status||0) block (grok R2#3: appending after it is dead code): immediate gh pr view --json mergeCommit,state with poll ONLY if empty (no unconditional sleep; grok R2#5) -> ONE combined git fetch refspec <oid> + refs/notes/svc-receipts -> tree EQUAL => closed identity remap (slot-key sha/target_sha/sha only) PLUS coverage slot merged in ONE envelope RMW and ONE CAS publish (grok R2#11; codex C6) -> post-merge verify once via --sha on squash OID -> exit 0 verified / exit 3 MERGED_UNVERIFIED merged-but-unverified-notes (callers branch on 3) / exit 2 pre-merge blocks; request counts logged and successful-path added latency must equal baseline wrapper + exactly 1 fetch + 1 notes publish with ZERO sleep-poll (p95 acceptance, codex C6) | Net-effective per founder mandate; no dead code; no duplicate checker runs | Unconditional polling (up to 10s/land); two CAS pushes; second full checker pass |
| D6 | Checker strict-validates presence and finalizer always emits from day one; hard-requirement cutoff deliberately deferred to owner decision recorded in FRAMEWORK-STATE after replay proof | Zero historical breakage; honors proposal Human Checkpoint; interim observation-only telemetry (merged-PR-without-coverage-note warning) recorded as FRAMEWORK-STATE Known Gaps follow-up in T6, no enforcement | REVIEW_V3_CUTOFF_SHA-style cutoff now (self-referential at own land; churn on in-flight WIs) |
| D7 | Applicable-set scope: coverage required[] = mandatory delivery chain minus verify-promotion (all producers exist pre-merge); optional/non-producer selected skills are excluded BY LANE-MODEL DEFINITION, not skipped - extending coverage to arbitrary selected skills requires new authoritative producers and is a documented future WI (codex C1/C2); verify-promotion remains governed by existing CONSUMER_REQUIRED_TYPES plus G7 | Every required entry binds to a real producer receipt type today; founder intent (#826 chain gap) preserved without retrofitting child schemas | Adding task_id/skill-digest fields to five child schemas (scope creep across nine hosts) |

## Files Planned

| Task | Title | Files | Action | Purpose |
|------|-------|-------|--------|---------|
| T1 | coverage-schema | `schemas/receipts/skill-coverage.schema.json` | CREATE | Structural contract only: required fields, policy-condition enum + policy_registry_digest + decided_at, item-count cap, total receipt byte ceiling (codex C8) |
| T2 | coverage-library | `scripts/lib/skill-coverage.mjs` | CREATE | Parses lane-tasks internally (NO task-graph CLI exec, grok R2#7); exports compileCoverage(graph)/verifyCoverage(receipt,envelope,treeGraph|null); compile table: not-selected omitted, skipped+registered condition=>NA, silence=>MISSING, chain-mandatory=>required; canonicalizer version constant |
| T3 | checker-integration | `scripts/check-chain-receipts.mjs` | MODIFY | Hook point: validate present skill-coverage immediately AFTER envelope normalize and BEFORE every early return incl. quick-fix/retroactive/consumer tiers (codex C4); presence-gated DYNAMIC import so legacy SHAs pay zero module cost (grok R2#12); no REQUIRED_TYPES_FULL change; PASSING_VERDICTS is not the hook (grok R2#1); duplicate task_id rejection; add lib to policyFingerprint inputs (grok R2#10); batch cat-file --batch graph reads keyed by blob OID (codex C5); UNKNOWN-vs-NO taxonomy; opt-in --coverage mode with default JSON byte-stable |
| T4 | merge-finalizer | `scripts/merge-pr-with-review-receipt.mjs`;`scripts/worktree.sh`;`skills/land-changeset/SKILL.md` | MODIFY | REPLACE terminal exit block with finalization sequence (grok R2#3 - appending is dead code); one RMW + one CAS publish; skip pre-merge checker when land already validated same candidate (grok R2#8); exit codes 0/2/3, callers branch on 3 |
| T5 | tier1-validator | `test-framework/evals/tier-1/validate-skill-coverage.sh`;`test-framework/fixtures/skill-coverage/envelope-composite.json`;`test-framework/fixtures/skill-coverage/envelope-legacy.json` | CREATE | Hermetic scenarios S1-S13 (S11 remap integrity both directions; S12 fetch fail-closed; S13 pruned-inventory vs recomputed-set mismatch fails); SHARED fixture repo; S5 test backoff=0 (production keeps linear backoff); mechanical stopwatch assertion failing the validator above 15s wall |
| T6 | contract-docs | `references/chain-receipt-contract.md`;`FRAMEWORK-STATE.md` | MODIFY | Register type/producer/termination; policy_registry_digest forward-compat note; fix stale staging-filename line 13; Known Gaps incl. arming decision + merged-PR-without-coverage telemetry follow-up |
| T7 | wi-meta | `docs/specs/work-items/WI-556.md`;`docs/specs/work-items/INDEX.md`;`.svc/lane-tasks-WI-556.json` | MODIFY | WI promotion record, index row, cross-host task graph |
| T8 | plan-artifacts | `docs/plans/2026-08-22-final-sha-skill-coverage/manifest.md`;`docs/plans/2026-08-22-final-sha-skill-coverage/plan-contract.json` | CREATE | This manifest and its safety contract |

## Task Graph

| ID | Title | Deps | AC coverage | Validation command | Checkpoint | Parallel group |
|----|-------|------|-------------|--------------------|------------|----------------|
| T1 | Author skill-coverage JSON Schema | — | AC-2, AC-3 | JSON.parse smoke → SCHEMA-OK | CP-T1 | g1 |
| T2 | Compile/bind/verify library | T1 | AC-1..AC-4, AC-8 | node --check plus export probe → LIB-OK | CP-T2 | g1 |
| T3 | Checker strict validation plus --coverage mode | T2 | AC-2, AC-8, AC-9 | node --check plus usage smoke → CHECKER-SMOKE-OK | CP-T3 | g2 |
| T4 | Merge finalization contract | T2 | AC-5, AC-6, AC-10 | node --check plus usage smoke → FINALIZER-SMOKE-OK | CP-T4 | g2 |
| T5 | Tier-1 validator plus RMW fixtures | T3, T4 | AC-1..AC-10 | bash test-framework/evals/tier-1/validate-skill-coverage.sh | CP-T5 | g3 |
| T6 | Contract plus state registration | T5 | AC-10 | grep anchors → DOCS-OK | CP-T6 | g3 |
| T7 | WI meta records | — | — | validate-task-graph-lane PASS plus INDEX row present | CP-PLAN | g0 |
| T8 | Plan artifacts | — | — | mechanical suite green at CP-PRELAND | CP-PLAN | g0 |

Chain obligations: framework lane requires plan-changeset → review-plan → execute-changeset → review-gate → review-exec → audit-implementation → land-changeset → verify-promotion, exactly once each, contiguous — encoded in `.svc/lane-tasks-WI-556.json` and validated PASS (12 tasks, positions 4..11 contiguous).

## Changeset Blueprint (Execution Mode inline)

SKIPPED per WI-386 — see Header. Executor sources of truth: Architecture Decisions above, proposal Protocol Contract §§1–7, and the verified MODIFY anchor map:

- scripts/check-chain-receipts.mjs: REQUIRED_TYPES_FULL @39, NOTE_REQUIRED_CONSUMERS @74, generic schema loader loadSchema() @755 (auto-discovers new type — zero registration needed), arg parsing in main() @1081.
- scripts/merge-pr-with-review-receipt.mjs: provenance block ends @189, dry-run exit @191–194, terminal gh call @199–200 (pre-merge validation inserts before it gated on flags; post-merge finalization inserts after line 200 gated on merge.status===0).

## AC-to-Task Mapping

| AC | Statement (condensed) | Tasks |
|----|-----------------------|-------|
| AC-1 | Complete inventory: every applicable mandatory task listed exactly once | T2, T5 |
| AC-2 | Binary truth: YES only when all required entries validate | T1, T2, T3 |
| AC-3 | AUTHORIZED_NA needs registered policy condition plus decision evidence; prose-only skip fails | T1, T2, T5 |
| AC-4 | Skill-load alone cannot satisfy phase-required tasks | T2, T5 |
| AC-5 | Final-SHA authority: candidate/head receipts cannot green a squash SHA; the final SHA must carry a valid note envelope | T3, T4, T5 |
| AC-6 | Natural termination: emission changes no commit tree, creates no obligation | T2, T4, T5 |
| AC-7 | No evidence bypass: mixed evidence/config commit keeps normal classifier | T4, T5, T6 |
| AC-8 | Tamper resistance: graph, child, digest, or note mutation invalidates coverage | T2, T3, T5 |
| AC-9 | Failing command names each missing/invalid skill and why mandatory | T3, T5 |
| AC-10 | Compact canonical storage: digest references, no duplicate raw artifacts | T4, T5, T6 |

Full coverage — no PARTIAL, no MISSING rows.

## AC-to-Test Mapping

| AC | Test type | Evidence |
|----|-----------|----------|
| AC-1 | Unit | tier-1 S1 subset-selection; S13 recomputed-inventory vs receipt multiset equality |
| AC-2 | Unit | tier-1 S2/S4 all-pass vs one-missing matrices |
| AC-3 | Unit | tier-1 S3 NA-policy accept plus prose-skip reject |
| AC-4 | Unit | tier-1 S3b producer-map rejects lighter-than-required evidence |
| AC-5 | Unit | tier-1 S6 green only after note publication; S9 stale-base refused BEFORE merge by behindBy gate; S11 remap keeps tree_hash byte-identical; S12 unfetched-object write fails closed |
| AC-6 | Unit | tier-1 S6 SHA identical before/after emission |
| AC-7 | Unit | tier-1 S7 mixed-commit classifier stays NO |
| AC-8 | Unit | tier-1 S4 tamper matrix; S10 deleted evidence object ⇒ UNKNOWN-INFRA_FAILURE never YES |
| AC-9 | Unit | tier-1 S2 named-skills output assertions |
| AC-10 | Unit | tier-1 S8 digest reference resolves into evidence store |

Live GitHub squash replay (proposal Replay target 3 end-to-end) is Manual at verify-promotion on a throwaway PR; hermetic S6 covers the invariant locally.

## Prerequisite Alignment Matrix

| Trace | Source | Applied to |
|-------|--------|-----------|
| Technical design | Proposal Required Product plus Protocol Contract §§1–7; manifest Architecture Decisions D1–D6 | All tasks |
| UX transitions | N/A — no UI surface; CLI verdict-table format fixed by proposal Required Product table | T3 |
| UI visual tokens | N/A — no UI surface | — |
| Style contract | Repo shell conventions (AGENTS.md §5): Node .mjs ESM with shebang, portable Bash set -euo pipefail | T2, T5 |
| Persona trace | N/A — framework chrome; stakeholder is founder requirement quoted in proposal Evidence section | All tasks |
| Journey trace | J-FW-02 unaffected; G7 closeout records replay evidence per proposal Replay Verification | T5, verify-promotion |

## Validation Plan

Task-level commands are in the Task Graph. Branch-level, before land:

```bash
bash test-framework/evals/run-all-evals.sh   # full corpus; globs the new validator automatically
node scripts/lint-skills-manifest.mjs        # cheap insurance, unchanged surface
```

Performance acceptance (founder mandate): successful sanctioned land adds exactly one object fetch plus one notes publish over today's wrapper baseline - zero sleep-poll on the happy path, zero added work on legacy SHAs (presence-gated dynamic import), enforced p95 recorded in finalization output.

Receipt obligations: every chain skill emits its canonical receipt; this skill emits plan-manifest (schema v3, ac_digests baton, mode inline) at P-final.

## Execution Command Sequence

```bash
set -euo pipefail
WI=WI-556
BASE=75986ebecabafc599c6acdcdf2617db8b91b0c4a
# trailer derives from ACTIVE orchestrator/model at commit time
TRAILER="Co-authored-by: ${SVC_TRAILER_NAME:-ox-alpha} (${SVC_TRAILER_HOST:-opencode/x-preview-f-free})"

# carry planning artifacts into the worktree branch
REPO_ROOT="$(pwd)"
bash scripts/worktree.sh create feature-final-sha-skill-coverage
cd .worktrees/feature-final-sha-skill-coverage

# re-verify MODIFY anchors before patching (main may have moved since base pin)
grep -q "REQUIRED_TYPES_FULL" scripts/check-chain-receipts.mjs && grep -q 'ghArgs.push("--squash")' scripts/merge-pr-with-review-receipt.mjs

# carry planning artifacts: they are untracked on main and ABSENT in a fresh worktree
mkdir -p docs/plans/2026-08-22-final-sha-skill-coverage docs/specs/work-items test-framework/fixtures/skill-coverage
cp "$REPO_ROOT"/docs/plans/2026-08-22-final-sha-skill-coverage/manifest.md docs/plans/2026-08-22-final-sha-skill-coverage/
cp "$REPO_ROOT"/docs/plans/2026-08-22-final-sha-skill-coverage/plan-contract.json docs/plans/2026-08-22-final-sha-skill-coverage/
cp "$REPO_ROOT"/docs/specs/work-items/WI-556.md "$REPO_ROOT"/docs/specs/work-items/INDEX.md docs/specs/work-items/
cp "$REPO_ROOT"/.svc/lane-tasks-WI-556.json .svc/lane-tasks-WI-556.json
cp -r "$REPO_ROOT"/test-framework/fixtures/skill-coverage/. test-framework/fixtures/skill-coverage/

git add docs/plans/2026-08-22-final-sha-skill-coverage docs/specs/work-items/WI-556.md docs/specs/work-items/INDEX.md .svc/lane-tasks-WI-556.json test-framework/fixtures/skill-coverage
git commit --trailer "$TRAILER" -m "chore(plan): WI-556 planning artifacts and lane task graph"

# receipt for this commit: emit directly onto its SHA (staging lives in main's .svc and is invisible to this worktree)
BODY=".svc/receipts/staging/pm-body-wi556.json"; mkdir -p "$(dirname "$BODY")"
cp "$REPO_ROOT"/.svc/receipts/staging/e0b7c7939be9ad3aba4e292265cb6c7608007580/plan-manifest--WI-556.json "$BODY"
node scripts/emit-receipt.mjs --type plan-manifest --wi WI-556 --sha "$(git rev-parse HEAD)" --body "$BODY"
git -C "$REPO_ROOT" reset -q   # unstage main index now that artifacts are carried

# deps: none beyond Node stdlib (no package.json change)

# T1+T2 (g1)
node -e 'JSON.parse(require("fs").readFileSync("schemas/receipts/skill-coverage.schema.json","utf8"))' && echo SCHEMA-OK
node --check scripts/lib/skill-coverage.mjs && node --input-type=module -e 'import("./scripts/lib/skill-coverage.mjs").then(m=>console.log(typeof m.compileCoverage==="function"&&typeof m.verifyCoverage==="function"?"LIB-OK":"LIB-MISSING"))'
git add schemas/receipts/skill-coverage.schema.json scripts/lib/skill-coverage.mjs
git commit --trailer "$TRAILER" -m "feat(receipts): skill-coverage schema and compile/verify library (WI-556)"

# T3+T4 (g2)
node --check scripts/check-chain-receipts.mjs && node --check scripts/merge-pr-with-review-receipt.mjs && bash -n scripts/worktree.sh
git add scripts/check-chain-receipts.mjs scripts/merge-pr-with-review-receipt.mjs scripts/worktree.sh skills/land-changeset/SKILL.md
git commit --trailer "$TRAILER" -m "feat(receipts): coverage verification in checker and atomic merge finalizer (WI-556)"

# T5 (g3)
bash test-framework/evals/tier-1/validate-skill-coverage.sh
git add test-framework/evals/tier-1/validate-skill-coverage.sh
git commit --trailer "$TRAILER" -m "test(tier-1): skill-coverage compile/binding/tamper/termination/concurrency fixtures (WI-556)"

# T6 (g3)
grep -q "skill-coverage" references/chain-receipt-contract.md && grep -q "WI-556" FRAMEWORK-STATE.md && echo DOCS-OK
git add references/chain-receipt-contract.md FRAMEWORK-STATE.md
git commit --trailer "$TRAILER" -m "docs(receipts): register skill-coverage type and arming decision (WI-556)"

# chain continuation
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-556.json

# RECOVERY_IF_FAIL: git stash push -u -m "WI-556-wip" (never checkout -- .);
# fix forward, re-validate, stash pop. Unrecoverable:
#   bash scripts/worktree.sh remove feature-final-sha-skill-coverage && restart.
```

## Checkpoint Plan

| Order | Checkpoint | Anchor | Rollback |
|-------|-----------|--------|----------|
| 1 | CP-PLAN | Manifest SIMULATED, mechanical suite green (deferred items closed), review-plan PASS | revert plan artifacts |
| 2 | CP-T1/T2 | schema + library commit green | git reset --soft HEAD~1 in worktree |
| 3 | CP-T3/T4 | checker + finalizer wired, smokes green | same pattern |
| 4 | CP-T5 | tier-1 validator PASS | same pattern |
| 5 | CP-T6 | docs registered, full corpus green | same pattern |
| 6 | CP-PRELAND | review-exec + audit clean, residual ≤ MEDIUM, mechanical suite re-run fully green in worktree | findings loop-back per review-gate |
| 7 | CP-LAND | squash + coverage note on final SHA + verify YES | MERGED_UNVERIFIED schedules bounded recovery (D5) |

Sequencing constraint: WI-555 (in_progress) also modifies scripts/check-chain-receipts.mjs; this branch must rebase onto or land after WI-555's chain to avoid checker merge conflicts — resolved at CP-PRELAND before review-exec.

Mechanical-gate sequencing note: C1 path-existence and C10 diff-parity can only be satisfied once CREATE targets materialize inside the worktree; they are therefore enforced as the CP-PRELAND re-run of verify-plan-mechanical plus validate-plan-contract, not waived. Structure-level fixes (headings, contract shape, concrete filenames) are applied now.

## Promotion Readiness Checklist

- [ ] Final diff contains exactly the §Files Planned set
- [ ] Every task validation executed and logged
- [ ] All 10 ACs mapped to ≥1 task and ≥1 test type
- [ ] All checkpoints named with rollback anchors
- [ ] Schema-drift check: N/A — no ORM/entity files touched (JSON receipt schema is additive, not a data-model migration)
- [ ] Tier-1 promotion note for new validator — validator_path: test-framework/evals/tier-1/validate-skill-coverage.sh; failure_class: false-completion (final-SHA coverage unobservable); promotion_signal: founder requirement plus Example Marketplace PR #826 incident (44d9cc57 merged without final-SHA note); expected_runtime_budget: at most 10s hermetic disposable repo (12 scenarios incl. S9 stale-base pre-merge refusal, S11 remap integrity, S12 fetch fail-closed, S10 UNKNOWN classification, shared fixture init); why_tier_2_or_targeted_is_insufficient: protects receipt hot path exercised by pre-push L2 and reconcile L3 on every governed commit
- [ ] plan-contract.json risk flags match manifest declaration (Check 11)
- [ ] Lane-model validation exits 0
- [ ] resource_review.denominator updated to the worktree executable census before CP-LAND

## External State

Taxonomy walk over all 15 environments of references/external-state-lifecycle-protocol.md (git refs, remotes/PR state, CI, caches, registries, env files, containers, cloud resources, external services, filesystem-outside-artifact, host config, process state, scheduled jobs, shared locks, ad-hoc). Matched:

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | ad-hoc: Git notes ref refs/notes/svc-receipts (local + remote) | skill-coverage receipt appended to existing envelope | coupled | Read authority plus validation in check-chain-receipts (note-required consumers); backup wiring in plan-contract external_writer section |
| 2 | ad-hoc: GitHub PR merge state (squash SHA created remotely) | existence plus identity of final SHA | coupled | Finalizer fetches mergeCommit via gh pr view and refuses to proceed without it (T4) |
| 3 | .svc/lane-tasks-WI-556.json pipeline state | graph whose normalized digest becomes graph_digest | coupled | Digest recorded in both manifest and receipt (D2); malformed graphs blocked by lane-tasks hooks |
| 4 | ad-hoc: tier-1 eval corpus discovery | new validator auto-enrolls in full runs | coupled | run-all-evals.sh globs tier-1/*.sh (verified in simulation log) |
| 5 | FRAMEWORK-STATE.md Known Gaps and Decisions | closure plus arming-decision record | decoupled-justified | Updated at verify-promotion closeout, not at execution; drift detected by review-gate G7 state sync; recovery: G7 blocks promotion until updated |

Untouched environments (walked the taxonomy, found nothing): databases, caches, registries, env/secrets files, containers/orchestration, cloud resources, paid third-party APIs, scheduled jobs, host wirer configs, process supervision state.

Decoupled justification for #5: the doc record trails implementation by design because its content depends on replay outcomes produced by verify-promotion; monitoring path is the G7 review which fails promotion when FRAMEWORK-STATE lacks the WI-556 closure entry.

## Pre-Implementation Simulation Report

Layer walked: disk. Planned-layer conflicts re-checked at each checkpoint.

| Check | Target | Result |
|-------|--------|--------|
| CREATE targets absent | schema, library, validator | PASS ×3 (.svc/plan-changeset-simulation.log) |
| MODIFY anchors present | REQUIRED_TYPES_FULL@39, NOTE_REQUIRED_CONSUMERS@74, loadSchema@755, --squash@114, terminal exit@200 | PASS ×5 |
| Imports resolve | state-io.mjs, lib/normalize-ac-table.mjs present; stdlib-only additions | PASS |
| Fixture parent dir | test-framework/fixtures/ exists; both RMW fixtures written | PASS |
| Eval auto-discovery | glob-based enrollment confirmed | PASS |
| Route conflicts | N/A — no routes in framework repo | PASS |
| Deprecated foundations scan | scan-deprecated-foundations.mjs --fail-on-findings on both MODIFY targets | PASS, 0 findings |
| New npm deps | none (Node stdlib only) | PASS |

Journey Scenario Walkthrough: no product journeys apply (framework chrome); G7 replays proposal targets 1–4 via tier-1 S-scenarios.

All checks PASS — proceeding to adversarial review.

## Adversarial Review Record

Structure-level mechanical findings already applied during authoring: exact parser headings (Execution Command Sequence, Prerequisite Alignment Matrix, Files Planned→Task Graph block), contract-shaped Files Planned table (T-numbered owners), concrete lane-tasks filename replacing glob, de-backticked promotion-note values, full ownership/claims/executables/resource_review contract fields. Deferred-by-design gates (C1 existence, C10 diff parity, denominator census) are enforced at CP-PRELAND inside the worktree. Self-review Pass 1 and Pass 2 records follow below.

### Self-Review Pass 1 — correctness/completeness (2026-08-22)

| # | Check | Finding | Disposition |
|---|-------|---------|-------------|
| 1 | Banned-phrase scan across manifest/WI/lane-tasks | CLEAN | — |
| 2 | AC coverage matrix | AC-5 row dropped proposal clause "final SHA must carry a valid note envelope" | FIXED — restored |
| 3 | Naming consistency | `skill-coverage` used uniformly (25 hits); no snake/camel drift | PASS |
| 4 | Checkpoint referential integrity | Task Graph referenced CP-T7 absent from Checkpoint Plan | FIXED — T7 folded into CP-PLAN commit |
| 5 | Cross-WI file conflict | WI-555 also touches check-chain-receipts.mjs; unsequenced | FIXED — rebased-after-WI-555 constraint added |
| 6 | Risk-flag honesty | config_schema_migration/idempotent_rewriter/cross_runtime_integration rejected with reasons in scope log | PASS |
| 7 | External State completeness | 5 coupled/decoupled entries + untouched-list present | PASS |
| 8 | Mode fail-closed trap | mode:inline explicit in Header + lane graph + planned receipt field | PASS |

Residual after Pass 1: deferred-by-design mechanical gates only (documented at Checkpoint Plan).

### Self-Review Pass 2 — efficiency convergence (2026-08-22)

| # | Lens | Finding | Disposition |
|---|------|---------|-------------|
| 1 | Task-count minimality | 8 owner rows is the floor imposed by diff-parity ownership (every changed path needs exactly one owner); merging T7/T8 would blur meta vs product ownership for zero gate benefit | KEEP |
| 2 | Parallelism | Waves g0→g1→g2→g3 already maximal given deps (T3⊥T4 after T2) | PASS |
| 3 | Ceremony minimality | claims[] and executables[] empty — contract carries only matched risk sections + required base arrays | PASS |
| 4 | Redundant validation listing | branch-level block listed focused validator separately from run-all-evals corpus (double execution) | FIXED — single corpus command with glob note |
| 5 | Enforcement economics | D6 defers hard-requirement cutoff: zero churn on in-flight WIs, no self-referential land problem | PASS |
| 6 | Blueprint economics | inline mode skips §3a re-authoring per WI-386; anchors + decisions give executor-equivalent determinism at inline prices | PASS |

Convergence verdict: two consecutive passes with only one cosmetic finding in Pass 2 → residual stable at deferred-gates-only. Plan declared SIMULATED/REVIEWED for handoff to review-plan (lane task 6).

### Self-Review Pass 3 — pre-execution readiness audit (build-mode, 2026-08-22)

Fresh adversarial pass over on-disk artifacts hunting what breaks when executed.

| # | Check | Finding | Severity | Disposition |
|---|-------|---------|----------|-------------|
| 1 | Manifest structural integrity after earlier table-insertion incident | exactly one Files Planned / Task Graph section each | — | PASS |
| 2 | Ownership triangle contract↔manifest | zero multi-owner paths, zero mismatches both directions | — | PASS |
| 3 | D4 mechanism vs schema reality | exec-record.schema.json has NO phases property — D4 referenced a nonexistent field | HIGH | FIXED — D4 rewritten to producer-binding enum (evidence identity = receipt slot type; skill-load structurally cannot satisfy); S3b wording aligned |
| 4 | §7a worktree transfer | planning artifacts are untracked on main only; fresh worktree git add would fail | HIGH | FIXED — explicit cp carry step added before add/commit |
| 5 | Receipt visibility across .svc dirs | staged plan-manifest sits in main's .svc; worktree post-commit hook cannot promote it | MEDIUM | FIXED — per-commit emission with explicit --sha from body copied into worktree's gitignored receipts dir; main index unstaged after carry |
| 6 | Runtime-budget honesty | under-5s claim unrealistic for 8 disposable-repo scenarios | LOW | FIXED — ≤10s with shared fixture init |
| 7 | exec-record schema surface cross-check | diff_hash/files_touched/test_results present as assumed by checker integration | — | PASS |

Residual: deferred-by-design CP-PRELAND gates unchanged. Plan re-declared READY for execution.

### Independent Review Disposition — cursor-agent CLI (plan mode, 2026-08-22)

External adversarial review dispatched per founder instruction: `cursor-agent -p --mode plan` grounded against checker/finalizer/task-graph/schemas. Full transcript: .svc/plan-changeset-cursor-agent-review.log (168KB stream-json). Verdict was FIX-FIRST; disposition of all 12 findings:

| # | Sev | Disposition | Fix applied |
|---|-----|-------------|-------------|
| 1 required[] trust root / under-compilation | HIGH | ACCEPT | D2: checker cross-checks graph_digest vs commit-tree lane-tasks; absence ⇒ UNKNOWN never YES |
| 2 digest canonicalization undefined over volatile fields | HIGH | ACCEPT | D2/T1: sorted keys + volatile-state exclusion + two-lifecycle-state digest test |
| 3 squash-tree ≠ candidate-tree collides with checker tree-bind | HIGH | ACCEPT | D5: divergence ⇒ refuse + MERGED_UNVERIFIED, tree_hash rewriting forbidden; S9 scenario added |
| 4 composite fixture short-SHA/mixed-target bug | HIGH | ACCEPT | Fixture rewritten: full 40-hex single target (verified by parser-shape assert) |
| 5 zero-envelope probe uses ref-wide list | MED | ACCEPT | Contract: per-object show+list probe; rev-parse for ref health |
| 6 gh edge paths (lag/--auto/--rebase/tmpdir cwd/baseRef) | MED | ACCEPT | D5: squash-only refusal set, merge.status gate, bounded poll, baseRef fetch; anchor corrected to post-line-200 gate |
| 7 CAS lease must use fetched REMOTE tip; flock host-local | MED | ACCEPT | Contract concurrency rewritten accordingly; cross-host limitation documented |
| 8 UNKNOWN taxonomy missing | MED | ACCEPT | T3 owns read-failure⇒UNKNOWN vs mismatch⇒NO split; S10 deleted-object scenario |
| 9 schema cannot express counts arithmetic; PASSING_VERDICTS gap | MED | ACCEPT | Semantic checks assigned to verifyCoverage/checker hook incl. skill-coverage verdict handling; schema stays structural |
| 10 NA-enum churn + unverifiable temporal clause | MED | PARTIAL | v1 enum kept + policy_registry_digest field + decided_at ordering test; registry-growth path documented in T6 |
| 11 uncovered merges invisible until arming | LOW | SCOPED | Observation-only telemetry recorded as FRAMEWORK-STATE Known Gaps follow-up (T6); no new owned files, Human Checkpoint preserved |
| 12 misc (glob pin / scenario count / stale contract line / anchor drift) | LOW ×4 | ACCEPT | Exact staging-dir pin; S1–S10 count; line-13 fix folded into T6; §7a anchor re-verify step added |

Post-fix state: mechanical suite re-run shows only the known deferred-by-design gates. Plan re-declared READY.

### Independent Review Disposition — grok-build CLI round 1 (partial, timeout-cut) + codex round 1 (no synthesis)

Both stations dispatched in parallel with a mandatory performance lens (founder requirement: execution must not get measurably slower; net pure effective optimization; baseline chain receipts accepted). grok streamed 4 HIGH findings before the wall-clock ceiling killed it mid-synthesis; codex produced 346KB of tool-grounding but no final report. Round 2 relaunches are detached with completion markers and a known-dispositioned exclusion list so they hunt NEW ground plus PERF-BUDGET.

| # | Sev | Finding | Disposition | Fix applied |
|---|-----|---------|-------------|-------------|
| G1 | HIGH | Verbatim slot translation cannot pass checker — slot-key SHA and body target_sha must equal SHA-under-test | ACCEPT | D5: closed identity remap (slot-key sha, target_sha, sha ONLY; tree_hash/diff_hash bytes untouched); S11 fixture asserts both failure directions |
| G2 | HIGH | Squash object exists only on GitHub until fetched — tree compare and notes write would fail post-merge | ACCEPT | D5: git fetch origin <oid> + notes ref BEFORE any bind/write; S12 fail-closed scenario |
| G3 | HIGH | Behind-but-mergeable PR squashes to merge-result tree ≠ head tree — common case, dead-end after merge | ACCEPT | D5: pre-merge freshness gate behindBy===0 refuses BEFORE gh merge; MERGED_UNVERIFIED reserved for lag/API mismatch |
| G4 | HIGH | Exit 3 collides with caller semantics — worktree.sh:625 and land-changeset Step 4 treat non-zero as PR-still-open | ACCEPT | T4 widened: exit-code contract 0/2/3; worktree.sh + land-changeset SKILL.md branch on 3 (owned-file set updated, parity re-verified clean) |

Codex round-1 salvage: none usable as findings (sandbox blocked its temp-write probes; no verdict emitted) — superseded by round 2 with pipes-only instruction.

### Independent Review Disposition — grok-build R2 + codex R2 (both completed, 2026-08-22)

Both stations delivered full reports with PERF-BUDGET tables; both initial verdicts FIX-FIRST. Dispositions:

| Finding | Sev | Disposition | Fix |
|---|-----|-------------|-----|
| grok#1 T3 hook is no-op on live checker | HIGH | ACCEPT | Hook verifyCoverage after envelope normalize, presence-gated, default --sha path; PASSING_VERDICTS is not the hook |
| grok#2 digest-equal ≠ recompile | HIGH | ACCEPT | D2: recompile applicable set from canonicalized tree graph + exact task_id/skill multiset equality; S13 scenario |
| grok#3 insert-after-line-200 is dead code | HIGH | ACCEPT | T4: REPLACE terminal exit block with finalization sequence |
| grok#4 compile table missing → own WI can never YES; untracked-.svc repos dead-end | HIGH | ACCEPT | D7/T2 compile table; emission-skip fallback for consumer repos |
| grok#5 5×2s poll + duplicate checker = slower lands | HIGH | ACCEPT | D5: immediate mergeCommit view, poll-only-if-empty; skip pre-merge checker when land validated |
| grok#6 range child cap is 5s/10s not 20s; no nested execs | MED | ACCEPT | D2/T3 constraints recorded |
| grok#7 task-graph CLI-only, wrong API | MED | ACCEPT | T2 internal parse + compileCoverage/verifyCoverage exports |
| grok#8 duplicate pre/post validation vs land | MED | ACCEPT | T4 skip-if-land-validated; --coverage opt-in, byte-stable default JSON |
| grok#9 S5 production backoff breaks budget claim | MED | ACCEPT | T5 shared fixture repo, test backoff=0, mechanical stopwatch ≤15s else FAIL |
| grok#10 policyFingerprint misses new lib | LOW | ACCEPT | T3 fingerprint input |
| grok#11 envelope cost fine; need ONE RMW+ONE CAS | LOW | ACCEPT | D5/T4 single publish, compact stringify |
| grok#12 static import taxes legacy SHAs | LOW | ACCEPT | T3 dynamic import presence-gate |
| codex C1 producer gap for arbitrary tasks | CRITICAL | PARTIAL | D7: scope = mandatory-chain minus verify-promotion (all producers exist); optional skills excluded by lane-model definition; extension = future WI with new producers; child-schema retrofit rejected as scope creep |
| codex C2 coverage at land cannot include post-merge verify-promotion truthfully | CRITICAL | ACCEPT via C1 scoping | verify-promotion stays governed by CONSUMER_REQUIRED_TYPES + G7 |
| codex C3 own skips lack registered conditions | HIGH | ACCEPT (dogfooded now) | lane-tasks t0a-c carry structured skip_condition_id/decision_ref/decided_at |
| codex C4 early returns bypass strict-validate-if-present | HIGH | ACCEPT | T3 hook BEFORE all early returns incl. quick-fix/retroactive tiers + mixed-envelope tests |
| codex C5 cold reconcile ×16 workers repeat graph reads | HIGH | ACCEPT | Batch cat-file --batch keyed by blob OID + OID/version-keyed digest cache |
| codex C6 finalizer RT bloat, no latency acceptance | HIGH | ACCEPT | D5 consolidated snapshot, combined refspecs, request-count logging; Validation Plan p95 acceptance: baseline + exactly 1 fetch + 1 notes publish, zero happy-path sleep-poll |
| codex C7 tier-1 budget unproven | MED | ACCEPT (overlaps grok#9) | Stopwatch assertion enforced in-validator |
| codex C8 no receipt/envelope byte ceiling (baseline measured: 91 notes, avg 3.8KiB, max 27KiB) | MED | ACCEPT | T1 item cap + total byte ceiling; compact canonical fields |

NET-EFFECT resolution per founder mandate: both stations scored the pre-fix plan SLOWER. Post-fix accounting: legacy SHAs zero cost (presence-gated dynamic import, no git-show); sanctioned land adds exactly one object fetch plus one notes publish over today's wrapper (no sleep-poll, one RMW/one CAS); range reconcile gains batched reads only on coverage-bearing SHAs; tier-1 addition self-enforced at ≤15s shared-fixture wall clock.
