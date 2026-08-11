# Framework Improvement: Android Play Version Reuse Guard

## Gap

The build-and-ship alignment rule rejected Gradle-only Android upload claims and
required a Play `versionCode` floor check, but it did not cover a second-order
failure: the project ledger can be stale, and a local overwrite flag can rebuild
the same Play-named artifact even after that code was consumed in Play Console.

## Evidence

Example Marketplace produced `Example Marketplace-1.0.31-vc32.aab` again after Play had already used
`versionCode 32`. The local ledger said the floor was lower, and the release
script allowed an existing artifact to be overwritten. Google Play correctly
rejected the rebuilt artifact because store uniqueness is based on Play state,
not local file state.

## Change

- `rules/build-and-ship-alignment.md` now states that repo ledgers are evidence,
  not authority, and that Play Console/upload errors override stale local data.
- The rule now treats existing Play-named artifacts as evidence that the code may
  already be consumed unless Play/release records prove otherwise.
- Local overwrite flags are explicitly rejected as proof that a Play
  `versionCode` is reusable.
- `concerns/build-ship-alignment.md` records the repeat Example Marketplace stale-ledger
  failure mode.
- `test-framework/evals/tier-1/validate-build-ship-android-version-gate.sh`
  now checks these requirements.

## Acceptance

- A future agent cannot call an Android AAB upload-ready just because Gradle
  succeeded, a stale ledger says the code is free, or an existing artifact was
  overwritten locally.
- On any Play Console conflict, the required correction is: update the
  ledger/release evidence, bump to the next unused `versionCode`, rebuild, and
  verify manifest/bundle metadata.

## Rollback

Revert this proposal plus the rule, concern, and tier-1 eval edits if the
framework moves Android release checks into a stronger dedicated release skill
with equivalent stale-ledger and overwrite coverage.
