---
name: open-redirect
domain: security
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    []
  diff_keywords:
    - "window\.location\s*=\s*[a-zA-Z_]*\.url"
    - "redirect\(\s*req\."
    - "res\.redirect\(\s*req\."
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: open-redirect — <reason>"

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

# open-redirect

User-controlled redirect targets enable phishing. Allowlist destinations.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
