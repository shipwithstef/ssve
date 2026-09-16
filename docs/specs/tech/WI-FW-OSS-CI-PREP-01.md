# Technical design — WI-FW-OSS-CI-PREP-01

**Status:** local design for dormant GitHub CI templates. Not hosted proof.
**Date:** 2026-09-16
**Lane:** framework. No product UI, no application data model, no journeys.

## Problem

Prepare a ready-to-activate free GitHub Actions check for a future public
repository without activating Actions while `shipwithstef/ssve` is private.

## Chosen architecture

Store installable templates **outside** recognized GitHub paths:

| Live path (after public conversion) | Dormant path now |
|---|---|
| `.github/workflows/ssve-checks.yml` | `docs/ci/workflows/ssve-checks.yml` |
| `.github/dependabot.yml` | `docs/ci/workflows/dependabot.yml` |

A wrapper `scripts/ci/run-free-checks.sh` is the shared local/hosted entry.
A Node contract test `test-framework/tests/oss-ci-workflow.test.mjs` proves
YAML/event/permission/pin/failure-propagation/paid-tier/dormancy contracts.

The eventual required GitHub check is the aggregator job named
**`SSVE Required`**. It runs `if: always()`, needs `free-checks`, and exits
nonzero unless `needs.free-checks.result == success`. Skipped, cancelled, or
failed prerequisites cannot become a green required check.

## Alternatives rejected

| Alternative | Why not |
|---|---|
| Live `.github/workflows` now | Would activate hosted CI on a private repo. Unauthorized. |
| `workflow_dispatch`-only live workflow | Forbidden substitute for dormancy. |
| Azure Pipelines | WI-569 found HoursHub-owned Azure YAML, not SSVE. |
| Self-hosted or larger runners | Cost, trust, and “always billed” larger-runner rule. |
| Lint-only CI | Omits the free Tier-1 runtime/installer corpus. |
| `pull_request_target` | Privileged context over untrusted contributor code. |
| Dependency caches | No root lockfile; cache poisoning risk without justification. |

## Security and cost

- Triggers: `pull_request` and `push` to `main` only. No `workflow_dispatch`,
  no `schedule`, no path filters. Historical comparison:
  `docs/plans/WI-FW-OSS-CI-PREP-01/historical-coverage.md`.
- `permissions.contents: read`. `persist-credentials: false`.
- Actions pinned to verified SHAs (see pin evidence). setup-node
  `package-manager-cache: false`.
- `EVALS=0` in the workflow; wrapper refuses `EVALS=1`. Paid tiers run only
  when `EVALS` is exactly `1` in `run-all-evals.sh`.
- Standard `ubuntu-24.04` only. Node 24 LTS. Timeouts 60 / 5 minutes.
- No secrets, no artifacts upload (job logs only), concurrency cancel-in-progress.

## Out of scope

Hosted runs, required-check installation, public visibility, Azure, history
cleanup, sibling hook/validator/FRAMEWORK-STATE edits, INDEX.md, README.md,
`.gitignore`.
