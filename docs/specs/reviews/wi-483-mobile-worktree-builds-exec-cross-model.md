# WI-483 execution cross-model review

**Gate:** review-exec / G6
**Author host:** Codex
**Adversarial reviewer:** Claude Fable, high effort
**Frozen input:** staged WI-483 implementation diff
**Verdict:** PASS

## Scope reviewed

- `scripts/mobile-build-identity.mjs` allocation, locking, path control, state
  transitions, receipt equality, and filename proof
- `schemas/mobile-build-contract.schema.json` consumer and ledger boundary
- execute, land, and verify skill wiring
- build-and-ship rule and concern alignment
- fake-adapter and regression validators
- WI-483 acceptance criteria and frozen manifest

## Review convergence

Round 1 found one High and three Medium issues: development state could alias and
overwrite the release ledger; schema/runtime aliases and the fixture drifted;
development-as-release and transition-skip negatives were absent; and filename
proof used substring matching. The implementation was corrected at the engine,
schema, doctrine, and Tier-1 layers.

Round 2 confirmed every High and Medium finding closed and returned `APPROVE`.
It left two Low items: reject `tmp/../...` state traversal and record the bounded
validator deviation. The traversal is now rejected before lock or file creation
and pinned by a negative test. Round 3 reproved all substantive closures and
returned `APPROVE_WITH_DOCUMENTATION_NOTE` solely because this evidence file did
not exist yet; the note below closes that final process item.

The subsequent mandatory security, testing, and performance audit then found a
deeper AC-483-5 gap not exercised by the earlier suite: matching JSON could
certify a nonexistent or incorrectly named artifact, release allocation was not
source/platform-idempotent, and the named fake adapter only logged calls. That
audit correctly reopened execution. Round 4 now requires real regular artifact
bytes, exact contract-rendered filenames, engine-computed SHA-256 bound into the
ledger, source/platform-idempotent reservations with stale-floor rejection,
runtime/schema-aligned contract validation, and a fake adapter that actually
prepares, builds, allocates, and inspects without a shell. Final verdict remains
pending until cross-model and specialist re-review confirm these fixes.

Round 5 reviewed the final containment and evidence-strictness delta. Fable
confirmed contract-root artifact containment, JSON-number enforcement, closed
adapter-output fields, and committed replay floor semantics, then returned
`APPROVE`. The security specialist independently returned PASS; all earlier
testing and performance findings are now pinned by the 12/12 lifecycle matrix.

## Frozen-manifest deviation

`test-framework/evals/tier-1/validate-output-discipline-guard.sh` was modified
outside the manifest's Files Planned list as a bounded test-harness robustness
fix. The new always-injected build rule contains Markdown backticks; the old
validator interpolated hook output into `bash -c`, allowing command substitution
and causing a false failure. The fix replaces that unsafe interpolation with a
direct fixed-string predicate. It changes no product or routing behavior and is
covered by the validator's 27/27 passing checks.

`proposals/triage.json` received mechanical SLA housekeeping at the final land
gate: the three July 14 proposals were deferred to July 29 pending formal
archive, residual-map, and WI-481 program closeout. This does not alter WI-483
behavior or disposition and avoids claiming proposal promotion prematurely.

## Final findings state

| Severity | Open | Disposition |
|---|---:|---|
| High | 0 | Real artifact, exact filename, and digest proof confirmed |
| Medium | 0 | Idempotency, floor, closed-schema, and runtime alignment confirmed |
| Low | 0 | Traversal fixed; bounded deviation recorded above |

The implementation is safe to advance through audit convergence and landing.
