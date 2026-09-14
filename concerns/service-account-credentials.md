---
name: service-account-credentials
domain: auth
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/service-accounts/**"
  diff_keywords:
    - "google-service-account"
    - "service_account\.json"
    - "IAM\.assumeRole"
  packages_imported:
    - "google-auth-library"
    - "@google-cloud/iam"
  env_vars_referenced:
    - "GOOGLE_APPLICATION_CREDENTIALS"
    - "AWS_ROLE_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: service-account-credentials — <reason>"

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
  - secrets-management
---

# service-account-credentials

Service-account credentials in code or world-readable config = blast-radius CRITICAL.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
