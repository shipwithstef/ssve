# WI-530 promotion verification

**Verdict:** VERIFIED
**Verification tier:** install-validation
**Target:** canonical SVC installation and a real Example Marketplace consumer worktree
**Promotion SHA:** `aed928448b6f75fd69d7421adf0cc4476a7cba66`

## Promotion evidence

- PR #192 merged through the governed review-receipt wrapper.
- Canonical `main` and `origin/main` resolved to the promotion SHA before installation.
- Setup and zero-drift checks passed for Antigravity, Claude, Codex, Cursor, Gemini, Kimi, MiMo-Code, and OpenCode.
- The post-commit focused validator passed 19 of 19 assertions.
- Sol exact-diff review and AGY Gemini 3.6 Flash High production review reported zero Critical or High findings.

## Consumer replay

The centrally installed Codex entrypoint was invoked from the preserved Example Marketplace Sample worktree:

```text
~/.codex/skills/scripts/svc-ensure-worktree.mjs
WI-SAMPLE-REVENUE-ACTIVATION-01
sample-revenue-activation-r25
```

It exited `0`, emitted structured JSON, and reported:

- `created: false`
- `resumed: true`
- preserved path `/home/svc-user/app-workspaces/example-marketplace/.worktrees/sample-revenue-activation`
- controller lease `38bb16c4-551c-4c1a-afcb-ca2555227e1c`
- generation `1`
- `preexisting_controller: true`

The Sample worktree remained clean at `49afc597f77f1bf2169b32c470228e964df6afc2`. No duplicate worktree, recovery override, product edit, or deployment occurred.

The centrally installed `svc-reconcile.mjs --help` also exited `0` from the Example Marketplace repository and described consumer-anchored Git/state behavior without requiring a vendored product script.

## Regression classification

The full Tier-1 pre-push comparison reported 286 passing scripts, 19 repository-baseline failures, and one timeout. The changed focused validator passed 19 of 19, manifest lint and mechanical plan validation passed, and no changed-path regression was found. The repository policy classified the unrelated baseline as warn-only.

This framework change has no browser-visible, mobile-build, database, product-deploy, or production-canary surface; those verification families are not applicable.
