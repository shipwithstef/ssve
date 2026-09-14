---
name: deploy-rollback-plan
domain: infra
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/.github/workflows/release*"
    - "**/.github/workflows/deploy*"
    - "**/scripts/deploy*"
  diff_keywords:
    - "deploy"
    - "release"
    - "rollback"
    - "revert"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: ["build-and-ship-alignment"]
  required_skills: []
  optional_skills: ["audit-implementation"]

waiver_format: |
  PR body line: "concern-waived: deploy-rollback-plan — <reason>"

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
  - build-ship-alignment
---

# deploy-rollback-plan

Every deploy needs a roll-back recipe. Otherwise rollback is incident response.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
