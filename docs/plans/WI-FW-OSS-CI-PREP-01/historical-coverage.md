# Historical CI coverage comparison — WI-FW-OSS-CI-PREP-01

Sanitized public matrix. Private archive names, product names, portal URLs,
credentials, and raw logs are not reproduced here. Private redacted inventory:
`.svc/external-review-artifacts/oss-worker-20260916/historical-coverage-private.json`.

Observed 2026-09-16. Hosted proof remains pending. This is not active CI.

## Sources

| Source | What was available | Limitation |
|---|---|---|
| Named SSVE private history archives (2026-08-11 and 2026-09-14) | Read-only repo metadata, default/archive trees filtered for workflow/Azure paths, Actions workflow/run counts | No `.github/workflows` tree entries; Actions `total_count=0`. Post-reset local history is still not proof that workflows never existed *before* those archives. |
| Current `shipwithstef/ssve` | Still PRIVATE; Actions workflows/runs = 0 | Matches WI-569. |
| Unwired SSVE sketch blob `c4f5b9b6383d14081aa3da8b9692458d468affe5` | Nightly flake-check sketch, header says not wired | Never a live runner. |
| Unrelated private application repo on this machine (owner-authorized read-only) | Eight GitHub workflows now `workflow_dispatch`-only; Azure Linux CI + deploy + iOS YAML | Live Azure service metadata not re-queried (prior intake: TF401444). |
| GitHub billing/runner docs | Standard public runners currently documented as free; larger runners always billed | Not a future-pricing guarantee. |

## Matrix

| Capability | Historical GitHub (unrelated private app, pre-Azure) | Azure counterpart (same app) | SSVE archive / sketch | Relevance to public SSVE | Decision | Rationale |
|---|---|---|---|---|---|---|
| Automatic PR + default-branch validation | Eight workflows previously had automatic `push` / `pull_request` / `schedule`; later stripped to manual-only to stop private Actions minutes | Linux CI on `main` + PRs to `main` | Archives: none found. Sketch: schedule + dispatch only | Required | **Adapt** | Keep *one* `pull_request` + `push: main` workflow. Do not revive eight automatic workflows. |
| Docs-only changes | Unknown per-file; several former PR gates | `docs/**` excluded from Linux CI | Sketch ignored docs | Required (must not skip) | **Omit Azure skip** | Public SSVE required check must still run on documentation/skill-only PRs. |
| Required terminal job | Separate GHA checks could skip independently | `FinalizeCI` runs `always()` and requires exactly one successful Linux suite | Sketch had a single job | Required | **Adapt** | Keep `SSVE Required` `if: always()`; fail unless `free-checks` is `success`. |
| Full free test suite | Product Deno / npm / e2e / assistant evals | Shared “fast suite” on Linux T1/T2 | Sketch: `FLAKE_CHECK=1` full evals | Required: Tier-1 + manifest linter | **Adapt** | Use `scripts/ci/run-free-checks.sh` + contract test. Do not add product suites. |
| Paid / LLM evals | Assistant eval jobs (offline scripts, extra minutes) | Not in Linux fast path | Sketch did not set `EVALS=1` but nightly doubles the suite | Omit paid | **Omit** | Wrapper refuses `EVALS=1`. Paid tiers run only when `EVALS` is exactly `1`. |
| Nightly / schedule | Disabled with other automatic triggers | None observed on Linux CI YAML | Sketch: daily cron | Not required first | **Omit** | Nightly flake doubling is a later optional job after hosted proof. |
| `workflow_dispatch` | Retained as the *only* remaining GHA trigger after billing stop | Azure has manual parameters on some pipelines | Sketch included it | Owner correction: none | **Omit** | Not a dormancy substitute; extra trigger if accidentally installed while private. |
| Action pinning | Mutable `@v4` tags | Azure `NodeTool@0` / checksum-pinned Deno on T2 | Sketch `@v4` | Required | **Retain current pins** | Keep verified SHAs already recorded. |
| Checkout credentials | Default persist on several GHA files | Linux CI `persistCredentials: false`; deploy pipeline true | Sketch default | Required false | **Retain false** | Never persist write credentials on contributor CI. |
| Caches | npm and Deno `actions/cache` | No GitHub cache; self-hosted workspace scrub | Sketch none | Avoid until lockfile | **Omit** | No root lockfile. setup-node `package-manager-cache: false`. |
| Artifacts | Failure uploads possible | Job logs / local receipts | Sketch uploads eval results on failure | Bounded storage | **Omit upload** | GitHub job logs only; no Actions artifacts. |
| Concurrency | Some GHA `concurrency` | Azure capacity gate + single agent | Sketch none | Useful | **Retain** | Cancel in-progress per PR/`main` to avoid stacked runs. |
| Timeouts | Mixed / often unset | 60 minutes Linux suite; 10 admit; 45 scoped extra job | Sketch 30 | Bound | **Retain 60 / 5** | Full free corpus can take minutes; aggregator stays short. |
| Permissions | Often default GITHUB_TOKEN | Azure service token names exist; unused here | Sketch default | Minimum read | **Retain contents:read** | No deploy token, no `pull_request_target`. |
| Fork PRs | GHA `pull_request` (not `_target`) | Azure PR of same org | None hosted | Required | **Retain `pull_request`** | Do not use `pull_request_target`. |
| Self-hosted / larger / macOS | One GHA `macos-26` iOS job | Self-hosted Linux VM pool + hosted fallback + macOS-26 iOS | Sketch ubuntu-latest | Public free Linux only | **Omit** | Larger/self-hosted/macOS are paid or private infra. |
| Deploy / pages / stores | GHA deploy + iOS workflows | Deploy pipeline + iOS signing groups | None | Unrelated product | **Omit** | SSVE has no app deploy target. |
| Env-hardening / capacity selector | N/A | Large `BASH_ENV`/`PATH` wipe, capacity JSON, Docker socket isolation | None | Private app hardening | **Omit** | No self-hosted agent. |
| Duplicate PR+push | Likely unfiltered `push`+`pull_request` on all branches (demonstrated by later “stop automatic GHA” contract) | PR + `main` only | Sketch neither | Cost driver | **Adapt** | `push` limited to `main` so feature-branch PRs do not double-run. |

## Billing pressure (demonstrated vs hypothesis)

**Demonstrated**

- The unrelated private application had **eight** automatic GitHub workflows. A later migration contract required them all to be `workflow_dispatch`-only with **no** `push` / `pull_request` / `schedule`, explicitly to stop automatic GitHub Actions while Linux CI moved to Azure.
- Several of those workflows cached package managers; one used a macOS image.
- Two workflow comments state they previously ran on every relevant PR.
- The SSVE sketch, if it had been wired on a **private** repo, would have added a **nightly** full-suite job.

**Not demonstrated**

- No SSVE Actions run IDs or consumed-minute totals on current `ssve` or the named archives (all empty).
- No GitHub billing-account export.
- A local Azure cost export on the unrelated product describes VM/storage spend, not GitHub Actions minutes, and is not treated as SSVE evidence.

**Design consequence:** one standard `ubuntu-24.04` workflow, no schedule, no dispatch, no matrix, no cache, no artifacts, `push` only to `main`, bounded timeouts. After public conversion, current GitHub docs still describe standard hosted runners as free for public repos; that wording is not a future-pricing guarantee.

## Candidate reconciliation

Already present and kept: SHA pins, read-only permissions, `persist-credentials: false`, `EVALS=0` + refuse `EVALS=1`, `SSVE Required` aggregator, no caches, no `.github/` install.

Changed after this comparison: **removed `workflow_dispatch`**. Added explicit “no path filters” so docs-only PRs stay covered.
