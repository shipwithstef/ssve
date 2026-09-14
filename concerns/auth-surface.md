---
name: auth-surface
domain: auth
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/auth/**"
    - "**/AuthContext*"
    - "**/AuthProvider*"
    - "**/middleware/auth*"
    - "**/login*"
    - "**/signup*"
    - "**/oauth*"
    - "**/passport*"
    - "**/session*"
    - "**/jwt*"
    - "**/functions/**/auth*"
    - "**/functions/**/login*"
    - "**/functions/**/session*"
  diff_keywords:
    - "OAuth"
    - "JWT"
    - "verify(.*)token"
    - "session\\.user"
    - "bcrypt"
    - "argon2"
    - "scrypt"
    - "refreshToken"
    - "accessToken"
    - "logout"
    - "loginViaEmailPassword"
    - "loginViaProvider"
    - "auth\\.me\\("
  packages_imported:
    - "bcrypt"
    - "bcryptjs"
    - "argon2"
    - "jsonwebtoken"
    - "passport"
    - "passport-*"
    - "@auth/*"
    - "next-auth"
    - "lucia"
    - "iron-session"
  env_vars_referenced:
    - "JWT_*"
    - "AUTH_*"
    - "SESSION_*"
    - "NEXTAUTH_*"
    - "OAUTH_*"

handled_by:
  required_rules: [post-fix-evidence-before-next-fix]
  required_skills: [review-security]
  optional_skills: [design-tech, review-cross-model]

waiver_format: |
  PR body line: "concern-waived: auth-surface — <reason>"
  Acceptable reasons are narrow: copy-only change in error messages, accessibility
  attribute on auth form elements. Most edits to auth files do NOT qualify.

fires_on:
  - first-introduction
  - bugfix-touching-call-shape
  - new-flow
  - refactor
  - dependency-update

fires_off:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/docs/**"

related_concerns:
  - session-management
  - token-rotation
  - oauth-callback
  - permission-elevation
  - rate-limiting
---

# What this concern is

A change is touching authentication or session handling. Auth bugs are a top-3 cause of catastrophic incidents (account takeover, data leak, billing fraud). Decisions here must be defensive by default and reviewed against OWASP / STRIDE patterns.

# How an agent should think about it

1. **STRIDE pass** — Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege. `review-security` runs the full pass.
2. **Token lifecycle** — issuance, refresh, revocation, storage on client (httpOnly cookie? localStorage? SecureStorage on native?), expiry. Are tokens scoped tightly enough?
3. **Replay protection** — nonces, JTIs, idempotency keys for sensitive endpoints.
4. **Failure handling** — auth-failed should never fall through to unauthenticated success. No silent demotion of a failed verification.
5. **Side-channel leaks** — timing differences between "user not found" and "wrong password," verbose error messages exposing user existence.
6. **Fix-loop discipline** — auth failures often produce N>2 PR loops because the symptom looks the same after each partial fix. The `post-fix-evidence-before-next-fix` rule applies hard here.

# Why it exists

The cost asymmetry is extreme: a 30-second `review-security` pass vs. a multi-hour incident + customer notification + (potentially) regulatory disclosure. Wiring this concern means agents cannot edit `AuthContext.jsx` without `review-security` engaging, which is the appropriate friction.

Real precedent: Example Marketplace WI-166b regression where a public-routes gate suppressed `/me` before checking for OAuth callback tokens, breaking web Gmail login. Surfaced in production. Caught only when a user reported the bug.

# Examples

**Matches:**
- Editing `src/lib/AuthContext.jsx`
- Adding `next-auth` to package.json
- Modifying `base44/functions/auth/entry.ts`
- Changing JWT verification logic
- Touching session storage on client

**Does NOT match:**
- A login form's CSS-only change
- A unit test for auth (still useful but doesn't trigger the security review)
- Auth documentation
