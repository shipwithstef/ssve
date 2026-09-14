# Best Practices and Anti-Patterns

## Chart Authoring

### Naming
- Chart names: lowercase, start with letter, use hyphens sparingly.
- Avoid dots and underscores in chart names.
- Template file names: dashed notation (`my-configmap.yaml`), not camelCase.
- One resource definition per template file.

### Versioning
- Use SemVer 2 for chart `version`.
- Pin container image tags explicitly; never default to `latest`.
- Keep `appVersion` synchronized with the application version it deploys.

### Labels and Selectors
- Always declare selectors in PodTemplates explicitly.
- Do NOT use mutable labels (like version or timestamp) in selectors — this breaks Deployment rollouts.
- Use standard Kubernetes recommended labels (see templating.md).

### Resources
- Always define `resources.requests` and `resources.limits` in values.yaml (even if commented out).
- Do not hardcode resource values in templates.

### Security
- Run containers as non-root where possible.
- Set `readOnlyRootFilesystem: true` when feasible.
- Drop all capabilities, add back only what's needed.
- Do not put secrets in `values.yaml`. Use External Secrets Operator, Sealed Secrets, or Vault.
- Be aware that `helm get values` exposes values in plaintext (even from Secrets storage).

### Probes
- Configure `livenessProbe`, `readinessProbe`, and `startupProbe` via values.yaml.
- Ensure probes point to the correct container port.

## Values Design

### Override-Friendly Structure
- Make values easy to override with `--set`. Prefer maps over arrays for named collections.
- Document every value in `values.yaml` with a comment starting with the property name.
- Provide `values-production.yaml` and `values-staging.yaml` examples.

### Null Values for Removal
- Since Helm 3.13+, setting a value to `null` removes the key from the merged result. This allows users to delete default resources:

```yaml
# user override
resources: null
```

## Template Hygiene

### Whitespace
- Use `{{-` and `-}}` consistently to avoid blank lines in rendered YAML.
- Use `nindent` instead of `indent` when including multi-line blocks (adds leading newline).

### Nil Safety
- Check nested values exist before accessing:

```yaml
{{ if .Values.persistence }}
  {{ if .Values.persistence.enabled }}
    # ...
  {{ end }}
{{ end }}
```

Or use `dig` (Sprig):

```yaml
{{ dig "persistence" "enabled" false .Values }}
```

### Global Helpers
- All `define` templates must be namespaced: `{{ define "chartName.templateName" }}`.
- Put reusable helpers in `templates/_helpers.tpl`.

## CRD Handling

- Place CRDs in `crds/` as plain YAML (not templated).
- Helm does NOT upgrade CRDs on `helm upgrade`. Plan a separate CRD management strategy for evolving CRDs.
- Do not put CRD instances (custom resources) in `crds/` — they belong in `templates/`.

## Testing and Validation

```bash
helm lint ./mychart
helm template myapp ./mychart --debug
helm template myapp ./mychart | kubectl apply --dry-run=client -f -
helm install myapp ./mychart --dry-run --debug
```

### JSON Schema
- Add `values.schema.json` to catch misconfiguration early.
- Use `--skip-schema-validation` only when intentionally testing edge cases.

## CI/CD Integration

### Recommended Steps
1. `helm lint`
2. `helm template | kubectl apply --dry-run=client`
3. `helm dependency build` (reproducible, uses Chart.lock)
4. `helm upgrade --install --wait --timeout`
5. `helm test` (post-deploy smoke tests)

### Version Pinning in CI
- Pin `helm` binary version in CI to avoid surprise behavior changes.
- Pin chart dependency versions with `Chart.lock`.
- Pin base image digests, not just tags.

## Ecosystem Tooling

| Tool | Use Case |
|---|---|
| **Helmfile** | Declarative multi-release deployments |
| **Helm Diff** | Preview changes before applying upgrade |
| **Helm Secrets** | Encrypt values with Mozilla SOPS |
| **Nova** | Detect outdated chart dependencies |
| **Pluto** | Find deprecated Kubernetes APIs in charts |
| **Chartmuseum** | Self-hosted classic chart repository |
| **Helm Push (helm-push plugin)** | Push charts to ChartMuseum (legacy; use OCI `helm push` instead) |

## Common Mistakes

| Mistake | Why It Hurts | Fix |
|---|---|---|
| Using `latest` tag | Non-reproducible deployments, rollback breakage | Pin exact tag or digest |
| Mutable labels in selectors | Deployment creates new RS every upgrade, orphaning pods | Use stable labels only |
| Forgetting `nindent` | Malformed YAML indentation | Use `nindent N` for blocks |
| Hardcoding namespaces | Chart can't be installed into arbitrary namespaces | Use `{{ .Release.Namespace }}` |
| Storing secrets in values | Exposed via `helm get values` | Use external secret management |
| Not namespacing `define` | Template name collisions across subcharts | Prefix: `chartName.templateName` |
| Expecting CRD upgrades | Helm skips CRD updates on upgrade | Manage CRDs separately |

## L4 Pointers

- Chart best practices guide: https://helm.sh/docs/chart_best_practices/
- Security best practices: https://helm.sh/docs/topics/security/
- Helm + CI/CD patterns: https://helm.sh/docs/topics/ci_cd/
