---
name: mfa-flow
domain: auth
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/mfa/**"
    - "**/2fa/**"
    - "**/functions/*mfa*/**"
  diff_keywords:
    - "totp"
    - "otpauth"
    - "webauthn"
    - "authenticator"
    - "verifyMFA"
  packages_imported:
    - "otpauth"
    - "speakeasy"
    - "@simplewebauthn/*"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: mfa-flow — <reason>"

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

# mfa-flow

Backup codes, recovery flow, replay protection on TOTP windows.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
