---
name: build-ship-alignment
domain: infra
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/build.gradle"
    - "**/Info.plist"
    - "**/AndroidManifest.xml"
    - "**/capacitor.config.*"
    - "**/package.json"
    - "**/version.txt"
    - "**/VERSION"
    - "**/CHANGELOG.md"
    - "**/Dockerfile"
    - "**/Procfile"
    - "**/fly.toml"
    - "**/vercel.json"
    - "**/netlify.toml"
    - "**/build-artifacts/**"
    - "**/dist/**"
    - "**/.github/workflows/**"
    - "**/scripts/build*"
    - "**/scripts/deploy*"
    - "**/scripts/release*"
  diff_keywords:
    - "versionCode"
    - "versionName"
    - "CFBundleVersion"
    - "CFBundleShortVersionString"
    - "\"version\":"
    - "BUILD_CANARY_VERSION"
    - "deploy.*POST"
    - "POST.*deploy"
  packages_imported: []
  env_vars_referenced: []

handled_by:
  required_rules: [build-and-ship-alignment]
  required_skills: [audit-implementation]
  optional_skills: []

waiver_format: |
  PR body line: "concern-waived: build-ship-alignment — <reason>"
  Acceptable: doc-only edit to CHANGELOG.md, comment-only diff in build files,
  test-mode env var change.

fires_on:
  - version-bump
  - artifact-build
  - deploy-config-change
  - release-pipeline-edit

fires_off:
  - "**/*.test.*"
  - "**/__tests__/**"
  - "**/docs/**"

related_concerns:
  - deploy-rollback-plan
  - canary-deploy
  - feature-flag-rollout
---

# What this concern is

A change is touching the path between "source committed" and "artifact / runtime serving traffic." Misalignments between source state, artifact identity, deployed runtime, and declared version are silent failures that produce unuploadable artifacts, debug-by-PR loops, and "we shipped X but rolled back Y silently" incidents.

# How an agent should think about it

The full discipline is the `build-and-ship-alignment` rule. Quick checklist:

1. **Source matches** — the git ref reflects exactly what was built / shipped
2. **Artifact matches** — filename + embedded version + contents reflect that source state
3. **Deploy matches** — the runtime serving traffic was built from the same commit
4. **Declaration matches** — commit message, PR title, release notes name what's in the artifact
5. **Working tree clean** — nothing uncommitted is implied by the artifact

A violation of any of the five = work is not done.

## Mobile worktree development identity

Mobile worktrees may produce co-installable development artifacts only when a
consumer contract derives a stable branch-suffixed application/bundle identity,
display label, epoch-based development code, and traceable filename. Those
builds use worktree-local allocation state plus debug or ad-hoc signing. They
must keep app data separate, must not edit canonical version fields, and must
emit a development receipt. Development epoch codes are non-release and a
development receipt is never promotion evidence.

Canonical release identity stays separate. Allocate it exactly once during
`land-changeset` under the release-ledger lock, before the release build. The
remote store remains authority; `ledger_floor` is conservative evidence used
only through `max(remote_floor, ledger_floor, last_canonical,
highest_reserved) + 1`, never proof that a code is reusable. Failed release
builds consume their reserved code, so a retry re-reads the floors and allocates
a higher one. Allocation is source-and-platform idempotent while its reservation
is live; only an explicit retry may replace a failed reservation with a higher
code. Failure evidence does not require a fake artifact or digest. Promotion
requires a fresh direct invocation of the trusted configured inspection argv,
not trust in paired JSON alone. The configured filename must exactly name a
real regular, non-symlink artifact, and the engine-computed SHA-256 must equal
`artifact_sha256` in the release receipt, fresh metadata, and the
source/platform-bound ledger row.

## Android / Google Play hard gate

For Play uploads, `versionCode` is a store-global monotonic counter for the
package. A local Gradle-successful `app-release.aab` is **not** upload-ready
until the agent has proved:

- `android/app/build.gradle` was inspected after the latest code changes.
- `versionCode` is greater than the latest code already uploaded to any Play
  track, using Play Console or a project-maintained ledger/release note.
- `versionName`, `versionCode`, artifact filename, and release note agree.
- The built manifest or bundle metadata contains the same `versionCode` and
  `versionName` that appear in the filename.

The ledger is evidence, not authority. When Play Console or an upload error says
the code has already been used, the ledger is stale and must be corrected before
another upload-ready claim. Existing Play-named artifacts under `build-artifacts/`
are also evidence: overwriting one locally does not make its `versionCode`
reusable in Play. The default correction is to bump to the next unused code,
rebuild, and verify the new manifest/bundle metadata.

If any of those are missing, route back to release-preflight/build correction
before telling the user to upload the AAB.

# Why it exists

Originated 2026-05-07 from Example Marketplace session: five misalignments stacked in one ~1hr window — AAB built from working tree with uncommitted version bump (unuploadable), AAB filename was timestamp-only instead of `<App>-<v>-vc<vc>` convention, AAB dropped to `~/Desktop` instead of `build-artifacts/`, Base44 secret rotated without function-level redeploy, bundle-grep was the only thing proving deploy took. Each individually small; compound effect was ~1 hour of avoidable motion.

Reinforced 2026-05-29 from Example Marketplace Play upload failure: the generated
`Example Marketplace-1.0.30-vc31.aab` built and signed locally, but Google Play rejected it
because `versionCode 31` had already been used. The framework-level fix is to
require a Play version-code floor check before upload-ready claims.

Reinforced 2026-05-31 from Example Marketplace repeat failure: the project ledger said the
Play floor was lower than reality, and an existing `Example Marketplace-1.0.31-vc32.aab`
was overwritten locally. Google Play still rejected `versionCode 32` as already
used. Framework-level correction: ledger data and local overwrites are weaker
than Play state; on conflict, bump instead of rebuilding the same code.

# Examples

**Matches:**
- Editing `android/app/build.gradle` to bump `versionCode`
- Touching `Info.plist` for an iOS release
- Editing `package.json` `version` field
- Modifying `.github/workflows/release.yml`
- Adding a new build script under `scripts/`

**Does NOT match:**
- A code change in `src/` that doesn't touch build/deploy config
- A doc note in CHANGELOG.md describing what shipped (still important but not blocking)
