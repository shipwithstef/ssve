---
name: xss-prevention
domain: security
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/components/**/*.{jsx,tsx,vue,svelte}"
  diff_keywords:
    - "dangerouslySetInnerHTML"
    - "innerHTML"
    - "eval\("
    - "Function\("
    - "document\.write"
  packages_imported:
    - "dompurify"
    - "sanitize-html"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: xss-prevention — <reason>"

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
  - auth-surface
  - csp-policy
---

# xss-prevention

Sanitize before innerHTML; avoid eval; CSP as defense in depth.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
