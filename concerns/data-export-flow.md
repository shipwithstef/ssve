---
name: data-export-flow
domain: data
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/export/**"
    - "**/functions/*export*/**"
    - "**/data-export/**"
  diff_keywords:
    - "userDataExport"
    - "gdprExport"
    - "streamToFile"
    - "csv\.stringify"
  packages_imported:
    - "archiver"
    - "csv-stringify"
    - "json2csv"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: data-export-flow — <reason>"

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
  - gdpr-deletion
---

# data-export-flow

Data exports must include all PII or comply with subject-access-rights; access controls must be enforced.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
