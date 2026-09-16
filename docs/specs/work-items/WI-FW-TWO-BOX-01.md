# WI-FW-TWO-BOX-01 — Two-Box Planning and Deterministic Transmutation

Status: VERIFIED. Promoted by https://github.com/shipwithstef/ssve/pull/62 squash `e016e443ea95c20d151f1703e4a63584aa26c81d` (tree `a383ed61c34d9df45c1eb0fb85d87713d006040b`, digest `35624d9b78b68f668950e7022c03b3b15bfea7d78fcbe562a27d9603ee24349a`). Type: Enabler. Mode: contract-change. Lane: framework. Owner: repository owner.

## Intent

Turn product intent into verified software through living specifications, progressive narrowing, executable changesets, and inspectable evidence. Ship executable Two-Box Planning, Dual-Pass Re-exploration Narrowing, Deterministic Transmutation, claim-level research, and honest launch documentation. Commercial and fleet capabilities remain secondary ambitions without income or success guarantees.

Owner authorization: conversation of 2026-09-14. Sequence: self-review; Cursor Grok High solution review; corrections; Extra High changeset conversion; orchestrator review; Extra High implementation. Public root 0dcd69d255642dcc78db521e95afa2b18ea1276f.

## Evidence and decisions

Accepted solution: docs/plans/two-box-transmutation/solution-plan.md. Solution-review dispositions preserved (original FAIL 5/10). Root design review: docs/plans/two-box-transmutation/root-design-review.md. Binding decisions 1–10 and SR1–SR6 remain authoritative; RD01–RD12 correct the conversion design, not those ACs.

Promoted evidence: r22 FULL Tier-1 371/0/0; pinned Sol+AGY execution reviews PASS with 0 findings on digest `35624d9b…`; r20 no-inference rescore of retained CANARY03 (`corrected_verification=true`; original executor `failed_score` preserved). LIVE budget consumed is 12 planning calls + 1 executor; no further LIVE calls. r23 installed all nine hosts from canonical main with zero package drift at that time. r24 current aggregate drift is not zero: Codex governed command remains owner-disabled in `~/.codex/hooks.json` and is preserved. Promotion index id `d640496bd22dcb2c80879c391833f51e7f5dbc21319bec6f41ca9df9631a0f1e`. Companion WI-FW-PROMPT-INSPECTION-01 confirmed scope closed on this same implementation.

## Acceptance Criteria

| ID | Criterion |
|---|---|
| AC01 | Launch narrative correctly covers goal, phases, product specs, transmutation, receipts and bounded determinism; business remains aspirational/secondary. |
| AC02 | New substantive plans invoke both boxes once, before conversion, with eligible lightweight exceptions only. |
| AC03 | Open/Contract originals are immutable and isolated; supplied context/read evidence is captured and contamination diagnosed. |
| AC04 | Exactly two distinct assigned traversals challenge only Contract Box; coverage gaps remain explicit. |
| AC05 | Open win, Contract win, justified combination, unsupported innovation rejection and unresolved conflict are handled and tested. |
| AC06 | Accepted consequential changes reconcile specs/designs; original requirements survive handoff. |
| AC07 | Review sees the complete implementation contract; sealing after review adds no semantic choices; no duplicate holistic review. |
| AC08 | All execution modes retain complete appropriate handoff, AC/task/proof coverage, staleness checks and recovery. |
| AC09 | Local autonomy, justified disagreement, in-scope repair and consequential amendment follow one consistent evidence-backed rule. |
| AC10 | Every model role/effort/host/fallback is configurable through existing authority; advisory recipes never override owner configuration. |
| AC11 | Confidence 6 triggers appropriate external research; 7 does not; local questions remain analysis; explicit/freshness requests work; missing assessment cannot fake sufficiency. |
| AC12 | Compiler, validator and all activated skill/rule consumers share the conditional research decision; no example quotas/fabricated research receipts. |
| AC13 | Planning/transmutation evidence is required at issuance and execution for new work, tampering/missing/stale evidence fails, authentic history remains readable. |
| AC14 | Resume reuses only matching outputs; durable evidence survives isolated-worktree deletion and package/consumer roots stay distinct. |
| AC15 | Learning candidates can originate on either side; promotion requires outcome evidence/evaluation. |
| AC16 | Meaningful offline behavior fixtures and a bounded real host canary prove integration; simulated/static checks are not called live model proof. |
| AC17 | Baseline, Two-Box and full-flow evaluation reports omissions, unsupported choices, outcome, time and cost honestly; no paid broad benchmark expansion without a bounded scope. |
| AC18 | Manifest/pipeline validators, full Tier-1 release checks, post-commit relevant checks and nine-host install/drift verification complete through the governed release chain. |

## Technical Design

See docs/specs/tech/two-box-transmutation.md. This WI's receipts: inline v4 bootstrap only. Implementation package: plan-manifest v5 for inline and dispatch, control-plan v2, review-inputs.mjs included. Open Box: facts-dir plus Codex --ephemeral --sandbox read-only --ignore-user-config; fail closed if unproven. No HOME/CODEX_HOME edits.

## Alternatives and rationale

1. Prompt-only Open Box: rejected (RD01).
2. New dispatch v3 issuance: rejected (RD02).
3. Caller isNewIssuance / null cutover SHA: rejected (RD03).
4. Broad paid benchmark: rejected.
5. Coordinated Two-Box + v5 package + predicate: selected.

## Quality and operations

Headless operators. UX/UI N/A. No new npm dependency. Rollback via rollback-rolling.md. RD12: report genuine baseline failures separately from this WI.

## Consumer stories and journey

J-FW-07. System Dependencies and pillars as in the feature spec.
