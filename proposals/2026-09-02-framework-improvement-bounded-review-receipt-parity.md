# Framework improvement: bounded-review disposition must be receiptable

**Status:** DRAFT — human checkpoint before WI promotion
deferred_until: 2026-09-03
reason: Awaiting owner review of the submitted proposal before WI promotion.
**Date:** 2026-09-02
**Category:** review convergence / receipt integrity
**Severity:** high
**Source:** HoursHub PostHog mobile closeout, reported by the owner and reproduced against the installed framework

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
- HoursHub candidate `940794c79725dc7c7737f599616467a7a868fd17` completed the permitted three cross-family plan-review rounds. The final round contained zero Critical findings but returned raw `fail` with three High and one Medium findings. Each finding was evaluated and dispositioned, but schema-v3 `review-plan` receipt emission failed with:
  - `launcher findings do not carry a passing plan verdict`
  - `launcher findings contain unresolved Critical/High`
- The HoursHub runtime change itself was already merged, deployed, and live-verified. The contradiction blocks durable governance closeout rather than product runtime behavior, which makes it a replayable framework integration defect rather than a product-state defect.

## Diagnosis

- **Root cause:** WI-491 implemented bounded convergence in skill doctrine and a review-log checker, but schema-v3 receipt evidence still treats the external reviewer's raw verdict as the sole promotion verdict. The local, governed disposition decision is not represented in the receipt contract.
- **Why this is not a duplicate:** WI-491 fixed unbounded review looping and declared bounded disposition authoritative. This proposal completes the missing integration into review-receipt emission and validation.
- **Why prompt wording alone is insufficient:** asking a reviewer to say `pass-with-findings` may reduce occurrences but cannot make independent model wording a deterministic governance primitive.
- **Why raw `fail` must not be accepted by itself:** a generic downgrade would turn reviewer failures into waivers. Acceptance must require a complete, candidate-bound adjudication that is independently validated against every canonical finding.

## Required contract

Add one canonical `bounded_exit` adjudication object to review evidence. It must bind:

- review kind, WI, candidate SHA/tree/digest, and the exact terminal launcher receipt/findings digests;
- `rounds_run`, the hard cap, and the ordered identities of all rounds;
- canonical finding IDs and severities from the terminal findings artifact;
- one disposition per residual finding: `fixed`, `accept-with-justification`, or `reject-with-justification`;
- non-empty justification plus evidence digests for every accepted/rejected High;
- zero unresolved Critical findings; and
- the deterministic `check-review-round-cap` result and review-log digest.

The receipt validator may accept a terminal raw `fail` only when this complete object validates. Existing raw `pass` and `pass-with-findings` paths remain valid under their current constraints. A Critical finding always blocks.

The contract must also define candidate mutation after review: any tree/digest change invalidates the adjudication and requires a newly governed review cycle for the new candidate. A cycle identity and per-cycle three-round counter must prevent both accidental reuse and relabeling a forbidden fourth round as a new cycle.

## Acceptance criteria

- **AC-1 — Doctrine/receipt parity:** A three-round review log with zero unresolved Critical findings and complete residual dispositions can emit and validate a schema-current `review-plan` or `review-exec` receipt even when the terminal reviewer's raw verdict is `fail`.
- **AC-2 — No fourth-round pressure:** The successful bounded-exit path requires no additional external invocation and rejects `rounds_run > 3` within the same candidate/review cycle.
- **AC-3 — Criticals remain blocking:** Any canonical unresolved Critical finding rejects receipt emission regardless of disposition text, owner acknowledgment, or reviewer verdict.
- **AC-4 — Complete finding census:** Missing, duplicate, unknown, or severity-mismatched finding IDs fail closed. Every terminal finding is reconciled exactly once.
- **AC-5 — Evidence-bound High dispositions:** Every accepted/rejected High has non-empty justification and hash-verified evidence. Prose-only or blanket dispositions fail.
- **AC-6 — Immutable reviewer evidence:** The implementation consumes launcher receipts and findings by digest and never edits, normalizes, or replaces their content.
- **AC-7 — Candidate freshness:** Wrong WI, review kind, SHA, tree hash, candidate digest, review-log digest, launcher digest, or findings digest fails closed.
- **AC-8 — Cycle integrity:** A changed candidate starts a distinct governed cycle; the validator rejects attempts to evade the cap by renaming round 4 as round 1 without a new candidate digest and cycle identity.
- **AC-9 — Existing passes preserved:** Current valid `pass` and `pass-with-findings` receipts continue to validate, and raw `fail` without a valid bounded-exit object continues to fail.
- **AC-10 — HoursHub replay:** The immutable three-round HoursHub evidence shape reproduces the current receipt failure before the fix and validates afterward using only the new adjudication artifact; no fourth review and no reviewer-artifact mutation are required.

## Negative tests

- Raw `fail`, one residual High, and no bounded-exit object.
- Valid-looking bounded exit with one terminal finding omitted or duplicated.
- A Critical marked `accept-with-justification`.
- A High disposition with prose but no evidence digest.
- Correct dispositions bound to a stale candidate tree or another review kind.
- Three valid rounds plus a hidden fourth launcher receipt.
- Same candidate digest with a fabricated new cycle identity.
- Changed candidate digest reusing dispositions or findings from the prior cycle.
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

1. Preserve the original HoursHub terminal launcher receipt and findings bytes.
2. Reproduce the current schema-v3 emission rejection.
3. Generate the new adjudication from the exact candidate, review log, and terminal finding census.
4. Validate `check-review-round-cap` and emit the review receipt without an external round 4.
5. Mutate each binding independently and prove fail-closed rejection.
6. Run the full receipt/chain Tier-1 suite and a disposable end-to-end candidate promotion replay.

## Rollback

Revert the new schema, validator, emitter, and skill contract together. Existing raw-pass receipt validation remains the fallback behavior. Never retain an emitter capable of writing bounded-exit receipts after removing the validator that proves them.

## Framework-state mutations after implementation

- **Analysis History:** record the HoursHub contradiction and replay result.
- **Known Gaps:** add this gap when promoted to a WI; remove it only after verified promotion.
- **Decisions:** lock one shared terminal-state contract between bounded-review doctrine and receipt validation.
- **Capabilities:** add hash-bound bounded-exit review receipts after live replay proves them.

## Human checkpoint

Approve or revise this contract before WI promotion. This proposal intentionally submits the defect and its required safety properties without changing receipt authority in the same proposal-only commit.
