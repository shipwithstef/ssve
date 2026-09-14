---
name: logging-policy
domain: observability
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/logger*"
    - "**/logging/**"
  diff_keywords:
    - "console\.log\("
    - "logger\."
    - "pino\."
    - "winston\."
  packages_imported:
    - "pino"
    - "winston"
    - "bunyan"
    - "consola"
  env_vars_referenced:
    - "LOG_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: logging-policy — <reason>"

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
  - pii-handling
---

# logging-policy

Strip PII. Structured logs. Levels meaningful. Don't log secrets.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
