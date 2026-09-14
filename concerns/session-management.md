---
name: session-management
domain: auth
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/session*"
    - "**/middleware/session*"
  diff_keywords:
    - "session\.user"
    - "createSession"
    - "destroySession"
    - "cookie\.set"
  packages_imported:
    - "iron-session"
    - "next-session"
    - "express-session"
  env_vars_referenced:
    - "SESSION_*"

handled_by:
  required_rules: ["post-fix-evidence-before-next-fix"]
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: session-management — <reason>"

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

# session-management

Session fixation, idle timeout, concurrent-session limits, secure-cookie attributes.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
