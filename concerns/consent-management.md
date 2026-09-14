---
name: consent-management
domain: privacy
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/consent/**"
  diff_keywords:
    - "consentGiven"
    - "optIn"
    - "optOut"
    - "cookieConsent"
  packages_imported:
    - "@cookieconsent/*"
    - "react-cookie-consent"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: consent-management — <reason>"

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
  - pii-handling
  - cookie-consent
---

# consent-management

Granular per-purpose consent, withdrawal flow, audit trail.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
