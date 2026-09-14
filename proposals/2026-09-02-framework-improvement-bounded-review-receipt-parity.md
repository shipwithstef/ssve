# Framework improvement: bounded-review disposition must be receiptable

**Status:** ACCEPTED — promoted to WI-566 on 2026-09-02 by owner direction
accepted_wi: WI-566
**Date:** 2026-09-02
**Category:** review convergence / receipt integrity
**Severity:** high
**Source:** Example Marketplace PostHog mobile closeout, reported by the owner and reproduced against the installed framework

## Gap

WI-491 deliberately makes a three-round adversarial review converge by disposition when there are no unresolved Critical findings. The review skills and `check-review-round-cap.mjs` require the change to proceed after round 3 when every residual High is explicitly accepted or rejected with justification.

The schema-v3 review-receipt validator does not recognize that terminal state. It accepts launcher findings only when the reviewer's raw verdict starts with `pass`; a raw `fail` remains inadmissible even when the bounded-exit checker proves three rounds, zero unresolved Critical findings, and complete residual-High dispositions.

This leaves a governed change with three unsafe choices: violate the hard cap by ordering a fourth review, alter immutable reviewer evidence, or stop despite the framework's explicit instruction to proceed. The framework must provide one hash-bound, fail-closed path from a valid WI-491 bounded exit to a valid review receipt.

This proposal covers one gap only: **bounded adversarial-review convergence and review-receipt acceptance currently disagree about the same terminal state**.

## Evidence

- `skills/review-cross-model/SKILL.md` says “Never run more than 3 adversarial rounds” and, after round 3 with only High/Medium/Low findings, requires disposition and progression without a fourth round.
- `scripts/check-review-round-cap.mjs` exits 0 for `rounds_run <= 3`, no unresolved Critical, and every residual High enumerated in `bounded_exit` with an allowed disposition.
- `scripts/lib/reviewer-evidence.mjs` currently rejects launcher findings unless `findings.verdict` starts with `pass`, and separately rejects any High unless the raw reviewer verdict is exactly `pass-with-findings`.
- The review-plan schema has no machine-readable bounded-exit/adjudication object that binds dispositions to launcher findings, the candidate digest, and the terminal round.
- Example Marketplace closeout candidate `940794c79725dc7c7737f599616467a7a868fd17` retains the permitted three cross-family plan-review rounds over successive manifest digests `cf89…`, `7e3d…`, and `124a…`. The immutable final round contains zero Critical findings and returns raw `fail` with two High and two Medium findings. Each finding was evaluated and dispositioned, but schema-v3 `review-plan` receipt emission failed with:
  - `launcher findings do not carry a passing plan verdict`
  - `launcher findings contain unresolved Critical/High`
- The Example Marketplace runtime change itself was already merged, deployed, and live-verified. The contradiction blocks durable governance closeout rather than product runtime behavior, which makes it a replayable framework integration defect rather than a product-state defect.

## Diagnosis

- **Root cause:** WI-491 implemented bounded convergence in skill doctrine and a review-log checker, but schema-v3 receipt evidence still treats the external reviewer's raw verdict as the sole promotion verdict. The local, governed disposition decision is not represented in the receipt contract.
- **Why this is not a duplicate:** WI-491 fixed unbounded review looping and declared bounded disposition authoritative. This proposal completes the missing integration into review-receipt emission and validation.
- **Why prompt wording alone is insufficient:** asking a reviewer to say `pass-with-findings` may reduce occurrences but cannot make independent model wording a deterministic governance primitive.
- **Why raw `fail` must not be accepted by itself:** a generic downgrade would turn reviewer failures into waivers. Acceptance must require a complete, candidate-bound adjudication that is independently validated against every canonical finding.

## Required contract

Add one canonical `bounded_exit` adjudication object to review evidence. It must bind:

- final promotion SHA/tree/digest, plus each round's exact reviewed-subject, launcher-receipt, and findings digests;
- `rounds_run`, the hard cap, and the ordered identities of all rounds;
- canonical finding IDs and severities from the terminal findings artifact;
- one disposition per residual finding: `fixed`, `accept-with-justification`, or `reject-with-justification`;
- non-empty justification plus evidence digests for every accepted/rejected High;
- zero unresolved Critical findings; and
- the deterministic `check-review-round-cap` result and review-log digest.

The receipt validator may accept a terminal raw `fail` only when this complete object validates. Existing raw `pass` and `pass-with-findings` paths remain valid under their current constraints. A Critical finding always blocks.

The contract must distinguish plan-revision iteration from promotion-tree freshness. Successive plan-manifest digests may remain in one bounded cycle when their immutable phase-guard anchor is identical; an execution-tree mutation starts a new cycle. The final promotion tree remains independently exact. A launcher-authoritative cycle identity and locked per-cycle counter must prevent accidental reuse or relabeling a forbidden fourth round as a new cycle.

## Acceptance criteria

- **AC-1 — Doctrine/receipt parity:** A three-round review log with zero unresolved Critical findings and complete residual dispositions can emit and validate a schema-current `review-plan` or `review-exec` receipt even when the terminal reviewer's raw verdict is `fail`.
- **AC-2 — No fourth-round pressure:** The successful bounded-exit path requires no additional external invocation and rejects `rounds_run > 3` within the same authoritative review cycle.
- **AC-3 — Criticals remain blocking:** Any canonical unresolved Critical finding rejects receipt emission regardless of disposition text, owner acknowledgment, or reviewer verdict.
- **AC-4 — Complete finding census:** Missing, duplicate, unknown, or severity-mismatched finding IDs fail closed. Every terminal finding is reconciled exactly once.
- **AC-4a — Complete rubric census:** Every terminal rubric failure is enumerated exactly once, mapped to one or more dispositioned terminal finding IDs, justified, and backed by hash-verified repository evidence. Unread dependencies and failed certifications remain blocking.
- **AC-5 — Evidence-bound High dispositions:** Every accepted/rejected High has non-empty justification and hash-verified evidence. Prose-only or blanket dispositions fail.
- **AC-6 — Immutable reviewer evidence:** The implementation consumes launcher receipts and findings by digest and never edits, normalizes, or replaces their content.
- **AC-7 — Identity freshness:** Wrong WI, review kind, promotion SHA/tree/digest, per-round reviewed-subject digest, review-log digest, launcher digest, or findings digest fails closed.
- **AC-8 — Cycle integrity:** Plan revisions with one immutable phase-guard anchor stay in one bounded cycle; execution-tree changes start a distinct cycle. The launcher refuses and the validator rejects attempts to relabel round 4 as round 1.
- **AC-9 — Existing passes preserved:** Current valid `pass` and `pass-with-findings` receipts continue to validate, and raw `fail` without a valid bounded-exit object continues to fail.
- **AC-10 — Example Marketplace replay:** The immutable three-round Example Marketplace evidence shape reproduces the current receipt failure before the fix and validates afterward using only the new adjudication artifact; no fourth review and no reviewer-artifact mutation are required.

## Negative tests

- Raw `fail`, one residual High, and no bounded-exit object.
- Valid-looking bounded exit with one terminal finding omitted or duplicated.
- A Critical marked `accept-with-justification`.
- A High disposition with prose but no evidence digest.
- Correct dispositions bound to a stale candidate tree or another review kind.
- Three valid rounds plus a hidden fourth launcher receipt.
- Same plan-cycle anchor with a fabricated new cycle identity.
- Changed execution candidate digest reusing dispositions or findings from the prior cycle.
- Altered launcher/findings bytes with unchanged claimed digests.
- Raw `pass-with-findings` regression fixture proving the existing path still works.

## Implementation route

**Route:** normal SVC-on-SVC bugfix pipeline: `diagnose-bug` → `write-spec` → `design-tech` → `explore-solutions` → `plan-changeset` → review → `execute-changeset` → `review-exec` → `audit-implementation` → `land-changeset` → `verify-promotion`.

This changes a hot-path governance contract and validator, so it is not eligible for direct implementation as a proposal-only quick fix.

Likely implementation surfaces after diagnosis/design:

- `schemas/receipts/review-plan.schema.json`
- `schemas/receipts/review-exec.schema.json`
- a shared bounded-exit schema or definition
- `scripts/lib/reviewer-evidence.mjs`
- `scripts/check-review-round-cap.mjs` or a structured companion library
- `scripts/emit-receipt.mjs` and receipt fixtures only where required by the final design
- `skills/review-cross-model/SKILL.md`, `skills/review-plan/SKILL.md`, and `skills/review-exec/SKILL.md`
- focused Tier-1 fixtures covering the positive replay and all fail-closed cases above

## Replay verification target

1. Preserve the original Example Marketplace terminal launcher receipt and findings bytes.
2. Reproduce the current schema-v3 emission rejection.
3. Generate the new adjudication from the exact candidate, review log, and terminal finding census.
4. Validate `check-review-round-cap` and emit the review receipt without an external round 4.
5. Mutate each binding independently and prove fail-closed rejection.
6. Run the full receipt/chain Tier-1 suite and a disposable end-to-end candidate promotion replay.

## Rollback

Revert the new schema, validator, emitter, and skill contract together. Existing raw-pass receipt validation remains the fallback behavior. Never retain an emitter capable of writing bounded-exit receipts after removing the validator that proves them.

## Framework-state mutations after implementation

- **Analysis History:** record the Example Marketplace contradiction and replay result.
- **Known Gaps:** add this gap when promoted to a WI; remove it only after verified promotion.
- **Decisions:** lock one shared terminal-state contract between bounded-review doctrine and receipt validation.
- **Capabilities:** add hash-bound bounded-exit review receipts after live replay proves them.

## Human checkpoint

Approve or revise this contract before WI promotion. This proposal intentionally submits the defect and its required safety properties without changing receipt authority in the same proposal-only commit.
