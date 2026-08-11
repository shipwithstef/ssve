---
name: paid-streaming-api
domain: integration
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/video/**"
    - "**/services/streaming/**"
    - "**/functions/*stream*/**"
  diff_keywords:
    - "mux\.com"
    - "cloudflare\.com/stream"
    - "livekit"
    - "agora\.io"
  packages_imported:
    - "@mux/mux-node"
    - "livekit-server-sdk"
    - "agora-access-token"
  env_vars_referenced:
    - "MUX_*"
    - "LIVEKIT_*"
    - "AGORA_*"

handled_by:
  required_rules: ["paid-api-integration-checklist"]
  required_skills: []
  optional_skills: ["manage-finops"]

waiver_format: |
  PR body line: "concern-waived: paid-streaming-api — <reason>"

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

# paid-streaming-api

Per-minute streaming bills compound; idle session cleanup and resolution-tier choice matter.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
