# Systems Analysis: WI-506 Runtime-Root Portability

**Date:** 2026-07-22
**Branch:** `framework-WI-506-runtime-root-portability`
**Spec:** `docs/specs/work-items/WI-506.md`
**Mode:** full — authority-sensitive host/runtime behavior, >200 changed lines

## Scope and concern coverage

The final implementation and durable evidence change exactly the 66-path
allowlist. The later files under `docs/specs/reviews/`, `docs/specs/security/`
and this audit path are required review outputs, not unplanned implementation.
No Example Marketplace product file is changed.

The full-path concern scan reports `auth-surface`, `session-management`, and
`security-cross-family-review` from the filename
`.svc/session-contract.jsonl`; explicit scanning of the nine changed production
executables matches none. The session contract is routing metadata, not product
authentication. Even so, both required controls ran: the dedicated security
report passed and the exact implementation diff received a different-family
Anthropic review. `pricing-tier-touch` is a lexical match on the directory name
`docs/plans/`, not a billing change. No waiver is used.

## Verification contract

| AC | Required behavior | Verification | Status |
|---|---|---|---|
| RP-01 | Missing/nonexistent XDG chooses a private fallback without an override | Runtime matrix plus live invalid-XDG canonical loader | Confirmed |
| RP-02 | Valid current-user `0700` XDG stays preferred | Valid-XDG matrix and cross-consumer assertions | Confirmed |
| RP-03 | Unsafe existing XDG states deny | Mode, symlink, foreign-owner and non-directory negative cases | Confirmed |
| RP-04 | Explicit override precedence/trust is stable and documented | Matrix covers shared and legacy override precedence, missing/relative/unsafe inputs | Confirmed |
| RP-05 | One resolver owns selection and recurrence is gated | Consumer import scan plus exact one observation-only XDG read | Confirmed |
| RP-06 | Shell completion follows the resolver contract | Session-binding/actionable-denial fixtures cover zero/one invocation and advisory failures | Confirmed |
| RP-07 | Leaves/files are private and `/run/user/<uid>` is never created | Mode/owner assertions, live host stat, absent-parent checks | Confirmed |
| RP-08 | Loader preflights storage and authority before graph mutation | Invalid storage/authority fixtures preserve graph and receipt bytes | Confirmed |
| RP-09 | Predictable failures are stable; crash retry is idempotent | Corrupt/truncated receipt recovery, canonical compare, injected crash and byte-stability cases | Confirmed |
| RP-10 | Valid installations remain compatible | Default-isolation, task-state, Codex-integrity and all-host validators | Confirmed |
| RP-11 | Focused host/transaction/cross-consumer cases exist | New runtime matrix plus nine modified Tier-1 validators | Confirmed |
| RP-12 | Focused and full Tier-1 run with honest classification | Focused GREEN; final aggregate 265 pass, 2 proven base failures, 0 timeout | Confirmed with baseline debt |
| RP-13 | Every supported installation refreshes with zero drift | Source-side all-host fixture passes; real install refresh remains task 15 | Pending promotion proof |
| RP-14 | Original Example Marketplace WI-496 loader succeeds twice with no override | Local WI-506 loader proves corrected path; original promoted replay remains task 15 | Pending promotion proof |
| RP-15 | No bypass, deletion, impersonation, or manual repair is used | Audit history and same-input evidence show canonical commands only | Confirmed so far |
| RP-16 | Mandatory non-executable blend artifacts remain planning-phase | Exact `NOTICES`, registry, `.md/.json/.jsonl/.version` cases pass | Confirmed |
| RP-17 | Executables and durable exec-record still deny plan review | Executable-knowledge, unrelated-reference, post-exec and ancestor-note negative cases | Confirmed |
| RP-18 | Retro-plan exception is owner/SHA/WI/source/path bound and one-off | Authorization digest, receipt checks and hard-cap review log | Confirmed |

## Coverage ledger

| Subsystem | Entrypoints | ACs | Risk | Status |
|---|---|---|---|---|
| Shared root resolution | `resolveRuntimeDirectory`, CLI | RP-01–RP-07 | High | Audited and GREEN |
| Node authority consumers | ensure, claim, isolation, migration, Codex context | RP-02–RP-05, RP-07, RP-10 | High | Audited and GREEN |
| Loader transaction | `codex-load-skill.mjs` | RP-08–RP-10, RP-14 | High | Audited and GREEN |
| Shell completion adapter | `svc-task-completion-guard.sh` | RP-06, RP-07, RP-10 | High | Audited and GREEN |
| Plan-review classifier | `run-external-review.mjs` | RP-16–RP-18 | High | Audited and GREEN |
| Install/promotion | setup and supported hosts | RP-13–RP-15 | High | Source fixtures GREEN; live replay downstream |

## Hypotheses and causal traces

1. **Missing XDG might still reach `mkdir('/run/user/1000/...')`.** Rejected.
   The resolver classifies exact `ENOENT` and enters the real-home cache path;
   the live canonical loader exits zero while `/run/user/1000` remains absent.
2. **Unsafe existing XDG might be mistaken for missing and fail open.** Rejected.
   Only `ENOENT` triggers fallback. Existing symlink, wrong type, owner or mode
   fails before a consumer leaf is created.
3. **Receipt storage or authority failure might still mutate the graph.**
   Rejected for predictable failures. Session storage and `resolveWI` run before
   `activate-skill`, and fixtures compare pre/post bytes.
4. **The unavoidable graph-first crash gap might duplicate activation or corrupt
   a completed receipt.** Rejected. An injected crash leaves graph-only state;
   exact retry forward-completes once, canonical key-order comparison accepts an
   equivalent receipt, and a completed retry is byte-stable.
5. **Shell stderr might become part of a directory path or resolver failure might
   grant authority.** Rejected. Streams are separated, successful output must be
   one absolute line, and failure affects advisory completion pressure only.
6. **The phase fix might hide executable implementation under knowledge paths or
   through Git rename collapsing.** Rejected after remediation. Only exact
   non-executable evidence extensions are exempt; `.mjs` remains implementation
   divergence, and `git diff --no-renames` classifies both sides of staged and
   committed implementation-to-exempt moves with zero provider calls.
7. **Persistent fallback state might become stale authority.** Rejected. Runtime
   files do not serialize correctness. Repository-shared exact-OID Git refs plus
   durable claim/binding/lease generation and zero-drift refresh form the
   authorization/correctness boundary.

## Pre/post evidence

`node scripts/validate-pre-post-validation-evidence.mjs --evidence
.svc/wi506-pre-post-evidence.json` passes. The pre-change probes fail on the
intended missing-XDG runtime, loader transaction, and phase-classifier signals;
the corresponding post-change commands pass. The delta is classified
`fixed-by-change`, not merely branch-introduced or unclassified.

## Specialist audits

Three read-only lenses completed:

- Security found repository-skill symlink disclosure and Bash arithmetic
  injection as High, plus graph/authority binding and split lock namespaces as
  Medium. All four were accepted, fixed, and regression-tested.
- Maintainability found unreclaimed durable claim locks as High. G5 then found
  that blind unlink recovery raced between delayed contenders. The final
  remediation moved claim, binding, bootstrap, and migration correctness locks
  to exact-old-object Git ref transactions and added a two-process stale-reclaim
  serialization test. Its final pass then found malformed-holder auto-reclaim,
  hidden release failure, and implementation-to-exempt rename classification;
  all three were accepted and regression-tested. Its Medium completion-state GC
  and Git subprocess-cost observations are retained below.
- Testing found five Medium evidence gaps. Loader graph+receipt identity,
  key-order replay, unsafe explicit roots, phase extension/override matrices,
  symlink graph rejection, and hermetic task-state/session fixtures were added.
  The actual Stop-hook test proves allow produces no counter and pressure uses
  one mutually exclusive branch; exact subprocess timing remains a non-blocking
  performance observation rather than an acceptance proxy.

## Findings

No Critical or High implementation finding remains open.

- Low: a symlinked `~/.cache` is intentionally rejected. This is a documented
  fail-closed trust boundary with a pre-existing `0700` `SVC_RUNTIME_DIR`
  remediation, not a privilege bypass.
- Informational: the recurrence scan is bounded to production executable roots.
  The current shipped invariant is covered; broader test/skill-local scanning is
  separately backlog-safe.
- Medium, non-blocking lifecycle hardening: persistent completion counters and
  compatibility markers do not yet have a canonical recursive GC. They are
  advisory/non-authoritative, private, and per-session hashed, so this is disk
  hygiene rather than a trust or correctness bypass.
- Medium, non-blocking performance debt: an uncontended correctness lock uses
  six synchronous Git subprocesses; 200 live-holder polls measured 602 Git
  subprocesses and 13.1 seconds against 2 seconds of explicit waits. Exact-OID
  CAS remains correct, but repository metadata caching, batched holder reads,
  bounded backoff, and subprocess-count instrumentation belong in a focused WI.
- Medium, non-blocking test observability: the installed Stop-hook path has
  functional and elapsed-time coverage but no direct resolver subprocess-count
  assertion yet.
- Medium, bounded availability/diagnostic debt: the two hard consumers of the
  new `lock_release_error` result still collapse it into an acquisition error.
  Authority remains denied and exact cleanup evidence survives, but a completed
  bootstrap or migration can be reported and retried as though it never began.
- Medium, bounded host-compatibility debt: repository-local skill resolution can
  lose precedence when its `repoRoot` argument contains a symlinked ancestor;
  it falls back only to the separately trusted installed-skill boundary. Current
  governed installations and direct-root fixtures remain green.

## Residue and exclusions

- No executable TODO, FIXME, stub, test-only failpoint leakage, or orphaned
  runtime selector was found.
- `SVC_CODEX_TEST_FAIL_AFTER_ACTIVATION` is gated by
  `SVC_CODEX_TEST_MODE === "1"`.
- The observed `ensureOwnedDirectory` helper is live through
  `atomicWriteJson`, not dead code.
- No visual, journey, database, API, or product-auth surface exists in this WI.

## Unverified surfaces

- Full aggregate Tier-1 ran twice. The final result is 265 pass, 2 proven
  pre-existing failures, and 0 timeout; the result report preserves the exact
  baseline attribution rather than calling the aggregate all-green.
- Real installed-host refresh, remote merge integrity, idempotent second replay,
  and the original Example Marketplace WI-496 canonical loader are task 15 acceptance
  evidence.

## Verdict

READY TO CONTINUE — the implemented behavior has no unresolved Critical/High
finding. Landing remains blocked on task 13 full Tier-1, final-SHA receipt
completeness, sanctioned merge, installation refresh, and original WI-496 replay.
