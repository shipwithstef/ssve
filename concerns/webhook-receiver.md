---
name: webhook-receiver
domain: integration
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/functions/*webhook*/**"
    - "**/api/webhooks/**"
  diff_keywords:
    - "x-signature"
    - "webhook\.verify"
    - "constructEvent"
    - "svix"
  packages_imported:
    - "svix"
    - "standardwebhooks"
  env_vars_referenced:
    - "*_WEBHOOK_SECRET"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: webhook-receiver — <reason>"

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
  - replay-protection
---

# webhook-receiver

Signature verification + replay protection + idempotency. Skipping any one is exploitable.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
