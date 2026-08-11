# Problem Brief: Secure Runtime-Root Portability

## Problem statement

SVC must execute guarded bootstrap and skill-loading commands on hosts where
`XDG_RUNTIME_DIR` is unset, valid, or advertised but absent, without requiring a
manual environment workaround and without weakening authority when an existing
root is unsafe.

## Upstream context

- Vision principles: deterministic guarded execution, proof over proxy,
  cross-host portability, and recoverable state.
- Persona constraints: N/A — framework enabler consumed by developers and AI hosts.
- Key ACs: WI-506 RP-01 through RP-15.
- Journey complexity: six runtime consumers, one shell bridge, two loader state
  files, installed-host refresh, and original external-repository replay.
- Baseline: `docs/specs/tech/runtime-root-portability.md`.

## Success criteria derived from ACs

### Must

- RP-01/RP-02/RP-03: missing XDG works, valid XDG stays compatible, unsafe XDG denies.
- RP-05/RP-06: one Node policy with explicit shell parity.
- RP-07: private modes and no creation of `/run/user/<uid>`.
- RP-08/RP-09: predictable loader failures are no-write and crash retry is exact.
- RP-11/RP-12: focused matrix and honest full-suite attribution.
- RP-13/RP-14/RP-15: installed zero drift and original no-workaround replay.

### Should

- Preserve existing consumer leaf names on valid XDG.
- Add no runtime dependency or service.
- Keep resolution O(1) and diagnostics actionable.

### Nice

- Make future direct XDG policy forks mechanically detectable.
- Provide an operation-local structured classification for diagnostics.

## Baseline approach

One shared dependency-free Node resolver classifies explicit, valid XDG,
unavailable XDG, and unsafe roots. Missing/unset XDG falls back to a private
home cache, while unsafe existing state fails closed. Shell calls a thin CLI.
The loader preflights storage and authority, then uses graph-first activation
and exact retry for the unavoidable cross-file crash gap.

## Assumptions to challenge

1. Runtime coordination must remain outside repository state.
2. Home cache is the right unavailable-XDG fallback.
3. Unsafe existing state must deny rather than fall back.
4. Two-file forward recovery is safer than rollback or journaling.
5. Node should own the policy even though one consumer is shell.
6. A direct-policy pattern gate is worth the maintenance cost.

## Constraints

No root privilege, no product mutation, no state deletion, no authority schema
redesign, no new external service, no bypass of installed guards, and no claim
of completion before real no-override WI-496 replay.
