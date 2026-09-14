---
name: webhook-signature-verification
domain: security
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/webhooks/**"
    - "**/functions/*webhook*/**"
  diff_keywords:
    - "constructEvent"
    - "verifySignature"
    - "webhook\.verify"
    - "svix\.verify"
  packages_imported:
    - "stripe"
    - "svix"
  env_vars_referenced:
    - "*_WEBHOOK_SECRET"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: webhook-signature-verification — <reason>"

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
  - webhook-receiver
  - replay-protection
---

# webhook-signature-verification

Unverified webhooks are open trust gates. Always verify before processing.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
