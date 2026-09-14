---
name: github-api-touch
domain: integration
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/scripts/**/github*"
    - "**/services/github/**"
    - "**/functions/*github*/**"
  diff_keywords:
    - "api\.github\.com"
    - "octokit"
    - "@octokit"
  packages_imported:
    - "@octokit/*"
    - "octokit"
  env_vars_referenced:
    - "GITHUB_*"
    - "GH_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: github-api-touch — <reason>"

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
---

# github-api-touch

Free but rate-limited (5k/hr authenticated, 60/hr unauthed). ETag/If-Modified-Since to extend the budget.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
