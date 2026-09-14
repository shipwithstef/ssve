# Stack Profile

> Source-of-truth for project identity. Read by `recall-stack-knowledge` (the Spine gate) at phase 0 of every infra-* lane. Per `proposals/done/2026-04-30-infra-project-support.md` § 3.1 + § 17.2.

**Project:** <name>
**Class:** infra | app | mixed
**Last refreshed:** <iso-date>
**Refresh cadence:** every 90 days OR when stack components change

## Stack

| Component | Choice | Version pin |
|---|---|---|
| Cloud(s) | aws / gcp / azure / multi | — |
| IaC tool | terraform / pulumi / cloudformation / cdk | (e.g. terraform 1.7.x) |
| K8s flavor | eks / gke / aks / self-hosted / none | (e.g. eks 1.29) |
| Observability | datadog / new-relic / grafana-stack / cloudwatch | — |
| Secret manager | aws-secrets-manager / vault / sops / gcp-sm | — |
| CI/CD platform | github-actions / gitlab-ci / circleci / buildkite | — |
| Policy engine | opa / sentinel / checkov / tfsec / kube-score | — |
| Cost tool | infracost / cloud-custodian / native | — |
| Chaos tool | aws-fis / chaos-mesh / litmus / none | — |

## FinOps envelope (per § 17.2)

```yaml
finops:
  monthly_envelope_usd: <int>
  per_unit_target: { metric: "per-1k-requests", usd_max: <float> }
  cost_alert_threshold_pct: <int>           # default 10
  baseline_file: .svc/cost-baseline.jsonl
```

## Security envelope

```yaml
security:
  compliance_frameworks: [SOC2, GDPR, HIPAA, PCI]   # list applicable
  policy_packs: [tfsec/aws, checkov/k8s, opa/iam-least-priv]
  secret_manager: <choice>
  supply_chain:
    signed_images_required: true | false
    sbom_required: true | false
  baseline_file: .svc/security-baseline.jsonl
```

## Scalability envelope

```yaml
scalability:
  peak_load: { rps: <int>, p95_latency_ms: <int> }
  multi_az: required | optional | none
  multi_region: { rto_min: <int>, rpo_min: <int> }
  capacity_headroom_pct_min: <int>          # default 30
  baseline_file: .svc/scalability-baseline.jsonl
```

## Criticality tier

`tier-1` (revenue/safety) | `tier-2` (important) | `tier-3` (best-effort)

## On-call rotation

Link to PagerDuty / Opsgenie / team rotation doc.

## Plan-staleness threshold

```yaml
plan_staleness:
  max_minutes_since_plan: 30   # execute-changeset --infra refuses applies older than this
```

## Knowledge domains needed

List the `references/knowledge/domains/<stack>/` slices `recall-stack-knowledge` should fetch first. Lazy-populated by gap → research auto-loop on first miss.

- `terraform/` — IaC tool (if used)
- `kubernetes/` — k8s patterns (if used)
- `aws-iam/` — IAM least-privilege (if AWS)
- `<provider>/` — primary cloud

## Topic → domain map (Spine recall)

Skills declare `requires_topics: [stack.iac-tool, stack.criticality-tier, ...]` in their frontmatter. The recall gate resolves each topic to a knowledge-domain slice via the table below. **This is what makes `helm` (or `terraform`/`pulumi`) get auto-injected into `plan-blast-radius` context** — the skill asks for `stack.iac-tool` and the Spine looks here to find which domain to pull.

```yaml
topic_to_domain:
  stack.cloud:           [<aws|gcp|azure>]
  stack.iac-tool:        [<terraform|helm|pulumi|cdk>]   # multi-value if hybrid
  stack.k8s-flavor:      [<eks|gke|aks>, kubernetes]
  stack.observability:   [<datadog|grafana>]
  stack.secret-manager:  [<aws-secrets-manager|vault|sops>]
  stack.ci-cd:           [<github-actions|gitlab-ci>]
  stack.policy-engine:   [<opa|tfsec|checkov>]
  stack.cost-tool:       [<infracost>]
  stack.chaos-tool:      [<aws-fis|chaos-mesh>]
  stack.criticality-tier: []   # no domain — read scalar from this file
```

**Example:** if `IaC tool = helm` above, then `stack.iac-tool` resolves to `references/knowledge/domains/helm/`. A skill with `requires_topics: [stack.iac-tool]` will auto-recall the helm slice.
