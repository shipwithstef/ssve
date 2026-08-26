---
name: paid-ocr-vision-api
domain: integration
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/ocr/**"
    - "**/services/vision/**"
    - "**/functions/*ocr*/**"
    - "**/functions/*receipt*/**"
    - "**/functions/*processReceipt*/**"
  diff_keywords:
    - "vision\.googleapis"
    - "textract"
    - "rekognition"
    - "documentai"
  packages_imported:
    - "@google-cloud/vision"
    - "@aws-sdk/client-textract"
    - "@google-cloud/documentai"
  env_vars_referenced:
    - "GOOGLE_VISION_*"
    - "AWS_TEXTRACT_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["manage-finops","review-security"]

waiver_format: |
  PR body line: "concern-waived: paid-ocr-vision-api — <reason>"

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
---

# paid-ocr-vision-api

Receipts and IDs contain PII. Combined cost + privacy concern.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
