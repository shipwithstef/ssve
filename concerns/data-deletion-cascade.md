---
name: data-deletion-cascade
domain: data
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/cascadeDelete*"
    - "**/functions/cascadeDelete/**"
    - "**/services/deletion/**"
  diff_keywords:
    - "ON DELETE CASCADE"
    - "cascadeDelete"
    - "deleteAccount"
    - "forceDelete"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: data-deletion-cascade — <reason>"

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
  - data-model-mutation
  - gdpr-deletion
  - pii-handling
---

# data-deletion-cascade

Cascade rules can silently destroy unrelated data. Each delete path needs explicit blast-radius proof.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
