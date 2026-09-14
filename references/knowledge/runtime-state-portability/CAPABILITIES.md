# Peer Runtime-State Portability — Targeted Capability Snapshot

Analyzed: 2026-07-22
Scope: state-root resolution, advisory-vs-authority files, locks/recovery, and
host portability. This is a targeted cross-source snapshot, not a claim that the
four repositories' complete capability catalogs were refreshed.

## Sources

| Source | Pin | Version | Relevant capability |
|---|---|---:|---|
| gstack | `a3259400a366593e0c909dd9ac3e59752efd2488` | 1.60.1.0 | Central shell resolver for state, plans, and temp roots with explicit host-aware fallback chains. |
| Open GSD | `936a3453810470182421051301f6a0a83552bf89` | 1.8.0 | Advisory context bridge in `os.tmpdir()`; validates path key and deliberately never blocks tools. |
| GSD 2 | `33c00aaffa56e5d394bccce1c8df59fb842e84c5` | 3.0.0 | Project-local exclusive session lock with path snapshot, PID metadata, compromise detection, stale recovery, and retry. |
| Superpowers | `d884ae04edebef577e82ff7c4e143debd0bbec99` | 6.1.1 | Harness-agnostic skill bodies with thin installer-owned host bootstrap/tool adapters and zero runtime dependency policy. |

## Transferable conclusions

- Centralized, inspectable root precedence improves portability, but gstack's
  best-effort behavior is unsuitable for authorization state.
- Fail-open temp files are sound for advisory hints only. The same behavior at
  an authority boundary is a privilege/control failure.
- Snapshotting a lock path and making acquisition/recovery idempotent avoids
  root drift within one operation.
- Host portability is easiest to sustain when the portable core owns invariants
  and each harness adapter owns only delivery mechanics.
- None of the sources validates the specific invalid-but-set XDG case with
  SVC-equivalent ownership/mode semantics. WI-506 therefore needs an SVC-native
  policy rather than a direct transplant.

## Details

See [runtime-state.md](details/runtime-state.md) for mechanisms, trade-offs,
source pointers, and the SVC application.
