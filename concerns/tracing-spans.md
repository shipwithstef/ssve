---
name: tracing-spans
domain: observability
severity: LOW
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/tracing/**"
  diff_keywords:
    - "opentelemetry"
    - "tracer\.start"
    - "span\.end"
  packages_imported:
    - "@opentelemetry/*"
  env_vars_referenced:
    - "OTEL_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: []

waiver_format: |
  PR body line: "concern-waived: tracing-spans — <reason>"

fires_on:
  - first-introduction
  - bugfix-touching-call-shape
  - new-caller
  - refactor

fires_off:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
  - "**/docs/**"

related_concerns:
  []
---

# tracing-spans

Sampling, propagation, end-to-end coverage on slow paths.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
