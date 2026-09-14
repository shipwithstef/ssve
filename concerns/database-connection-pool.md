---
name: database-connection-pool
domain: infra
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/db/pool*"
    - "**/db.config*"
  diff_keywords:
    - "poolSize"
    - "maxConnections"
    - "createPool"
  packages_imported:
    - "pg-pool"
    - "mysql2"
    - "better-sqlite3"
  env_vars_referenced:
    - "DATABASE_*"
    - "DB_POOL_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: database-connection-pool — <reason>"

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

# database-connection-pool

Wrong pool size = exhaustion or wasted memory. Match to concurrency budget.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
