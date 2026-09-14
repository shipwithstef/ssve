# WI-505 Promotion Verification

**Verdict:** VERIFIED — live acceptance path passed; unrelated Tier-1 baseline/environment debt acknowledged
**Promotion:** PR #163, squash commit `9ae4728b3fd75eee680702d15732dd0b7ea5c11e`
**Reviewed tree:** `cea62c29b802f687d72fe12dc0819261cb8a9455`
**Target class:** framework CLI authority, no browser or visual surface
**Verification tier:** behavioral installed-framework replay

## Promotion and installation

- GitHub reports PR #163 merged at 2026-07-21T08:17:50Z.
- The squash tree equals the reviewed branch tree.
- `plan-manifest`, `review-plan`, `exec-record`, `review-exec`, and `audit-implementation` notes validate on the squash SHA and are published to `refs/notes/svc-receipts`.
- Canonical main fast-forwarded cleanly to the squash SHA.
- `./setup --host codex` completed and `check-install-drift.sh` passed for antigravity, claude, codex, cursor, gemini, kimi, mimo-code, and opencode.
- Protected stash `c4f5b0193894dc6a353e45e010b19350715f2cd1` remained the first stash entry and was never applied, dropped, rewritten, or absorbed. The WI-504 worktree was not touched.

## Original WI-496 replay

The pre-replay live tuple matched the owner report:

- claim schema v1, generation 1;
- owner `019f7d76-65f3-73d0-9dd8-46379d081e21`;
- branch `wi-496-native-splash-transition` at `939f0321d6fa80edbed45f8415f12f408f4644fb`;
- complete exact claim/binding coordinates;
- claim stale beyond its 24-hour TTL.

The original command was run from `/home/svc-user/app-workspaces/example-marketplace` with current thread identity `019f8308-97bf-75e1-b71e-a496dbeea02c` and no break-glass or state deletion. It exited 0:

```json
{"wi":"WI-496","branch":"wi-496-native-splash-transition","base_sha":"939f0321d6fa80edbed45f8415f12f408f4644fb","absolute_worktree":"/home/svc-user/app-workspaces/example-marketplace/.worktrees/wi-496-native-splash-transition","absolute_graph":"/home/svc-user/app-workspaces/example-marketplace/.worktrees/wi-496-native-splash-transition/.svc/lane-tasks-WI-496.json","owner_session":"019f8308-97bf-75e1-b71e-a496dbeea02c","claim_generation":2,"created":false,"resumed":true}
```

Postconditions:

- claim generation is 2 and records `transfer_from_generation: 1` plus the exact old session;
- old binding generation 1 is released and points to the current session/generation;
- current binding generation 2 is the only unreleased binding;
- current resolver classification is `owned` with authority true;
- old resolver classification is non-authoritative with `no exact session binding`;
- graph SHA remains `5627e293daeba545ca589b592bd88a9340687c77d8edb2c126e8dcd9b62b7426`;
- tracked-tree SHA remains `ea94d8367e2df54a6bf1605bb2c131086e7f236912f78a62cd823bd1f985bff9`;
- HEAD remains `939f0321d6fa80edbed45f8415f12f408f4644fb`, with a clean worktree;
- the ignored/untracked name-set hash becomes identical to the pre-replay hash `ef32d2d8e8ec285e78b37828a008a417612225bd6f817a9d59d5df74312cac0a` when the one sanctioned new binding path is excluded.

A second identical ensure exited 0 with `created=false`, `resumed=true`, the same current owner, and generation 2. No second generation bump or additional binding occurred.

## Focused and full validation

All owner-required focused checks passed on the reviewed/promoted tree:

- session/worktree binding: 26/26;
- default-checkout isolation: 14/14, including the WI-505 stale/fresh/race/mismatch/crash/v2/idempotence/data-preservation fixture;
- controller lease handover, operation scope authority, and Codex first-task activation: PASS;
- Node syntax checks for ensure, claim, and resolver: PASS.

Full Tier-1 was executed repeatedly. The frozen WI-505 worktree run was 265 pass / 1 fail; the only failure was untouched WI-498 tasks missing skip/skill evidence. Its SHA-256 is `ae7df0ae2f4810f8e7f873bfc21dbd86a7ddadcebcc670dd48c4071fc8a01e21` at both the WI-505 base and promoted main.

The promoted-main run was 263 pass / 3 fail / 1 timeout:

1. the same unchanged WI-498 evidence debt;
2. `validate-chain-receipts-schema.sh` exceeded the harness timeout while scanning 1,218 machine-local cached receipt JSON files with two Python processes per file; durable WI-505 notes independently validate;
3. `validate-svc-reconcile-watcher-advance.sh` exceeded its internal 100 ms receipt-child assumption (measured range validation is slower on this local receipt history), after its mutation/state matrix passed.

WI-505 changes none of the two validator files, `svc-reconcile.mjs`, or `check-chain-receipts.mjs`. These are not treated as green, are not silently repaired in this authority WI, and do not invalidate the live acceptance-critical transfer. Full Tier-1 is therefore verified relative to the unchanged baseline/environment, not reported as an all-green suite.

## AC and test-quality audit

- SR-01 through SR-13: hermetic focused proof plus independent review.
- SR-14: complete required sequence, reviews, merge receipts, installation, and actual Tier-1 execution; baseline exceptions classified above.
- SR-15: direct installed replay and idempotent second call passed.
- No requirement-linked test is skipped or disabled. Expected values come from the WI contract and pre-replay live state, not from generated output.
- UI, browser, responsive, visual-baseline, journey-E2E, canary, provider-fidelity, mobile-release, and landing-page gates are N/A because this is a local headless framework authority transition.

## Pre/post classification

- Pre: original WI-496 command exited 2 with `existing worktree binding conflict` owned by the old session.
- Post: the same command against promoted main exited 0 and transferred generation 1 to 2 in place.
- Classification: fixed by WI-505.
- Iteration count: one promoted replay plus one idempotence replay.

## Leftovers

The closeout branch contains only the deliberate WI-505 state, proposal move, and verification updates. Machine-local receipts, review receipts, and logs remain ignored caches/evidence. Protected unrelated state remains outside this change.
