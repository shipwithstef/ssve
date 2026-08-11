---
name: gdpr-deletion
domain: privacy
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/gdpr/**"
    - "**/services/deletion/**"
    - "**/functions/*deleteAccount*/**"
  diff_keywords:
    - "gdprDelete"
    - "rightToErasure"
    - "eraseUser"
    - "tombstone"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: gdpr-deletion — <reason>"

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
  - pii-handling
  - data-deletion-cascade
---

# gdpr-deletion

Backups, downstream copies, log retention, third-party subprocessors. Deletion is multi-system.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
