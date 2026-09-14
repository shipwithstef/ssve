# WI-562 Promotion Delivery Receipt

- **Date:** 2026-08-24
- **Work item:** WI-562 — Universal Multi-Agent Swarm Handoff, Graph Engineering & Cross-Host Verification Parity
- **Branch:** `feat/wi-562-swarm-graph-engineering` → `origin/main` (fast-forward, 25 commits from `aeb8b8c`)

## What shipped

| Track | Audit items | Delivered |
|---|---|---|
| H — handoff contracts | IP-H1..H7 | Ground-truth parallel merge-back (`merge-back-core.mjs`; workers commit before report; replay-only evidence; declared-command coverage), exit-honest promote/remove (fake-origin-verified), repo-wide Git-CAS verb mutex + quarantine, `finalizeHandover` forward completion (lease-embedded token proof), process-death-proof locks (state-io + wi-claim heartbeat contracts + refuse-to-persist), normalized handoff records (`schemas/handoff-record.schema.json`, per-record atomic, resume consumption with per-WI filtering + ts ordering), freeze enforcement at guard layer, orchestrator-state quarantine |
| R — receipts | IP-R1..R5, R7, R9 | Format Charter + machine-readable kind registry (12 kinds) + exceptions ledger + lint, fail-closed schema loading (emit + check paths), slot-keyed envelope mining with per-slot aggregation and mixed-envelope lane context, single sanctioned emitter (`writeReceiptMirror`) with atomic tmp+fsync+rename, exact schema/code conformance (bidirectional), pipeline-decision dual-write + PR-receipt snapshot schema_version gate + read-matrix gate, envelope digest binding with tamper-proof mirror serve + fail-closed GC |
| W — wiring | IP-W1..W4 | Uniform atomic write policy across all three wirers (+ cursor corrupt-config abort + backup), shared ownership predicate consumed by all three wirers, host-hook catalog (32 hooks, capability truth for all 7 hook-capable hosts) with whole-path quoted renderer, path-quoting verified under space-bearing HOME |
| Swarm DAG velocity | V-1/V-2 | Adaptive bounded fanout pool (flag > env > adaptive; explicit `--unbounded`), non-blocking branch claims in dispatch-worker (hashed ids, pid+start-token ownership, positive-death-proof-only steal, branch_busy retry ×2 in fanout) |

Deferred with registered follow-ups: **WI-563** (IP-R6 cross-host receipt-production parity + read-matrix debt tail), **WI-564** (IP-R8 stage-registry/manifest integrity) — see `docs/specs/wi-followups.md`.

## Verification evidence

- **Tier-1 suite:** 348/350 PASS (0 timeouts). The only failures are `validate-codex-session-rebinding.sh` and `validate-wi546-cursor-live-acceptance.sh`, both reproduced failing on a pristine `origin/main` checkout (pre-existing, environment/data-dependent). One additional validator (`validate-receipt-tier.sh` / `validate-receipt-identity-collision.sh`, rotating) exhibits a parallel-batch load flake and passes standalone 4/4.
- **Plan review gate:** 6 rounds across Codex gpt-5.6-sol (high) / Grok grok-4.6 (high) / Cursor Auto — unanimous APPROVE at plan v6. Artifacts: `docs/specs/reviews/wi562-plan-review-round1-transcripts.md`, `wi562-plan-review-rounds2-6-transcripts.md`, remediation map `wi562-plan-remediation.md`.
- **Execution review gate:** 6 rounds across the same three stations. Final: Cursor APPROVE (R3), Grok APPROVE (R6), Codex NEEDS_FIX with residuals dispositioned (MAXC=1 test tolerance is deliberate; environmental observations reproduce on main). Consolidated log: `docs/specs/reviews/wi562-exec-triple-review.md`.
- **Governance:** machine-readable contract `docs/plans/2026-08-24-wi562-swarm-graph-engineering/plan-contract.json` passes `scripts/validate-plan-contract.mjs` (ownership parity over all changed paths, executable census, zero parity failures).
- **Install convergence:** `./setup --all-hosts` run post-changeset under the documented worktree override with echoed reason.

## New always-on tier-1 validators (17)

validate-parallel-ground-truth · validate-process-liveness-lock · validate-claim-liveness · validate-rename-schema-drill · validate-slot-envelope-mining · validate-atomic-receipt-writes · validate-wirer-corrupt-config · validate-handoff-forward-completion · validate-schema-code-conformance · validate-ownership-predicate-parity · validate-swarm-velocity-gates · validate-v2-branch-claims-live · validate-promote-honesty-fake-origin · validate-catalog-generation · validate-receipt-integrity · lint-receipt-formats + receipt-read-matrix --check. Promotion notes: plan Appendix P.

## Known accepted residuals

1. Two pre-existing tier-1 failures on pristine main (named above) — not this changeset.
2. Parallel-batch load flake in one receipt validator — passes standalone; root cause is git-notes contention under ~90 concurrent fixture repos.
3. Full catalog-driven wirer entry generation — WI-563 scope by decision; generator API shipped, tested, and consumed by the catalog eval.
