### 1) `smoke`

Run only critical paths for selected journeys:
- Auth/session entry
- Primary user action
- Success state visibility
- Critical failure guardrail

Use for fast confidence after deploy or risky merges.

### 2) `regression`

Run full journey scenarios and all mapped ACs for selected scope.

Use for release readiness or wide-impact changes.

### 3) `feature-ac`

Run AC-focused QA for one feature spec while still executing through journey flow
contexts (not isolated clicks).

Use when a team asks for "verify feature X against spec".

### 4) `exploratory`

Run unscripted, risk-guided QA around journey transitions and edge states.
Record discovered gaps and route them to the right skill.

**Exploratory testing patterns** (run through each in the browser):

| Pattern | What to try | Looking for |
|---------|------------|-------------|
| **Boundary values** | Min/max lengths, zero, negative, huge numbers | Crashes, truncation, overflow |
| **Empty states** | Fresh account, no data, cleared filters | Missing empty state UI, errors |
| **Rapid actions** | Double-click submit, rapid navigation, back/forward | Duplicate submissions, race conditions |
| **Invalid input** | SQL injection, XSS payloads, Unicode, emoji, RTL text | Security holes, encoding bugs |
| **Interruption** | Refresh mid-form, close tab mid-upload, network offline | Lost data, stuck states |
| **Permission edges** | Access URLs directly without auth, tamper with IDs in URL | Auth bypass, IDOR |
| **Responsive** | Resize to mobile/tablet/desktop breakpoints | Broken layout, unreachable elements |
| **Accessibility** | Tab through all interactive elements, screen reader flow | Missing focus indicators, broken tab order |
| **State persistence** | Refresh page, navigate away and back, close and reopen | Lost form data, reset state |
| **Concurrency** | Open same page in two tabs, edit same resource | Conflicts, stale data |

For each discovered issue, record:
- What you tried (exact steps)
- What happened (screenshot)
- What should have happened (from spec/journey/common sense)
- Severity: Critical / High / Medium / Low

### Base44 E2E Account OTPs

For Base44 journeys that create or prepare generated E2E auth accounts, load
`rules/base44/e2e-otp-connector.md` before declaring the account gate blocked or
adding mailbox automation. The preferred path is an installed mailbox connector
for the forwarded test-domain inbox, followed by `base44.auth.verifyOtp(...)`
and an immediate password-login preflight.

Do not add one-off Gmail OAuth refresh-token scripts while a connector can read
the OTP mailbox. OTP values must stay in process memory and must not appear in
evidence artifacts or final reports.

---
