---
name: dependency-audit
domain: security
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/package.json"
    - "**/package-lock.json"
    - "**/yarn.lock"
    - "**/pnpm-lock.yaml"
    - "**/go.mod"
    - "**/Pipfile.lock"
    - "**/Cargo.lock"
  diff_keywords:
    []
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: dependency-audit — <reason>"

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
  - supply-chain-security
---

# dependency-audit

New dep = new attack surface. CVE check + maintainer reputation + bus factor.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
