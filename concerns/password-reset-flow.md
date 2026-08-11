---
name: password-reset-flow
domain: auth
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/password-reset*"
    - "**/forgot-password*"
    - "**/functions/*passwordReset*/**"
  diff_keywords:
    - "forgotPassword"
    - "resetPassword"
    - "sendResetEmail"
    - "tokenExpiry"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: password-reset-flow — <reason>"

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
  - paid-notification-api
---

# password-reset-flow

Single-use token + short TTL + rate limit + uniform response (no user enumeration).

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
