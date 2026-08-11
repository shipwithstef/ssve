# Systems Analysis: Candidate Reservoir and Triage Engine

**Date:** 2026-07-23T09:07:00+03:00
**Branch:** `framework-WI-508-candidate-reservoir-triage`
**Spec:** `docs/specs/features/candidate-reservoir.md`
**Mode:** full
**Verdict:** READY TO LAND — iteration-two replay closes every accepted audit finding; zero unresolved Critical or High findings

## Upstream contract and scope

The v3 plan-manifest baton was read first and contains all 31 AC digests. Each digest was checked against the live feature spec; the baton is a navigation index, not a replacement for the spec. Because this chain deliberately defers its single implementation commit until `land-changeset`, iteration two audited staged implementation tree `d94f792ad769d6795745a5b12f003ac2faa435f3` with staged-diff digest `82f5f4b034e5d5c98de63d092ad5b5ffe89378f4`. The manifest's final expected path list and the staged path list match exactly: 35 planned files, zero unplanned, zero missing.

The acceptance-critical pre/post evidence validates as `fixed-by-change`: the selected focused command failed before implementation because the harness did not exist and now passes all core, rank, and triage groups. Final aggregate Tier-1 improves from 266 passed / 3 failed to 268 passed / 2 failed: the Candidate Harness validator passes, `validate-no-svc-residue.sh` is resolved, and the two remaining named failures are unchanged baseline debt. This is not represented as an all-green aggregate result.

## Verification contract

| AC | What the implementation must do | Verification | Result |
|----|---------------------------------|--------------|--------|
| CAND-01 | Import and print every candidate in descending composite order. | Full 50-row rank fixture and exact ordering assertions. | Confirmed |
| CAND-02 | Bound top output and reject invalid N values. | `--top` count plus zero, negative, non-integer, and malformed CLI failures. | Confirmed |
| CAND-03 | Re-import without duplicate identity or nondeterministic export. | Row-count assertion and byte-hash comparison after unchanged rerank. | Confirmed |
| CAND-04 | Reject malformed/invalid mirrors before state or ledger side effects. | Invalid JSON, missing field, duplicate ID, `1e400`, range, path, and state matrix; row/ledger counts unchanged. | Confirmed |
| CAND-05 | Break score ties by candidate ID. | Deliberate tie fixture asserts ascending ID order. | Confirmed |
| CAND-06 | Ship exactly CAND-001 through CAND-050. | Independent seed count, uniqueness, sequence, and metadata check. | Confirmed |
| GROUND-01 | Report exact valid/total count on every row. | Mixed-existence output assertions include `1/5`, `0/0`, `1/1`, and `0/1`. | Confirmed |
| GROUND-02 | Count only contained existing regular files/directories. | Lexical/realpath code trace plus contained file/directory fixture. | Confirmed |
| GROUND-03 | Diagnose absolute, escape, broken, and outside-symlink targets as invalid. | Hostile-path fixture asserts all names in `invalid_targets`. | Confirmed |
| GROUND-04 | Map empty target lists to 0/0 and zero score. | Empty-target fixture asserts ratio and numeric dimension. | Confirmed |
| GROUND-05 | Derive grounding as valid/total times 100. | Mixed-target output asserts `1/5` and `20.00`. | Confirmed |
| GROUND-06 | Read target metadata without modifying targets. | README byte hash before and after rank and triage. | Confirmed |
| SCORE-01 | Require roles and exactly four authored dimensions. | Strict mirror validation and missing/extra shape fixtures. | Confirmed |
| SCORE-02 | Require finite scores in inclusive 0..100. | Boundary/range fixtures and valid-JSON `1e400` non-finite fixture. | Confirmed |
| SCORE-03 | Apply the exact 35/25/20/-10/-10 formula. | Byte-exact top-ten fixture and focused formula assertions. | Confirmed |
| SCORE-04 | Display two decimals but sort using unrounded values. | Two candidates display `42.50`; higher unrounded value sorts first. | Confirmed |
| SCORE-05 | Ignore and recompute imported derived values. | Poisoned composite/grounding metadata fixture is overwritten by live derivation. | Confirmed |
| SCORE-06 | Print ID, type, roles, five dimensions, score, ratio, status. | Output contract regexes cover every field. | Confirmed |
| TRIAGE-01 | Promote one active candidate to the supplied WI. | CLI, SQLite, mirror, and event assertions. | Confirmed |
| TRIAGE-02 | Reject one active candidate with a nonblank reason. | CLI, blank-reason failure, SQLite, mirror, and event assertions. | Confirmed |
| TRIAGE-03 | Fail missing and cross-scope ambiguous terminal lookups. | Missing-ID and duplicate-scope fixtures fail closed without mutation. | Confirmed |
| TRIAGE-04 | Make identical retries idempotent and conflicts monotonic. | Sequential and concurrent identical retries produce one event; conflict is refused. | Confirmed |
| TRIAGE-05 | Append one complete event per first terminal transition. | JSONL payload inspection, stable `event_id`, outbox recovery, and dedupe replay. | Confirmed |
| TRIAGE-06 | Record only the boundary decision, never create a WI/customer row. | Repository snapshot and work-item absence assertions; no customer DB module exists. | Confirmed |
| ISOLATE-01 | Prefer valid nonblank company-link `app_id`. | Precedence, blank, malformed, and non-object config fixtures. | Confirmed |
| ISOLATE-02 | Fall back through normalized origin then basename. | HTTPS with port, SCP, credential/query stripping, absolute/file remote, and basename fixtures. | Confirmed |
| ISOLATE-03 | Contain no proprietary/customer-DB hardcoding. | Adjacent literal-family static sweep across script source. | Confirmed |
| ISOLATE-04 | Default to native local SQLite outside Git/customer data. | Node `DatabaseSync` trace and redirected temp-state proof; default-store hash unchanged. | Confirmed |
| ISOLATE-05 | Allow hermetic DB and decision-ledger redirection. | Every focused fixture uses temporary repositories and explicit state overrides. | Confirmed |
| ISOLATE-06 | Isolate identical candidate IDs across projects. | Two-project fixture proves independent rank, transition, and mirror state. | Confirmed |
| ISOLATE-07 | Use transactional schema/import/transition with bounded contention. | `BEGIN IMMEDIATE`, 5-second busy timeout, rollback paths, future-schema failure, partial-schema rejection, and concurrent transition fixture. | Confirmed |

## Coverage ledger

| Subsystem | Entrypoints | Risk | AC coverage | Status | Findings |
|-----------|-------------|------|-------------|--------|----------|
| CLI and project identity | `parseArgs`, `resolveProjectId` | High | CAND-01..02, ISOLATE-01..03 | audited | none |
| Mirror validation and import | `validateMirror`, `importCandidates` | High | CAND-03..06, SCORE-01..02, ISOLATE-06..07 | audited | none |
| Filesystem grounding and scoring | `grounding`, `composite`, `rankedRows` | High | GROUND-01..06, SCORE-03..06 | audited | none |
| SQLite schema and lifecycle | `openDatabase`, `transaction` | High | ISOLATE-04..07 | audited | none |
| Terminal triage and outbox | `terminalTransition`, `flushOutbox` | High | TRIAGE-01..06 | audited | none |
| Seed and focused validator | validator groups `core`, `rank`, `triage` | High | all 31 ACs | audited | none |

## Falsifiable hypotheses and results

1. **A mirror re-import can bypass explicit triage.** Falsified: conflict updates preserve SQLite terminal fields, and same-scope cross-mirror reassignment is refused inside the import transaction.
2. **A crash between SQLite and JSONL loses or duplicates a decision.** Falsified: forced projection failure retains a pending outbox row; retry emits one stable-ID event, including append-before-ack replay.
3. **A repository move causes terminal export to write the old absolute path.** Falsified: the stored mirror is relative, projection resolves under the current real root, and the old path remains absent.
4. **Two identical concurrent terminal commands conflict or duplicate audit evidence.** Falsified: bounded SQLite locking serializes them and both return successfully with one event.
5. **Imported derived scores can influence ranking.** Falsified: code grounding and composite are recomputed from current filesystem state and authored score dimensions on every rank.
6. **Project identity can leak URL credentials or local absolute paths.** Falsified: origin normalization removes credentials/query fragments and rejects absolute/file remotes in favor of the workspace basename.

## Specialist convergence

The independent testing and security/data-migration specialists received disjoint, read-only audit assignments. Iteration 1 intentionally did not converge: the testing lens reproduced three High and three Medium evidence gaps, while the security/data lens reproduced three Medium integrity gaps and one Low hardening gap. All ten findings were accepted and repaired. Iteration two converges: the all-group hostile validator passes, the refreshed security review passes, and the fresh G5 review reports zero Critical/High/Medium findings.

The canonical G6 review reached its three-round hard cap on the full audit-repair package. Its one substantive High finding, same-mirror item-scope reassignment, is repaired and covered by a hostile fixture. Evidence-binding and required-review findings are closed by the tree-bound G5, G6, cross-model, and security records. Stale baton and parser concerns are dispositioned because their batons were consumed into staging receipts and the final aggregate result is regenerated below. Default/shared ledger mode behavior, operand-free outbox recovery, invalid config, seed portability, and crash-residue ignores are all implemented and replayed.

Performance is proportionate to the CLI contract: import is linear over candidates using prepared statements within one transaction; grounding is linear over declared targets; ranking is O(n log n); the lookup index covers project/candidate/scope. Synchronous filesystem and SQLite calls do not block a server event loop because no server exists. Database closure runs in `finally`; transaction paths roll back on exceptions.

## Concern coverage

| Concern | Disposition |
|---------|-------------|
| data-model-mutation / database-migration | Addressed by baselined SQLite v1 design, security report, schema constraints, compatibility checks, and focused migration fixtures. No customer migration exists. |
| security-cross-family-review | Addressed by two canonical Claude Opus 4.8/high rounds and the dedicated security report. |
| build-ship-alignment | Addressed by this full audit and the required promoted-main replay still gated after land. |
| auth/session/OAuth/PII/secrets/paid API/provider/deploy/pricing | Scanner keyword matches only; no corresponding executable surface or dependency exists. |
| blocking I/O | Deliberate for a local synchronous CLI, not a request hot path. |

## Findings — iteration 1, closed in iteration 2

1. **AUDIT-TEST-01 (High) — CLOSED:** the validator rejects every unknown `CANDIDATE_TEST_GROUP` before running fixtures.
2. **AUDIT-TEST-02 (High) — CLOSED:** the negative matrix now covers top bounds, malformed mirrors and scores, blank reject reasons, missing IDs, and ambiguous scopes.
3. **AUDIT-TEST-03 (High) — CLOSED:** promote/reject ledger assertions bind action, WI/reason, candidate, status, project, scope, actor, timestamp, and stable event ID.
4. **AUDIT-TEST-04 (Medium) — CLOSED:** a direct `SVC_STATE_DIR/store.db` fixture proves default path selection and private modes.
5. **AUDIT-TEST-05 (Medium) — CLOSED:** bounded busy-timeout plus identical and conflicting concurrent transitions prove atomicity and monotonicity.
6. **AUDIT-TEST-06 (Medium) — CLOSED:** regular files, directories, internal/outside symlinks, absolute/escape paths, and target byte preservation are asserted.
7. **AUDIT-DATA-01 (Medium) — CLOSED:** configuration and default-ledger parents are realpath-contained beneath a real repository `.svc` ancestor.
8. **AUDIT-DATA-02 (Medium) — CLOSED:** an existing matching event ID must carry a deeply equal payload or delivery fails closed.
9. **AUDIT-DATA-03 (Medium) — CLOSED:** unregistered, older, newer, partial, malformed-shape, and comment-obscured schemas fail closed without version stamping.
10. **AUDIT-DATA-04 (Low) — CLOSED:** state-directory/database permission enforcement propagates `chmod` failures; ledger behavior preserves pre-existing shared-file mode deliberately.

All ten iteration-one findings are closed by implementation and executable fixtures. The G6 same-mirror re-scope finding is also closed. No unresolved Critical, High, or Medium implementation-integrity finding remains.

## Residue

- Executable, focused validator, and seed contain zero `TODO`, `FIXME`, `HACK`, `XXX`, placeholder, or stub markers.
- No unused import or unreachable command branch was identified.
- Canonical ignored review artifacts are retained for the final tree-bound receipt consolidation; consumed plan/review batons are absent and are not stale workspace residue.
- Default-checkout Gemini residue is outside this worktree and remains protected until `land-changeset` creates a path-limited named stash.

## Unverified surfaces

- Final commit SHA, Git-note receipt envelope, remote PR, squash-merge SHA, and promoted-main runtime replay do not exist yet. They are intentionally owned by `land-changeset` and `verify-promotion` and must not be inferred from this local audit.
- Node reports `node:sqlite` as experimental in the installed runtime. The required API is present and all functional fixtures pass; this is a platform-status warning, not a WI-508 correctness failure.

## Verdict

- [x] READY TO LAND — no unresolved Critical/High findings
- [ ] FIX-AND-REENTER — audit findings require implementation and exact-tree review replay
- [ ] CONDITIONAL — High findings accepted without repair

G5, G6/cross-model, security, and the iteration-two systems audit all pass. The task graph advances to the final framework test gate; commit-SHA, remote merge, and promoted-main proof remain correctly unverified until their owning stages.
