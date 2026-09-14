---
name: timezone-handling
domain: i18n
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/components/**"
    - "**/services/**"
  diff_keywords:
    - "new Date\("
    - "Date\.now"
    - "toLocaleString"
    - "tz:"
    - "DateTime\."
  packages_imported:
    - "date-fns-tz"
    - "luxon"
    - "dayjs"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: timezone-handling — <reason>"

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
  []
---

# timezone-handling

UTC at rest, local at render. Daylight-saving, leap seconds, fixed-offset users.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
