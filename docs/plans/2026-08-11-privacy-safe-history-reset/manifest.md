# WI-537 — Privacy-safe single-root history reset

**Status:** VERIFIED
**Archetype:** migration / destructive repository-boundary reset
**Execution mode:** inline
**Base:** `51dd6361ed382df2a15a3d421e86b3d5c35bbda1`

## Implementation Summary

Preserve every recoverable historical Git and pull-request surface in a private archive, construct and validate a minimized current snapshot, then atomically replace the original repository refs with one sanitized root commit.

## Invariants

1. Backup verification precedes every destructive remote operation.
2. The source repository remains private throughout the migration.
3. The retained framework behavior is tested before publication.
4. Historical commit identities and PII are not reachable from retained heads, tags, or notes.
5. The local and remote archive remain untouched after verification.

## Files Planned

| Action | Surface | Purpose |
|---|---|---|
| CREATE | `docs/specs/work-items/WI-537.md` | Durable scope and acceptance boundary |
| CREATE | `docs/specs/privacy/repository-publication-boundary.md` | Future privacy policy |
| CREATE | `scripts/audit-repository-privacy.mjs` | Mechanical regression gate |
| CREATE | `docs/specs/privacy/history-epoch.json` + `scripts/lib/history-epoch.mjs` | Preserve non-personal provenance semantics after intentional history externalization |
| MODIFY | `.gitignore` | Prevent transient `scratch/` recurrence |
| DELETE | transient/raw/company-specific residue named by this manifest | Remove non-product publication data while retaining runtime-required lane and promotion fixtures |
| DELETE | product-only marketing, status, research, screenshot, work-item, and evidence artifacts | Prevent the source product codebase and operating context from being reconstructable from the framework repository |
| MODIFY | tracked textual artifacts containing product/company identities, product URLs, repository paths, personal paths, contact values, or literal credentials | Deterministic pseudonymization using `Example Marketplace`, `example-marketplace`, `Example Company`, `example-org`, and explicit credential placeholders |
| EXTERNAL | GitHub refs, PR states, private archive repository | Governed archive and history replacement |

## Task Graph

| Task | Depends on | Work | Proof |
|---|---|---|---|
| T1 | — | Create local mirror and private GitHub archive | exact head/tag/note SHA comparison + `git fsck` |
| T2 | T1 | Export all PR metadata and full open-PR recovery artifacts | archive branch and count checks |
| T3 | T2 | Remove transient/private/product-only residue and pseudonymize retained reusable framework text | privacy audit plus zero source-product/source-company matches |
| T4 | T3 | Run framework validation on the sanitized tree | Tier-1 + manifest lint |
| T5 | T4 | Create one root commit with the canonical author | root/author/committer assertions |
| T5a | T5 | Rebind legacy provenance and hermetic validators to the explicit history epoch; keep optional browser behavior strict-mode selectable | focused validators + full Tier-1 on a durable fresh clone |
| T6 | T5 | Close open PRs and remove superseded refs | GitHub API and `ls-remote` |
| T7 | T6 | Force-update `main` and verify published state | fresh clone + scans + contributor API |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | GitHub repository | Heads, tags, notes, PR states, default branch | coupled | backup object equality gates every destructive command |
| 2 | Private GitHub archive | Full refs plus PR recovery metadata | coupled | private visibility and ref-count verification |
| 3 | Local filesystem | Independent bare mirror and metadata export | coupled | `git fsck --full` and explicit absolute backup path |
| 4 | Contributor attribution cache | GitHub account association | decoupled-justified | API recheck; GitHub Support for residual cache/PR objects |

Untouched environments: package registries, deployment environments, databases, payment systems, mobile stores, DNS, cloud runtime, customer data.

GitHub cache and closed PR objects cannot be transactionally coupled to a force-push. The archive preserves recovery, while residual inaccessible-object removal follows GitHub's support process.

## Validation Plan

- `git fsck --full --no-dangling` on the local archive and final repository.
- Exact source/archive SHA equality for 80 heads, 118 tags, and `refs/notes/svc-receipts`.
- `node scripts/audit-repository-privacy.mjs --history-root`.
- `node scripts/lint-skills-manifest.mjs`.
- `bash test-framework/evals/run-all-evals.sh`.
- Fresh-clone ref count, root count, author/committer identity, and GitHub contributor API checks.

## Rollback

Restore `main`, branches, tags, and notes from the private bare mirror or archive repository. Reopen archived PRs only when their restored head branches and base SHAs are again available.

## Simulation Report

- Backup exists before mutation: PASS.
- Source/archive head, tag, and notes object IDs match: PASS.
- All 184 PRs have metadata; five open PRs have full recovery artifacts: PASS.
- Sanitized snapshot is isolated from `main`: PASS.
- Remote deletion and force-push remain blocked until T3–T5 pass: PASS.
