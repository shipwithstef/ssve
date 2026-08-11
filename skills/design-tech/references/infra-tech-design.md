# Infra Tech Design Annex

Source: `proposals/done/2026-04-30-infra-project-support.md` § 5 phase 5

Annex to `design-tech` for infra lanes. Adds infra-specific decision categories on top of the standard tech-design output.

## Provider / Module Choices

Justify by version pin, CVE history, community support, vendor lock-in profile.

| Decision | Choice | Justification | Alternative considered |
|---|---|---|---|
| IaC tool | Terraform 1.7.x | mature, widest community | Pulumi (rejected: smaller community) |
| AWS provider | hashicorp/aws v5.40.x | latest stable | beta v6 (rejected: not GA) |
| K8s controller | argo-cd v2.10 | GitOps native | flux (acceptable; team familiarity) |

## State Backend

| Aspect | Choice | Notes |
|---|---|---|
| Storage | s3 with dynamodb lock | versioned, encrypted at rest |
| Access | IAM role per env (dev/staging/prod) | no shared credentials |
| Workspaces | terraform workspaces or separate state files | document choice and migration path |

## Secret Management

| Secret type | Storage | Rotation cadence | Access pattern |
|---|---|---|---|
| Database credentials | aws-secrets-manager | 90 days auto | IAM role at runtime |
| API keys for external services | aws-secrets-manager | manual quarterly | CI/CD only |
| TLS certificates | aws-certificate-manager | auto-renew via ACM | LB termination |

## Drift Detection Wiring

| Mechanism | When | Action |
|---|---|---|
| Scheduled `terraform plan` | hourly via CI | log diff, alert if non-empty |
| AWS Config rules | continuous | alert on out-of-band changes |
| `kubectl diff` against committed manifests | per-deploy | block deploy if drift |

## Module Pinning Discipline

- Providers pinned to exact minor (e.g., `~> 5.40.0`).
- Modules pinned to git tags, NOT commit SHAs (auditability).
- Helm charts pinned via `version:` in values, NOT `latest`.
- Validator: `validate-infra-version-pins.sh` (added in WI-SPINE-004).
