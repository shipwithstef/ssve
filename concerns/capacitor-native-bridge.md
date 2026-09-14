---
name: capacitor-native-bridge
domain: ux
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/capacitor.config*"
    - "**/android/**"
    - "**/ios/**"
    - "**/capacitorInit*"
  diff_keywords:
    - "Capacitor\."
    - "@capacitor/"
    - "Plugins\."
  packages_imported:
    - "@capacitor/*"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: capacitor-native-bridge — <reason>"

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
  - ios-android-parity
  - build-ship-alignment
---

# capacitor-native-bridge

Native bridge edits often need new APK/AAB build to ship to users.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
