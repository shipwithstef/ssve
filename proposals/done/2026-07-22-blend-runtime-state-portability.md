# Blend Plan: Runtime-State Portability Patterns for WI-506

**Status:** IMPLEMENTED (2026-07-22, WI-506, PR #166, `4cce515f6cd6eb03a235d83e81e2393b3e2a5a45`)
**Accepted WI:** WI-506
**Date:** 2026-07-22
**Scope:** Runtime-root selection, authority-state safety, locking/recovery, and host portability only.

## Sources and pins

| Source | Current pin | Version | License | Relevant surface |
|---|---|---:|---|---|
| gstack | `a3259400a366593e0c909dd9ac3e59752efd2488` | 1.60.1.0 | MIT | `bin/gstack-paths` |
| Open GSD | `936a3453810470182421051301f6a0a83552bf89` | 1.8.0 | MIT | `hooks/gsd-context-monitor.js` |
| GSD 2 | `33c00aaffa56e5d394bccce1c8df59fb842e84c5` | 3.0.0 | MIT | `src/resources/extensions/gsd/session-lock.ts` |
| Superpowers | `d884ae04edebef577e82ff7c4e143debd0bbec99` | 6.1.1 | MIT | `docs/porting-to-a-new-harness.md` |

All observations below are tied to these exact source snapshots. No external
code or runtime dependency is imported.

## SVC capability baseline

SVC already has the stronger authority model: repository-shared claims and
bindings, generation-bound transfer, task/phase receipts, fail-closed guards,
atomic graph activation, and exact replay proof. Its gap is narrower but
load-bearing: six consumers independently select an ephemeral runtime root,
and the skill loader mutates graph state before proving that its session receipt
boundary is writable and trusted.

## Dual assessment

### Assessment A — techniques to absorb

- **gstack: ADOPT WITH MODIFICATION.** Adopt the single resolver interface and
  explicit precedence-chain shape. Replace its best-effort/fail-open semantics
  with SVC's security classification: unavailable roots may fall back; existing
  unsafe roots deny.
- **Open GSD: SKIP for authority, retain as a boundary example.** `os.tmpdir()`
  plus silent failure is appropriate for advisory context warnings because loss
  of the file cannot grant mutation authority. It is unsafe for SVC claims,
  bindings, locks, or authorization receipts.
- **GSD 2: RETAIN SVC, reinforce recovery tests.** Its project-local lock,
  snapshotted path, PID metadata, stale-owner recovery, and idempotent retry
  validate SVC's existing lock/ownership direction. Importing `proper-lockfile`
  would add a dependency without solving root trust or loader ordering.
- **Superpowers: RETAIN SVC host adapters.** Its harness-agnostic content plus
  thin per-host bootstrap is a sound portability split. Its zero-runtime-state
  architecture cannot replace SVC's intentional durable authority evidence.

### Assessment B — external addon viability

No source is a viable runtime addon for WI-506. All are MIT-compatible, but
none exposes an interop contract for SVC's claim/binding generations and task
receipts. Adding one would duplicate state ownership and make incident recovery
harder. The correct integration is conceptual and dependency-free.

## Full targeted dimensional comparison

| Dimension | gstack | Open GSD | GSD 2 | Superpowers | SVC | Verdict | Action |
|---|---|---|---|---|---|---|---|
| Root-selection ownership | One shell resolver | Host `os.tmpdir()` | Project `.gsd/` roots | Avoids runtime state | Six local policies | gstack shape better | HYBRID |
| Precedence visibility | Explicit documented chain | Host implicit | Project-root implicit | Install mechanism implicit | Divergent implicit chains | gstack better | IMPROVE |
| Invalid-but-set environment | Best-effort, caller fails later | Host library decides | Not central to lock root | Avoided | Fails late/inconsistently | gap in all peers | SVC-native |
| Existing unsafe root | No ownership/mode validation | No authority use | Project state assumptions | N/A | Partial checks per consumer | SVC intent better | KEEP + centralize |
| Missing root fallback | Local/project fallback | OS temp fallback | Project-local state | N/A | Unset-only fallback | peers more portable | HYBRID |
| Root creation | Best effort | OS-managed | Project state created | N/A | Some consumers create advertised root | gstack avoids privileged create | IMPROVE |
| Advisory-state failure | Fail open | Deliberately silent | N/A | N/A | Mixed | Open GSD correct for advisory only | KEEP boundary |
| Authority-state failure | Not modeled | Not modeled | Exclusive project session lock | Not modeled | Fail closed | SVC better | KEEP |
| Lock concurrency | Caller-level files | None for context bridge | OS lock + PID metadata | None | Atomic mkdir/CAS generations | comparable, different scope | KEEP |
| Lock path stability | Resolver output reused | `os.tmpdir()` per process | Snapshot at acquisition | N/A | Recomputed in places | GSD 2 insight useful | IMPROVE |
| Stale-owner recovery | Minimal | Stale timestamps ignored | PID/stale/retry recovery | N/A | Exact-generation CAS transfer | SVC stronger | KEEP |
| Crash after state mutation | Caller discovers failure | Advisory loss accepted | Retry/recovery paths | N/A | Loader can partially activate | GSD 2 discipline better at edge | IMPROVE |
| Retry idempotency | Not authority-bearing | Advisory overwrite | Explicit reacquisition | Content bootstrap repeats | Graph activation idempotent, receipt edge incomplete | GSD 2 reinforces need | IMPROVE |
| Host portability | Env/plugin/home/local | Node host temp | Node/project-local | Thin harness adapters | Multi-host hooks/installers | Superpowers split useful | KEEP + resolver adapter |
| Windows/WSL behavior | TMP/TMPDIR/project fallback | `os.tmpdir()` | Node/project paths | Per-harness install | Invalid Linux-style XDG blocks WSL | peer fallback better | IMPROVE |
| Dependency burden | Shell only | Node built-ins | `proper-lockfile` | Zero runtime deps | Node/shell built-ins | SVC should stay dependency-free | SKIP addon |
| Security boundary clarity | Warns values unsanitized | Clearly advisory | Lock ownership local to process/project | No authority boundary | Strong but path policy fragmented | SVC can be best after fix | HYBRID |
| Install/runtime drift | Tool resolver shipped with framework | Hook uses runtime-relative path | Bundled extension | Installer-owned host adapters | Installed hooks plus repo scripts | comparable | KEEP + drift proof |
| Testable failure contract | Late caller failure | Silent no-op | Lock/recovery tests | Acceptance transcript | Missing invalid-XDG matrix | GSD 2 stronger at recovery | IMPROVE |
| Audit provenance | No authority receipt | No authority receipt | Lock metadata | No authority receipt | Receipt chain and decision log | SVC better | KEEP |

## Hybrid blend plan

1. Add one dependency-free SVC Node resolver that returns a structured source,
   resolved root, and trust classification.
2. Use an explicit precedence chain, inspired by gstack's central resolver:
   secured SVC override, valid XDG runtime root, then a private user-home cache
   fallback when XDG is absent or unavailable.
3. Preserve SVC's stricter security boundary: an existing non-directory,
   symlinked, foreign-owned, or permission-unsafe root is hostile and fails
   closed. Never create `/run/user/<uid>`.
4. Make the shell completion guard consume a small Node bridge so path policy is
   not forked into shell.
5. Snapshot the selected path for each operation, following GSD 2's consistency
   lesson, and preflight all predictable authority/storage checks before graph
   activation.
6. Define the post-activation crash contract as exact idempotent retry; never
   weaken authority failures to Open GSD's advisory fail-open behavior.
7. Keep per-host installation as a thin adapter and prove installed-file drift,
   consistent with the useful part of Superpowers' harness split.

## Rejected alternatives

- **Always use `/tmp` or `os.tmpdir()`:** portable but too weak for authorization
  receipts on shared systems.
- **Always ignore invalid XDG:** would silently downgrade an attacker-controlled
  existing root.
- **Create `/run/user/<uid>`:** SVC is not the login/session manager and must not
  manufacture that trust boundary.
- **Adopt `proper-lockfile`:** solves a different problem and adds dependency and
  recovery complexity.
- **Remove runtime authority state:** would discard SVC's core auditable guard
  model instead of fixing its portability.

## Attribution and licensing

This plan uses architectural observations only. No source text or code is
copied, so no new runtime notice is required. Existing source registry entries
will record the reviewed pins and dispositions at implementation closeout.

## Implementation handoff

The accepted outcome is an SVC-native shared resolver plus loader preflight and
recovery contract. `design-tech` must specify the exact fallback namespace,
validation algorithm, shell bridge, operation snapshot semantics, and test
matrix before `plan-changeset`. This proposal authorizes no product-repository
change and no Example Marketplace splash diagnosis.

## Implemented outcome

WI-506 implemented the selected hybrid without importing external code or a
runtime dependency. The shared resolver, thin shell bridge, exact-OID Git lock
boundary, preflight-before-activation loader, and idempotent retry contract are
promoted. All eight declared hosts report zero drift, and the original
invalid-XDG Example Marketplace WI-496 ensure/loader path passes twice without a runtime
override or product-tree change. See
`docs/specs/verification/wi-506-runtime-root-portability.md`.
