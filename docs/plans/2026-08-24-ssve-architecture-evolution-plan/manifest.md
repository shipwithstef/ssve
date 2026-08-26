# Manifest — WI-SSVE-ARCHITECTURE-EVOLUTION-02

Plan: `docs/plans/2026-08-24-ssve-architecture-evolution-plan.md` · Contract: `plan-contract.json` (same directory) · Base SHA `784b764b9af91dbcbd4167f3c317508fa6084677`

**Amendment protocol (living manifest):** parity with the working tree is strict and bidirectional, so this table lists artifacts that exist on disk. Each execution wave amends this table + contract `ownership[]` in the SAME commit as its changes. Prospective wave file sets live in the plan doc §2 until they exist.

## Files Planned

| Task | Action | File(s) | Purpose |
|---|---|---|---|
| T01 | CREATE | docs/specs/audits/2026-08-24-ssve-evolution-feasibility-audit.md | Feasibility & pruning verdicts: ADOPT-adapted ×3, REJECT-supersede ×1 |
| T01 | MODIFY | .svc/lane-tasks-WI-SSVE-ARCHITECTURE-EVOLUTION-02.json | Canonical task graph (rebuilt from non-canonical bootstrap shape; T01/T02 completed with receipts) |
| T02 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan.md | Comprehensive evolution plan (waves E1–E4, rejected-alternatives ledger, D-1/D-2 decision points) |
| T02 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/manifest.md | This file |
| T02 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/plan-contract.json | Machine contract (ownership, claims, validation commands, decision points) |
| T02 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/review-request.md | Station dispatch request header (review lenses, output contract, rubric anchors) |
| T02 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/full-review-prompt.md | Full station prompt (header + plan) |
| T03 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/review-log.yaml | Durable review-plan log (Grok High round 1–2) |
| T03 | CREATE | docs/specs/reviews/wi-ssve-evolution-plan-grok-high.md | Grok High findings + round-2 APPROVE |
| T03 | CREATE | docs/specs/reviews/wi-ssve-evolution-plan-triple-review.md | Triple-station rollup |
| T03 | CREATE | docs/specs/reviews/wi-ssve-evolution-plan-review-log.yaml | Specs-side copy of review log |
| T03 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/review-cursor-auto.txt | Cursor Auto station output |
| T03 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/review-cursor.txt | Cursor station scratch |
| T03 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/review-grok-high.txt | Grok station scratch (phase-gated; canonical is specs/reviews) |
| T03 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/review-opencode-codex.txt | Codex station output (pending a real findings envelope) |
| T03 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/review-opencode.txt | OpenCode station scratch |
| T04 | MODIFY | references/stage-registry.json | `mandatory_chain_segments` source of truth (E1) |
| T04 | MODIFY | scripts/lib/stage-registry.mjs | registry loader + segment derivation (E1) |
| T04 | MODIFY | scripts/stage-segment.mjs | derive `SEGMENTS` from registry; template staleness exit 2 (E1) |
| T04 | MODIFY | scripts/audit-story-receipts.mjs | template staleness sentinel hardened to exit 2 (E1) |
| T04 | MODIFY | test-framework/evals/tier-1/validate-stage-registry-single-source.sh | extended single-source coverage (E1) |
| T05 | MODIFY | skills-manifest.json | schema_version 1, dualRunSkillAllowlist, reviewGates.enforced_by (E2) |
| T05 | MODIFY | scripts/lint-skills-manifest.mjs | `--stamp` digest sidecar emission (E2) |
| T05 | CREATE | hooks/git/pre-commit.d/21-manifest-integrity | pre-commit manifest-integrity slot (E2) |
| T05 | MODIFY | .gitignore | classify `.svc/learning-lifecycle.jsonl` as machine-local cache (E2; digest sidecar reclassified TRACKED by exec R5 F-006 amendment, see T10) |
| T05 | MODIFY | AGENTS.md | enforced_by gate-ownership prose sync (E2) |
| T05 | MODIFY | README.md | enforced_by gate-ownership prose sync (E2) |
| T05 | MODIFY | skills/execute-changeset/SKILL.md | G5/review-exec hand-off wording (E2) |
| T05 | MODIFY | skills/review-exec/SKILL.md | G5-enforcing gate self-label (E2) |
| T05 | CREATE | test-framework/evals/tier-1/validate-manifest-integrity-stamp.sh | digest sidecar + stamp validator (E2) |
| T05 | CREATE | test-framework/evals/tier-1/validate-gate-ownership-matrix.sh | reviewGates.enforced_by vs skill self-labels (E2) |
| T06 | MODIFY | scripts/wire-hooks.mjs | subtractive rebuild cutover (E3) |
| T06 | CREATE | test-framework/evals/tier-1/validate-claude-wirer-cutover.sh | sandboxed-HOME cutover acceptance (E3) |
| T06 | MODIFY | test-framework/evals/tier-1/validate-wire-hooks-variant-dedup.sh | repurposed for rebuild semantics (E3) |
| T07 | MODIFY | hooks/lib/hook-payload.mjs | Cursor payload normalizer (E4) |
| T07 | MODIFY | references/host-hook-catalog.json | capability tiers incl. receipts (E4) |
| T07 | MODIFY | scripts/wire-cursor-hooks.mjs | afterFileEdit autoemit wiring (E4) |
| T07 | MODIFY | scripts/wire-grok-hooks.mjs | PostToolUse autoemit wiring (E4) |
| T07 | MODIFY | test-framework/evals/tier-1/validate-cross-host-hook-conformance.sh | capability-tier receipt conformance section (E4) |
| T07 | MODIFY | test-framework/evals/tier-1/validate-catalog-generation.sh | generated-command quoting coverage (E4) |
| T07 | MODIFY | test-framework/evals/tier-1/validate-wi546-cursor-live-acceptance.sh | isolated scratch note store (E4) |
| T08 | MODIFY | .svc/pipeline-decisions.jsonl | decision log entries incl. canonical WI-id record (T05 governance) |
| T08 | MODIFY | references/pipeline-decisions-schema.json | wi pattern aligned to canonical WI-id grammar (T05 governance) |
| T08 | MODIFY | test-framework/evals/tier-1/validate-pipeline-decisions-schema.sh | wi pattern aligned to canonical WI-id grammar (T05 governance) |
| T08 | MODIFY | test-framework/evals/tier-1/validate-plan-product-safety.sh | ACTIVE contract selector: newest-committed instead of lexicographic (multi-plan branch fix) |
| T08 | CREATE | docs/specs/reviews/wi-ssve-evolution-e1-e4-validation.log | E1–E4 wave validator evidence (T05 governance) |
| T09 | CREATE | docs/specs/reviews/wi-ssve-evolution-delivery-receipt.md | promotion delivery receipt (T06) |
| T07 | MODIFY | hooks/svc-phase-receipt-autoemit.mjs | Shell tool + case-insensitive gate + evaluateAutoemitTarget export (exec R5 F-001) |
| T07 | CREATE | scripts/verify-d1-autoemit-host-payloads.mjs | D-1 payload compatibility + latency gate harness |
| T08 | MODIFY | scripts/install-git-hooks.mjs | REQUIRED_SLOTS registers 21-manifest-integrity (exec R4 F-001a) |
| T07 | MODIFY | test-framework/evals/tier-1/validate-wi546-grok-live-acceptance.sh | live EXEC check tolerates configured owner-policy machine; no-Sonnet/fast invariant preserved (exec R5) |
| T10 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/exec-review-request.md | exec review station package |
| T10 | CREATE | docs/plans/2026-08-24-ssve-architecture-evolution-plan/review-cursor-auto-r2.txt | Cursor Auto R2 plan-closure transcript |
| T10 | CREATE | .svc/manifest-digest.json | tracked manifest digest sidecar (tracked-sidecar model, exec R5 F-006) |
| T10 | CREATE | docs/specs/reviews/wi-ssve-evolution-d1-autoemit-gate.json | D-1 verdict evidence: all hosts COMPATIBLE |
| T10 | MODIFY | schemas/receipts/review-exec.schema.json | reviewer host enums extended for multi-host stations |
| T10 | MODIFY | schemas/receipts/review-plan.schema.json | reviewer host enums extended for multi-host stations |

Volatile session state (hook-written, excluded from plan scope per WI-558 mechanism): `.svc/session-contract.jsonl`.

## External State

T04 wirers mutate live host configs. Tests must use sandboxed HOME; live `./setup` writes the real files. Coupled wiring is the existing backup-once + corrupt-config abort + atomic tmp+rename (IP-W1).

| Environment | Path | Coupled? | Wiring |
|---|---|---|---|
| Claude Code host settings | home-dir Claude settings.json (not in-repo) | coupled | scripts/wire-hooks.mjs backup-once, parse-fail abort exit 1 with prior bytes intact, tmp+fsync+rename |
| Cursor host hooks | home-dir Cursor hooks.json (not in-repo) | coupled | scripts/wire-cursor-hooks.mjs pre-migration.bak, parse-fail abort (no silent reset), tmp+fsync+rename |
| Grok host config | home-dir Grok config.toml (not in-repo) | coupled | scripts/wire-grok-hooks.mjs pre-migration.bak, parse-fail abort, tmp+fsync+rename |
| Git pre-commit slots | hooks/git/pre-commit.d/ (in-repo) | coupled | dispatcher runs repo slot dir; new 21-manifest-integrity is in-tree |

Untouched environments (walked the taxonomy, found nothing in this WI): package registries, SaaS endpoints, DB migrations, cloud schedulers, DNS, secrets stores, container registries, app-store listings, billing ledgers, identity providers, production DBs, CDN, email/SMS providers, feature-flag services.

**Decoupled-justified:** evals run against sandboxed HOME fixtures (`validate-claude-wirer-cutover.sh`, cursor/grok wire evals). Drift of a developer's live host config after a local `./setup` is recovered from the timestamped backup printed on every mutating run. Monitoring: corrupt-config abort leaves prior bytes; no silent `{}` reset.

## Task Graph

```
T01 -> T02 -> T03 (triple PLAN review) -> T04 (waves E1->E2->E3->E4) -> T05 (triple EXEC review) -> T06 (land + verify)
```

Wave granularity and per-wave file ownership: plan doc §2. E-wave file ownership is disjoint (E3 ∩ E4 = ∅). Full tier-1 corpus mandatory at CP-PRELAND before T06.

## Prerequisite Alignment Matrix

| Prerequisite | State at plan time | Evidence |
|---|---|---|
| WI-562 waves 1–4 landed (IP-H*, IP-R1–R5/R7/R9, IP-W1–W3) | Landed on origin/main @ 784b764 | `git log --grep=WI-562`; promotion receipt 348/350 tier-1 |
| Hook catalog + shared ownership predicate available for E3/E4 | Present | `hooks/lib/hook-catalog.mjs`, `hooks/lib/svc-ownership.mjs`, `references/host-hook-catalog.json` |
| Stage registry loader consumable by stage-segment.mjs | Present | `scripts/lib/stage-registry.mjs` (`loadStageRegistry`) |
| Receipt-kind registry available for segments emits validation | Present | `references/receipt-kind-registry.json` (WI-562 wave 2) |
| Surface-scoped tier-1 runner for per-wave validation | Present (FP-030) | `run-all-evals.sh --surface` |
| Residual audit items scoped & dispositioned | Done (Task 1) | feasibility audit §§2–3 |
| Canonical task graph valid | Done (Task 2) | `task-graph.mjs validate` green; next=T03 review-plan |

## Execution Command Sequence

```bash
# Tier-1 mechanical gate on this plan + contract (must exit 0 before station dispatch)
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-24-ssve-architecture-evolution-plan/manifest.md

# Triple independent plan review via canonical launcher (per station; request = header + plan on stdin)
cat docs/plans/2026-08-24-ssve-architecture-evolution-plan/review-request.md \
    docs/plans/2026-08-24-ssve-architecture-evolution-plan.md \
  | node scripts/run-external-review.mjs --orchestrator opencode --review-kind plan \
      --artifacts-dir .svc/external-review-artifacts/ssve-evo-plan --reviewer-station <station-id> \
      --reviewer-phase plan
```
