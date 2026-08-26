# WI-FW-HOOKS-SAFETY-01 — Exec Cross-Model Review (frozen diff)

**Status:** PENDING — external reviewer transport unavailable at execution time
**Frozen diff base:** 494f074 (origin/main merge-base)
**Review kind required:** `exec` (implementation has begun; plan-kind is phase-refused by design)

## Transport status at review time

| Station | Tuple | Result |
|---|---|---|
| fable (required, independent) | cursor / anthropic / claude-fable-5 / high | launcher classification=`capability` — no review transport for host cursor (`REVIEW_HOST_TRANSPORTS` = codex/agy/claude only). Receipt: `.svc/external-review-artifacts/plan/e33b38…/20260825T223937Z-2652300/receipt.json` |
| sol-high (optional) | cursor / openai / gpt-5.6-sol / high | same transport gap |
| agy-gemini-3.7-high (fallback/explicit) | agy / google / Gemini 3.7 Flash (High) | classification=`authentication` — Google OAuth login expired; interactive consent flow cannot be completed by an agent. Receipt: `…/20260825T224200Z-2672287/receipt.json` |
| claude direct | — | CLI reports "Not logged in"; entitlements declare `claude_paid:false` |
| codex / grok | — | entitlements declare `codex:false`; grok has no launcher transport and is the inline-self advisory family |

Historical evidence that AGY is this machine's working independent reviewer:
successful exec receipts on 2026-08-15 and 2026-08-20 in hourshub worktrees.

## What ran instead (no fabricated substitutes)

1. Per-task focused tier-1 validators red/green (T01–T05), each committed at its checkpoint.
2. Full tier-1 corpus run at T05/T06 with `TEST_CONCURRENCY=2`.
3. Adversarial self-review recorded in `docs/specs/audit/wi-fw-hooks-safety-analysis.md`
   with mutation-test evidence inverted per allow predicate.

## Required when transport restores

Run, from this branch:

```bash
SVC_DISPATCH_POLICY=~/.svc/dispatch-policy.json \
SVC_REVIEWER_STATION=agy-gemini-3.7-high SVC_DISPATCH_EXPLICIT_ASK=1 \
bash scripts/run-external-review.mjs --review-kind exec --orchestrator opencode \
  --candidate-digest <frozen-diff-sha> --context-root <worktree>
```

…or with any drivable independent station after owner policy repair. Land/merge
MUST NOT claim independent release authority until a validated receipt exists
here or the repository-owner records an explicit risk acceptance.
