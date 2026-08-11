---
name: cron-or-scheduled-job
domain: infra
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/crons/**"
    - "**/scheduled/**"
    - "**/.github/workflows/cron*"
  diff_keywords:
    - "cron:\s*['\"]"
    - "schedule:\s*['\"]"
    - "setInterval"
  packages_imported:
    - "node-cron"
    - "agenda"
    - "bull"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: cron-or-scheduled-job — <reason>"

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

# cron-or-scheduled-job

Idempotency, single-tenant locking across replicas, missed-run handling.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
