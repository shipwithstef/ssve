# Templating — Go Templates, Sprig, and Helpers

## Engine Basics

Helm uses Go's `text/template` engine augmented with the **Sprig** template function library. Templates live in `templates/` and produce valid Kubernetes YAML when rendered.

**Key rule:** Helm does not "understand" YAML — it performs text substitution. It is entirely possible to generate syntactically invalid YAML.

## Built-in Template Objects

| Object | Description | Example |
|---|---|---|
| `.Values` | Merged configuration values | `.Values.replicaCount` |
| `.Release` | Release metadata | `.Release.Name`, `.Release.Namespace` |
| `.Chart` | Chart metadata | `.Chart.Name`, `.Chart.Version` |
| `.Capabilities` | Cluster capabilities | `.Capabilities.KubeVersion.Version` |
| `.Template` | Current template info | `.Template.Name`, `.Template.BasePath` |
| `.Files` | Access to non-template files | `.Files.Get "config.json"` |

## Common Template Directives

```yaml
# Variable assignment
{{- $fullname := include "mychart.fullname" . -}}

# Conditionals
{{- if .Values.ingress.enabled }}
# ... ingress manifest ...
{{- end }}

# With — sets scope
{{- with .Values.resources }}
resources:
  {{- toYaml . | nindent 12 }}
{{- end }}

# Range — iteration
{{- range .Values.env }}
- name: {{ .name }}
  value: {{ .value | quote }}
{{- end }}

# Default values
{{ .Values.image.tag | default .Chart.AppVersion }}

# Required values (fail if missing)
{{ required "A valid .Values.apiKey entry required!" .Values.apiKey }}
```

## Whitespace Control

Go templates are whitespace-sensitive because YAML is whitespace-sensitive.

- `{{-` — chomp whitespace BEFORE the directive
- `-}}` — chomp whitespace AFTER the directive

**Best practice:** Use whitespace chomping aggressively to keep rendered YAML clean.

```yaml
metadata:
  labels:
    {{- include "mychart.labels" . | nindent 4 }}
```

The `nindent` function: inserts a newline + N spaces of indentation.

## Sprig Functions (High-Utility Subset)

Sprig adds ~100 template functions. Most commonly used in Helm:

### String
- `quote`, `squote`, `upper`, `lower`, `title`, `trim`, `replace`, `repeat`
- `b64enc`, `b64dec`
- `sha256sum`, `sha512sum` (3.16+)

### Math
- `add`, `sub`, `mul`, `div`, `mod`, `max`, `min`

### Lists
- `first`, `last`, `rest`, `reverse`, `uniq`, `has`, `concat`, `without`

### Dictionaries
- `get`, `set`, `unset`, `hasKey`, `keys`, `values`, `merge`, `mustMerge`
- `dig` — safely traverse nested maps: `dig "image" "tag" "latest" .Values`

### Reflection / Type
- `kindOf`, `kindIs`, `typeOf`
- `empty`, `int`, `float64`, `toString`

### Date
- `now`, `date`, `dateModify`, `dateInZone`

### Encoding
- `toYaml`, `fromYaml`, `toJson`, `fromJson`, `toToml`
- `toYamlPretty` (3.17+) — pretty-printed YAML output

## Named Templates (Helpers)

Defined in `_helpers.tpl` and included elsewhere. **Must be namespaced** with chart name to avoid collisions across subcharts.

```yaml
{{/* _helpers.tpl */}}
{{- define "mychart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "mychart.labels" -}}
helm.sh/chart: {{ include "mychart.chart" . }}
{{ include "mychart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
```

Usage:

```yaml
metadata:
  name: {{ include "mychart.fullname" . }}
  labels:
    {{- include "mychart.labels" . | nindent 4 }}
```

## The `tpl` Function

Renders a string as a template. Useful for values that contain template expressions:

```yaml
# values.yaml
extraLabels: |
  team: {{ .Values.team }}
  env: {{ .Release.Namespace }}

# template
metadata:
  labels:
    {{- include "mychart.labels" . | nindent 4 }}
    {{- tpl .Values.extraLabels . | nindent 4 }}
```

## The `lookup` Function

Query the live cluster during template rendering:

```yaml
{{- $secret := lookup "v1" "Secret" .Release.Namespace "my-secret" }}
{{- if $secret }}
  existingValue: {{ index $secret.data "key" | b64dec }}
{{- end }}
```

**Caution:** `lookup` requires cluster access. In `--dry-run=client` mode, it returns empty. In `--dry-run=server` (3.13+ default), it queries the cluster.

## Kubernetes Labeling Convention

Helm charts should use the standard Kubernetes recommended labels:

```yaml
app.kubernetes.io/name: {{ include "mychart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/component: backend
app.kubernetes.io/part-of: myapp
app.kubernetes.io/managed-by: {{ .Release.Service }}
```

## L4 Pointers

- Go template docs: https://pkg.go.dev/text/template
- Sprig function reference: https://masterminds.github.io/sprig/
- Helm template guide: https://helm.sh/docs/chart_template_guide/
