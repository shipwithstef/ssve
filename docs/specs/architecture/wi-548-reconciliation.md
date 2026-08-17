# WI-548 Reconciliation — dispositions and implementation sequence

**Status:** BASELINED for planning PR
**Date:** 2026-08-17
**Planning WI:** WI-548
**Base:** `origin/main` `a4d0efa3`

## 1. Disposition table

Every listed proposal, WI, and extra discovered item has exactly one disposition.

| Item | Disposition | Target | Why |
|---|---|---|---|
| `proposals/2026-08-17-framework-improvement-risk-triggered-plan-exec-contracts.md` | implement separately | WI-553 | Independent of host parity; mechanical contracts only |
| `proposals/2026-08-17-framework-improvement-native-host-dispatch-policy.md` | implement separately | WI-551 | Owner-external resolver; must precede continuation |
| `proposals/2026-08-17-framework-improvement-autonomous-restart-boundary-continuation.md` | implement separately | WI-552 | Lifecycle controller; consumes WI-551 + WI-547 + WI-502 |
| WI-544 Kimi `/tmp/fake` | operational follow-up | live `~/.kimi/config.toml` | Not a framework code change; do not fold into 542/543 |
| WI-545 Grok/Cursor Stop adapters | implement separately | WI-545 | Small executable-mode repair; precedes Stop fixtures |
| WI-546 capability-aware parity | implement separately as integration wave | WI-546 | After 545/547/549/550; live Grok/Cursor/AGY acceptance |
| WI-547 durable review evidence | accepted historical state (landed during this planning run) | PR #11 squash `7bca62f3`; closeout PR #12 `ac04fbb6` | Foundation is on `origin/main`. This run verified `check-chain-receipts --sha f27a143a` → `ok:true` from `.worktrees/verify-WI-547-on-main`. Do not duplicate. |
| PR #10 + WI-542/WI-543 closeout | operational follow-up after WI-547 | PR #10 | Unblock path below; do not merge during planning |
| Shared chain-policy for linked worktrees | implement separately | WI-549 | Absorbs WI-358 follow-up |
| Canonical receipt validation before Stop/VERIFIED/final | merge into | WI-550 | Same barrier as collision-safe identity |
| Multi-WI receipt collision | implement separately | WI-550 | Composite note keys |
| Durable plan/review/exec/audit/promotion evidence | split | notes stay in `refs/notes/svc-receipts`; bulky review bytes = WI-547 | Do not invent a second CAS for small JSON receipts |
| Autonomous continuation | implement separately | WI-552 | See proposal |
| Owner-external dispatch | implement separately | WI-551 | See proposal |
| Risk-triggered plan/exec | implement separately | WI-553 | See proposal |
| Historical `.wi543.bak` | accepted historical state | `/home/dianast/.grok/config.toml.wi543.bak` (live host file) | Retain on disk; do not commit; not a useful pre-rewire baseline (became identical after the second rewire) |
| WI-358 local CI-equivalent | accepted historical state | already VERIFIED | Only the worktree-policy follow-up is absorbed by WI-549 |
| WI-497 named WI ids | keep independent | WI-497 | Complementary; WI-550 uses existing WI-id validation and must not wait on 497 |
| WI-506 runtime-root portability | accepted historical state | already VERIFIED | WI-547/WI-549 reuse common-dir patterns; do not re-implement |
| WI-521 stage-receipt spine | keep independent | WI-521 | Complementary object; WI-550 must not collapse stage receipts into chain notes |
| Execution Controller v2 / WI-368 | supersede only the “owner as transport” gap | remainder stays WI-368 | This program consumes WI-502 authority APIs; it does not implement Luna/capsule runtime |
| WI-542 runtime SessionStart | accepted historical state | merged `a4d0efa3` | Proven; remaining work is closeout + follow-ups |
| WI-543 native hook schema | accepted historical state | merged `a4d0efa3` | Proven with WI-542 |
| WI-503 relative artifact path display | keep independent | WI-503 | Adjacent display bug; not required for this DAG |
| WI-468 emit-envelope | keep independent / defer | WI-468 | Optional later helper; WI-550 is the identity fix |
| Silent Claude/Codex remap | close as obsolete after WI-551 | current `resolve-adversarial-reviewer.sh` rewrite | Replaced by fail-closed resolver |
| AGY-as-orchestrator assumption | close as obsolete | capability matrix | AGY is reviewer transport only |
| This umbrella | planning only | WI-548 | Stops after the planning PR |

## 2. Duplicate / overlap detection

| Pair | Overlap? | Resolution |
|---|---|---|
| WI-546 vs WI-549/550 | WI-546 originally bundled policy + receipts + host fixtures | Split: 549 policy, 550 receipts/barrier, 546 remaining as live acceptance |
| WI-547 vs “durable evidence” item 12 | Partial | 547 owns bulky review bytes; notes remain the receipt envelope |
| WI-551 vs WI-489 cutover clock | Related | Clock belongs in owner file, not a framework date |
| WI-552 vs WI-368 controller | Related | 552 is the narrow restart-boundary slice; 368 remains the broader controller |
| WI-553 vs existing plan-contract | Additive | New optional sections only when flags match |
| WI-550 vs WI-521 | Complementary | Different objects, hash cross-link only |
| Circular dependencies | None | See DAG |

## 3. Ordered implementation sequence

```
independent now:
  WI-547  LANDED (PR #11 / `7bca62f3`) — do not duplicate
  WI-545  (executable adapters)
  WI-549  (shared policy)
  WI-550  (receipt identity + finalization)
  WI-551  (dispatch resolver)
  WI-553  (risk-triggered contracts)
  WI-544  (ops: live Kimi config)

after WI-547 (already true):
  PR #10 closeout can rebase onto `7bca62f3` and cite the passing `f27a143a` check

after WI-551:
  WI-552  (restart continuation asks verify.restart)

after 545 + 547 + 549 + 550 + (552 if restart fixtures are in the wave):
  WI-546  (capability-aware live Grok/Cursor/AGY acceptance)

sequential musts:
  547 before PR #10 merge
  551 before 552
  545 before any Grok/Cursor Stop live fixture
  549 + 550 before WI-546 policy/finalization fixtures
  547 before WI-546 “AGY evidence consumed from Grok/Cursor/main” fixture
```

### What WI-547 unlocked (observed 2026-08-17)

- `check-chain-receipts --sha f27a143a` from canonical main using original AGY bytes — **PASS** (`ok:true`, `type:complete`, `receipt_source:note`)
- Worktree-absolute AGY paths are no longer required for that SHA
- PR #10 can be re-validated instead of re-running AGY
- WI-546 continuity fixtures can consume the store

### When PR #10 can close

See §4. Not during this planning run.

### Does WI-545 precede broader parity?

Yes. Stop/finalization fixtures are meaningless while `svc-enforce` classifies the adapters as dangling.

### Which WI-546 parts depend on WI-547?

Review/audit continuity, “real AGY evidence consumable from Grok/Cursor/main”, and “historical worktree removal does not invalidate evidence.” Shared-policy and Stop fixtures do not need 547.

### Must dispatch precede restart continuation?

Yes. WI-552 asks the resolver for `verify.restart` and must not invent a Claude fallback.

## 4. Exact PR #10 unblock path

Observed during this planning run:

- WI-547 landed as PR #11 / `7bca62f3`.
- From `.worktrees/verify-WI-547-on-main` at that SHA, `node scripts/check-chain-receipts.mjs --sha f27a143a` returned `ok:true`.
- That was the original receipt-portability blocker.

Remaining before merge (still not done by this planning WI):

1. Rebase `closeout-WI-542-verify-promotion` onto `origin/main` `7bca62f3` so the closeout docs sit on the store-aware checker.
2. Refresh the PR #10 verification note to cite the passing `f27a143a` check. Do not rerun AGY.
3. If the closeout SHA must carry both WI-542 and WI-543 `verify-promotion` receipts, land WI-550 first or emit the two receipts onto distinct SHAs. Last-wins type@sha is still unsafe.
4. Keep WI-545 chmod out of PR #10. Keep default-checkout dirty files out of PR #10.
5. Then merge PR #10. Not from this planning WI.

## 5. Quality-gate results (planning)

| Gate | Result |
|---|---|
| Every listed item has a disposition | PASS |
| Duplicate WIs | none allocated; 548–553 are new and unused |
| Circular dependencies | none |
| AGY treated as orchestrator | none; matrix marks orchestrator unsupported |
| Hidden Claude/Codex fallback | forbidden in selected design; current remap scheduled for removal by WI-551 |
| Success with invalid receipts | closed by WI-550 barrier |
| Evidence tied to disposable worktree paths | closed by WI-547 |
| Owner copy/paste as normal continuation | closed by WI-552; last-resort blocker only |
| Unnecessary paid calls in planning | none invoked |
| WI-547 duplicated | no; referenced only |
| PR #10 unblock | precise and achievable |

## 6. Intentionally deferred

- Execution Controller v2 Luna/capsule runtime
- WI-497 named-id sweep
- WI-503 receipt-display MODULE_NOT_FOUND
- WI-468 emit-envelope generator
- Cloud CI (WI-358 already deferred)
- Repair or restore of `.wi543.bak`
- Live Kimi `/tmp/fake` cleanup beyond the operational WI-544 card
- Changing owner reviewer-policy-v2 to add a Grok key (owner-external; not a framework commit)
- Re-running historical WI-542 AGY reviews
