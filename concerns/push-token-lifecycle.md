---
name: push-token-lifecycle
domain: ux
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/push*"
    - "**/notifications/**"
  diff_keywords:
    - "fcm"
    - "apns"
    - "pushToken"
    - "deviceToken"
    - "registerForPushNotifications"
  packages_imported:
    - "@capacitor/push-notifications"
    - "firebase-admin"
  env_vars_referenced:
    - "FCM_*"
    - "APN_*"
    - "FIREBASE_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: push-token-lifecycle — <reason>"

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

# push-token-lifecycle

Token rotation, multi-device, opt-in/out, dead-token cleanup.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
