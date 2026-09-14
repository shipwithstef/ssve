---
name: subscription-state-machine
domain: business
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/subscriptions/**"
  diff_keywords:
    - "subscription\.status"
    - "cancelSubscription"
    - "reactivate"
    - "gracePeriod"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: subscription-state-machine — <reason>"

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
  - billing-side-effect
---

# subscription-state-machine

States: trialing, active, past_due, canceled, expired. Transitions must be explicit.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
