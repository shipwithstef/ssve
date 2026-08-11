---
name: social-media-api-touch
domain: integration
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/social/**"
  diff_keywords:
    - "api\.x\.com"
    - "api\.twitter"
    - "graph\.facebook"
    - "linkedin\.com/oauth"
    - "instagram\.com/api"
  packages_imported:
    - "twitter-api-v2"
    - "instagrapi"
    - "linkedin-api-client"
  env_vars_referenced:
    - "TWITTER_*"
    - "X_*"
    - "FB_*"
    - "LINKEDIN_*"
    - "INSTAGRAM_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: social-media-api-touch — <reason>"

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
  - auth-surface
---

# social-media-api-touch

Aggressive per-app rate limits, OAuth token rotation, platform policy reviews.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
