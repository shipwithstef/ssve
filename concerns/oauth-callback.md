---
name: oauth-callback
domain: auth
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/oauth/**"
    - "**/functions/*oauth*/**"
    - "**/auth/callback*"
  diff_keywords:
    - "state\b"
    - "code_verifier"
    - "redirect_uri"
    - "authorization_code"
  packages_imported:
    - "simple-oauth2"
    - "openid-client"
  env_vars_referenced:
    - "OAUTH_*"

handled_by:
  required_rules: ["post-fix-evidence-before-next-fix"]
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: oauth-callback — <reason>"

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

# oauth-callback

CSRF-protect via state, PKCE, callback URI allowlist exact-match.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
