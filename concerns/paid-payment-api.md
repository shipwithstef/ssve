---
name: paid-payment-api
domain: integration
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/payments/**"
    - "**/services/billing/**"
    - "**/functions/*checkout*/**"
    - "**/functions/*subscription*/**"
    - "**/functions/*invoice*/**"
    - "**/functions/dodo*/**"
    - "**/functions/stripe*/**"
  diff_keywords:
    - "stripe\.com"
    - "paddle\.com"
    - "dodopayments"
    - "createCheckoutSession"
    - "paymentIntent"
    - "subscription\."
    - "webhook"
  packages_imported:
    - "stripe"
    - "@stripe/*"
    - "dodopayments"
    - "@paddle/*"
    - "lemonsqueezy"
  env_vars_referenced:
    - "STRIPE_*"
    - "PADDLE_*"
    - "DODO_*"
    - "LEMONSQUEEZY_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security","manage-finops"]

waiver_format: |
  PR body line: "concern-waived: paid-payment-api — <reason>"

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
  - webhook-signature-verification
  - pii-handling
---

# paid-payment-api

Payment changes touch real money + customer trust. Idempotency keys, webhook signature verification, refund-state-machine integrity, retry-storm avoidance.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
