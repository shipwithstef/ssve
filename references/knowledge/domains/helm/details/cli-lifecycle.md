# CLI, Release Lifecycle, and Hooks

## Helm 3 Architecture

Helm 3 is **client-only**. The CLI (`helm`) runs on the user's machine and communicates directly with the Kubernetes API server using the user's kubeconfig credentials. Release state is stored as Secrets (default) or ConfigMaps in the target namespace.

No Tiller. No cluster-side component. RBAC is standard Kubernetes RBAC.

## Core Commands

### Installation

```bash
helm install <release-name> <chart> [flags]

# Examples
helm install myapp ./mychart
helm install myapp bitnami/nginx -f values.prod.yaml --namespace prod --create-namespace
helm install myapp ./mychart --set replicaCount=5 --set image.tag=2.0.0
helm install myapp ./mychart --dry-run --debug        # render without applying
helm install myapp ./mychart --generate-name          # auto-generate release name
helm install myapp ./mychart --wait --timeout 5m      # block until ready
```

### Upgrade

```bash
helm upgrade <release-name> <chart> [flags]

# Examples
helm upgrade myapp ./mychart
helm upgrade --install myapp ./mychart    # install if not exists, else upgrade
helm upgrade myapp ./mychart --reset-values      # discard prior values, use defaults
helm upgrade myapp ./mychart --reuse-values      # keep prior values, merge new
helm upgrade myapp ./mychart --reset-then-reuse-values  # reset then re-apply user values
helm upgrade myapp ./mychart --force             # replace (delete+recreate) resources
helm upgrade myapp ./mychart --take-ownership    # adopt resources not owned by Helm (3.17+)
```

**Values merge behavior on upgrade:**
- Without flags: merge new values over previously user-supplied values.
- `--reset-values`: ignore prior user values, use chart defaults only.
- `--reuse-values`: preserve all prior user values, merge only new CLI flags.

### Rollback

```bash
helm rollback <release-name> <revision>

# Example
helm rollback myapp 2
```

Rollback reverts to the specified revision's manifest. The rolled-back state becomes a new revision (history is append-only).

### Uninstall

```bash
helm uninstall <release-name> [flags]

# Examples
helm uninstall myapp
helm uninstall myapp --keep-history    # retain release history (useful for rollback)
helm uninstall myapp --wait            # wait for resources to be deleted
```

### History and Inspection

```bash
helm list --all-namespaces
helm history myapp
helm status myapp
helm get values myapp             # user-supplied values
helm get values myapp --all       # computed values (defaults + user)
helm get manifest myapp           # rendered K8s manifests
helm get notes myapp              # NOTES.txt output
helm get metadata myapp           # Chart.yaml metadata
```

## Release State Storage

Helm stores release metadata in the target namespace:

- **Secret driver (default):** One Secret per release revision, labeled `owner=helm`.
- **ConfigMap driver:** One ConfigMap per revision. Less secure (values are base64 in Secrets, plain text in ConfigMaps).
- **SQL driver:** Experimental; stores state in a SQL database.

Switch driver:

```bash
helm install myapp ./mychart --storage sql --sql-dsn "postgres://..."
```

## Hooks

Hooks allow running Kubernetes Jobs at specific lifecycle events.

### Hook Annotations

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  annotations:
    "helm.sh/hook": post-install
    "helm.sh/hook-weight": "1"
    "helm.sh/hook-delete-policy": hook-succeeded
```

### Available Hooks

| Hook | When It Runs |
|---|---|
| `pre-install` | After templates render, before any resources created |
| `post-install` | After all resources are ready |
| `pre-delete` | Before deleting release resources |
| `post-delete` | After all release resources deleted |
| `pre-upgrade` | Before upgrading resources |
| `post-upgrade` | After upgrading resources |
| `pre-rollback` | Before rolling back |
| `post-rollback` | After rolling back |
| `test` | When `helm test` is run |

### Hook Delete Policies

| Policy | Behavior |
|---|---|
| `hook-succeeded` | Delete hook Job if it succeeds |
| `hook-failed` | Delete hook Job if it fails |
| `before-hook-creation` | Delete previous hook before running new one |
| `no-delete` or none | Keep the hook resource |

### Hook Weights

Hooks with the same event run in order of `hook-weight` (ascending integer). Negative weights are allowed.

## Tests

Charts can include test Pods in `templates/tests/`. These run with `helm test`:

```yaml
# templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "mychart.fullname" . }}-test-connection"
  annotations:
    "helm.sh/hook": test
spec:
  containers:
    - name: wget
      image: busybox
      command: ['wget']
      args: ['{{ include "mychart.fullname" . }}:{{ .Values.service.port }}']
  restartPolicy: Never
```

```bash
helm test myapp
```

## Lint and Template

```bash
helm lint ./mychart              # static analysis
helm template myapp ./mychart    # render to stdout
helm template myapp ./mychart --output-dir ./rendered
helm template myapp ./mychart | kubectl apply --dry-run=client -f -
```

## L4 Pointers

- Helm commands reference: https://helm.sh/docs/helm/
- Hooks: https://helm.sh/docs/topics/charts_hooks/
- Chart tests: https://helm.sh/docs/topics/chart_tests/
- Storage backends: https://helm.sh/docs/topics/advanced/#storage-backends
