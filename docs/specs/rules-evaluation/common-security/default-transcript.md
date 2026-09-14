# Default Transcript — common/security.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. Any code that touches secrets, auth, user input, or external APIs
2. Before committing code with security-sensitive changes

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — secrets/auth/input:**
I never hardcode secrets. I use env vars. I validate all user input. I use
parameterized queries (never string concatenation for SQL). I sanitize HTML
output (XSS prevention). I check for CSRF protection. These are non-negotiable
defaults I apply without any rule.

**Scenario 2 — pre-commit security:**
I mentally review for common vulnerabilities. I don't run through a formal
checkbox checklist with a specific list of items. I rely on pattern recognition
and code review, not a formalized protocol.

**Scenario 3 — security issue found:**
If I find a security issue, I flag it prominently and recommend fixing it before
continuing. I don't have a formal "STOP → use security-reviewer agent → rotate
secrets → review entire codebase" protocol — I handle it contextually.
