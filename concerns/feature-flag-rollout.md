---
name: feature-flag-rollout
domain: infra
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/feature-flags/**"
    - "**/flags/**"
    - "**/launchconfig*"
  diff_keywords:
    - "featureFlag"
    - "launchDarkly"
    - "unleash"
    - "flag\.enabled"
  packages_imported:
    - "launchdarkly-node-server-sdk"
    - "unleash-client"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: feature-flag-rollout — <reason>"

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
  - canary-deploy
  - dark-launch
---

# feature-flag-rollout

Default-off, ramp, kill-switch availability. Track who can toggle.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
