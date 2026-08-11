---
name: region-locking
domain: privacy
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/geo-restrict*"
    - "**/middleware/geo*"
  diff_keywords:
    - "geoBlock"
    - "allowedCountries"
    - "GDPR.*EU"
    - "CCPA.*California"
  packages_imported:
    - "geoip-lite"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: region-locking — <reason>"

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
---

# region-locking

Some features must geo-block (export controls, regulated content, ToS jurisdictions).

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
