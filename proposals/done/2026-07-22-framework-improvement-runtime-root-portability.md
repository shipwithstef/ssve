# Framework Improvement: Secure Runtime-Root Portability

**Status:** IMPLEMENTED (2026-07-22, PR #166, `4cce515f6cd6eb03a235d83e81e2393b3e2a5a45`)
**Accepted WI:** WI-506
**Date:** 2026-07-22
**Owner session:** `019f8840-f8bf-7a21-a50c-48d52ed0d526`

## Evidence

- **Source:** Real Codex/WSL host plus the blocked Example Marketplace WI-496 continuation.
- **Finding:** The host exports `XDG_RUNTIME_DIR=/run/user/1000/`, but that directory does not exist. The canonical framework bootstrap exits with `EACCES: permission denied, mkdir '/run/user/1000/svc-ensure-worktree-1000'`. The canonical skill loader separately reaches `lstat('/run/user/1000')` and exits `ENOENT` after graph activation.
- **Reproduction:** From the framework repository, run `node scripts/svc-ensure-worktree.mjs --wi WI-506 --branch framework-WI-506-runtime-root-portability --from origin/main --json --print-cd` with the original host environment. From the Example Marketplace WI-496 worktree, run the canonical installed `codex-load-skill.mjs` command with its existing graph/task/skill tuple.
- **Severity:** Critical. The documented guarded entry path cannot repair itself on a supported host class, and loader ordering can leave graph state ahead of the session receipt.

## Diagnosis

- **Immediate root cause:** Runtime consumers treat any non-empty `XDG_RUNTIME_DIR` as usable without distinguishing absent/uncreatable state from present-but-insecure state.
- **Enabling cause:** Runtime-root policy is independently implemented across Codex context, worktree bootstrap, binding locks, isolation receipts, completion counters, and migration locks. Their fallback and security semantics differ.
- **Ordering cause:** `codex-load-skill.mjs` invokes graph `activate-skill` before resolving and validating session receipt storage and final authority, so predictable storage failure occurs after the graph mutation.
- **Test gap:** Existing tests cover a valid pre-created XDG root and an unset-XDG home fallback, but not an invalid-but-set WSL/container-style root or cross-consumer parity.
- **Category:** Cross-host portability fragility plus partial-activation ordering.
- **Already in FRAMEWORK-STATE.md?** No. The framework records session isolation, installed enforcement, atomic graph activation, and stale-claim recovery, but not host-advertised missing runtime directories.

### Duplicate filter

| Prior WI | Existing responsibility | Why WI-506 is not a duplicate |
|---|---|---|
| WI-486 | Session-isolated bootstrap and documented runtime compatibility layout | Its design assumes the selected runtime base is usable; it does not validate invalid-but-set XDG across consumers. |
| WI-487 | Durable installed enforcement and actionable denials | Installation durability does not select a portable runtime state root. |
| WI-498 | Install-anchored loader and atomic graph task activation | Graph receipt/status are atomic together, but session receipt storage is still resolved afterward. |
| WI-501 | Recovery/read-only escape handling | Does not repair runtime-root selection and cannot be acceptance proof. |
| WI-502 | Durable generation-bound authority and containment | Defines who may mutate, not where ephemeral per-session evidence is safely stored. |
| WI-505 | Stale authority transfer and idempotent resume | Reaches the correct owner only after its own runtime lock directory can be created. |

## Acceptance Criteria

- **RP-01:** Missing or nonexistent host XDG state automatically selects a private user-owned fallback without requiring an environment command.
- **RP-02:** A valid user-owned `0700` XDG runtime directory remains preferred and behavior-compatible.
- **RP-03:** An existing symlinked, foreign-owned, non-directory, or permission-unsafe XDG directory fails closed; insecure existing state is never silently downgraded to fallback.
- **RP-04:** Any explicit SVC override has documented precedence, absolute/canonical validation, and the same trust checks as the selected security boundary.
- **RP-05:** One shared resolver contract owns Node runtime-root selection; all affected Node consumers use it and a pattern gate prevents new direct `XDG_RUNTIME_DIR || ...` policy forks.
- **RP-06:** The shell completion guard consumes equivalent resolver output or a deliberately advisory adapter whose different failure behavior is explicit and tested.
- **RP-07:** The fallback lives under a stable user-owned home/cache state boundary with `0700` directories and `0600` sensitive files; SVC never attempts to create `/run/user/<uid>`.
- **RP-08:** `codex-load-skill` validates runtime storage, graph/task/skill identity, and current authority before the first graph mutation.
- **RP-09:** Graph activation and session-receipt publication have an explicit crash contract: predictable preflight failures leave graph and receipt byte-identical, while a crash after activation is safely recoverable by exact idempotent retry.
- **RP-10:** Existing secure installations and valid-XDG paths remain byte/behavior compatible except for the deliberate ordering guarantee.
- **RP-11:** Focused fixtures cover unset, missing, valid, unsafe, symlinked, foreign-owned, override, WSL-like, partial-state, repeated-load, and cross-consumer cases.
- **RP-12:** All affected focused validators and full Tier-1 run; unrelated baseline failures are classified and never reported as green.
- **RP-13:** All supported host installations refresh with zero drift after landing.
- **RP-14:** The original Example Marketplace WI-496 canonical loader succeeds under the original invalid host environment, records both receipts, and a second load is idempotent.
- **RP-15:** Final proof uses no XDG override, disabled guard, state deletion, old-session impersonation, or manual graph repair.

## Implementation

- **Route:** Full framework pipeline: `research` → `design-tech` → `explore-solutions` → `plan-changeset` → `review-plan` → `execute-changeset` → `review-gate` → `review-exec` → `review-security` → `audit-implementation` → `test-framework` → `land-changeset` → `verify-promotion`.
- **Candidate correction:** Centralize secure runtime selection, distinguish unavailable from insecure roots, migrate every relevant consumer, and reorder loader preflight before graph activation. The design tasks must decide fallback namespace, shell integration, cleanup policy, and the exact post-activation crash contract.
- **Expected files:** One shared runtime-root module; current runtime consumers under `hooks/` and `scripts/`; Codex loader/context; focused Tier-1 validators; contract map, decision, WI, plan, review, state, and capability records.
- **Commits:** implementation branch `39aaaa01`, `2a786c12`, and `560d0092`; PR #166 squash merge `4cce515f6cd6eb03a235d83e81e2393b3e2a5a45`.

## Rollback

Revert the implementation and focused fixture commits as one reviewed correction. Do not delete live runtime directories, claims, bindings, graphs, or receipts during rollback. The rollback restores the prior host failure behavior without migrating durable authority schemas.

## Replay Verification

- **Replay target:** The exact pre-change WI-506 ensure failure and the existing Example Marketplace WI-496 canonical loader, both under `XDG_RUNTIME_DIR=/run/user/1000/` with `/run/user/1000` absent.
- **Required local proof:** Resolver state matrix, all migrated consumer probes, pre-activation byte-identity on failure, idempotent retry, focused Codex activation/execution-integrity fixtures, and full Tier-1.
- **Required promoted proof:** Installed no-override ensure and WI-496 load return success; task is authorized, graph/session receipts agree, repeated load is idempotent, and unrelated worktree/product files are unchanged.
- **Result:** PASS. All eight host installs have zero drift. Under the original invalid-XDG host state and without a runtime override, the Example Marketplace WI-496 ensure transferred generation 2 to 3 once, the second ensure remained at 3, and the installed loader succeeded twice with unchanged graph and product tree. The permanent phase-classifier suite passed 157/157 on promoted main.
- **Evidence:** `docs/specs/verification/wi-506-runtime-root-portability.md`; `.svc/wi506-pre-post-evidence.json`; PR #166 receipt chain on `4cce515f6cd6eb03a235d83e81e2393b3e2a5a45`.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Record the invalid-but-set XDG portability failure and the promoted shared resolver/order correction.
- **Known Gaps:** Add only while WI-506 is active; remove/close after promoted replay.
- **Decisions:** Record unavailable-versus-insecure fallback semantics and preflight-before-mutation ordering.
- **Capabilities:** Update `references/knowledge/svc/CAPABILITIES.md` only after installed cross-host proof succeeds.

## Scope Boundary

This proposal contains one gap: secure portable runtime-root resolution and the loader mutation boundary that depends on it. It does not redesign v1/v2 authority, change product authentication, repair the unrelated proposal-triage backlog, modify Example Marketplace splash code, or import external framework code.
