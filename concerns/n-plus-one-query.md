---
name: n-plus-one-query
domain: performance
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/**"
    - "**/api/**"
  diff_keywords:
    - "for\s*\(.*\)\s*\{[\s\S]*await.*\.findOne"
    - "forEach.*await.*\.findOne"
    - "\.map\(.*async.*\.findOne"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: n-plus-one-query — <reason>"

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
  - unbounded-query
---

# n-plus-one-query

await-in-loop on a relational lookup. Use eager loading or batch loader.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
