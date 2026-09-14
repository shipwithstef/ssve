# Browser-Verification Doctrine (WI-097)

How svc skills should perform live-URL verification without regressing session economy.

## Principles (binding)

1. **Never ask the user to browser-verify.** If a skill's acceptance criterion is "did the button work on prod?", the skill verifies it — not the human. Handing browser-verify to the user is a silent abdication of the close-out gate (WI-095).
2. **Never return raw Playwright MCP output to the parent orchestrator.** Page snapshots, DOM dumps, and accessibility trees are large and mostly irrelevant. Parent-orchestrator context is first-class economy; raw Playwright output burns it.
3. **Always go through a compact wrapper that returns only verdicts + minimal evidence.** The wrapper accepts `{ url, checks: [...] }` and returns `{ pass: bool, findings: [...], screenshot_path?: string }`. Evidence files live on disk under `docs/specs/work-items/evidence/<WI>/`; the parent sees only verdict-shape JSON.
4. **When in doubt, prefer E2E-in-repo over ad-hoc browser probes.** `write-e2e` + `playwright` produce durable artifacts; MCP browser_click/browser_snapshot flows are for one-off diagnostics, not gate evidence.

## Status of the wrapper

**Shipped 2026-04-25 as `scripts/browser-verify.mjs`** per WI-102. The wrapper accepts declarative checks, runs them via headless Playwright, writes screenshots to `docs/specs/work-items/evidence/<WI>/`, and returns verdict-shape JSON under 2 KB.

Enforcement is now binding:
- Skills requiring live-URL verification MUST call `node scripts/browser-verify.mjs` (or `import { browserVerify } from '../../scripts/browser-verify.mjs'`) instead of invoking raw `mcp__plugin_playwright_playwright__*` tools.
- Raw MCP calls are reserved for one-off interactive diagnostics only — never for gate evidence.
- The WI-095 close-out gate's product-lane extension (Playwright-on-prod-URL) can now be filed as a follow-up WI that calls the wrapper.

## Wrapper requirements (v1 — implemented in WI-102)

| Requirement | Notes |
|---|---|
| Headless Chromium by default | Optionally named browser profile for stateful auth |
| Declarative checks: `presence`, `text-contains`, `regex-match`, `attr-equals`, `count-elements`, `screenshot-matches` | Each returns a boolean verdict |
| Returns verdict JSON under ~2 KB regardless of page size | Screenshots saved to disk, path returned |
| Timeout, retry, navigation-wait all encapsulated | Caller never tunes these per-call |
| Runnable from both a skill and a tier-1 validator | Same binary, same contract |

## Non-goals

- This doctrine does not govern E2E-in-repo tests (that's `write-e2e` + `playwright` skill territory).
- It does not cover non-URL verification (tier-1 static checks, AST validators, unit tests).

## Related

- WI-095 — close-out gate (framework lane v1 shipped; product-lane blocked on WI-102).
- WI-097 — this doctrine (v1 = principles + WI-102 dependency).
- WI-102 — wrapper build (blocks full WI-097 enforcement and WI-095 product-lane extension).
