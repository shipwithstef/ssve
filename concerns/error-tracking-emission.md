---
name: error-tracking-emission
domain: observability
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/error-handler*"
    - "**/sentry*"
  diff_keywords:
    - "Sentry\."
    - "rollbar"
    - "bugsnag"
    - "captureException"
  packages_imported:
    - "@sentry/*"
    - "rollbar"
    - "@bugsnag/*"
  env_vars_referenced:
    - "SENTRY_*"
    - "ROLLBAR_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: []

waiver_format: |
  PR body line: "concern-waived: error-tracking-emission — <reason>"

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
  - logging-policy
---

# error-tracking-emission

Capture stack + user context (sans PII) + release tag.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
