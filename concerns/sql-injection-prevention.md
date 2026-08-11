---
name: sql-injection-prevention
domain: security
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/db/**"
    - "**/queries/**"
  diff_keywords:
    - "\$\{[^}]*\}.*\bSELECT\b"
    - "\+\s*[`'\"]\bSELECT\b"
    - "rawQuery"
    - "unsafeRaw"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: sql-injection-prevention — <reason>"

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

# sql-injection-prevention

Parameterize every query. ORMs help; raw SQL with string interpolation is the canonical bug.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
