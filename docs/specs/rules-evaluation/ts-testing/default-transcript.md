# Default Transcript — typescript/testing.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. Asked which E2E testing framework to use for a TypeScript/React project
2. Writing E2E tests for a web application

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — E2E framework choice:**
For TypeScript/JavaScript web projects, Playwright is my default recommendation.
It has better cross-browser support, better TypeScript integration, and is now the
community-preferred choice over Cypress for most use cases. I'd recommend Playwright
without prompting from a rule.

**Scenario 2 — writing E2E tests:**
I write Playwright tests using page objects pattern where appropriate, with
descriptive test names, AAA structure, and targeting stable selectors. This is
my default approach.
