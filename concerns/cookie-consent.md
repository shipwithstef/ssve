---
name: cookie-consent
domain: privacy
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/components/**/CookieBanner*"
    - "**/components/**/Consent*"
  diff_keywords:
    - "cookieConsent"
    - "analytics_consent"
  packages_imported:
    - "react-cookie-consent"
    - "@cookieconsent/*"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-ux"]

waiver_format: |
  PR body line: "concern-waived: cookie-consent — <reason>"

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
  - consent-management
---

# cookie-consent

GDPR/ePrivacy require pre-consent for non-essential cookies. Default-off, easy reject.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
