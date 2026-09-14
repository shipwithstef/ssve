---
name: data-import-flow
domain: data
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/import/**"
    - "**/functions/*import*/**"
  diff_keywords:
    - "bulkImport"
    - "parseCSV"
    - "streamFromS3"
  packages_imported:
    - "csv-parse"
    - "fast-csv"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech","review-security"]

waiver_format: |
  PR body line: "concern-waived: data-import-flow — <reason>"

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
  - data-model-mutation
  - rate-limiting
---

# data-import-flow

Bulk imports stress the DB and can poison production data. Validation, batch size, dry-run mode.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
