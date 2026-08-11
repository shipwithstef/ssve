---
name: metrics-emission
domain: observability
severity: LOW
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/metrics/**"
  diff_keywords:
    - "StatsD"
    - "prometheus"
    - "datadog"
    - "cloudwatch:put"
  packages_imported:
    - "hot-shots"
    - "datadog-metrics"
    - "prom-client"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: []

waiver_format: |
  PR body line: "concern-waived: metrics-emission — <reason>"

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

# metrics-emission

Cardinality limits, label hygiene, SLI alignment.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
