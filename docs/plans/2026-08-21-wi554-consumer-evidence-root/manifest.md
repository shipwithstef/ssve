# Implementation Plan — WI-554 consumer evidence root

**WI:** [WI-554](../../specs/work-items/WI-554.md)
**Branch:** `framework-WI-554-consumer-evidence-root`
**Base:** `origin/main` @ `b0e2e9b6`
**Lane:** framework / bugfix
**Execution mode:** `inline`
**Status:** READY (remediated after AGY plan review F-001..F-003)

## 1. Summary

`scripts/check-chain-receipts.mjs` calls `verifyReviewerEvidence` with
`root: join(SCRIPT_DIR, "..")`. When the checker is centrally installed and
invoked from a consumer repository, that root is the framework checkout, so
valid consumer-local reviewer evidence fails. Change the root to
`repoRootForCache()` (same helper used for reconcile cache / chain-policy).
Add a tier-1 regression that runs the real central checker against a separate
consumer repo (accept valid evidence; reject candidate tampering).

## 2. Files Planned

| File | Action | Purpose |
|------|--------|---------|
| `scripts/check-chain-receipts.mjs` | MODIFY | `verifyReviewerEvidence({ root: repoRootForCache(), ... })` |
| `test-framework/evals/tier-1/validate-consumer-evidence-root.sh` | CREATE | Central-checker + consumer-repo regression |
| `docs/specs/work-items/WI-554.md` | CREATE | WI record |
| `docs/specs/work-items/INDEX.md` | MODIFY | Index entry |
| `docs/plans/2026-08-21-wi554-consumer-evidence-root/manifest.md` | CREATE | This plan |

Out of scope: `--repo` CLI, retroactive-attestation roots, WI-472 backlog paths.

## 3. Task Graph

1. **fix-root** — replace SCRIPT_DIR parent with `repoRootForCache()` at the schema-v3 evidence call site only.
2. **tier1-regression** — hermetic consumer fixture; cwd=consumer; SCRIPT_DIR=framework; assert pass then tamper fail.
3. **verify-existing** — `validate-reviewer-run-evidence.sh` + `validate-svc-reconcile-consumer-routing.sh`.
4. **post-land-hourshub** — After land + required host setup, from `/home/dianast/app-workspaces/hourshub-port/.worktrees/wi-billing-01-dodo-live-cutover` with `GIT_ALTERNATE_OBJECT_DIRECTORIES` and `SVC_REVIEW_EVIDENCE_STORE` unset, run ordinary `check-chain-receipts --sha` for the five cutover SHAs listed in §4 (AC-554-5). Out of scope: `21da99bebe370a64d319f49b7e807f21a82e55af`.

## 4. Validation Plan

Pre-land (execute gate):

```bash
bash test-framework/evals/tier-1/validate-consumer-evidence-root.sh
bash test-framework/evals/tier-1/validate-reviewer-run-evidence.sh
bash test-framework/evals/tier-1/validate-svc-reconcile-consumer-routing.sh
```

Post-land (AC-554-5; promotion verification, outside the pre-commit mapped-test):

```bash
cd /home/dianast/app-workspaces/hourshub-port/.worktrees/wi-billing-01-dodo-live-cutover
unset GIT_ALTERNATE_OBJECT_DIRECTORIES SVC_REVIEW_EVIDENCE_STORE
for sha in \
  66401fd9cdc7efacb472fb27f87bbc18b92d4ffe \
  335a6dbc40543a289180cfe31ce6fcf905f17f81 \
  b10977f7e04c5cc90a083df06ce03577504c8a10 \
  1d0f26c04243ed0483ecee8a896ed3118c22b7b3 \
  b925db1d9d6a3ece2438a711891a363901d60fdf
do
  node "$(git -C /home/dianast/app-workspaces/seriousvibecoding rev-parse --show-toplevel)/scripts/check-chain-receipts.mjs" --sha "$sha"
done
```

## 5. Risk / Rollback

- **Risk:** low — one root selector; schemas/evidence library unchanged.
- **Rollback:** revert the one-line root change; leave the regression as a failing red test until re-applied.
- **concurrency_test:** `test-framework/evals/tier-1/validate-consumer-evidence-root.sh`

## 6. AC Mapping

| AC | Proof | Gate |
|----|-------|------|
| AC-554-1 | Static assert in validator + source diff | pre-land task 1–2 |
| AC-554-2 | Central checker exit 0 on valid consumer evidence | pre-land task 2 |
| AC-554-3 | Tampered candidate_digest exit ≠ 0 | pre-land task 2 |
| AC-554-4 | Three named validators PASS | pre-land task 3 |
| AC-554-5 | Five HoursHub SHAs pass ordinary check after land | post-land task 4 |

## 7. Lane Compliance

Framework/bugfix upstream accounting for this WI:

| Skill | Status | Evidence / skip |
|-------|--------|-----------------|
| `design-tech` | skipped | Lane-tasks task 1: one-line root selector; no new components/APIs/data model |
| `plan-changeset` | this artifact | `docs/plans/2026-08-21-wi554-consumer-evidence-root/manifest.md` |
| `review-plan` | required next | Real launcher review; no retro-plan override |
| `execute-changeset` | after review-plan pass | Saved WI-554 patch reapplied only after plan PASS |
| `review-exec` / `audit-implementation` / `land-changeset` | after execute | Mandatory chain |

No other greenfield product skills (vision/domain/UX/UI) apply to this framework bugfix.

## 8. External State

**Untouched declaration:** This changeset only changes how a locally invoked
central checker resolves the *consumer Git worktree root* for
`verifyReviewerEvidence`. It does not create, mutate, deploy, or depend on any
of the 15 taxonomy external environments (cloud accounts, SaaS APIs, hosted
DBs, DNS, CDNs, secret stores, CI vendor state, package registries beyond
reading already-installed local CLIs for review, mobile stores, email/SMS
providers, payment rails, analytics, feature flags, or third-party identity).

Review evidence for the chain is produced under the worktree's
`.svc/external-review-artifacts/` (local) and consumed from the consumer repo
object store after land — no new external service binding.

## 9. Blueprints

### `scripts/check-chain-receipts.mjs` (schema-v3 block)

Replace:

```js
verifyReviewerEvidence({ root: join(SCRIPT_DIR, ".."), ... })
```

with:

```js
verifyReviewerEvidence({ root: repoRootForCache(), ... })
```

Do not change `loadSchema` SCRIPT_DIR anchoring (schemas ship with the framework).
Do not change `validateRetroactiveAttestation` framework-doc roots.
