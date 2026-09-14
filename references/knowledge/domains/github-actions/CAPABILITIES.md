# GitHub Actions — Capabilities

**Domain:** GitHub Actions CI/CD platform
**Layer:** 2 (CAPABILITIES)
**Last updated:** 2026-04-30
**Extraction method:** WebFetch from official docs.github.com (gemini-cli fallback per `rules/research-must-use-gemini-cli.md` after 429 RESOURCE_EXHAUSTED on both gemini-2.5-pro and gemini-2.5-flash)

> **Provenance discipline:** every concrete claim below carries a `[source: <key>]` anchor pointing to a row in `.sources.jsonl`. Heuristic judgments are marked `[heuristic]`. Items without coverage from the fetched sources are explicitly listed as gaps in `INDEX.md` § "NOT yet covered".

## Source key

- `[hardening]` = https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
- `[oidc]` = https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
- `[oidc-aws]` = https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
- `[billing]` = https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions

## Action pinning

- **Pin third-party actions to a full-length commit SHA** — the doc states this is "currently the only way to use an action as an immutable release" `[hardening]`.
- Pinning to a tag is permitted "only if you trust the creator" — tags can be moved or deleted `[hardening]`.
- GitHub provides repository- and organization-level policies to enforce SHA pinning `[hardening]`.

## GITHUB_TOKEN permissions

- The hardening doc recommends setting "the default permission for the `GITHUB_TOKEN` to read access only for repository contents" `[hardening]`.
- "Permissions can then be increased, as required, for individual jobs within the workflow file" `[hardening]`.

## Self-hosted runners on public repositories

- The hardening doc states self-hosted runners "should almost never be used for public repositories" `[hardening]`.
- Reason given: "any user can open pull requests against the repository and compromise the environment" `[hardening]`.
- The same risk class applies to private/internal repos when fork-PRs are enabled — "anyone who can fork the repository and open a pull request...are able to compromise the self-hosted runner environment" `[hardening]`.

## Secret handling

From the "Use secrets for sensitive information" section of `[hardening]`:

- Apply principle of least privilege to credentials.
- Mask non-secret sensitive values with `::add-mask::VALUE` workflow command.
- "Never use structured data as a secret" — avoid JSON/XML/YAML blobs.
- "Register all secrets used within workflows" if generated values are created.
- Audit by reviewing source code and testing with valid + invalid inputs.
- "Delete and rotate exposed secrets" if unredacted secrets appear in logs.
- "Rotate secrets periodically to reduce the window of time" of compromise exposure.

## OIDC for cloud auth

- OIDC lets workflows "exchange short-lived tokens directly from your cloud provider" instead of storing hardcoded secrets `[oidc]`.
- The problem it solves: "using hardcoded secrets requires you to create credentials in the cloud provider and then duplicate them in GitHub as a secret" `[oidc]`.
- Listed cloud-provider examples: "AWS, Azure, GCP, HashiCorp Vault, and others" `[oidc]`.
- **JWT `sub` claim format examples** from `[oidc]`:
  - Environment-scoped: `"sub": "repo:octo-org/octo-repo:environment:prod"`
  - Ref-scoped pattern: `repo:{org}/{repo}:ref:{ref}`
- **Permissions block** for requesting an OIDC token (from `[oidc-aws]`):
  ```yaml
  permissions:
    id-token: write   # required for requesting the JWT
    contents: read    # required for actions/checkout
  ```
- **GitHub OIDC provider URL** (used when configuring AWS IAM trust): `https://token.actions.githubusercontent.com` `[oidc-aws]`.
- **Issuer URL (`iss`):** `[CITATION-NEEDED]` — not stated in the fetched docs.

## Cost model — free tier + multipliers (2026-04-30 snapshot)

From `[billing]`:

| Plan | Free private-repo minutes / month |
|---|---|
| GitHub Free | 2,000 |
| GitHub Pro | 3,000 |
| GitHub Free for organizations | 2,000 |
| GitHub Team | 3,000 |
| GitHub Enterprise Cloud | 50,000 |

| Runner | $/min | Relative cost |
|---|---|---|
| Linux 2-core | $0.006 | baseline |
| Windows 2-core | $0.010 | 1.67× Linux |
| macOS 3-4 core | $0.062 | 10.3× Linux |

- Public-repo statement (verbatim): "GitHub Actions usage is **free** for **self-hosted runners** and for **public repositories** that use standard GitHub-hosted runners" `[billing]`.

## Anti-patterns to flag at SEV-tier (heuristic, derived from `[hardening]` recommendations)

> All anti-patterns below are derived from explicit recommendations or warnings in `[hardening]`. SEV tiers are heuristic judgments by the framework, not stated severities from GitHub. **No CVE numbers are claimed** — the source doc references none.

| Pattern | Source recommendation | SEV (heuristic) |
|---|---|---|
| Self-hosted runner enabled on public repo without fork-PR guards | `[hardening]` "should almost never be used for public repositories" | SEV-1 |
| Action pinned to floating tag in production workflow | `[hardening]` "Pin actions to a tag only if you trust the creator" | SEV-2 |
| Workflow without `permissions:` scope (default GITHUB_TOKEN broad) | `[hardening]` "set the default permission for the GITHUB_TOKEN to read access only" | SEV-2 |
| Long-lived cloud credentials stored as secrets when OIDC is available | `[oidc]` OIDC "exchange short-lived tokens directly from your cloud provider" instead of "duplicate them in GitHub as a secret" | SEV-2 |
| Structured data (JSON/XML/YAML) stored as a secret | `[hardening]` "Never use structured data as a secret" | SEV-3 |
| Generated secret-derived values not registered with `::add-mask::` | `[hardening]` "Mask all sensitive information that is not a GitHub secret" | SEV-3 |

## Cross-cutting dimension envelopes (proposal §17 — heuristic)

These are framework-level judgments, not GitHub-stated guidance. Marked `[heuristic]` to distinguish from cited fact.

| Dimension | Envelope `[heuristic]` |
|---|---|
| FinOps | Linux runners only unless OS-specific testing required (10.3× macOS multiplier from `[billing]`); cache-hit-rate target ≥70% (heuristic) |
| Security | All actions pinned to SHA per `[hardening]`; OIDC for all cloud auth per `[oidc]`; GITHUB_TOKEN scoped per workflow per `[hardening]` |
| Scalability | (no quantitative envelope from cited sources — recall returns `[CITATION-NEEDED]` for ARC sizing, queue-depth thresholds) |

## Authoritative sources

See `.sources.jsonl` for full URL list with retrieval timestamps.

- https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
- https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
- https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
- https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions
