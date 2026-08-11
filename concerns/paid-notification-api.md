---
name: paid-notification-api
domain: integration
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/email/**"
    - "**/services/sms/**"
    - "**/services/push/**"
    - "**/functions/*sendEmail*/**"
    - "**/functions/*sendSms*/**"
    - "**/functions/*notify*/**"
  diff_keywords:
    - "sendgrid"
    - "twilio"
    - "postmark"
    - "resend\.com"
    - "mailgun"
    - "one_signal"
  packages_imported:
    - "@sendgrid/mail"
    - "twilio"
    - "postmark"
    - "resend"
    - "mailgun"
  env_vars_referenced:
    - "SENDGRID_*"
    - "TWILIO_*"
    - "POSTMARK_*"
    - "RESEND_*"
    - "MAILGUN_*"

handled_by:
  required_rules: ["paid-api-integration-checklist"]
  required_skills: []
  optional_skills: ["manage-finops","review-security"]

waiver_format: |
  PR body line: "concern-waived: paid-notification-api — <reason>"

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
  - pii-handling
  - rate-limiting
---

# paid-notification-api

Per-message billing + reputational risk if domain gets blacklisted. Throttling, sender-domain auth (SPF/DKIM/DMARC), bounce handling.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
