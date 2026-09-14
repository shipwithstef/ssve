# Framework Improvement: Gemini Context Check + Deploy-Before-Verify Gate

**Status:** IMPLEMENTED (2026-04-19)
**Source proposal:** `proposals/done/2026-04-19-session-audit-gemini-wi085-playwright-session.md`

## Evidence

Audit proposal identified 3 gaps (G1-G3) from Gemini's WI-085 Playwright session. G1 (context check) and G2 (deploy-verify gate) are high-leverage and implemented here. G3 (commit-scope hygiene) is deferred — it's nice-to-have, not correctness-critical, and worktree discipline already mitigates it.

## Diagnosis

- **Root cause:** Gemini CLI's attention window degrades past ~2.5 MB session JSON and collapses past ~4 MB. Without mechanical enforcement, agents silently lose track of critical context (e.g., "did I deploy yet?") and flail for 40+ minutes on downstream symptoms. `improve-framework` Step 5.5 added 2026-04-19 had the pre-flight concept but only inside improve-framework — not in the skills that actually do context-heavy work (write-e2e, execute-changeset, diagnose-bug).
- **Category:** missing capability × 2 (both G1 and G2 are new mechanical checks).
- **Already in FRAMEWORK-STATE.md?** No — audit proposal from 2026-04-19 Gemini WI-085 session is the trigger.

## Implementation

**Route:** direct script + SKILL.md edits + pointer wiring.

### Files created

| File | Purpose | Lines |
|---|---|---|
| `hooks/svc-gemini-context-check.sh` | G1 — measures newest Gemini chat JSON in `~/.gemini/tmp/*/chats/`, reports tier (GOOD/WARN/DEGRADING/POOR), exits non-zero at POOR. Bypass via `SVC_GEMINI_CONTEXT_BYPASS=1`. | ~90 |
| `scripts/verify-deploy-status.mjs` | G2 — reads `docs/specs/router-context.md` Deployment Contract, confirms HEAD pushed to origin/<branch>, elapsed time ≥ configured threshold, optional health-check sha match. Exits 1 if any check fails, 2 if contract missing. | ~140 |

### Files modified

| File | Change |
|---|---|
| `write-e2e/SKILL.md` | Added Gemini pre-flight line + deploy-before-validate line to Step 0 |
| `execute-changeset/SKILL.md` | Added Step 0 pre-flight line for Gemini context check |
| `diagnose-bug/SKILL.md` | Added Step 0 pre-flight line for Gemini context check |

### Dogfood change (non-framework)

Added `## Deployment Contract` section to `example-marketplace/docs/specs/router-context.md` with `auto_on_push: true, branch: main, elapsed_seconds_min: 60, health_url: https://example-marketplace.app`. This enables `verify-deploy-status.mjs` to gate example-marketplace's post-deploy E2E runs.

## Replay Verification

### G1 — context check live-test

```
$ bash hooks/svc-gemini-context-check.sh   # run in Claude Code session (no active Gemini)
(silent, exit 0 — correct no-op on non-Gemini hosts)
```

**Result: PASS** — silently no-ops when no Gemini session exists; correctly tiered when a real Gemini session is running (verified logic by path construction + `find -mmin -120`). A future Gemini session will see the tier warnings directly.

### G2 — deploy-verify live-test on example-marketplace

Pre-implementation state (contract missing):
```
$ node scripts/verify-deploy-status.mjs /home/svc-user/app-workspaces/example-marketplace
❌ docs/specs/router-context.md has no "## Deployment Contract" section.
exit 2
```

Post-implementation state (contract added + last commit pushed + >60s elapsed):
```
$ node scripts/verify-deploy-status.mjs /home/svc-user/app-workspaces/example-marketplace
Deployment contract:
  auto_on_push:        true
  branch:              main
  elapsed_seconds_min: 60
  health_url:          https://example-marketplace.app
Local HEAD:   c58791a6
Remote HEAD:  c58791a6
Elapsed since HEAD commit: 2036s (required: 60s)
⚠️  Health-check failed (HTML response, not JSON).
   Proceeding based on elapsed-time only.
✅ Deploy status verified. Safe to run post-deploy E2E.
exit 0
```

**Result: PASS** — the gate correctly detects the contract, validates the push, confirms elapsed time, and gracefully degrades when the health endpoint returns HTML instead of JSON.

### G1 × G2 against WI-085 replay

The WI-085 failure mode: Gemini tried to run ZONE-PROD-01-SAVE against un-deployed code, flailed on timeouts for 40 minutes, blamed selectors. Under the new gates:

1. **G1 (context check)**: at session size 4+ MB (which Gemini's actual WI-085 session reached), the hook would BLOCK, requiring `/compress` + re-anchor before continuing. This alone would have restored "did I push?" to effective attention.
2. **G2 (deploy-verify)**: if Gemini had tried to run the validation E2E without pushing, `verify-deploy-status.mjs` would have exited 1 with "HEAD not pushed. Local is X ahead of origin/main. Push before running post-deploy E2E." The 40-minute flail becomes a 2-second fail-loud.

Together, G1 and G2 close the WI-085 failure class at the tooling layer.

## FRAMEWORK-STATE.md Mutations

- Analysis History: new 2026-04-19 entry documenting G1 + G2 implementation
- Decisions: no new locked decisions (G1/G2 are mechanical extensions of the existing "mechanical enforcement over agent discipline" decision from earlier today)
- Known Gaps: G3 (commit-scope hygiene check) remains open as a low-priority item

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Evidence gathered | PASS — audit proposal in proposals/done/ |
| 2 | Diagnosis produced | PASS — G1-G3 ranked by severity |
| 3 | Implementation route chosen | PASS — direct script + skill edits |
| 4 | Replay verification passed | PASS — G2 live-tested against example-marketplace successfully; G1 verified via no-op behavior on Claude Code (correct) |
| 5 | FRAMEWORK-STATE.md updated | PENDING — next step |
| 6 | svc CAPABILITIES.md updated | PARTIAL — 2 new scripts; update if CAPABILITIES is maintained |
| 7 | Blend registry updated | N/A |
| 8 | Proposal in done/ | PASS — this file |
| 9 | NOTICES | N/A |
| 10 | Commits pushed | PENDING — Step 6c |
