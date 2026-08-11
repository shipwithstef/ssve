# Charts — Structure, Metadata, and Values

## Chart Directory Structure

```
my-chart/
├── Chart.yaml          # Chart metadata + dependencies + version
├── values.yaml         # Default configuration values
├── values.schema.json  # Optional: JSON Schema to validate values
├── charts/             # Vendored dependency charts (auto-populated)
├── crds/               # Custom Resource Definitions (installed BEFORE templates)
├── templates/          # Go-template YAML manifests
│   ├── _helpers.tpl    # Named template helpers (define/include)
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── serviceaccount.yaml
│   ├── hpa.yaml
│   └── NOTES.txt       # Post-install notes (rendered to stdout)
├── .helmignore         # Excludes files from packaging (like .gitignore)
├── README.md           # Human-facing chart documentation
└── LICENSE             # Optional license file
```

## Chart.yaml (apiVersion: v2)

```yaml
apiVersion: v2
name: my-application
description: A production-ready application chart
type: application        # or "library" for reusable helper charts
version: 1.0.0           # Chart version (SemVer 2)
appVersion: "2.4.1"      # Version of the application being deployed
kubeVersion: ">=1.24.0"  # Optional K8s version constraint
home: https://example.com
sources:
  - https://github.com/example/my-app
maintainers:
  - name: Team
    email: contact-351a08ac3c@example.invalid
icon: https://example.com/icon.png
annotations:
  category: Infrastructure
dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
    alias: db
```

**Key rules:**
- Chart names: lowercase letters, numbers, hyphens. No underscores, no dots, no uppercase.
- Directory name MUST match chart name.
- `version` is the chart package version; `appVersion` is the application version.
- `type: library` charts are installable only as dependencies, not directly.

## values.yaml — Design Patterns

### Naming Convention
- camelCase for all user-defined variables.
- Helm built-ins start with uppercase (`.Release.Name`, `.Values`) to avoid collision.

### Flat vs Nested

```yaml
# Nested — use when many related variables and at least one is mandatory
image:
  repository: nginx
  pullPolicy: IfNotPresent
  tag: "1.16.0"

# Flat — use when few related variables or all are optional
imageRepository: nginx
imagePullPolicy: IfNotPresent
imageTag: "1.16.0"
```

Helm best-practice guide historically favored flat for simpler nil-checking, but modern charts often use nested for readability. Nested requires guards:

```yaml
{{ if .Values.image }}
  {{ default "none" .Values.image.tag }}
{{ end }}
```

### Arrays vs Maps for Lists

```yaml
# BAD for --set: ordered array
servers:
  - name: foo
    port: 80

# GOOD for --set: map keyed by name
servers:
  foo:
    port: 80
```

### Image Tag Discipline

Never use `latest`, `head`, `canary` in default values. Always pin:

```yaml
image:
  repository: myapp/backend
  tag: "1.2.3"
  pullPolicy: IfNotPresent
```

### Documentation in values.yaml

Every property should have a comment beginning with the property name:

```yaml
# replicaCount is the number of pod replicas to run
replicaCount: 3

# resources defines CPU/memory limits and requests
resources:
  limits:
    cpu: 500m
    memory: 512Mi
```

This enables `helm show values` and documentation generators to correlate comments with fields.

## Values Precedence (Highest to Lowest)

1. `--set` / `--set-string` / `--set-file` / `--set-json` / `--set-literal` (CLI flags)
2. `-f` / `--values` (user-supplied values files)
3. `values.yaml` in child charts (subcharts)
4. `values.yaml` in parent chart (defaults)

**Note:** `--set` has lower precedence than `-f` files supplied *after* it on the command line. Order matters:

```bash
helm install rel ./chart -f base.yaml -f override.yaml --set foo=bar
```

In this example, `--set foo=bar` wins over `base.yaml`, but `-f override.yaml` wins over `--set` if it also sets `foo`.

## CRDs (crds/ directory)

- Files in `crds/` are installed **before** anything in `templates/`.
- CRDs are **NOT** templated — they must be plain YAML manifests.
- Helm does NOT upgrade CRDs on `helm upgrade`. If a CRD changes, manual intervention or a separate CRD management strategy is required.
- If the chart is deleted, CRDs are **NOT** removed (to prevent data loss).

## JSON Schema Validation (values.schema.json)

Helm 3 supports validating user-supplied values against a JSON Schema. This catches type errors and missing required fields before templating.

```bash
helm install rel ./mychart --set replicaCount=notANumber
# Error: values don't meet the specifications of the schema(s)
```

Skip schema validation with `--skip-schema-validation` (3.16+).

## L4 Pointers

- Chart best practices guide: https://helm.sh/docs/chart_best_practices/
- JSON Schema validation: https://helm.sh/docs/topics/charts/#schema-files
- Library charts: https://helm.sh/docs/topics/library_charts/
