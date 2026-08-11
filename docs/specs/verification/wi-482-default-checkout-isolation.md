# WI-482 Post-Merge Verification

- **Manifest:** `docs/plans/2026-07-14-wi482-default-checkout-isolation/manifest.md`
- **Promoted commit:** `0ebe2efd7d0b13131e1fab2d01ff639caec54427`
- **Pull request:** #135
- **Target class:** infra
- **Verification tier:** V2 installed-host and policy interaction
- **Verdict:** VERIFIED

## Promotion Evidence

| Surface | Result | Evidence |
|---|---|---|
| GitHub promotion | PASS | PR #135 squash-merged to main at `0ebe2efd` |
| Frozen review gate | PASS | `.svc/review-receipts/pr-135.json`; final Claude Fable verdict APPROVE |
| Receipt chain | PASS | plan, review-plan, exec, review-exec, and audit receipts complete on the implementation commit |
| Promoted tree identity | PASS | reviewed branch tree and promoted `origin/main` tree were byte-identical |
| Canonical main sync | PASS | bounded, session-specific post-merge fast-forward preserved all five unrelated untracked status files |
| Host installation | PASS | Antigravity, Claude, Codex, Cursor, Gemini, Kimi, Mimo Code, and OpenCode setup completed and drift checks passed from canonical main |

## Acceptance and Runtime Evidence

- AC-482-1: default checkout, external-cwd-to-repo, linked-to-default, multi-root, symlink escape, pre-commit, and four sed write/execute paths deny.
- AC-482-2: a real bare origin and clone prove clean/current `origin/main`, ignored `.worktrees/`, immutable base handling, dirty rejection, and stale rejection.
- AC-482-3: WI-485 reads, exact `node --check <file>`, and approved external runtime temp remain allowed; temp symlinks back into a repository deny.
- AC-482-4: worktree status retains WI, absolute path, branch, and binding owner identity.
- AC-482-5: create and exact-session resume are idempotent; binding conflicts fail; installed-style symlink targets remain unchanged across lifecycle operations.

## Regression Evidence

- `validate-default-checkout-isolation.sh` — 8 passed, 0 failed.
- `validate-session-worktree-binding.sh` — 22 passed, 0 failed.
- `validate-codex-execution-integrity.sh` — 88 passed, 0 failed.
- `validate-cross-host-hook-conformance.sh` — 49 passed, 0 failed.
- `validate-source-repo-not-worktree.sh` — 20 passed, 0 failed.
- `lint-skills-manifest.mjs` — PASS.
- Full Tier 1 on promoted canonical main — 241 scripts passed, 0 failed, 0 timed out.

## G7

G7 passes. All five acceptance criteria are proven on promoted source, no unresolved Critical/High/Medium review finding remains, all installed host surfaces resolve to canonical main, and unrelated user files remain untouched. Browser, visual, provider, database, mobile, and canary checks are N/A because this change governs the local framework control plane.

```yaml
single_lane_summary:
  item: WI-482
  target_class: infra
  verification_tier: V2
  sampled: true
  evidence:
    - docs/specs/verification/wi-482-default-checkout-isolation.md
    - docs/specs/audit/wi-482-default-checkout-isolation-analysis.md
    - docs/specs/reviews/wi-482-default-checkout-isolation-exec-cross-model.md
```
