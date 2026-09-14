---
name: supply-chain-security
domain: security
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/package.json"
    - "**/Dockerfile"
    - "**/.github/workflows/**"
  diff_keywords:
    - "curl.*\|.*sh"
    - "wget.*\|.*sh"
    - "unverified"
    - "integrity:"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: supply-chain-security — <reason>"

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
  - dependency-audit
---

# supply-chain-security

Pinned versions, integrity hashes, signed CI artifacts.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
