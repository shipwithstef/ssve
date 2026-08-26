---
name: paid-storage-api
domain: integration
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/storage/**"
    - "**/functions/*upload*/**"
    - "**/functions/*media*/**"
  diff_keywords:
    - "s3\.amazonaws"
    - "storage\.googleapis"
    - "r2\.cloudflarestorage"
    - "putObject"
    - "getObject"
    - "createMultipart"
  packages_imported:
    - "@aws-sdk/client-s3"
    - "@google-cloud/storage"
    - "@cloudflare/r2"
  env_vars_referenced:
    - "AWS_*"
    - "S3_*"
    - "R2_*"
    - "GCS_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["manage-finops","review-security"]

waiver_format: |
  PR body line: "concern-waived: paid-storage-api — <reason>"

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
  - data-deletion-cascade
---

# paid-storage-api

Object storage egress and storage class transitions silently inflate bills. Lifecycle rules + presigned URL TTLs + bucket-level encryption.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
