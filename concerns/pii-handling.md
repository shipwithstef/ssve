---
name: pii-handling
domain: privacy
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/entities/User*"
    - "**/entities/Customer*"
    - "**/entities/Profile*"
    - "**/entities/Employee*"
    - "**/services/email/**"
    - "**/services/sms/**"
    - "**/functions/**/sendEmail*"
    - "**/functions/**/sendSms*"
    - "**/gdpr/**"
    - "**/ccpa/**"
    - "**/privacy/**"
  diff_keywords:
    - "email"
    - "phone_number"
    - "phone\\b"
    - "address"
    - "first_name"
    - "last_name"
    - "full_name"
    - "date_of_birth"
    - "dob\\b"
    - "ssn"
    - "passport"
    - "national_id"
    - "ip_address"
    - "geolocation"
    - "location_history"
    - "user_agent"
    - "hashedPassword"
  packages_imported: []
  env_vars_referenced: []

handled_by:
  required_rules: []
  required_skills: [review-security]
  optional_skills: [design-tech]

waiver_format: |
  PR body line: "concern-waived: pii-handling — <reason>"
  Acceptable: a non-PII field happens to share a keyword (e.g. an internal
  "ip_address" of a server, not a user). State why the field is not PII in
  the waiver line.

fires_on:
  - first-introduction
  - new-pii-field
  - new-export-path
  - new-storage-target

fires_off:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/docs/**"
  - "**/test-fixtures/**"

related_concerns:
  - data-model-mutation
  - data-deletion-cascade
  - gdpr-deletion
  - logging-policy
  - consent-management
---

# What this concern is

A change touches data that identifies a person: email, phone, address, name, geolocation, government IDs, etc. PII handling carries legal obligations (GDPR, CCPA, HIPAA depending on jurisdiction and category) AND ethical ones (the user trusted you with this).

# How an agent should think about it

1. **Necessity** — is this PII actually needed for the feature? Minimization is the strongest defense.
2. **Consent** — is the user's collection consent already captured for this purpose, or does this change require new consent?
3. **Storage location** — encrypted at rest? In a region the user's jurisdiction permits? Backup retention bounded?
4. **Access** — who can read this field? Service role only? Owner-only? Customer-self-only? Default to most-restrictive.
5. **Logs and analytics** — does this PII end up in logs (loggers, error-reporting, analytics events)? Strip or hash before emission. Composes with `logging-policy`.
6. **Export/delete rights** — does the user-data-export include this field? Does the deletion flow erase it (including backups, caches, downstream copies)? Composes with `gdpr-deletion`.
7. **Cross-border transfer** — does this PII leave the user's region? If so, what's the legal basis (SCCs, adequacy decision, user consent)?

# Why it exists

PII mistakes are expensive — both in regulatory fines (GDPR up to 4% of annual revenue) and in trust loss after disclosure incidents. Catching a PII issue at design time is minutes; catching it after a leak is months of remediation. The cost asymmetry justifies HIGH severity even for "small" changes that introduce a new PII field.

# Examples

**Matches:**
- Adding a `phone_number` field to the `Customer` entity
- A new function that sends an email containing user details
- Adding `geolocation` storage to `Employee`
- A new logger that emits `req.body` (might include PII)

**Does NOT match:**
- Adding a `count` field to a metrics entity
- A pure UI component that displays user data already in scope (the storage decision was made elsewhere)
