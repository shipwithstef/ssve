---
name: deep-link-handling
domain: ux
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/deeplinks/**"
    - "**/AndroidManifest.xml"
    - "**/Info.plist"
  diff_keywords:
    - "intent-filter"
    - "CFBundleURLSchemes"
    - "universalLink"
    - "deepLink"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: deep-link-handling — <reason>"

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
  - oauth-callback
  - capacitor-native-bridge
---

# deep-link-handling

OAuth callbacks, share-receivers, marketing links. Validation + auth gating.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
