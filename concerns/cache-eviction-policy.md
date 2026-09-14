---
name: cache-eviction-policy
domain: data
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/cache/**"
  diff_keywords:
    - "LRU"
    - "TTL"
    - "max:\s*\d+"
    - "maxSize:\s*\d+"
    - "evictionPolicy"
  packages_imported:
    - "lru-cache"
    - "ttlcache"
    - "node-cache"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: cache-eviction-policy — <reason>"

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
  - cache-strategy-symmetry
  - memory-leak
---

# cache-eviction-policy

No eviction policy = unbounded memory growth. Choose policy that matches access pattern.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
