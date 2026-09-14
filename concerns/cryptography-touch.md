---
name: cryptography-touch
domain: security
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-07-10

signals:
  file_path_patterns:
    - "**/crypto/**"
    - "**/*hmac*"
    - "**/*hmac*/**"
    - "**/*signature*"
    - "**/*csrf*"
    - "**/*csrf*/**"
  diff_keywords:
    - "crypto\.createCipher"
    - "crypto\.createDecipher"
    - "AES-128-ECB"
    - "MD5"
    - "SHA-1\b"
    - "crypto\.randomBytes"
    - "crypto\.subtle"
    - "createHmac"
    - "HMAC"
    - "subtle\.(sign|verify)"
  packages_imported:
    - "crypto"
    - "bcrypt"
    - "argon2"
    - "scrypt"
    - "libsodium"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: ["review-security"]
  optional_skills: ["review-cross-model"]

waiver_format: |
  PR body line: "concern-waived: cryptography-touch — <reason>"

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
  - secrets-management
---

# cryptography-touch

Don't roll your own crypto. Avoid ECB/MD5/SHA1. Use vetted high-level libraries.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
