---
name: paid-search-api
domain: integration
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/search/**"
    - "**/functions/*search*/**"
  diff_keywords:
    - "algolia"
    - "meilisearch"
    - "typesense"
    - "elastic\.cloud"
  packages_imported:
    - "algoliasearch"
    - "meilisearch"
    - "typesense"
  env_vars_referenced:
    - "ALGOLIA_*"
    - "MEILI_*"
    - "TYPESENSE_*"

handled_by:
  required_rules: ["paid-api-integration-checklist"]
  required_skills: []
  optional_skills: ["manage-finops"]

waiver_format: |
  PR body line: "concern-waived: paid-search-api — <reason>"

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

# paid-search-api

Tiered pricing on records + queries. Index size and query rate move the bill.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
