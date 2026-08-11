---
name: paid-analytics-api
domain: integration
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/analytics/**"
    - "**/functions/*track*/**"
  diff_keywords:
    - "posthog"
    - "mixpanel"
    - "amplitude"
    - "segment\.com"
  packages_imported:
    - "posthog-js"
    - "posthog-node"
    - "mixpanel-browser"
    - "@amplitude/*"
    - "@segment/*"
  env_vars_referenced:
    - "POSTHOG_*"
    - "MIXPANEL_*"
    - "AMPLITUDE_*"
    - "SEGMENT_*"

handled_by:
  required_rules: ["paid-api-integration-checklist"]
  required_skills: []
  optional_skills: ["manage-finops","review-security"]

waiver_format: |
  PR body line: "concern-waived: paid-analytics-api — <reason>"

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
  - paid-external-api
  - pii-handling
  - consent-management
---

# paid-analytics-api

Per-event billing + PII risk. Sampling, server-side vs client-side, opt-in.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
