# Security & Authentication

> GITHUB_TOKEN permissions, secrets management, OIDC, and security hardening.

## Mechanism

### GITHUB_TOKEN

Every workflow run receives an auto-generated `GITHUB_TOKEN` secret. This token authenticates as the GitHub Actions app installed on the repository.

```yaml
# Access the token
${{ secrets.GITHUB_TOKEN }}
${{ github.token }}   # Only available inside job steps
```

**Properties:**
- Automatically created and invalidated after the workflow completes
- Scoped to the repository where the workflow runs
- Permissions configurable via the `permissions` key

### Permissions

The `permissions` key modifies GITHUB_TOKEN access. Available permissions:

| Permission | Description |
|------------|-------------|
| `actions` | Cancel workflow runs, manage artifacts |
| `artifact-metadata` | Create artifact storage records |
| `attestations` | Generate artifact attestations |
| `checks` | Create check runs/suites |
| `contents` | Read/write repository contents, create releases |
| `deployments` | Create deployments |
| `discussions` | Manage discussions |
| `id-token` | Fetch OIDC token (`write` required) |
| `issues` | Create/update issues |
| `models` | Use GitHub Models inference API |
| `packages` | Publish to GitHub Packages |
| `pages` | Request GitHub Pages builds |
| `pull-requests` | Manage PRs (labels, comments, merge) |
| `security-events` | Code scanning alerts |
| `statuses` | Commit statuses |
| `vulnerability-alerts` | Read Dependabot alerts (`read` or `none` only) |

Access levels: `read`, `write`, `none`. `write` includes `read`.

```yaml
# Workflow-level permissions
permissions:
  contents: read
  issues: write

# Job-level permissions override workflow-level
jobs:
  deploy:
    permissions:
      contents: write
      pages: write
      id-token: write
```

**Important:** If you specify ANY permission, all unspecified permissions default to `none`.

### Secrets

Three levels of secrets:

| Level | Scope | Use Case |
|-------|-------|----------|
| **Repository** | Single repository | API keys, deployment tokens |
| **Organization** | All repos in org | Shared credentials |
| **Environment** | Specific deployment environment | Production secrets |

Environment secrets require an `environment` declaration on the job:

```yaml
jobs:
  deploy:
    environment: production
    steps:
      - run: deploy.sh
        env:
          API_KEY: ${{ secrets.PROD_API_KEY }}
```

### OIDC Token Authentication

OpenID Connect enables passwordless authentication to cloud providers:

```yaml
permissions:
  id-token: write   # Required to request OIDC token
  contents: read

jobs:
  deploy:
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/ROLE
          aws-region: us-east-1
```

Supported providers: AWS, Azure, GCP, HashiCorp Vault, and any OIDC-compliant provider.

The OIDC token includes claims about the workflow run (repo, ref, environment) that can be used for trust policies.

## Analysis

### Default Permission Modes

| Level | Default |
|-------|---------|
| Enterprise | `restricted` or `permissive` (admin configurable) |
| Organization | Inherits enterprise default |
| Repository | Inherits organization default |

**Recommendation:** Set `restricted` at the enterprise/organization level and grant only needed permissions per workflow.

### Fork Security

| Scenario | GITHUB_TOKEN | Secrets |
|----------|-------------|---------|
| PR from same repo | Full permissions | All secrets available |
| PR from fork (first-time) | Read-only | No secrets (except GITHUB_TOKEN) |
| PR from fork (returning) | Read-only | No secrets |
| Dependabot PR | Read-only | No secrets |

To grant write access for forks, an admin must enable **"Send write tokens to workflows from pull requests"** in repository settings.

### `pull_request_target` Danger

`pull_request_target` runs in the base repository context with full secrets and write permissions. This is dangerous because:

1. The workflow file from the **default branch** is used (not the PR branch)
2. But if you checkout PR code and run it, that code has write access + secrets
3. Attackers can exfiltrate secrets or modify repository contents

**Safe pattern for PR automation with write access:**
```yaml
# Workflow 1: Untrusted build (pull_request, no secrets)
# Workflow 2: Trusted action (workflow_run, has secrets, reads artifacts from Workflow 1)
```

### Pinning Actions to SHA

Tags can be force-pushed. For security, pin actions to commit SHAs:

```yaml
# Less secure - tag can change
uses: actions/checkout@v4

# More secure - immutable
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
```

Dependabot can update SHA-pinned actions automatically.

### Composite Actions Cannot Access Secrets

Composite actions do NOT have access to the `secrets` context for security reasons. Pass secrets explicitly as inputs:

```yaml
# Composite action caller
- uses: ./.github/actions/my-action
  with:
    token: ${{ secrets.MY_TOKEN }}

# Inside composite action
inputs:
  token:
    required: true
runs:
  using: composite
  steps:
    - run: echo "${{ inputs.token }}"
```

### Secret Masking

GitHub automatically masks secrets when printed to logs by replacing them with `***`. However:
- Base64-encoded secrets may not be masked
- URL-encoded secrets may not be masked
- Secrets split across multiple lines may leak
- Command substitution can bypass masking

### Least Privilege Checklist

```yaml
permissions:
  contents: read        # Only read code
  pull-requests: write  # Only if commenting/labeling
  id-token: write       # Only if using OIDC
  packages: write       # Only if publishing packages
```

### Dependabot Secrets

Dependabot uses separate secrets from Actions secrets. Set them in **Settings → Secrets and variables → Dependabot**.

## Layer 4 Pointers

- [Workflow Syntax](syntax.md) — `permissions` key syntax, `secrets` in job/container config.
- [Events & Triggers](events-triggers.md) — Fork behavior, `pull_request_target` risks.
- [Reusability](reusability.md) — Passing secrets to composite actions and reusable workflows.
