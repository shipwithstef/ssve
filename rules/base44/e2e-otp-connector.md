# Base44 E2E OTP Connector Strategy

When a Base44 project creates generated E2E auth accounts, assume
email/password registration may require email OTP verification before
`loginViaEmailPassword()` succeeds. Do not treat service-role `User` updates,
admin field mutation, SDK registration, or SSO probes as proof that the auth
account is login-ready.

## Preferred Path

For domains whose test email routes into an inbox accessible by an installed
mailbox connector, use the connector first.

1. Confirm the target address is an E2E-owned generated account.
2. Request or resend the Base44 OTP with the SDK.
3. Read the latest forwarded verification email through the installed connector.
4. Keep the OTP in process memory only.
5. Call `base44.auth.verifyOtp({ email, otpCode })`.
6. Immediately verify password login and run the journey preflight.

Do not write OTP values to evidence files, logs, screenshots, task graphs,
session contracts, or final user messages.

## Fallback Path

Custom Gmail API, IMAP, Cloudflare Email Routing Worker, or other mailbox
capture code is a fallback only when the connector is unavailable or
insufficient. If used, it must be committed as maintained harness code with:

- ignored secret storage,
- redacted output,
- an explicit owner/scope allowlist for generated E2E accounts,
- committed evidence that proves login readiness without exposing OTPs.

Do not add one-off OAuth refresh-token scripts when an installed connector can
read the same OTP mailbox.
