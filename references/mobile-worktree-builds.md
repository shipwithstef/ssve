# Mobile worktree build identity

This contract gives each linked worktree a stable, co-installable development
identity without changing the canonical release identity. It is a framework
capability, not proof that a consumer mobile application has adopted it.

## Identity boundary

Treat development and release identities as separate domains.

| Property | Development worktree build | Canonical release build |
|---|---|---|
| Application identity | Canonical ID plus `.wt_{branch_slug}_{branch_hash}` | Canonical application/bundle ID |
| Display label | Canonical label plus `[slug-hash]` | Canonical display name |
| Version source | Worktree-local epoch allocator | Remote floor plus durable release ledger |
| State | Gitignored worktree runtime file | Durable, reviewed release ledger |
| Signing | `debug` or `adhoc` only | Consumer-controlled release signing |
| Promotion evidence | Never accepted | Inspected canonical artifact and release receipt |

The derived suffix also gives the operating system a separate data container.
Do not share production entitlements, keychain access groups, app groups,
push-notification environments, deep-link ownership, or production credentials
with a development identity unless the consumer adapter explicitly maps and
reviews that behavior. A suffix alone does not make an entitlement safe.

## Deterministic derivation

Normalize the full branch name to lowercase `[a-z0-9_]`, collapse runs of all
other characters to one underscore, trim surrounding underscores, and truncate
the result to 18 characters. Use `branch` when normalization would otherwise be
empty. Compute `branch_hash` as the first eight lowercase hexadecimal characters
of SHA-256 over the original, unmodified branch name.

Append `.wt_{branch_slug}_{branch_hash}` to the canonical application ID and use
`Canonical Name [branch_slug-branch_hash]` as the development label. The hash is
part of identity: two branches that truncate to the same slug must still differ.
Derivation is stable for the same complete branch name and independent of the
current commit. Reject the result when it violates a configured platform's
identifier grammar or length cap; never silently truncate the canonical ID or
hash.

## Development allocation

Use integer UTC Unix seconds as the candidate development code. Under an
exclusive lock next to the configured worktree-local state file, allocate:

```text
max(candidate_epoch_seconds, last_code + 1)
```

Persist the new value atomically before returning it. Ten calls in the same
second therefore produce ten strictly increasing values. Concurrent allocators
must serialize through the same lock and produce no duplicates. Reject a value
above `development.max_code`; Android contracts must not set that cap above
`2100000000`.

Build artifact names include project, branch slug and hash, compact UTC
timestamp, allocated code, source short SHA, and platform. The receipt and
post-build inspection must agree with the exact configured filename, not merely
contain similar tokens. The named artifact must resolve to a real regular,
non-symlink file. The engine computes SHA-256 from its bytes and requires the
same `artifact_sha256` in the receipt and fresh inspection metadata. Deleting a
development artifact does not reset the allocator. Remove its runtime state
only when the linked worktree is being permanently cleaned up and no build is
running.

## Release allocation lifecycle

Development state is never a release floor. Under a release-ledger lock,
allocate:

```text
max(remote_floor, ledger_floor, last_canonical, highest_reserved) + 1
```

The adapter obtains `remote_floor` from the relevant app store or authoritative
release service. `ledger_floor` is conservative local evidence, never evidence
that an absent or failed code may be reused. Write a durable `reserved` ledger
row before invoking a canonical build.

The release command takes `--sha <source-sha> --platform <android-or-ios>` and
optional `--now <epoch>` in addition to both floors. A live reservation is
idempotent by source SHA plus platform: repeating allocation for the same pair
returns the existing reservation rather than consuming another code. The row
binds source SHA and platform at reservation time. A previously failed row is
not resumable; only an explicit retry may allocate a new code, and that code
must be higher than every floor and reservation.

Move that exact allocation through the following state machine:

```text
reserved -> built -> committed
        \-> failed
```

Inspection moves a successful build to `built`; land moves that same row once to
`committed` and advances `last_canonical`. A failed build becomes `failed`, but
its number remains consumed. A retry re-reads all floors and reserves a new,
higher number. Rollback removes or reverts the release artifact and canonical
source change but never deletes the consumed ledger row or lowers a floor.
The `reserved -> failed` transition records failure evidence and does not
require or fabricate an artifact path, metadata document, or SHA-256 digest.

Allocate the canonical value exactly once during `land-changeset`, after review
gates and before the release build. `execute-changeset` may allocate development
codes only. `verify-promotion` rejects a development receipt even when its code
is numerically above the canonical floor.

## Adapter boundary

Store the consumer contract at `schemas/mobile-build-contract.json`. Validate it
against `schemas/mobile-build-contract.schema.json`. Every command is a JSON argv
array; shell command strings are forbidden. Treat only the configured,
repository-reviewed argv as trusted. Invoke it directly without a shell,
interpolation, `eval`, or replacement argv from adapter/build output, and pass
runtime values through documented arguments or environment variables.
The consumer owns Gradle, Xcode, signing, and store integration; the framework
owns identity allocation and equality checks.

An adapter inspection result binds at least mode, platform, application ID,
optional iOS bundle ID, version code/build number, version name, display label,
artifact path, source SHA, and branch hash. Verification requires exact equality
among the allocation receipt, freshly inspected metadata, exact configured
artifact filename, source commit, identity, and mode. Built and committed
evidence also requires `artifact_sha256`: the engine opens the real regular,
non-symlink artifact, computes SHA-256 itself, and requires equality with the
receipt, metadata, and ledger binding. Verification must freshly invoke the
trusted configured inspection argv and cannot accept two mutually consistent
JSON files as proof of artifact contents.

Use fake argv adapters for framework tests. They must not discover or invoke
Android SDK, Gradle, Xcode, CocoaPods, signing services, or app stores.

## Consumer onboarding

1. Add and schema-validate `schemas/mobile-build-contract.json` in a separate
   consumer work item.
2. Implement argv adapters for prepare, build, inspect, floor lookup/allocation,
   and canonical build without shell interpolation.
3. Ensure `development.state_file` is gitignored and scoped to the linked
   worktree; keep it physically separate from the release ledger.
4. Map development identifiers, labels, entitlements, signing, and artifact
   output without editing canonical release fields.
5. Prove two branch builds coexist on a real device or emulator and keep
   independent application data.
6. Prove release-floor lookup, failed-allocation non-reuse, inspected artifact
   equality, signing, and store acceptance in the consumer environment.
7. Record cleanup and rollback procedures before enabling the capability in
   execute, land, or promotion workflows.

Until that consumer work item supplies real SDK, device, signing, and store
evidence, report this feature as framework-supported only—not live-validated for
the application.

Unix-second development codes reach Android's configured `2100000000` ceiling
in 2036. The allocator deliberately fails closed at that point; consumers must
migrate to a reviewed successor code strategy before the ceiling is reached.

## Failure rules

- Reject branch collisions, invalid identifiers, cap overflow, stale locks,
  symlink/non-file artifacts, filename mismatches, digest mismatches, and receipt
  mismatches; do not repair them by weakening the contract.
- After a crashed allocator leaves a stale `.lock`, first prove the recorded PID
  is no longer alive and no allocator is running, then remove only that lock
  file. Never delete or lower the development state or release ledger.
- Preserve allocation state and the adapter transcript after failure.
- Never copy a development application ID, code, signing profile, or receipt
  into canonical release proof.
- Never infer store authority from the local ledger alone.
- Never edit consumer Gradle, Xcode, provisioning, or signing files from this
  framework changeset.
