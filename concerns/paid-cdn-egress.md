---
name: paid-cdn-egress
domain: integration
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/cdn/**"
    - "**/services/cdn/**"
  diff_keywords:
    - "cloudfront\.net"
    - "fastly\.com"
    - "bunnycdn"
    - "cloudflare\.com/r2"
  packages_imported:
    []
  env_vars_referenced:
    - "CDN_*"
    - "FASTLY_*"
    - "BUNNY_*"

handled_by:
  required_rules: ["paid-api-integration-checklist"]
  required_skills: []
  optional_skills: ["manage-finops"]

waiver_format: |
  PR body line: "concern-waived: paid-cdn-egress — <reason>"

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
---

# paid-cdn-egress

Egress traffic is the silent killer; cache-control headers + asset versioning + edge-vs-origin tradeoff move the bill.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
