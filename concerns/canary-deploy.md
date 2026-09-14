---
name: canary-deploy
domain: infra
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/.github/workflows/**"
  diff_keywords:
    - "canary"
    - "blue-green"
    - "percentage:\s*\d"
    - "traffic_split"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: canary-deploy — <reason>"

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
  - feature-flag-rollout
---

# canary-deploy

Gradual ramp + automatic rollback signal. Catch incidents before 100%.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
