# G6 Cross-Model Review: Candidate Reservoir

**Date:** 2026-07-23
**Author/orchestrator:** Codex, OpenAI family
**Adversarial reviewer:** Claude Opus 4.8/high, Anthropic family
**Branch:** `framework-WI-508-candidate-reservoir-triage`
**Round 1 request:** `8f16810c-7dd9-4aea-b1b9-51f683b61d1a`
**Launcher receipt:** `.svc/external-review-artifacts/WI-508-g6-round1/receipt.json`
**Schema-valid findings:** `.svc/external-review-artifacts/WI-508-g6-round1/findings.json`

## Round 1 Summary

The canonical launcher returned 13 findings: 3 High, 3 Medium, 6 Low, and 1
informational dependency question. One High, all three Mediums, and three Lows
were accepted and fixed. Two Highs were rejected with design/code evidence.
Round 2 reviews the repaired staged diff and the previously omitted helper
contracts. No Critical finding was returned.

## Round 1 Evaluation

| ID | Severity | Evaluation | Evidence / action |
|---|---|---|---|
| WI508-H1 | High | REJECT-WITH-JUSTIFICATION | Silently skipping malformed shared audit lines would weaken append-only integrity. `appendEventOnce` fails before changing the ledger; the already-committed outbox remains `logged_at IS NULL`, and identical replay heals after the operator repairs the malformed shared ledger. The forced-projection fixture proves this pending-outbox recovery shape. |
| WI508-H2 | High | REJECT-WITH-JUSTIFICATION | The reviewer described the architecture's explicit recovery trust boundary: `CANDIDATE_HARNESS_PLAN.md` states that a new database may reconstruct valid terminal state from a committed Git mirror. TRIAGE-05 applies to the first promote/reject command transition, not import reconstruction. Existing operational rows cannot be made terminal by mirror import, which the stale-mirror fixture proves. |
| WI508-H3 | High | ACCEPT-FIXED | Real contradiction with additive projection semantics. Import now detects an existing row whose `source_mirror` differs, aborts the whole transaction, and preserves the originating mirror. A same-project/scope collision fixture proves the original mirror and DB binding remain intact. |
| WI508-M1 | Medium | ACCEPT-FIXED | Added an actionable `rg` availability preflight so the negative hardcoding scan cannot pass vacuously. |
| WI508-M2 | Medium | ACCEPT-FIXED | Company-link roots must now be non-null JSON objects. Null, array, string, and numeric `app_id` fixtures fail with a path-specific message and never fall back identity. |
| WI508-M3 | Medium | ACCEPT-FIXED | URL project identities now preserve non-default ports; an `example.com:8443` fixture proves separation. |
| WI508-L1 | Low | ACCEPT-FIXED | Mutual exclusion now inspects parsed flags, not operand strings; a rejection reason equal to `--file` is accepted and persisted. |
| WI508-L2 | Low | ACCEPT-FIXED | Added deterministic `--help` usage output and a focused assertion. |
| WI508-L3 | Low | ACCEPT-WITH-JUSTIFICATION | The database is chmodded immediately and journal sidecars remain protected by the private parent directory. Pre-creation hardening is useful but not required for the v1 local-only threat model; security review will revisit it. |
| WI508-L4 | Low | ACCEPT-FIXED | Path values differing from their trimmed form now fail; labels retain intentional trimming. |
| WI508-L5 | Low | REJECT-WITH-JUSTIFICATION | Mirror operands are deliberately repository-relative, matching the persisted `source_mirror` contract and deterministic worktree replay. The exact public command is documented and tested from the repository root. |
| WI508-L6 | Low | REJECT-WITH-JUSTIFICATION | The full focused validator completes in about four seconds locally, within the documented Tier-1 per-validator budget; the deliberate 700 ms contention probe is acceptance-critical. |
| WI508-I1 | Info | RESOLVED-BY-DEPENDENCY-READ | `scripts/state-io.mjs` uses synchronous O_EXCL cross-process lockfiles and synchronous temp/fsync/rename writes. Round 2 includes that helper plus `scripts/company-memory.mjs` and ledger samples. |

## Verification After Round 1 Fixes

- `core`, `rank`, and `triage` groups: PASS independently.
- Full focused validator: pending final round-two replay; pre-fix full run passed.
- Cross-mirror collision: fails transactionally; original projection retained.
- G6 round count: 1 of hard maximum 3.

## Verdict

Round 1: `FIX-AND-REVIEW`. Zero unresolved Critical; the repaired diff required
one bounded second-model round because WI508-H3 changed executable behavior.

## Round 2

**Request:** `3b3dfc38-2f21-4cd1-a1f3-fea76659169c`
**Launcher receipt:** `.svc/external-review-artifacts/WI-508-g6-round2/receipt.json`
**Schema-valid findings:** `.svc/external-review-artifacts/WI-508-g6-round2/findings.json`
**Certified diff:** `4ac0e54f0d3a7d2c4a89f5d91d0cd4601d257aa4ef04e77b88f8e252410466fc`

The reviewer verified every round-one repair and accepted the H1/H2 design
rejections as defensible. It returned one High, four Mediums, five Lows, and
one informational observation. No Critical was found.

| ID | Severity | Evaluation | Evidence / disposition |
|---|---|---|---|
| WI508-R2-H1 | High | REJECT-WITH-JUSTIFICATION | TRIAGE-03 explicitly requires an ambiguous candidate ID across item scopes to fail, and the user-specified promote/reject grammar contains no scope operand. `terminalTransition` binds the resolved project and fails before mutation when more than one scope matches. Adding an implicit recovery or selector would expand the approved CLI contract; operators must resolve candidate IDs/scopes in their mirrors deliberately. |
| WI508-R2-M1 | Medium | REJECT-WITH-JUSTIFICATION | Rank/top are import/evaluate/export commands, not read-only queries. The user requires an auto-exported human/Git mirror and live filesystem grounding; checkout-specific derived diffs are the intended evidence. Seed byte-idempotency is proven when grounding is unchanged. |
| WI508-R2-M2 | Medium | REJECT-WITH-JUSTIFICATION | The outbox is drained by an identical terminal retry by design. A changed WI/reason is a conflicting terminal decision and must fail monotonicity rather than mutate or project different audit content. The direct pending-outbox fixture proves the documented recovery command. |
| WI508-R2-M3 | Medium | ACCEPT-WITH-JUSTIFICATION | Fresh-DB terminal reconstruction is intentionally trusted only from the reviewed Git mirror. The design records this recovery trust boundary and prevents any existing operational row from being changed by mirror import. A provenance marker is a reasonable future schema extension, not a v1 blocker. |
| WI508-R2-M4 | Medium | REJECT-WITH-JUSTIFICATION | `exportMirror` does not serialize the earlier display rows: it calls `rankedRows` again immediately before atomic write. A concurrent promote therefore appears in the exported mirror even if rank stdout began from an earlier snapshot; it cannot persist the stale status alleged. |
| WI508-R2-L1 | Low | REJECT-WITH-JUSTIFICATION | GROUND-02 explicitly accepts contained existing files or directories. Broad-target specificity is a human `/cos` scoring judgment, not a filesystem existence rule. |
| WI508-R2-L2 | Low | ACCEPT-WITH-JUSTIFICATION | The default ledger parent is the repository's existing `.svc` directory; test overrides live under private temp roots. Database state has the explicit private-directory contract. Security review will retain this as a local-permissions lens. |
| WI508-R2-L3 | Low | ACCEPT-WITH-JUSTIFICATION | Full-ledger event-ID dedupe is linear and locked in v1, prioritizing correctness over an auxiliary index. The current shared ledger size is bounded enough for the operator CLI; future scale can add an index without changing event semantics. |
| WI508-R2-L4 | Low | ACCEPT-WITH-JUSTIFICATION | Positive controls, DB/mirror assertions, and focused groups constrain the important negative cases. More stderr-specific assertions would improve diagnostic precision but do not undermine the covered fail-closed behavior. |
| WI508-R2-L5 | Low | ACCEPT-WITH-JUSTIFICATION | SQLite corruption already fails the command before projection; wrapping every stored JSON parse with column-specific diagnostics is useful operational polish, not a correctness boundary for v1. |
| WI508-R2-I1 | Info | REJECT-WITH-JUSTIFICATION | Re-materializing an omitted row is the explicitly documented additive/upsert-only behavior; deletion semantics are outside v1. |

## Round 3 — Audit-repair replay and hard-cap disposition

**Request:** `0f438757-1286-45a4-a4fb-12a522c1dc38`
**Launcher receipt:** `.svc/external-review-artifacts/WI-508-g6-audit-repair-full/receipt.json`
**Schema-valid findings:** `.svc/external-review-artifacts/WI-508-g6-audit-repair-full/findings.json`
**Reviewed staged diff:** `c4a15eebbe12d39cadd2bc8f7e1669abafba114fb7291fb10db9dc64663c9af2`
**Reviewed staged tree:** `416b840aeef2c751bebae846f9c4b9f64c7da144`
**Post-review implementation disposition tree:** `aaf08697ebb3d3804801323d8ca165bd18e6feb9`

An earlier launcher attempt `4c574290-1da1-40b8-9054-790d13a6fcb5`
correctly refused certification because it received only the package header. It
is recorded as packaging failure evidence, not an implementation review round.
The complete package then delivered the live contracts, executable, validator,
seed, state helper, prior findings, resolver receipt, and full staged diff.

| ID | Severity | Evaluation | Evidence / disposition |
|---|---|---|---|
| WI508-R3-H1 | High | ACCEPT-FIXED | Import now queries every scope already bound to the project/source mirror and refuses a scope rename inside the same transaction. The fixture rewrites the same mirror, requires non-zero exit, byte-identical input, and unchanged SQLite row count. |
| WI508-R3-H2 | High | ACCEPT-FIXED | This round-three record replaces the superseded two-round terminal claim. The final `review-exec` receipt is regenerated against the final staged tree and promoted by the post-commit hook. |
| WI508-R3-H3 | High | ACCEPT-FIXED | `review-cross-model` binds this canonical request, and `review-security` reruns after task 17 against the post-review implementation before audit. |
| WI508-R3-H4 | High | REJECT-WITH-JUSTIFICATION | The finding cited stale aggregate-log rows. `.svc/plan-manifest-WI-508.json` and `.svc/review-plan-WI-508.json` were already consumed into staging receipts and are absent from current status/filesystem. Final Tier-1 evidence is regenerated after graph closeout. |
| WI508-R3-M1 | Medium | ACCEPT-FIXED | A fresh-repository promotion with no decision override proves the default `.svc/pipeline-decisions.jsonl` destination, exact event, and `0600` creation mode. |
| WI508-R3-M2 | Medium | ACCEPT-FIXED | Ledger mode is set only when the harness creates the file. A pre-existing shared ledger remains `0644` after append. |
| WI508-R3-M3 | Medium | ACCEPT-FIXED | Rank/top now drains pending outbox entries before import, giving operand-free recovery; both forced ledger and mirror failures heal through plain rank with exactly one event. |
| WI508-R3-M4 | Medium | ACCEPT-WITH-JUSTIFICATION | The stale log demonstrated a diagnostic-growth blind spot, but current residue is disposed and the final aggregate log is regenerated. Changing the repository-wide aggregate parser is outside the candidate engine; final focused and named aggregate classification remain mandatory. |
| WI508-R3-M5 | Medium | ACCEPT-FIXED | `audit-implementation` reruns after security and replaces the iteration-one verdict with a 31/31 READY-TO-LAND record. |
| WI508-R3-L1 | Low | ACCEPT-WITH-JUSTIFICATION | Missing/renamed source mirrors fail after the durable decision and are recoverable by restoring the recorded Git path; silently abandoning Git projection would be worse. |
| WI508-R3-L2 | Low | ACCEPT-FIXED | Candidate-mirror `.lock` and `.tmp.*` crash residue is ignored explicitly. |
| WI508-R3-L3 | Low | REJECT-WITH-JUSTIFICATION | CAND-05 says candidate ID ascending; lexicographic ordering is deterministic for the string identifier contract and the seed uses the fixed three-digit namespace. |
| WI508-R3-L4 | Low | ACCEPT-WITH-JUSTIFICATION | Tab-delimited rows are human/operator output; comma-joined inner fields are explicitly informational and no machine parser contract is claimed. |
| WI508-R3-L5 | Low | ACCEPT-FIXED | Invalid JSON plus empty and whitespace-only `app_id` fixtures join the wrong-root/type matrix. |
| WI508-R3-L6 | Low | ACCEPT-FIXED | The hardcoding family scan now covers both executable and shipped seed. |
| WI508-R3-L7 | Low | ACCEPT-WITH-JUSTIFICATION | The real-store fingerprint is deliberately conservative hermeticity evidence. All harness calls are redirected; a concurrent unrelated writer would produce an explicit, diagnosable failure rather than hide a real operator-store mutation. |
| WI508-R3-I1 | Info | ACCEPT-FIXED | A source comment records that v1 DDL formatting and compatibility fragments are a single load-bearing contract. |

The complete-package reviewer returned zero Critical findings. Every High is
fixed or rejected with current filesystem evidence. Round three is the hard
cap; no fourth adversarial round is permitted.

## Final G6 Summary

- Rounds run: 3 of 3 maximum.
- Unresolved Critical: 0.
- Remaining High: 0 after round-three fixes and dispositions.
- Accepted and fixed: 7 round-one findings.
- Accepted residual risks: trusted terminal reconstruction provenance, local
  ledger-parent permissions, linear ledger scan, diagnostic precision, and
  stored-JSON error wording.
- Cross-family execution review: complete-package request is server-attested
  Claude Opus 4.8/high for the Codex/OpenAI orchestrator, with no fallback.
- Chain-note certification: pending by design until the pre-commit staging
  envelope is promoted to the final SHA by the post-commit hook.

## Final Verdict

`PASS-WITH-DISPOSITIONS`. The loop terminated at the hard three-round cap with
zero unresolved Critical, zero remaining High, and every finding fixed or
explicitly dispositioned. No fourth adversarial round is permitted.
