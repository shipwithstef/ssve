# Repositories, OCI Registries, and Dependencies

## Classic Helm Repositories

A Helm repository is an HTTP server hosting packaged charts and an `index.yaml` file that lists available charts and versions.

```bash
# Add a repository
helm repo add bitnami https://charts.bitnami.com/bitnami

# Update local cache
helm repo update

# Search
helm search repo nginx
helm search repo nginx --versions

# Remove
helm repo remove bitnami
```

Repository metadata is cached locally in `~/.cache/helm/repository/`.

## OCI Registries (Recommended for New Work)

Since Helm 3.8, OCI support is **GA and enabled by default**. Charts can be stored in any OCI-compliant registry alongside container images.

### Benefits Over Classic Repos

| Classic Repo | OCI Registry |
|---|---|
| Requires `index.yaml` maintenance | No index needed |
| Separate auth system | Unified auth with container images (`docker login`) |
| Dedicated chart server | Reuse existing registry infrastructure (Harbor, ECR, ACR, GAR, GHCR) |
| Custom upload tooling | Standard `helm push` / `helm pull` |

### Workflow

```bash
# Package the chart
helm package ./mychart        # produces mychart-1.0.0.tgz

# Log in to registry
helm registry login registry.example.com -u user

# Push
helm push mychart-1.0.0.tgz oci://registry.example.com/charts

# Install by tag
helm install myrelease oci://registry.example.com/charts/mychart --version 1.0.0

# Install by digest (immutable, most secure)
helm install myrelease oci://registry.example.com/charts/mychart@sha256:abc123...

# Pull (download without installing)
helm pull oci://registry.example.com/charts/mychart --version 1.0.0
```

### Registry-Specific Notes

- **Docker Hub:** Supports OCI artifacts including Helm charts.
- **GitHub Container Registry (GHCR):** `oci://ghcr.io/owner/charts/mychart`
- **Google Artifact Registry:** `oci://us-docker.pkg.dev/project/repo`
- **Harbor:** Supports both OCI and classic chart repositories.
- **ECR / ACR:** Native OCI support with IAM/RBAC integration.

### Authentication

Helm shares credential storage with Docker where possible. Credentials are stored in:

- Docker credential helpers (`osxkeychain`, `pass`, etc.) if configured
- Fallback: `~/.config/helm/registry/config.json` (unencrypted base64)

```bash
# Use docker login credentials
helm registry login docker.io -u username
```

## Chart Dependencies

Declare dependencies in `Chart.yaml`:

```yaml
dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
    tags:
      - database
    alias: db
    import-values:
      - child: service
        parent: dbService
```

### Dependency Commands

```bash
helm dependency update ./mychart    # download/update charts/ and Chart.lock
helm dependency build ./mychart     # rebuild from Chart.lock (CI-friendly)
helm dependency list ./mychart      # show current deps
```

### Chart.lock

After `helm dependency update`, a `Chart.lock` file is generated pinning exact dependency versions. Commit this to version control for reproducible builds.

### Dependency Conditions and Tags

```yaml
# values.yaml
postgresql:
  enabled: true
tags:
  database: false
```

- `condition: postgresql.enabled` — dependency is included only if the condition evaluates to truthy.
- `tags` — if ANY tag in the list is enabled, the dependency is included.
- `alias` — installs the dependency with a different release name prefix.

### OCI Dependencies

```yaml
dependencies:
  - name: mychart
    version: "2.7.0"
    repository: "oci://localhost:5000/myrepo"
```

Run `helm dependency update` to pull OCI dependencies.

## Global Values

Values under `global:` in values.yaml or `--set` are propagated to all subcharts:

```yaml
# parent values.yaml
global:
  storageClass: fast-ssd

# child chart can access
{{ .Values.global.storageClass }}
```

## Library Charts

A `type: library` chart contains reusable named templates but no installable resources. Used as a dependency to share helpers across multiple charts.

```yaml
# library chart Chart.yaml
apiVersion: v2
name: common
description: Common helper templates
type: library
version: 1.0.0
```

```yaml
# consuming chart Chart.yaml
dependencies:
  - name: common
    version: "1.x.x"
    repository: "https://charts.example.com"
```

## L4 Pointers

- OCI registries: https://helm.sh/docs/topics/registries/
- Chart dependencies: https://helm.sh/docs/topics/charts/#chart-dependencies
- Library charts: https://helm.sh/docs/topics/library_charts/
- Helm search: https://helm.sh/docs/helm/helm_search/
