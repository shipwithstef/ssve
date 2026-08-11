---
name: unbounded-query
domain: performance
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/**"
  diff_keywords:
    - "\.findMany\(\s*\)"
    - "\.find\(\s*\{\s*\}\s*\)"
    - "\.list\(\s*\)"
    - "SELECT \* FROM"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: unbounded-query — <reason>"

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
  - n-plus-one-query
---

# unbounded-query

Always paginate or limit. Listing without bounds breaks under data growth.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
