# WI-529 residual live closeout

**Verdict:** VERIFIED
**Promotion SHA:** `106b7b2eee8f4a2b77213cee097c49cb048f9ce7`
**PR:** `#188`
**Target class:** headless framework installation
**Verification tier:** runtime install validation

## Promotion evidence

- PR #188 squash-merged at `2026-08-10T19:06:55Z`.
- The merge tree is `c2664f18046ee603818efbd678bf74a8ef434e9a`, equal to the Sol- and AGY-reviewed final tree.
- The Example Marketplace consumer surface was independently merged in Example Marketplace PR #688 at `65888ada507844559da543b30434b88f47940d26`.

## Exact post-promotion proof

From canonical SVC `main` at the promotion SHA:

1. `./setup --host codex` completed and reported that it enabled the exact managed dispatcher state in `~/.codex/config.toml`.
2. `node scripts/verify-governed-routing.mjs --manifest provision/hosts/codex.json` returned `one effective governed command routes through the durable launcher`.
3. `bash scripts/check-install-drift.sh --host codex --quiet` exited 0.
4. Canonical `main` was clean and equal to `origin/main` after installation.

This is the acceptance-critical pre/post delta: before promotion, the exact dispatcher key `~/.codex/hooks.json:pre_tool_use:1:0` was explicitly disabled and verification failed; after canonical setup, that exact managed state was enabled and both routing verification and drift detection passed.

## Review and regression evidence

- Sol final re-review: PASS, 0 Critical, 0 High, after repairing symlink containment and multi-config rollback findings.
- AGY independent Google-family review: 10/10 PASS, exact candidate digest `0e75c14cf66f412de4db75d0feaba5d8d782f3984f933477600c62e96345bc30`, no findings.
- Focused behavior: governed wirer 9/9, all-host migration 55/55, project consumer surface PASS.
- Full Tier-1 pre-push: 281 scripts passed, 20 pre-existing baseline failures, 0 timeouts. The changed boundaries introduced no regression and the aggregate improved by one pass versus the prior run.

## Scope statement

No product behavior, database, payment, deployment, browser, mobile, or native-device surface changed. Browser and visual verification are therefore not applicable.
