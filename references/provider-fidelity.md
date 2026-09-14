# Provider Fidelity Evidence

Provider fidelity applies when a user, spec, or platform contract names a primary provider or when generated content source matters to the user promise.

Trigger risk flags:

| Flag | Meaning |
|---|---|
| `provider-backed` | A named provider or integration is part of the user-visible contract. |
| `generated-content` | The feature generates text, image, video, audio, or data outputs. |
| `ai-generation` | The generated output comes from an AI capability. |
| `primary-provider` | A specific provider must be used for PASS. |
| `saved-outcome` | Success includes a persisted result visible after save/return. |

Required evidence family: `provider_fidelity`.

Required closeout artifact:

```text
docs/specs/features/test-evidence/<run>/PROVIDER_FIDELITY_EVIDENCE.md
```

Validate it with:

```bash
node scripts/validate-provider-fidelity-evidence.mjs \
  --evidence docs/specs/features/test-evidence/<run>/PROVIDER_FIDELITY_EVIDENCE.md
```

Fallback rule: fallback, mock, placeholder, uploaded substitute, or draft-only evidence cannot satisfy primary-provider acceptance criteria unless the fallback policy allows it and the user explicitly approved the fallback before closeout.

## Test-assertion contract

The evidence file alone does NOT guarantee provider fidelity. The underlying tests must also assert on source attribution + content quality, not just success flag.

**See `rules/provider-fidelity-test-contract.md`** for the required assertion shape:

1. Source attribution must be in the expected acceptable set
2. Source must NOT equal the cheap fallback value when primary path is expected
3. Content quality (mime type, file size) must be probed
4. Monetary debits (wallet, credits) must reconcile with source attribution

Without this contract, tests pass with `success: true` while the system silently degrades. Real failure: Example Marketplace WI-233 had 4 contract tests all passing while every saved image was a 2.2 KB Groq SVG placeholder. Documented in `references/anti-patterns.md` AP-34.

## Companion: provider chain side-effects

Provider fallback chains where a step has multiple post-success calls (DB write, ledger update, usage tracking, transaction recording) must wrap each post-success call in its own try/catch. If a post-success call throws, the outer chain catch returns null, the chain falls through, the customer sees a different provider response — but the side-effects (e.g., wallet debit) already executed. Result: silent money loss with mid-state damage.

Pattern: see `tryBase44WalletImage` in Example Marketplace `generateAIContent` (commit `35557816`) — wraps inner `consumeAICredit` to prevent fallthrough after debit. See framework-learnings.jsonl entry `provider-chain-inner-side-effects-need-inner-try-catch`.
