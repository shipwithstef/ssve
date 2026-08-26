---
name: paid-translation-api
domain: integration
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/i18n/**"
    - "**/functions/*translate*/**"
  diff_keywords:
    - "translate\.googleapis"
    - "deepl"
    - "translator\.azure"
  packages_imported:
    - "@google-cloud/translate"
    - "deepl-node"
  env_vars_referenced:
    - "DEEPL_*"
    - "GOOGLE_TRANSLATE_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["manage-finops"]

waiver_format: |
  PR body line: "concern-waived: paid-translation-api — <reason>"

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
  - i18n-coverage
---

# paid-translation-api

Per-character billing. Cache translations by source-hash + target-locale.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
