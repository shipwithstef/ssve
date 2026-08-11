---
name: database-migration
domain: data
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/migrations/**"
    - "**/db/migrate/**"
    - "**/prisma/migrations/**"
    - "**/drizzle/migrations/**"
    - "**/supabase/migrations/**"
  diff_keywords:
    - "CREATE TABLE"
    - "ALTER TABLE"
    - "DROP TABLE"
    - "CREATE INDEX"
    - "DROP INDEX"
    - "CONSTRAINT"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech","review-cross-model"]

waiver_format: |
  PR body line: "concern-waived: database-migration — <reason>"

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
  - data-deletion-cascade
---

# database-migration

Migrations are nearly irreversible at scale. Backfill plan, lock-time, rollback, online-vs-offline.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
