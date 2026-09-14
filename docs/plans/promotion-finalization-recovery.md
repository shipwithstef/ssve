# Resume interrupted promotion finalization

WI: WI-FW-PROMOTION-RECOVERY-01
Status: implementation and focused validation; independent review pending.

PR45 merged successfully, then finalization failed because a stale local Git notes cache could not fast-forward. The old publication retry also replaced shared notes history without retaining all collaborators' receipts. The user authorized correcting these framework failure classes while completing the session-recovery release.

## Acceptance Criteria

- **AC-PF-1:** An already merged PR resumes finalization without another merge or stale-base refusal; candidate identity comes from verified PR metadata, not the checkout HEAD.
- **AC-PF-2:** Stale local receipt caches and divergent local notes cannot prevent publication or remove remote collaborators' evidence.
- **AC-PF-3:** Concurrent publication retries from current remote history using normal fast-forward pushes, with a finite retry budget; conflicting receipt content remains refused.
- **AC-PF-4:** Publication requires equal candidate/squash trees and a passing local receipt-chain check. Replaying identical coverage preserves prior evidence despite a changed generation timestamp.

## Plan

T1 changes scripts/merge-pr-with-review-receipt.mjs: detect merged state, bind candidate explicitly, verify before publishing. T2 adds scripts/lib/publish-receipt-notes.mjs: unique temporary notes ref, current entire remote notes history, conflict checks, normal push and bounded fresh retry. T3 adds test-framework/tests/receipt-publication-recovery.test.mjs: actual bare Git remotes and a competing publisher. T4 updates this plan, docs/plans/session-recovery.md and FRAMEWORK-STATE.md with the observed failure, repair and limits.

V1: node --test test-framework/tests/receipt-publication-recovery.test.mjs — stale cache, other contributors, concurrent push, conflicts, repeated coverage and merged-PR replay pass. V2: bash test-framework/evals/tier-1/validate-review-receipt-merge-guard.sh — all 19 existing receipt/merge guards pass. V3: replay the canonical merge wrapper on the already merged PR45 with its exact reviewed candidate; expect DONE without another merge. V3 already succeeded with squash d1bab2f255cb1e1a42e6a5851b272c1f8c68355c; retain actual output as release evidence.

## External state and release

Coupled: framework Git main, GitHub PR identity, shared remote receipt notes, and nine installed host surfaces. Require reviewed source and receipt chain before promotion; update canonical main, run ./setup --all-hosts and bash scripts/check-install-drift.sh --all-hosts. The existing product session remains governed by its separate WI and live-owner checks. No Twilio, deployment, application config, database, payment, SMS or production changes belong to this follow-up.

## Lane and rollback

The owner requested an urgent repair and focused tests. This is an inline framework bugfix; formal plan review is retrospective, not represented as preceding the implementation. Review the frozen plan and exact candidate, emit actual execution/review/audit receipts, promote, verify and install. Full tier-1 is not claimed. Source tests do not replace installed evidence. Roll back by reviewed source revert and canonical setup; never force-push shared notes, erase a live session lock, or edit installed hooks by hand.

## Review corrections

Independent execution review identified a fresh-clone gap: the squash fetch alone does not provide the reviewed feature commit or its published notes. Fetch both identities, fall back to the retained pull-request head ref if necessary, and recover missing local receipts from remote notes using a unique temporary ref. A merged PR with delayed mergeCommit metadata now enters the existing bounded poll rather than a pre-merge refusal. Two additional regressions use network-style single-branch clones which demonstrably lack the candidate object, a distinct local HEAD tree, published candidate-only evidence, and immediate/delayed GitHub commit metadata. All seven tests pass. The prior five tests and 19 merge guards remain required.

The advisory review also identified a present but incomplete local candidate note. Always merge the published remote candidate envelope with local evidence using the same conflict rules before remapping and verification. An eighth regression verifies this stale-partial case retains both local and published evidence. The final required set is eight real-Git tests and 19 existing merge guards.

## Canonical receipt lifecycle correction

PR46 installed the finalizer but G7 publication exposed an omitted canonical envelope type: `digests` is an integrity map, not an indivisible receipt. Merge its disjoint identity entries while refusing unequal values for the same identity. Preserve published and local receipt bodies unchanged. The ninth regression invokes the actual `emit-receipt.mjs` producer twice around publication, then replays an older publisher and attempts a conflicting digest. This correction implements AC-PF-2/3 within T2/T3; it does not change those acceptance criteria or relax evidence checks.
