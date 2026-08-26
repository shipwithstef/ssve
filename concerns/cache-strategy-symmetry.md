---
name: cache-strategy-symmetry
domain: data
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/cache/**"
    - "**/services/cache/**"
  diff_keywords:
    - "fetchDbCandidates"
    - "cache\.get"
    - "cache\.set"
    - "redis\.get"
    - "redis\.set"
    - "memcached"
  packages_imported:
    - "redis"
    - "ioredis"
    - "memcached"
    - "lru-cache"
  env_vars_referenced:
    - "REDIS_*"
    - "CACHE_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: cache-strategy-symmetry — <reason>"

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
  - cache-invalidation
  - cache-eviction
---

# cache-strategy-symmetry

Read-side cache without write-side population is dead weight. Originated Example Marketplace placesNearbyLookup 2026-05-07.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
