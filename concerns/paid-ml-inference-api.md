---
name: paid-ml-inference-api
domain: integration
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/ml/**"
    - "**/services/vision/**"
    - "**/services/speech/**"
    - "**/functions/*classify*/**"
    - "**/functions/*predict*/**"
  diff_keywords:
    - "replicate\.run"
    - "huggingface"
    - "inference\.endpoint"
    - "speech-to-text"
    - "translate"
  packages_imported:
    - "replicate"
    - "@huggingface/inference"
    - "@google-cloud/vision"
    - "@google-cloud/speech"
  env_vars_referenced:
    - "REPLICATE_*"
    - "HF_*"
    - "HUGGINGFACE_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["manage-finops"]

waiver_format: |
  PR body line: "concern-waived: paid-ml-inference-api — <reason>"

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
---

# paid-ml-inference-api

Per-second GPU billing or per-request inference cost. Batch where possible, cache outputs by input hash.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
