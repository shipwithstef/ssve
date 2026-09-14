# WI-483 security review

**Scope:** mobile identity allocator, artifact proof, release ledger, adapter boundary
**Verdict:** PASS

## Threat boundaries checked

| Boundary | Evidence | Result |
|---|---|---|
| State and ledger paths | Prefix, traversal, symlink, target/lock collision, and foreign-shape negatives | PASS |
| Allocation concurrency | Exclusive `0600` locks, atomic fsync+rename writes, concurrent uniqueness matrix | PASS |
| Artifact provenance | Contract-root containment, regular non-symlink open, exact template basename, descriptor-streamed SHA-256 | PASS |
| Release proof | Canonical identity, source/platform/floors/timestamp/path/digest bound to one ledger row | PASS |
| Lifecycle integrity | Only reserved→built→committed or reserved→failed; skips, downgrade, reuse, and evidence mutation rejected | PASS |
| Adapter execution | Repository-reviewed JSON argv invoked with `shell:false`; no shell interpolation or mobile SDK in framework tests | PASS |

## Findings convergence

The first specialist pass found that mutually consistent JSON could certify a
nonexistent artifact and that allocation was not idempotent per source/platform.
Both were blocking. The final implementation independently opens and hashes real
artifact bytes, requires the configured exact filename, binds immutable evidence
to the reservation, and returns at most one active or committed allocation for a
source/platform. Failed attempts remain consumed and permit only a higher retry.

The re-audit returned PASS. Fable independently confirmed the same closures and
the final contract-root containment, closed-field, numeric-type, and stale-floor
hardening. No Critical, High, Medium, or Low security finding remains open.

## Trust statement

The framework verifies bytes, identity fields, receipt equality, and ledger
integrity. Platform-specific manifest semantics remain the responsibility of the
repository-reviewed `inspect_artifact` adapter. The execute, land, and promotion
skills require fresh direct invocation of that configured argv; paired JSON alone
is not accepted as operational proof.

Real signing, device coexistence, entitlements, and store acceptance remain a
separate consumer-repository work item by WI-483 design.
