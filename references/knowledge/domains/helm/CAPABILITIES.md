# Helm — Kubernetes Package Manager

Layer 2 summary. Read this before any detail file.

## What It Is

Helm is the de facto package manager for Kubernetes. It uses **charts** (templated YAML bundles) to define, install, and upgrade complex K8s applications. Helm 3 (current) is a pure client-side CLI that talks directly to the Kubernetes API — the server-side Tiller component from Helm 2 was removed for security simplicity.

Latest stable: **v3.17.x** (as of early 2026). Tracks Kubernetes release cadence closely (typically supports current + two previous K8s minor versions).

## Core Capabilities

| Capability | What It Does | Detail File |
|---|---|---|
| **Chart packaging** | Bundle K8s manifests + metadata + templates into a versioned, installable unit | details/charts.md |
| **Templating engine** | Render K8s YAML from Go templates + Sprig functions + custom helpers | details/templating.md |
| **Release lifecycle** | Install, upgrade, rollback, uninstall, and history-track deployed charts | details/cli-lifecycle.md |
| **Repository / OCI distribution** | Fetch charts from HTTP repos or OCI-compliant registries (GA since 3.8) | details/registries-dependencies.md |
| **Dependency management** | Declare sub-charts in Chart.yaml; pull and vendor them automatically | details/registries-dependencies.md |
| **Hooks** | Execute Jobs at specific lifecycle points (pre-install, post-upgrade, etc.) | details/cli-lifecycle.md |
| **Values overrides** | Merge default values.yaml with CLI --set/--values overrides per environment | details/charts.md |

## Built-in Objects (Template Context)

| Object | Purpose |
|---|---|
| `.Values` | Values merged from values.yaml + user overrides |
| `.Release` | Release metadata (`.Name`, `.Namespace`, `.Revision`, `.IsUpgrade`, `.IsInstall`) |
| `.Chart` | Chart metadata from Chart.yaml (`.Name`, `.Version`, `.AppVersion`) |
| `.Capabilities` | Cluster capabilities (`.KubeVersion`, `.APIVersions.Has`) |
| `.Template` | Current template name / base path |
| `.Files` | Access non-template files in the chart (`.Get`, `.Glob`, `.Lines`, `.AsSecrets`, `.AsConfig`) |

## Quick CLI Surface

```bash
helm create mychart              # scaffold a new chart
helm template mychart .          # render templates locally (dry run)
helm install rel ./mychart -f values.prod.yaml
helm upgrade --install rel ./mychart
helm rollback rel 2
helm uninstall rel
helm repo add bitnami https://charts.bitnami.com/bitnami
helm dependency update           # fetch Chart.yaml dependencies
helm lint ./mychart
helm package ./mychart           # produce .tgz
helm push ./mychart-1.0.0.tgz oci://registry.io/charts
```

## When to Use Helm vs Alternatives

| Tool | Use When | Avoid When |
|---|---|---|
| **Helm** | You need packaging, versioning, templating, and lifecycle management for reusable apps | You only need to patch a few fields on existing static manifests |
| **Kustomize** | You need environment-specific overlays on base manifests without templating logic | You need complex conditional resource generation or SemVer packaging |
| **Raw kubectl** | One-off applies, CI/CD that already generates full manifests | Reusable, versioned, multi-env deployments |
| **Operators** | Complex stateful apps requiring deep domain-specific lifecycle automation | Simple stateless deployments where a chart suffices |

## Security Notes

- Helm 3 stores release state as Secrets (default) or ConfigMaps in the target namespace — no cluster-wide Tiller.
- Chart provenance: `helm package --sign` with GPG or Sigstore for OCI charts.
- `helm get values` can expose secrets if values contain raw credentials; prefer external secret management (Vault, Sealed Secrets, External Secrets Operator).
- `--dry-run` can now execute `lookup` functions against the cluster (since 3.13+); use `--dry-run=client` to suppress.

## Ecosystem Tools

| Tool | Purpose |
|---|---|
| **Helmfile** | Declarative spec for deploying multiple releases |
| **Helm Diff** | Preview changes before upgrade |
| **Helm Secrets** | SOPS integration for encrypted values |
| **Nova** | Find outdated charts |
| **Pluto** | Detect deprecated K8s APIs in charts |

## L4 Pointers (Where to Go Deeper)

- Official docs: https://helm.sh/docs/
- Chart best practices: https://helm.sh/docs/chart_best_practices/
- Sprig function reference: https://masterminds.github.io/sprig/
- OCI registries: https://helm.sh/docs/topics/registries/
- Helm source: https://github.com/helm/helm
