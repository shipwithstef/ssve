---
name: memory-leak-risk
domain: performance
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    []
  diff_keywords:
    - "setInterval\(.*\)"
    - "addEventListener\(.*\)"
    - "globalThis\.\w+\s*="
    - "__\w+\s*\|\|\=\s*new Map"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: memory-leak-risk — <reason>"

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
  - cache-eviction-policy
---

# memory-leak-risk

Unbounded global collections, uncleaned intervals, leaked listeners.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
