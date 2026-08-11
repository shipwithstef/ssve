---
name: security-cross-family-review
domain: security
severity: HIGH
status: active
created: 2026-07-10
last_reviewed: 2026-07-10

signals:
  file_path_patterns:
    # auth / session / tokens
    - "**/auth/**"
    - "**/AuthContext*"
    - "**/AuthProvider*"
    - "**/middleware/auth*"
    - "**/login*"
    - "**/signup*"
    - "**/oauth*"
    - "**/session*"
    - "**/jwt*"
    - "**/*csrf*"
    - "**/*csrf*/**"
    - "**/*token*"
    - "**/*token*/**"
    # cryptography / signing
    - "**/*crypto*"
    - "**/*crypto*/**"
    - "**/*hmac*"
    - "**/*hmac*/**"
    - "**/*signature*"
    - "**/*signState*"
    - "**/*verifyState*"
    # access control / row-level security
    - "**/rls/**"
    - "**/policies/**"
    - "**/*.policy.sql"
    - "**/migrations/**"
    # transport / browser security
    - "**/*cors*"
    - "**/*csp*"
    - "**/webhook*"
    # secrets
    - "**/secrets/**"
    - "**/*.secret.*"
  diff_keywords:
    - "crypto\\.subtle"
    - "createHmac"
    - "HMAC"
    - "timingSafeEqual"
    - "verify(.*)signature"
    - "verify(.*)token"
    - "b64url"
    - "base64url"
    - "JWT"
    - "Bearer "
    - "service_role"
    - "USING\\s*\\("            # postgres RLS predicate
    - "WITH CHECK"
    - "auth\\.getUser"
    - "auth\\.uid\\(\\)"
    - "webhook.*secret"
    - "X-.*-Secret"
  env_vars_referenced:
    - "*_SECRET"
    - "*_HMAC_*"
    - "*_SERVICE_ROLE_*"
    - "*_WEBHOOK_SECRET"
    - "JWT_*"
    - "AUTH_*"
    - "SESSION_*"

handled_by:
  # SOLE required skill on purpose. `required_skills` is OR-semantics, so this
  # concern deliberately lists ONLY the cross-family reviewer — that is what makes
  # cross-family review a STANDING gate rather than an option a same-family pass
  # can satisfy. The per-topic security concerns (auth-surface, cryptography-touch,
  # cors-policy, …) keep requiring/optionally-running `review-security`; this
  # concern fires ALONGSIDE them, so a security diff engages BOTH a same-family
  # pass (where its topic concern requires it) AND an independent cross-family pass.
  required_skills: [review-cross-model]
  optional_skills: [review-security]

waiver_format: |
  PR body line: "concern-waived: security-cross-family-review — <owner decision>"
  Missing CLI capability is not a routine waiver: the canonical launcher emits
  one actionable hard-failure receipt and the required gate halts. Any exception
  needs explicit repository-owner authority and must cite that receipt. "Looked
  fine to me" and same-family review never satisfy the concern.

fires_on:
  - first-introduction
  - bugfix-touching-call-shape
  - new-flow
  - refactor
  - dependency-update

fires_off:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/e2e/**"
  - "**/__tests__/**"
  - "**/docs/**"

related_concerns:
  - auth-surface
  - cryptography-touch
  - cors-policy
  - csp-policy
  - api-key-management
  - ssrf-prevention
  - replay-protection
  - data-deletion-cascade
---

# What this concern is

A change is touching a **security surface** — authentication, session/token
handling, cryptography or signing, row-level-security / access policies, CORS/CSP,
webhook-signature verification, or secrets. This concern requires an **independent
cross-family review** (`review-cross-model`, e.g. Codex) *in addition to* whatever
same-family review (`review-security`) the topic concern already asks for.

It is the routing primitive that makes "a second, genuinely-different model must
look at security-sensitive code" a standing gate instead of an optional nicety.

# How an agent should think about it

1. **Different family, not just a second pass.** The reviewer must be a different
   model family from the author (Claude author → Codex/Gemini reviewer). A second
   Claude pass shares the same training blind spots and does not satisfy this concern.
2. **Send the diff, goals, and spec** per `review-cross-model`; evaluate each
   finding (accept-with-justification / reject-with-code-evidence); converge until
   residual ≤ MEDIUM.
3. **Same-family review still runs** where its topic concern requires it — this is
   additive. Both engage; the disagreement between them is the signal.
4. **Capability-waiver, not judgment-waiver.** The only clean waiver is "no
   second-model CLI in this environment." Never waive because the change "looks fine."

# Why it exists

Originated 2026-07-09 (Example Marketplace `csrf-protection`). The stateless HMAC CSRF token
was reviewed by a same-family model (Fable) and by the author's own self-review;
both signed off "SAFE." A later **cross-family** review by Codex (`gpt-5.6-sol`)
caught a real finding neither saw: **non-canonical base64url signatures passed
verification** — appending `=` or flipping unused padding bits produced a different
token string that decoded to the same 32 HMAC bytes and verified true (signature
malleability). Low severity in that instance, but it proved the structural gap:
security concerns routed `review-cross-model` only as `optional`, and
`cryptography-touch` required no review skill at all, so nothing ever forced a
cross-family look at security-sensitive code. Same-model review has a blind spot by
construction; this concern closes it.

The cost asymmetry mirrors `auth-surface`: one cross-model review pass vs. a
shipped auth/crypto defect. HIGH (require ack/waiver) rather than CRITICAL so that
capability-limited CI can waive cleanly; a project handling regulated data can
override to CRITICAL in `<project>/.svc/concerns/security-cross-family-review.md`.

# Examples

**Matches:**
- Editing `supabase/functions/csrf-protection/index.ts` (HMAC signing/verify)
- Changing JWT/session verification or a `Bearer` auth path
- A migration that adds/edits an RLS `USING(...)` / `WITH CHECK` policy
- Editing CORS allow-lists or a CSP header
- Adding/altering webhook-signature verification
- Introducing a new `*_SECRET` / `*_HMAC_*` env dependency

**Does NOT match:**
- A CSS-only change on a login form
- A unit/e2e test for an auth flow (still valuable; doesn't trigger the gate)
- Security documentation
