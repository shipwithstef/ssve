# Combined release — 2026-09-26

The owner explicitly directed completion of all PRs and activation after the review timeout and sole-codeowner conflict were disclosed. The existing administrator merge authority is used for this release only; repository rules and CI requirements remain intact. The recorded exception is not an independent approval or fabricated phase receipt.

PR #117 integrates the unique reviewed sources in dependency order: #114, #113, #84, #74, #91, #100, #90, #92, #93, #94, #78, #82, #83, #98, #111, #112, #99, #76, #109, #107, #110 and #108, followed by the advisory runtime changes. Shared conflicts preserve the reviewed bounded timeout implementation, its regression fixtures and canonical-source validation. The test inventory is recounted from disk.

The old #115/#116 aggregates add no unique intended production behavior. Their source PRs and #91 permanent integration cases are retained. After #117 merges, close all originals with links to the combined merge rather than merge the partial aggregates.

Two unrelated hosted fixture races were reproduced in the PR111 run history. The short SQLite lock holder now uses a bounded 5-second busy timeout for its COMMIT; its 700ms hold and separate long-lock assertions remain. The reconcile consumer fixture waits for its detached packaged driver's terminal outcome and lock release before deleting private state. Neither change weakens a production assertion.

Release proof requires combined free checks and independent Sol source review, the exact GitHub squash commit, canonical main at that commit, all-host setup, drift checks and installed advisory-mode smoke tests. Prior individual green checks do not certify this combined tree. Formal historical phase receipts remain incomplete and are not retroactively synthesized.
