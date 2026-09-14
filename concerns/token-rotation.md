---
name: token-rotation
domain: auth
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/auth/**"
  diff_keywords:
    - "refreshToken"
    - "rotateToken"
    - "JWT.*sign"
    - "iss\b"
    - "aud\b"
  packages_imported:
    - "jsonwebtoken"
    - "jose"
  env_vars_referenced:
    - "JWT_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: token-rotation — <reason>"

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

# token-rotation

Short access-token TTL + rotating refresh-token + revocation list = baseline.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
