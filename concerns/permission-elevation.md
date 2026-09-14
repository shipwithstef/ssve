---
name: permission-elevation
domain: auth
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/admin/**"
    - "**/middleware/admin*"
    - "**/functions/*admin*/**"
  diff_keywords:
    - "isAdmin"
    - "requireAdmin"
    - "role\s*===\s*['\"]admin"
    - "sudo\b"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: permission-elevation — <reason>"

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

# permission-elevation

Server-side check at every elevated mutation. Audit log every admin action.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
