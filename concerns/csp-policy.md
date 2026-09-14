---
name: csp-policy
domain: security
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/csp*"
    - "**/headers.config*"
    - "**/next.config*"
  diff_keywords:
    - "Content-Security-Policy"
    - "unsafe-inline"
    - "unsafe-eval"
  packages_imported:
    - "helmet"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: csp-policy — <reason>"

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
  - xss-prevention
---

# csp-policy

CSP without unsafe-inline/eval where possible; nonces or hashes for inline.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
