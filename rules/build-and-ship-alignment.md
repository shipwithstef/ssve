---
description: Build and release artifacts must prove source, artifact, runtime, and store-version alignment before being called upload-ready.
scope: global
stack: universal
type: correction
source: local
source_sha: null
last_evaluated: "2026-05-31"
---

# Rule: Build And Ship Alignment

Never call a build artifact upload-ready from a successful local build alone.
The source revision, embedded version, artifact filename, release note, and
target runtime/store constraints must all agree.

## Development worktree artifacts

A mobile build made during `execute-changeset` is a development artifact, not a
canonical release. When a consumer provides
`schemas/mobile-build-contract.json`, derive its worktree application/bundle
identity, display label, epoch-based development code, and artifact filename
through `scripts/mobile-build-identity.mjs`. Use only the contract's JSON argv
adapter commands, debug or ad-hoc signing, and worktree-local state. Invoke the
repository-reviewed inspection argv directly; never evaluate adapter commands
as shell strings or trust an argv returned by build output.

Development identities must be stable for the same branch and distinct across
branches so builds are co-installable and keep separate app data. Development
epoch allocation remains physically separate from release allocation.
Development epoch codes are non-release codes.
A development build and its development receipt must never edit canonical version fields.
It must not reserve a canonical build number or be accepted as upload-ready or
promotion evidence.

## Canonical release artifacts

Canonical identity and version allocation happen exactly once at
`land-changeset`, under the release-ledger lock. The remote store is authority;
`ledger_floor` is conservative evidence used only through
`max(remote_floor, ledger_floor, last_canonical, highest_reserved) + 1`, never
proof that a code is reusable. Reserve the selected code durably before the
release build. A failed build consumes that reservation, and a retry must
re-read the floors and allocate a higher code.

Release allocation is idempotent for the same source SHA and platform: resumes
return the existing live reservation, while a failed reservation permits only
an explicit higher-code retry. Allocation takes the source SHA, platform, and
an optional controlled time value and binds them to the ledger row. Recording a
failure needs failure evidence, not a fabricated artifact or digest.

Release proof must include the remote floor, the exactly-one canonical
allocation, inspected artifact metadata, and exact equality among canonical
application/bundle identity, version/build code, version name, source commit,
artifact filename, and release receipt. The configured artifact template must
render the exact basename of a real regular, non-symlink file. The engine must
compute SHA-256 from that file and require the same `artifact_sha256` in the
receipt, fresh trusted inspection metadata, and source/platform-bound ledger
row. Paired JSON files, a local ledger, or a successful build cannot replace
independent artifact-byte verification.

For Android / Google Play releases:

1. Inspect `android/app/build.gradle` before building.
2. Prove `versionCode` is greater than the latest code already uploaded to any
   Play track. If Play Console is not accessible, use a repo ledger or release
   note that explicitly records the latest known uploaded code.
3. Bump `versionCode` and usually `versionName` before producing the AAB.
4. Name the artifact with both values, for example
   `<App>-<versionName>-vc<versionCode>.aab`.
5. Verify the built manifest or bundle metadata contains the same
   `versionCode` / `versionName` as the filename and release note.

A repo ledger is evidence, not authority. If Play Console or a user-visible
upload error says the `versionCode` has already been used, the ledger is stale:
update the ledger/release evidence, bump to the next unused `versionCode`, and
rebuild. Do not ship the same Play-named artifact again.

Existing release artifacts are also evidence. If
`build-artifacts/<App>-<versionName>-vc<versionCode>.aab` already exists, treat
that `versionCode` as potentially consumed unless Play Console or release
records explicitly prove it was never uploaded. Local overwrite flags such as
`ANDROID_RELEASE_OVERWRITE=1` may replace a file on disk, but they do not prove
the Play `versionCode` is reusable.

Forbidden claims:

- "Gradle succeeded, so the AAB is upload-ready" without a Play version-code
  floor check.
- Reusing an Android `versionCode` because only the local file changed.
- Reusing an Android `versionCode` because the project ledger is behind Play
  Console or because an existing artifact was overwritten locally.
- Naming/copying `app-release.aab` without embedding the version in the
  artifact filename or release evidence.

The same principle applies to iOS: `CFBundleVersion` must be higher than the
latest App Store Connect build number for that marketing version before an IPA
is called upload-ready.
