---
name: cors-policy
domain: security
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/middleware/cors*"
    - "**/cors.config*"
  diff_keywords:
    - "Access-Control-Allow-Origin"
    - "cors\(\{"
    - "origin:\s*['\"]\*"
  packages_imported:
    - "cors"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: cors-policy — <reason>"

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

# cors-policy

Wildcard origin in production is the canonical mistake. Allowlist specific origins.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
