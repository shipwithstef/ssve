---
name: social-login
domain: auth
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/auth/social/**"
    - "**/auth/google*"
    - "**/auth/apple*"
    - "**/auth/facebook*"
  diff_keywords:
    - "signInWithProvider"
    - "signInWithGoogle"
    - "signInWithApple"
    - "idToken"
  packages_imported:
    - "@react-native-google-signin/*"
    - "expo-apple-authentication"
  env_vars_referenced:
    - "GOOGLE_CLIENT_*"
    - "APPLE_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: social-login — <reason>"

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
  - oauth-callback
---

# social-login

ID token verification, account-linking attacks, email-verification trust.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
