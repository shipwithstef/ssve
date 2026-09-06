# Clean-main follow-up: Stage A implementation audit

Status: IMPLEMENTATION AUDIT PASS — Sol confirms no substantive Stage A blocker remains after resumed evidence repair. Final-candidate binding and release checks remain open. This is not landing, installation, or whole-program approval.

## Current verified test evidence

The post-Git-ceiling execution snapshot passed **366 validators, 0 failures, 0 timeouts** in 246931 ms. `inputs_stable` is true. Evidence: `.svc/clean-main-review/full-corpus-git-ceiling.json` and its adjacent `.log`.

- Source SHA-256: `aaacd6f9b5dbd67f1bba9c6e3dc2d860ec212566c837236a8172c595cb72b053`
- Index SHA-256: `835279fd078beba9a681bdd98eed4877c15146bf169fff70b45898025cab0f92`
- Status SHA-256: `6099c80b4eac3ece51dc0174e01aed0aa21928027d1b259341a5eb87fd6403e6`
- Base commit: `848693c4c7e1abc5636479b26b1dd9b37844c2b2`

These identify the tested snapshot. Later source or metadata changes do not inherit its identity automatically. The inventory covers tracked/nonignored source; it does not prove that transient changes or ignored/external state were untouched.

## Scope and execution review

The current plan owns 94 paths and names 49 executable witnesses. Plan and execution mechanical validation pass. The exact Cursor plan review passed on successor round3; the historical over-cap cycle remains nonauthorizing. Sol passed the staged implementation and the two-fixture amendment as same-family advisory review.

Cursor execution round1 failed on caller HOME scratch allocation, cache-replay round accounting, and stale audit reporting. Round2 independently accepted the HOME/audit corrections and the cache counter-evidence: signed review issuance capacity and paid process invocations are distinct; replay receipts require signed issuance. Round3 returned `pass-with-findings`: F-005 identified parent Git discovery from temporary directories; F-006 requested current audit evidence. All raw findings remain under `.svc/clean-main-review/cursor-exec-round-{1,2,3}/`.

F-005 is corrected by setting `GIT_CEILING_DIRECTORIES=/tmp` in the isolated environment. The focused probe checks the actual setting and nested-repository discovery; a synthetic parent repository proves that discovery occurs without the ceiling and is excluded with it. Focused tests passed 22/0; Sol High's bounded correction review passed; the post-correction corpus passed 366/0/0. F-006 is addressed by this snapshot-specific audit update. This prose is written after that run and does not claim its own bytes were present in the snapshot. Final release evidence must bind the final candidate independently.

Cursor's subsequent exact-candidate correction verification returned PASS with no findings for tree `acc85003fc763009cd7d5f3148f4c0765cddb58a`; its canonical review-exec receipt is retained for that tree. Earlier receipts remain historical, unchanged. Final lifecycle metadata still needs exact-candidate binding before release.

The later release-bound corpus passed 364 validators and failed two: task 5 was marked complete without required phase receipts. The first attempted repair then cited a stale failed preflight log and used the wrong evidence type. Sol caught those semantic mistakes despite passing shape checks. The superseded graph was archived through the existing immutable store. Execution was reopened; the actual dispatch preflight was run, P2 points to the implementation diff as a file, verification cites the passing post-ceiling corpus, and a fresh checkpoint precedes completion. All timestamps describe this resumed work, not a fabricated historical sequence. The legacy resolver returned standalone Grok despite the task's explicit Codex executor; the founder's task configuration takes precedence, and no unavailable provider was invoked. Raw output and the decision are preserved in `.svc/clean-main-review/resumed-dispatch-decision.json`.

The schema drill now changes only a private runtime copy. A concurrent drill/receipt-tier run passed with source bytes, mode, and mtime unchanged. Kimi path checks use a literal tilde and here-string matching without weakening their positive/negative assertions.

## Acceptance evidence and limits

| AC | Implementation evidence | Remaining release proof |
|---|---|---|
| 1 | Private HOME/XDG/provider guards; durable-source fixtures; parent-Git exclusion and nested-repo regression pass. | Final-candidate full run; live installation belongs to Stage C. |
| 2 | Cause-specific dispositions and immutable original records; resumed phase evidence corrects the executor's false closure. | Full receipt/skip-integrity validation on final metadata; retain failed runs unchanged. |
| 3 | Archive-backed provenance positive/tamper tests and original SHA objects; existing receipt identity checks retained. | Archive final task evidence before deleting any related worktree. |
| 4 | Execution mechanical/plan contract PASS: 94 owned paths, 49 executable witnesses; persistence PASS96. | Recheck final staged ownership and receipt tree binding. |
| 5 | Router validation reports104 skills; source-derived registry/context checks pass; original hosted-media heuristic retained once. | Stage B separately graduates the preserved UX draft. |
| 6 | Focused22/0 and post-ceiling full366/0/0 with stable inputs; failed364/2 run retained. Unknown/global selection remains full. | Final frozen release corpus; relevant post-commit checks. |
| 7 | Owner task policy uses current Codex executor, Sol advisory, exact Cursor Grok independent; no unavailable provider invoked. | Final candidate receipt, source landing, then Stage C all-host convergence. |

Hypotheses tested include live-home contamination, inherited parent Git, receipt replay identity mismatch, missing immutable evidence, concurrent schema-fixture source mutation, and malformed phase completion. Passing shape checks alone did not prove phase semantics; the resumed audit explicitly checks the actual artifacts and timestamps.

## Preserved history and recovery

The previous audit narrative is preserved as immutable SHA object `7ad6d17e04038f8c246d0f72df3a72878211f1c691c1bc9c09e12fb9c0bf2ea4`. It includes the superseded 365/1 diagnostic and earlier snapshots; none is rewritten as a passing run. The later 364/2 execution diagnostic is retained alongside the passing amended run. Graph and decision-log pre-edit originals are bound in `docs/plans/2026-09-06-clean-main-followup/dispositions.json`; original dirty checkout preservation remains outside the task worktree in the shared Git evidence store.

Current decision-log normalization preserves the original fields/timestamp and archive. The exact canonical row plus uniquely matching audit event was verified read-only; resume requires no append. Existing-file byte rollback preserves current permissions. Missing-file or permission restoration needs original metadata rather than guessed modes.

## Remaining release and program work

Resolve execution findings, obtain the required independent execution result, finish this audit and canonical receipts, and land the reviewed Stage A source through existing tooling. Preserve the final tested/reviewed identity through promotion.

Stage B must still graduate the preserved UX skill and its feature/UX fixtures. Stage C must still verify durable source handoff, all-host installation, original-main convergence, remote synchronization, and exact eligible-worktree cleanup. Active product sessions and unrelated dirty work remain protected. The goal is incomplete until those outcomes are verified.
