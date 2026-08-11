# Rule: Provider-Fidelity Tests Must Assert Source + Quality, Not Just Success

Any test that exercises a provider-backed feature (AI generation, payment processing, image generation, file upload, OAuth, etc.) MUST assert on:

1. **Source attribution** — which provider/path actually produced the output
2. **Content quality property** — mime type, file size, schema shape, or similar concrete property
3. **Negative on fallback** — that the result did NOT come from a low-quality fallback path when the test expects the primary path
4. **Monetary state consistency** — if any provider charges (wallet, credits, plan-counter), the debit MUST be reconciled with the source attribution

Asserting `response.success === true` is NOT sufficient. A test that only checks the success flag will pass while the system silently degrades to a fallback that produces customer-unacceptable output.

## The failure pattern this rule prevents

Real session 2026-05-13 on Example Marketplace: the `WI233-ai-content-generation-fallback.spec.ts` test asserted `image.success === true`, `image.url` present, `ai_credits_used === 0` for each of `deal | event | standby_queue | flash_offer`. ALL 4 passed. The WI was marked VERIFIED and `framework-complete`.

Reality: every saved image was a 2.2 KB SVG cartoon (`source: 'groq_svg_uploaded'`) — the absolute-last-resort free-tier fallback in a 5-step provider chain. The user explicitly stated the goal was "content customer will pay for, not placeholder weird looking stuff". The test had no way to catch this because it never looked at `image.source`.

Worse: in a separate code path (`tryBase44WalletImage`), the wallet WAS being debited 4¢ per generation while the response still returned `source: 'groq_svg_uploaded'` — silent money loss. No test asserted that monetary debit and source attribution were consistent, so the bug went undetected from initial deployment until manual user pushback.

Both gaps trace to the same root cause: tests asserted success flag instead of provider-fidelity properties.

## Required assertion contract

For every provider-fidelity test (per `concerns/provider-fidelity.md` signals):

```ts
// 1. Source attribution — must be one of the known acceptable source values
const ACCEPTABLE_SOURCES = new Set(['primary', 'paid-fallback-A', 'paid-fallback-B']);
expect(ACCEPTABLE_SOURCES.has(response.source), `unexpected source: ${response.source}`).toBe(true);

// 2. Negative on cheap fallback — when the test expects the primary path
expect(response.source).not.toBe('cheap-svg-fallback');
expect(response.url).not.toMatch(/cheap-svg-prefix/);

// 3. Content quality — mime type, file size, or schema
const head = await fetch(response.url, { method: 'HEAD' });
expect(head.headers.get('content-type')).toMatch(/image\/(png|jpe?g|webp)/);
expect(Number(head.headers.get('content-length'))).toBeGreaterThan(10_000);  // 10 KB floor for "not a placeholder SVG"

// 4. Monetary consistency — if charged, source must match
const walletAfter = await getWallet(locationId);
if (response.source === 'wallet') {
  expect(walletAfter.balance_cents).toBe(walletBefore.balance_cents - COST_CENTS);
} else {
  expect(walletAfter.balance_cents).toBe(walletBefore.balance_cents); // no silent debit
}
```

## When this rule applies

Use the `provider-fidelity` concern signals (`concerns/provider-fidelity.md`):

- File-path patterns: `docs/specs/features/**`, `**/provider/**`, `**/generation/**`, `**/ai/**`
- Diff keywords: "primary provider", "fallback", "generated image", "AI generation", "saved outcome", "source evidence"
- Packages: `openai`, `@fal-ai/*`, `replicate`, `@google/genai`
- Env vars: `*_API_KEY`, `*_TOKEN`

If any of these signals match a test file, the test MUST satisfy the assertion contract above.

## How to enforce

1. **At `write-e2e` time:** the skill must declare which source values are acceptable for the test in its Phase 0 spec. If the test exercises a paid path, list the acceptable paid sources AND the forbidden fallback values.

2. **At `review-gate` G3:** for any test file that imports a provider SDK or hits a function with `provider`/`generation`/`ai` in the name, verify the test asserts on `source` field. Reject the PR if it asserts only on `success`.

3. **At `validate-provider-fidelity-evidence.mjs`:** extend the validator to additionally require evidence rows showing the actual `source` value from each invocation, not just "image present".

4. **At `audit-implementation`:** flag any provider-fidelity test that does not also assert content-quality (mime type or file size). The classic failure mode is "image URL present" passing while the URL points to a 2 KB SVG placeholder.

## Companion rule: provider fallback chains must catch inner side-effects

When a provider chain step has multiple post-success calls (e.g., debit wallet → write transaction record → call usage-tracking function), each post-success call MUST be wrapped in its own try/catch. If any post-success call throws, the outer catch returns null, the chain falls through, and the customer experiences silent failure — often with mid-state damage (wallet debited, transaction recorded, but response says "we used a different provider").

See `tryBase44WalletImage` in Example Marketplace's `generateAIContent` (commit `35557816`) for the canonical example: inner try/catch around `consumeAICredit` was the fix that resolved a months-old silent money-loss bug.

## Why this rule exists

Tests that assert only the success flag give false confidence. The framework already has the `provider-fidelity` concern, the `PROVIDER_FIDELITY_EVIDENCE.md` requirement, and the `validate-provider-fidelity-evidence.mjs` validator. None of those check whether the underlying test assertions actually validate the provider-fidelity property. This rule closes that gap.

## Severity when violated

HIGH. A provider-fidelity test that doesn't assert source is materially equivalent to no test — it lets silent degradation pass review.

## Origin

2026-05-13 — Example Marketplace WI-238. Discovered when the user pushed back on screenshots that showed SVG placeholders instead of photographic output. Diagnosis revealed (a) tests passed because they checked success flag only, (b) wallet path had a silent debit-without-attribution bug because inner `consumeAICredit` errors fell through to the outer chain catch.
