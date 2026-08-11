---
name: provider-fidelity
domain: integration
severity: HIGH
status: active
created: 2026-05-12
last_reviewed: 2026-05-12

signals:
  file_path_patterns:
    - "docs/specs/features/**"
    - "docs/specs/features/test-evidence/**"
    - "**/provider/**"
    - "**/generation/**"
    - "**/ai/**"
  diff_keywords:
    - "primary provider"
    - "provider_fidelity"
    - "PROVIDER_FIDELITY_EVIDENCE"
    - "fallback"
    - "generated image"
    - "AI generation"
    - "saved outcome"
    - "source evidence"
  packages_imported:
    - "openai"
    - "@fal-ai/*"
    - "replicate"
    - "@google/genai"
  env_vars_referenced:
    - "*_API_KEY"
    - "*_TOKEN"

handled_by:
  required_rules: []
  required_skills: ["write-spec", "review-gate", "verify-promotion"]
  optional_skills: ["validate-feature", "test-journeys", "track-visuals"]

waiver_format: |
  PR body line: "concern-waived: provider-fidelity - <reason>"

fires_on:
  - first-introduction
  - bugfix-touching-call-shape
  - new-caller
  - refactor

fires_off:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
  - "**/docs/specs/work-items/**"
  - "**/docs/specs/features/test-evidence/*.template.md"

related_concerns:
  - paid-llm-api
  - external-api-contract
---

# provider-fidelity

Provider-backed and generated-output work must prove that the requested provider or explicitly approved degraded fallback produced the saved outcome.

# How to think about it

1. Detect whether the user, spec, or code names a primary provider, generation path, or saved generated output.
2. Require `provider_fidelity` in the delivery graph and provider/source/saved-outcome evidence in the closeout.
3. Treat fallback or uploaded substitute evidence as invalid unless the user explicitly approved the degradation.

# Why it exists

This concern captures the WI-306 provider-fidelity failure class: generated content can exist while coming from the wrong source or an unapproved fallback.

# Examples

Matches: AI image/text generation, provider migrations, integration-backed saved outputs, fallback-policy edits.

Does not match: static content edits or provider-neutral UI polish with no generated or integration-backed output.
