---
name: secrets-management
domain: security
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/.env.example"
    - "**/secrets/**"
  diff_keywords:
    - "process\.env\.[A-Z_]*KEY"
    - "process\.env\.[A-Z_]*SECRET"
    - "process\.env\.[A-Z_]*TOKEN"
    - "apiKey:\s*['\"]"
    - "secret:\s*['\"]"
  packages_imported:
    - "dotenv"
  env_vars_referenced:
    - "*_SECRET"
    - "*_KEY"
    - "*_TOKEN"
    - "*_PASSWORD"

handled_by:
  required_rules: ["destructive-git-ops"]
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: secrets-management — <reason>"

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
---

# secrets-management

Never commit secrets; ensure .env is gitignored; rotate on suspected exposure.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
