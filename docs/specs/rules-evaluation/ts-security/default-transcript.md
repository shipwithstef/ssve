# Default Transcript — typescript/security.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. Writing code that needs an API key or secret
2. Handling configuration values in a TypeScript app

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — API key needed:**
I NEVER write hardcoded secrets in code. My default is always to use
`process.env.VARIABLE_NAME`. I add startup validation to fail fast if
a required env var is missing. This is non-negotiable in my defaults.

**Scenario 2 — configuration handling:**
I use environment variables. I validate presence at startup with a clear error
message. I would never suggest `const apiKey = "EXAMPLE_API_KEY"` in any real code.
This is deeply ingrained default behavior, not something I need a rule for.
