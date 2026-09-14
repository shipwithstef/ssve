---
name: ssrf-prevention
domain: security
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    []
  diff_keywords:
    - "fetch\(\s*req\."
    - "http\.get\(\s*req\."
    - "axios\.get\(\s*req\.body"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: ssrf-prevention — <reason>"

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
  - auth-surface
---

# ssrf-prevention

User-supplied URLs in server fetch can hit metadata services and internal IPs.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
