---
name: dns-or-tls-change
domain: infra
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/dns/**"
    - "**/cloudflare/**"
    - "**/cert*"
  diff_keywords:
    - "CNAME"
    - "A record"
    - "TXT"
    - "DKIM"
    - "TLS"
    - "cert-manager"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: []

waiver_format: |
  PR body line: "concern-waived: dns-or-tls-change — <reason>"

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
  - build-ship-alignment
---

# dns-or-tls-change

TTL gotchas, cert renewal, cross-region propagation.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
