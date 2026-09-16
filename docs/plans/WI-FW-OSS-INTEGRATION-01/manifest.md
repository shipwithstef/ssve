# WI-FW-OSS-INTEGRATION-01 integration plan

WI: WI-FW-OSS-INTEGRATION-01
Status: DRAFTED
Mode: inline
Lane: framework
Branch: framework-oss-integration
Base SHA: 355f3c9279e609110da08c553bb4fd8a19766807
Spec: docs/specs/work-items/WI-FW-OSS-INTEGRATION-01.md
Timestamp: 2026-09-16T19:38:00Z
Archetype: incremental-extension
**Risk Flags:** none

## Implementation Summary

Integrate three frozen candidates on this worktree only, then make the remaining
Tier-1 timing failure deterministic. Keep CI dormant and the repository private.

1. Privacy candidate from captured `privacy.patch`
   (`sha256 fa83718c5e5992844b9bc689b0fd02552031eb03794857d119c3a69f285e64c6`).
   Historical result hash `6cef23fb…` used a different staged-diff command and
   is not re-asserted.
2. Test candidate from captured `tests.patch`
   (`sha256 a29db0c42c5806d6412e2a26912c9d21783590cdebe46879de97ee1247841fd9`).
   Historical staged hash `ac97207e…` is not re-asserted.
3. CI candidate from local commit `1a4e76ea740af5b67b0633e724f683f4344d1e05`
   (not pushed; no release envelope). Templates stay under `docs/ci/workflows`.
4. Integration corrections:
   - `fixture-home.sh` appends `/usr/bin:/bin` after inherited PATH so
     `actions/setup-node` Node 24 is not hidden by system Node.
   - TERM-resistant two-box test uses a bounded startup probe then a 2500ms
     hang timeout. Production `runBoundedProcess` clock is unchanged.
   - Original canary03 bytes are retained privately; the tracked fixture is a
     sanitized derivative with a new digest pin.

Shared `.svc` ledgers are reconciled, not overwritten. Sibling worktrees stay.
Owner main `README.md` / `.gitignore` stay untouched. Root intake INDEX rows
are not claimed.

Two-Box LIVE planning/executor/canary experiments are not authorized. v5
`two_box` issuance therefore cannot be completed here. Lightweight v5 issuance
requires `quick-fix-eligibility.mjs` eligible=true on the staged tree; this
changeset includes `scripts/`, `test-framework/evals/tier-1/`, and
`FRAMEWORK-STATE.md`, so that path is expected to refuse. Missing receipts will
be recorded as the exact issuance blocker, not fabricated.

## Files Planned

| Task | Action | Path |
|---|---|---|
| T1 | MODIFY | CONTRIBUTING.md |
| T1 | CREATE | docs/EARLY-PREVIEW.md |
| T1 | MODIFY | docs/plans/two-box-transmutation/implementation-report.md |
| T1 | MODIFY | docs/specs/evidence/framework-large-input/native-1mib-inspect.json |
| T1 | MODIFY | docs/specs/evidence/framework-large-input/transport-assessment-20260915.json |
| T1 | CREATE | docs/specs/reviews/2026-09-16-oss-early-preview-publication-decision.md |
| T1 | CREATE | docs/specs/work-items/WI-FW-OSS-READINESS-01.md |
| T1 | MODIFY | scripts/run-live-two-box-canary.mjs |
| T1 | MODIFY | test-framework/evals/tier-1/fixtures/two-box/canary03-executor-stdout.jsonl |
| T1 | MODIFY | test-framework/evals/tier-1/validate-two-box-transmutation.sh |
| T2 | MODIFY | test-framework/evals/tier-1/lib/fixture-home.sh |
| T2 | MODIFY | test-framework/evals/tier-1/validate-codex-first-task-activation.sh |
| T2 | MODIFY | test-framework/evals/tier-1/validate-runtime-root-portability.sh |
| T2 | MODIFY | FRAMEWORK-STATE.md |
| T2 | CREATE | docs/specs/work-items/WI-FW-TIER1-REPAIR-01.md |
| T3 | CREATE | docs/ci/ACTIVATION.md |
| T3 | CREATE | docs/ci/workflows/dependabot.yml |
| T3 | CREATE | docs/ci/workflows/ssve-checks.yml |
| T3 | CREATE | docs/plans/WI-FW-OSS-CI-PREP-01/evidence/pin-verification.json |
| T3 | CREATE | docs/plans/WI-FW-OSS-CI-PREP-01/historical-coverage.md |
| T3 | CREATE | docs/specs/tech/WI-FW-OSS-CI-PREP-01.md |
| T3 | CREATE | docs/specs/work-items/WI-FW-OSS-CI-PREP-01.md |
| T3 | CREATE | scripts/ci/run-free-checks.sh |
| T3 | CREATE | test-framework/tests/oss-ci-workflow.test.mjs |
| T4 | MODIFY | test-framework/tests/two-box-plan.test.mjs |
| T5 | MODIFY | docs/specs/work-items/INDEX.md |
| T5 | CREATE | docs/specs/work-items/WI-FW-OSS-INTEGRATION-01.md |
| T5 | CREATE | docs/plans/WI-FW-OSS-INTEGRATION-01/manifest.md |
| T5 | CREATE | .svc/lane-tasks-WI-FW-OSS-READINESS-01.json |
| T5 | CREATE | .svc/lane-tasks-WI-FW-TIER1-REPAIR-01.json |
| T5 | CREATE | .svc/lane-tasks-WI-FW-OSS-CI-PREP-01.json |
| T5 | CREATE | .svc/lane-tasks-WI-FW-OSS-INTEGRATION-01.json |
| T5 | CREATE | .svc/dispatch/WI-FW-TIER1-REPAIR-01.result.json |
| T5 | MODIFY | .svc/pipeline-decisions.jsonl |
| T5 | MODIFY | .svc/session-contract.jsonl |

## Task Graph

| ID | Title | Files | Deps | AC | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| T1 | Import privacy sanitization; keep original canary03 privately | privacy source files above | — | AC-OSS-INT-2 | source + unit digest pin | canary original ≠ sanitized |
| T2 | Import fixture repairs and honest FRAMEWORK-STATE wording; append system PATH | test/framework files above | T1 | AC-OSS-INT-1 | four focused validators | production deny paths untouched |
| T3 | Import dormant CI; document setup-node vs fixture PATH | CI files above | T1 | AC-OSS-INT-2, AC-OSS-INT-4 | 9 oss-ci tests | no `.github/workflows` |
| T4 | Deterministic TERM-resistant two-box test | two-box-plan.test.mjs | T2 | AC-OSS-INT-1 | validate-two-box-transmutation.sh | kill/reap assertions kept |
| T5 | Reconcile INDEX, owned graphs, sanitized ledgers | INDEX + graphs + jsonl | T1–T4 | AC-OSS-INT-2 | validate-no-svc-residue + docs audit | do not overwrite sibling results |
| T6 | Focused then one full free Tier-1 | — | T5 | AC-OSS-INT-1 | run-all-evals.sh --tier1 | matching-input only |
| T7 | Genuine review/receipts/merge or exact blocker | — | T6 | AC-OSS-INT-3 | review-plan + review-exec + land helpers | no forged notes |
| T8 | History disposition; keep CI/private | — | T6 | AC-OSS-INT-4 | gh read-only + backup result | no blanket deletion |

## AC-to-Task

| AC | Tasks |
|---|---|
| AC-OSS-INT-1 | T2, T4, T6 |
| AC-OSS-INT-2 | T1, T3, T5 |
| AC-OSS-INT-3 | T7 |
| AC-OSS-INT-4 | T3, T8 |

## AC-to-Test

| AC | Test type | Command / reason |
|---|---|---|
| AC-OSS-INT-1 | Unit | four repaired validators + validate-two-box-transmutation.sh + one full free Tier-1 |
| AC-OSS-INT-2 | Source | digest pins, canary provenance note, no `.github/workflows` |
| AC-OSS-INT-3 | Manual/N-A if issuance blocked | real `emit-receipt` / `run-external-review` or exact classifier error |
| AC-OSS-INT-4 | Manual | `gh repo view` visibility; backup-resume result; dormant YAML path |

## Prerequisite Alignment Matrix

| Input | Disposition | Evidence |
|---|---|---|
| UX/UI/personas | not_required | Framework publication hygiene; no application UI |
| design-tech | skipped | Owner forbade a new feature design cycle; reuse CI/privacy/test designs |
| Two-Box LIVE | forbidden | request.md; retained canary03 only |
| Style | existing bash/node/markdown | fixture-home.sh, two-box-plan.test.mjs, docs/ci |

## Validation Plan

1. `svc_run_fixture bash test-framework/evals/tier-1/validate-no-svc-residue.sh`
2. `svc_run_fixture bash test-framework/evals/tier-1/validate-framework-docs-audit.sh`
3. `svc_run_fixture bash test-framework/evals/tier-1/validate-codex-first-task-activation.sh`
4. `svc_run_fixture bash test-framework/evals/tier-1/validate-runtime-root-portability.sh`
5. `node --test test-framework/tests/oss-ci-workflow.test.mjs`
6. `svc_run_fixture bash test-framework/evals/tier-1/validate-two-box-transmutation.sh`
7. `EVALS=0 bash test-framework/evals/run-all-evals.sh --tier1` once on the exact integrated candidate
8. `node scripts/quick-fix-eligibility.mjs` after staging — record eligible/reasons

## Execution Command Sequence

```bash
# From this worktree only.
git rev-parse HEAD   # expect 355f3c9279e609110da08c553bb4fd8a19766807 until commit
command -v node; node -v; umask
# Focused then one full free suite. Do not set EVALS=1.
```

Release identities use existing land/verify producers after a real envelope exists.
Do not invent a merge SHA in this plan.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | Git refs / notes | feature branch, later PR/notes if envelope exists | coupled | land-changeset + merge-pr-with-review-receipt.mjs; do not skip git hooks |
| 2 | GitHub repo metadata | visibility PRIVATE; Actions workflows=0 | decoupled-justified | read-only `gh repo view`; no visibility or workflow install |
| 3 | Private history archive | shipwithstef/ssve-history-archive-20260914 already created | decoupled-justified | backup-resume/result.json; do not recreate |
| 4 | Host installs | Codex hook remains owner-disabled | decoupled-justified | Root owns post-merge setup; this worktree does not run global setup |

Untouched environments (walked taxonomy): MCP servers, databases, cloud deployments, application stores, DNS, package registries, schedulers, credentials/billing, external communication, product application files, Azure, unrelated products.

## Simulation Report

| Check | Layer | Result |
|---|---|---|
| Privacy/test/CI source files exist in sibling trees / object store | disk | PASS — imported |
| Original canary03 hash fa5da28b… retained privately | disk | PASS |
| Sanitized canary03 hash deebe3a4… tracked | disk | PASS |
| fixture-home PATH append after inherited PATH | planned/disk | PASS |
| two-box test readiness probe + timeout/reap | planned/disk | PASS |
| No `.github/workflows` created | disk | PASS |
| README.md / .gitignore not modified | disk | PASS |
| v5 two_box LIVE control-plan | planned | WARN — unauthorized; do not run |
| v5 lightweight eligibility | planned | WARN — expected refuse because scripts/tier-1/FRAMEWORK-STATE are denylisted |
| Owner main intake INDEX | planned | WARN — reconcile through Root |

No unresolved FAIL. WARN items are recorded as release constraints, not hidden.

## Promotion Readiness Checklist

- [ ] One matching full free Tier-1 is 371/0 or the exact residual is recorded
- [ ] Dormant CI only; SSVE PRIVATE
- [ ] Genuine 5-receipt envelope or exact issuance blocker
- [ ] History refs disposed without blanket deletion
- [ ] No schema/ORM files; no migration task required
