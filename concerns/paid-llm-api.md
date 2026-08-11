---
name: paid-llm-api
domain: integration
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/llm/**"
    - "**/agents/**"
    - "**/functions/*ai*/**"
    - "**/functions/*llm*/**"
    - "**/functions/*chat*/**"
    - "**/functions/*completion*/**"
  diff_keywords:
    - "api\.openai"
    - "api\.anthropic"
    - "gpt-[34]"
    - "claude-[34]"
    - "gemini-pro"
    - "X-Goog-Api-Key"
    - "OpenAI\("
    - "Anthropic\("
  packages_imported:
    - "openai"
    - "@anthropic-ai/sdk"
    - "@google/generative-ai"
    - "cohere-ai"
    - "replicate"
  env_vars_referenced:
    - "OPENAI_*"
    - "ANTHROPIC_*"
    - "GEMINI_*"
    - "GOOGLE_GENERATIVE_AI_*"
    - "REPLICATE_*"

handled_by:
  required_rules: ["paid-api-integration-checklist"]
  required_skills: []
  optional_skills: ["manage-finops","design-tech"]

waiver_format: |
  PR body line: "concern-waived: paid-llm-api — <reason>"

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
  - cache-strategy-symmetry
  - kill-switch-presence
---

# paid-llm-api

LLM APIs bill per-token; a runaway loop or untrimmed context can cost hundreds in minutes. Same lens as paid-external-api but tuned for token-economics: prompt caching, max_tokens caps, streaming-vs-buffered, content moderation costs, response truncation strategy.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
