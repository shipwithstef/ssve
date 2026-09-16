# Activate dormant SSVE free GitHub checks

**Status:** locally prepared, **not active CI**, **hosted proof pending**.
Do not call this a verified public release. Do not change billing, credentials,
Azure, or public visibility from this document.

Templates live outside recognized GitHub workflow locations so nothing launches
while the repository is private.

| Artifact | Dormant path | Activation path |
|---|---|---|
| Required checks workflow | `docs/ci/workflows/ssve-checks.yml` | `.github/workflows/ssve-checks.yml` |
| Action pin updates | `docs/ci/workflows/dependabot.yml` | `.github/dependabot.yml` |
| Shared free-check entry | `scripts/ci/run-free-checks.sh` | unchanged |

Do **not** create a `workflow_dispatch`-only file under `.github/workflows/` as a
stand-in for dormancy. The dormant template has **no** `workflow_dispatch` and
**no** `schedule`. Historical private-repo billing pressure came from many
automatic GitHub workflows; this candidate keeps one `pull_request` + `push` to
`main` check. See `docs/plans/WI-FW-OSS-CI-PREP-01/historical-coverage.md`.

## Current observed conditions (2026-09-16 UTC)

Read-only probes this session:

- `shipwithstef/ssve` is **PRIVATE**; default branch `main`.
- `GET /repos/shipwithstef/ssve/actions/workflows` → `total_count = 0`.
- This checkout has no `.github/` directory.

Earlier WI-569 inventory: no SSVE Azure pipeline in the scoped tree. Observed
Azure YAML on this machine belongs to a separate product and was read only for
coverage comparison. Do not modify that product or its Azure services.
Private-archive / history cleanup is a sibling worker's scope.

## Billing — current GitHub documentation, not a guarantee

Primary sources verified 2026-09-16:

- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Choosing the runner for a job](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)
- [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)

GitHub currently documents that **standard** GitHub-hosted runners are free for
**public** repositories, and that **larger runners are always charged**, including
on public repositories. Private repositories consume plan minutes (GitHub Free
documents 2,000 minutes / 500 MB artifact storage / 10 GB cache per repository)
and then bill overage. Artifact storage is shared with GitHub Packages.

**This is not an unlimited-free or future-pricing guarantee.** Re-read the pages
above on the activation day. Pricing, included minutes, and “unlimited” wording
can change.

This workflow uses only `ubuntu-24.04` (standard Linux x64). It does not select
larger runners, macOS/Windows, `ubuntu-slim` paid private SKUs as a goal, or
self-hosted runners.

## Pins and runtime (verified 2026-09-16)

See `docs/plans/WI-FW-OSS-CI-PREP-01/evidence/pin-verification.json`.

| Input | Pin | Evidence |
|---|---|---|
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` (`v7.0.1`) | `git ls-remote` + verified GitHub commit `prep v7.0.1 release (#2531)` |
| `actions/setup-node` | `820762786026740c76f36085b0efc47a31fe5020` (`v7.0.0`) | `git ls-remote` + verified GitHub commit `Migrate to ESM and upgrade dependencies (#1574)` |
| Runner | `ubuntu-24.04` | Standard public-repo Linux label; `ubuntu-latest` currently maps to the Ubuntu 24.04 image, but the explicit label reduces drift. `ubuntu-26.04` is public preview — do not use. |
| Node | `24` (LTS Krypton) | [Node.js releases](https://nodejs.org/en/about/previous-releases). Hosted runs must use the `actions/setup-node` Node 24 on PATH. Fixture helpers append `/usr/bin:/bin` after the inherited PATH so they do not hide that Node behind an older system binary. Do not pin a workstation path. |
| Action runtime | both actions `runs.using: node24` | Requires Actions Runner ≥ 2.327.1; GitHub-hosted runners provide this. |

`persist-credentials` defaults to `true` on checkout v7.0.1 — the template sets
`false`. `package-manager-cache` defaults to `true` on setup-node v7.0.0 — the
template sets `false` because this repo has no locked root dependency graph.

Security references: [Secure use](https://docs.github.com/en/actions/reference/security/secure-use)
(immutable SHA pins; do not run untrusted contributor code via
`pull_request_target`).

## Paid-tier exclusion

`test-framework/evals/run-all-evals.sh` skips tiers 1.5/2/3 unless `EVALS` is
exactly `1`:

```bash
if [[ "${EVALS:-0}" != "1" ]]; then
  echo ">>> Tiers 1.5, 2, 3 skipped (set EVALS=1 to run)"
```

`EVALS=0` therefore skips paid tiers, and so does an unset `EVALS`. The wrapper
exports `EVALS=0` and **refuses** `EVALS=1` so a mis-set environment cannot
enable paid LLM tiers.

## Exact post-publication steps

Do these in order. Do not require a check name before hosted proof.

1. **Confirm public visibility and applicable free runner conditions**
   - `gh repo view shipwithstef/ssve --json visibility,isPrivate`
   - Visibility must be public before treating standard runners as the
     public-repository free SKU. If it is still private, stop.
   - Re-read the billing and runner pages above. Confirm `ubuntu-24.04` is still
     a standard (not larger) label. Confirm no payment-method / quota block that
     would surprise the owner. Record the date.

2. **Install templates at the recognized paths**
   - Copy `docs/ci/workflows/ssve-checks.yml` → `.github/workflows/ssve-checks.yml`
     as a byte-identical file (keep the header comment; GitHub ignores it).
   - Copy `docs/ci/workflows/dependabot.yml` → `.github/dependabot.yml`
   - Do not add other workflows in the same change.
   - Do not enable Actions secrets, provider keys, or write tokens.
   - Keep default workflow permissions read-only if they still are.

3. **Push the reviewed configuration**
   - Land through the normal reviewed path. Do not `--no-verify` or force-push.
   - Confirm the live files exist on `main` (or the reviewed PR) at the paths
     above.

4. **Gather actual hosted results (same-repo, fork, main)**
   - Same-repo PR to `main` (include a docs-only PR so the required check is not
     skipped on documentation-only changes).
   - Fork PR to `main`.
   - Push to `main`.
   - Record run IDs, commit SHAs, and the **exact check name** GitHub produced.
   - Confirm the aggregator job `SSVE Required` is red when `SSVE Free Checks`
     fails, is cancelled, or is skipped, and green only when that job is
     `success`.
   - Confirm no paid LLM tiers ran (`EVALS` is not `1` in the logs).
   - Confirm fork runs have no persisted write credentials and no owner secrets.

5. **Only then require the verified check name**
   - Require exactly the observed passing name, expected to be `SSVE Required`.
   - Do not require a skipped/missing job. Do not guess a name from this file if
     GitHub displayed a different string.
   - Read back the ruleset/branch-protection setting after applying it.

## Local reproduction (dormant)

From the repository root, with `node` on PATH (or `NODE_BIN`) for local validation:

```bash
node --test test-framework/tests/oss-ci-workflow.test.mjs
EVALS=0 node scripts/lint-skills-manifest.mjs
# Direct wrapper execution refuses EVALS=1 and then runs the linter and
# free Tier-1 suite only. The hosted workflow runs the contract test as a
# separate preceding step. Known sibling Tier-1 failures are not hidden.
EVALS=0 bash scripts/ci/run-free-checks.sh
```

Hosted Actions were **not** run by the preparation worker.

## Remaining work after this preparation

- Public conversion (separate authorization).
- Copy to `.github/` and push (step 2–3).
- Hosted same-repo / fork / main proof (step 4).
- Required-check configuration (step 5).
- Sequential integration with the parallel test-worker fixes (hooks / four
  failing Tier-1 validators / `fixture-home.sh` / `audit-framework-docs.mjs` /
  `FRAMEWORK-STATE.md`).
- Independent review arranged by Root.
- Private-backup / history cleanup (sibling worker).
