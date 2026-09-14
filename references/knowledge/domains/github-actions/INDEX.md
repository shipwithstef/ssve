# GitHub Actions — Knowledge Index

**Layer:** 1 (INDEX)
**Last updated:** 2026-05-01
**Domain class:** infra / CI-CD platform
**Sources:** see `.sources.jsonl` (official docs.github.com URLs, WebFetch-extracted)

## Coverage status

This Layer-2 file covers ONLY topics with citations from the fetched sources. Topics without citations are marked `[CITATION-NEEDED]` and will populate via gap → research auto-loop on first miss.

## What this domain covers (cited)

- **Security hardening** for actions, secrets, self-hosted runners, GITHUB_TOKEN
- **OIDC** for cloud auth (AWS-specific config detail; other clouds reference-only)
- **Cost model** — current free-tier minutes + per-minute multipliers
- **Workflow syntax** — `on:`, `jobs:`, `steps:` mechanics (Layer 3: [details/syntax.md](details/syntax.md))
- **Events & triggers** — 30+ trigger events, activity types, filters (Layer 3: [details/events-triggers.md](details/events-triggers.md))
- **Contexts & expressions** — All 11 contexts, expression syntax, built-in functions (Layer 3: [details/contexts-expressions.md](details/contexts-expressions.md))
- **Runners** — Hosted and self-hosted runner specs, labels, pricing (Layer 3: [details/runners.md](details/runners.md))
- **Reusability** — Reusable workflows, composite actions, custom JS/Docker actions (Layer 3: [details/reusability.md](details/reusability.md))
- **Artifacts & caching** — Upload/download artifacts, cache keys, retention (Layer 3: [details/artifacts-caching.md](details/artifacts-caching.md))
- **Advanced features** — Matrices, containers, concurrency, environment protection (Layer 3: [details/advanced-features.md](details/advanced-features.md))

## NOT yet covered in Layer 2 (gap → research will populate on first recall miss)

- `github-actions.migration` — Jenkins/CircleCI/GitLab → Actions
- `github-actions.cve-history` — actual GitHub Security Advisories (the source doc references no CVEs)

## Topics this domain answers

- `github-actions.security-hardening`
- `github-actions.action-pinning`
- `github-actions.github-token-permissions`
- `github-actions.self-hosted-runners-public-repos`
- `github-actions.secret-handling`
- `github-actions.oidc`
- `github-actions.oidc-aws`
- `github-actions.cost-model`
- `github-actions.workflow-syntax`
- `github-actions.events-triggers`
- `github-actions.contexts-expressions`
- `github-actions.runners`
- `github-actions.reusability`
- `github-actions.artifacts-caching`
- `github-actions.advanced-features`

## Freshness

Source URLs fetched 2026-04-30 (security/cost) and 2026-05-01 (syntax/events/contexts/runners/reusability/artifacts/advanced). Re-validate every 90 days OR when changes touch OIDC trust policies, runner config, or pricing.
