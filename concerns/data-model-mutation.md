---
name: data-model-mutation
domain: data
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/entities/*.json"
    - "**/entities/*.ts"
    - "**/migrations/**"
    - "**/schema/**"
    - "**/models/**"
    - "**/prisma/schema.prisma"
    - "**/drizzle/**"
    - "**/sequelize/migrations/**"
    - "**/*.sql"
  diff_keywords:
    - "CREATE TABLE"
    - "ALTER TABLE"
    - "DROP TABLE"
    - "ADD COLUMN"
    - "DROP COLUMN"
    - "RENAME COLUMN"
    - "addColumn"
    - "dropColumn"
    - "renameColumn"
    - "createTable"
    - "dropTable"
    - "z\\.object\\("
  packages_imported:
    - "drizzle-orm"
    - "@prisma/client"
    - "sequelize"
    - "typeorm"
    - "mongoose"
  env_vars_referenced: []

handled_by:
  required_rules: []
  required_skills: [design-tech]
  optional_skills: [explore-solutions, review-security, review-cross-model]

waiver_format: |
  PR body line: "concern-waived: data-model-mutation — <reason>"
  Acceptable: typo fix in a column comment, formatting-only diff in a schema file.

fires_on:
  - first-introduction
  - schema-change
  - new-entity
  - field-add
  - field-rename
  - field-drop

fires_off:
  - "**/test-fixtures/**"
  - "**/seed-data/**"
  - "**/*.test.*"
  - "**/docs/**"

related_concerns:
  - pii-handling
  - migration-safety
  - data-deletion-cascade
  - cache-strategy-symmetry
---

# What this concern is

A change is altering the data model — a new entity, a new field, a rename, a drop, a type change. Decisions made here are HARD to reverse once data exists at scale, so getting the shape right and the migration safe matters more than at the code layer.

# How an agent should think about it

1. **Backwards compatibility** — does the migration take old data with it, or is there a backfill? If a backfill is needed, who runs it and when?
2. **Read paths** — does any existing code read a field that is being removed/renamed? Grep before merging. Multi-stage rename is safer than atomic.
3. **Cascade implications** — if an entity is being deleted/dropped, what other entities reference it? Are foreign-key cascades covered?
4. **Index strategy** — new query paths need indices; new fields used in WHERE/ORDER BY need indices. Forgotten indices are silent N+1 generators.
5. **PII shape** — does the new field hold PII? If yes, this concern composes with `pii-handling`.
6. **Cache invalidation** — any caches keyed on the changed entity need invalidation strategy. Composes with `cache-strategy-symmetry`.

# Why it exists

Schema changes are among the most expensive mistakes in any system. Catching shape issues at design-time costs minutes; catching them after data exists in production costs anywhere from a backfill job to a forensic recovery. `design-tech` (and optionally `explore-solutions` when the model has multiple reasonable shapes) is the right thinker; this concern just makes sure it actually engages.

# Examples

**Matches:**
- Editing `entities/Location.json` to add a field
- Adding a Prisma migration in `prisma/migrations/<ts>_add_loyalty_tier/`
- Adding a `z.object({...})` schema in a file that defines a persisted entity

**Does NOT match:**
- A Zod schema for a UI form-validation that doesn't persist
- A test fixture seeding data
- A doc describing the schema (no code change)
