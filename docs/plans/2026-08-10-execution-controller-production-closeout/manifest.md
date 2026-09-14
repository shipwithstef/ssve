# WI-529 implementation manifest

**Status:** VERIFIED / PR 188 MERGED / CANONICAL CODEX INSTALL PASS
**Branch:** `framework-WI-529-agy-codex-closure`
**Base SHA:** `0d75cb1d697d3c031e871f2bd182066a47f7bbb8`
**Archetype:** bounded corrective contract change on two already-identified closeout boundaries

## Immutable constraints

- AGY is the active independent Google route; do not add a direct Gemini CLI route.
- Preserve legacy receipts and every existing dispatcher child.
- Preserve unrelated product behavior and dirty state; consumer metadata is a separately verified external application of the framework contract.
- Do not report installed convergence until live canonical-main drift passes.

## Tasks

| Task | Files | AC | Method | Validation |
|---|---|---|---|---|
| T1 receipt compatibility | `schemas/receipts/review-plan.schema.json`, `schemas/receipts/review-exec.schema.json`, `test-framework/evals/tier-1/validate-receipt-tier.sh` | AC-529-1, AC-529-2 | Add `agy`; add valid and unknown-host mutations | `bash test-framework/evals/tier-1/validate-receipt-tier.sh` |
| T2 launcher-routed dispatcher | `bin/svc-enforce.mjs`, `scripts/svc-migrate-install.mjs`, `scripts/wire-codex-hooks.mjs`, `provision/hosts/codex.json` | AC-529-3, AC-529-4 | Register dispatcher and wire the single composite entry through launcher | focused Codex wirer/runtime validators |
| T3 governed routing predicate | `scripts/lib/governed-routing.mjs`, `scripts/verify-governed-routing.mjs`, `setup`, `scripts/svc-migrate-install.mjs`, `hooks/svc-session-start-healthcheck.mjs` | AC-529-5 | Parse effective host commands, require exact cardinality, and bind all declared tokens to the same command | laundering, duplicate, migration, self-heal, and setup fixtures |
| T3a proof-fixture completeness | `test-framework/evals/tier-1/validate-codex-execution-integrity.sh` | AC-529-4, AC-529-6 | Copy the enforcer's existing `session-handoff` dependency into both mutation sandboxes | full Codex integrity validator reaches terminal summary |
| T3b worktree drift determinism | `scripts/check-install-drift.sh` | AC-529-6 | Consume the complete `git worktree list` stream before selecting canonical main | worktree invocation exits 0, never SIGPIPE/141 |
| T3c Kimi config preservation | `scripts/wire-kimi-hooks.mjs`, `test-framework/evals/tier-1/validate-wire-kimi-hooks-paths.sh` | AC-529-5 | End hook ranges at every TOML table header and deduplicate only managed hook blocks | last-duplicate fixture preserves following settings/provider tables byte-for-byte |
| T3d AGY production normalization | `research/scripts/dispatch-agy.mjs`, `test-framework/evals/tier-1/validate-agy-launcher.sh` | AC-529-8 | On successful transport only, collapse repeated identical JSON objects; pass through malformed, mixed, single, or conflicting output unchanged | schema-free production transport, identical-repeat, and conflict fixtures |
| T4 state and evidence closeout | `FRAMEWORK-STATE.md`, proposal lifecycle, WI/spec/plan/audit | AC-529-6, AC-529-7 | Record exact capability, baseline debt, and post-merge install obligation | full Tier-1 comparison + live post-merge install |
| T5 effective Codex state | `scripts/wire-codex-hooks.mjs`, `scripts/lib/governed-routing.mjs`, `scripts/verify-governed-routing.mjs`, `scripts/svc-migrate-install.mjs`, `scripts/check-install-drift.sh`, `provision/hosts/codex.json` | AC-529-9 | Bind routing proof to the exact hook position and reject or repair an explicit disabled state | disabled-state laundering, dry-run, migration, drift, and live setup fixtures |
| T6 consumer surface | `scripts/init-project-state.mjs`, `test-framework/evals/tier-1/validate-project-consumer-surface.sh`, onboarding docs | AC-529-10 | Provision a committable repo identity plus project-local skill directory that never becomes the framework executable root | identity, idempotency, existing-file preservation, and executable-source rejection fixtures |

## Pre/post loop

- Pre: `./setup --host codex` exits zero, then `bash scripts/check-install-drift.sh --host codex` exits one with both governed markers absent.
- Post: the same two commands must both exit zero; installed config must contain the launcher and dispatcher markers.

## Prerequisite Alignment Matrix

| Task | UX/UI | Technical design | Style/pattern | Persona/competitor |
|---|---|---|---|---|
| T1 receipts | N/A | Existing mandatory-chain schemas and cognitive-family resolver | Additive enum compatibility plus negative mutations | N/A - internal framework identity |
| T2-T3 routing | N/A | Existing durable launcher, serialized dispatcher, host manifests, and atomic setup migration | Dependency-free Node ESM and portable Bash; preserve unrelated host config | N/A - internal enforcement path |
| T3c Kimi | N/A | Existing TOML block scanner and managed-hook identity | Bounded range parsing; preserve every non-managed byte | N/A - host adapter only |
| T3d AGY | N/A | Existing canonical AGY dispatcher and external-review schema validation | Fail-closed scanner; normalize only provably identical structured documents | N/A - reviewer transport only |
| T4 closeout | N/A | Existing receipt chain, Tier-1 harness, and canonical-main install flow | Evidence distinguishes focused pass, baseline debt, merge, and live install | N/A - no product surface |

No browser journey, product persona, data migration, package registry, or application deployment is part of this framework-only corrective change. The Example Marketplace application step is metadata-only and must preserve its existing dirty worktree byte-for-byte outside the generated surface.

## External State

| Environment | Planned write | Rollback |
|---|---|---|
| Git worktree | WI-529 scoped files | Revert WI-529 commit |
| Git remote | Branch/PR/squash merge | Revert squash commit |
| `~/.codex` | Post-merge setup merges managed hook entry and feature flag | Adjacent timestamped backups from wirer |
| `~/.kimi/config.toml` | Post-merge setup deduplicates only managed Kimi hook blocks | Adjacent timestamped backup plus byte-preservation fixture |
| `~/.svc/enforcement` | Post-merge materialized launcher manifest | Re-run prior canonical setup |
| Owner reviewer policy file outside the repository | Read-only policy selects self/Sol/AGY/optional Opus stations | Owner edits the external policy; framework code remains unchanged |

Untouched external systems: application environments, databases, schedulers, DNS, authentication, secrets, package registries, and product repositories.

## Execution Command Sequence

The implementation reuses the existing WI-529 worktree and task graph. Commands below are literal, shell-safe entry points; no direct Gemini CLI route is permitted.

```bash
git status --short --branch
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-10-execution-controller-production-closeout/manifest.md
bash test-framework/evals/tier-1/validate-receipt-tier.sh
bash test-framework/evals/tier-1/validate-governed-wirer-fail-fast.sh
bash test-framework/evals/tier-1/validate-codex-session-rebinding.sh
bash test-framework/evals/tier-1/validate-codex-hook-feature-flag.sh
bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh
bash test-framework/evals/tier-1/validate-wire-kimi-hooks-paths.sh
bash test-framework/evals/tier-1/validate-agy-launcher.sh
bash test-framework/evals/run-all-evals.sh
node scripts/run-external-review.mjs --orchestrator codex --review-kind exec --candidate-digest <sha256> --artifacts-dir <dir> --context-root <worktree> --reviewer-config /home/svc-user/.svc/reviewer-policy-v2.json --reviewer-mode production --reviewer-phase exec --reviewer-station agy
git push -u origin framework-WI-529-agy-codex-closure
node scripts/merge-pr-with-review-receipt.mjs --pr <number> --squash --delete-branch
./setup --host codex
node scripts/verify-governed-routing.mjs --manifest provision/hosts/codex.json
bash scripts/check-install-drift.sh --host codex
```

Expected outcomes: mechanical/focused validators pass; full Tier-1 has no new branch-caused failures versus the captured baseline; both independent reviews report zero Critical/High; merge uses the governed wrapper; canonical-main setup, routing verification, and drift all exit zero.

## Review-plan decision

The original plan selected the correct smallest repair: route the existing serialized dispatcher through the launcher rather than install a second concurrent enforcer. Execution review then expanded the bounded plan to cover effective-command token laundering, Kimi tail preservation, and canonical AGY repeated-output normalization. Exact-candidate review and receipt emission remain mandatory before landing.

## Closure gates

- Focused red/green proof for both defects.
- Relevant validators plus full Tier-1 with no new failures.
- Self-review plus independent Sol and AGY review of the exact candidate digest.
- Squash merge, canonical-main setup, live Codex drift exit zero, final receipt audit.
