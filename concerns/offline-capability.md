---
name: offline-capability
domain: ux
severity: LOW
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/sw.{ts,js}"
    - "**/service-worker*"
    - "**/offline*"
  diff_keywords:
    - "navigator\.onLine"
    - "caches\.open"
    - "workbox"
  packages_imported:
    - "workbox-*"
    - "idb"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: offline-capability — <reason>"

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

# offline-capability

PWA / native offline UX requires explicit cache + sync strategy.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
