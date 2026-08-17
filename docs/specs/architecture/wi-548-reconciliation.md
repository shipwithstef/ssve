# WI-548 Reconciliation — dispositions and implementation sequence

**Status:** BASELINED for planning PR
**Date:** 2026-08-17
**Planning WI:** WI-548
**Base:** `origin/main` `223436ab` (post PR #10/#11/#12). `a4d0efa3` is only the historical SHA where WI-542/543 runtime was proven.

## 1. Disposition table

Every listed proposal, WI, and extra discovered item has exactly one disposition.

| Item | Disposition | Target | Why |
|---|---|---|---|
| `proposals/2026-08-17-framework-improvement-risk-triggered-plan-exec-contracts.md` | implement separately | WI-553 | Independent of host parity; mechanical contracts only |
| `proposals/2026-08-17-framework-improvement-native-host-dispatch-policy.md` | implement separately | WI-551 | Owner-external resolver; must precede continuation |
| `proposals/2026-08-17-framework-improvement-autonomous-restart-boundary-continuation.md` | implement separately | WI-552 | Lifecycle controller; consumes WI-551 + WI-547 + WI-502 |
| WI-544 Kimi `/tmp/fake` | operational follow-up | live `~/.kimi/config.toml` | Not a framework code change; do not fold into 542/543 |
| WI-545 Grok/Cursor Stop adapters | implement separately | WI-545 | Small executable-mode repair; precedes Stop fixtures |
| WI-546 capability-aware parity | implement separately as integration wave | WI-546 | After 545/547/549/550/551/552; live Grok/Cursor/AGY acceptance |
| WI-547 durable review evidence | accepted historical state (landed during this planning run) | PR #11 squash `7bca62f3`; closeout PR #12 `ac04fbb6` | Foundation is on `origin/main`. This run verified `check-chain-receipts --sha f27a143a` → `ok:true` from `.worktrees/verify-WI-547-on-main`. Do not duplicate. |
| PR #10 + WI-542/WI-543 closeout | accepted historical state | PR #10 merged as `223436ab` | Closeout landed; WI-542/WI-543 are VERIFIED-L3 |
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
| WI-542 runtime SessionStart | accepted historical state | `a4d0efa3` + closeout PR #10 `223436ab` | VERIFIED-L3 |
| WI-543 native hook schema | accepted historical state | same as WI-542 | VERIFIED-L3 |
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

already landed:
  PR #10 closeout (`223436ab`)

after WI-551:
  WI-552  (restart continuation asks verify.restart)

WI-546 hard-depends on:
  WI-545 + WI-547 + WI-549 + WI-550 + WI-551 + WI-552

sequential musts:
  551 before 552
  545, 547, 549, 550, 551, 552 before WI-546
  WI-553 never blocks WI-546
```

### What WI-547 unlocked (observed 2026-08-17)

- `check-chain-receipts --sha f27a143a` from canonical main using original AGY bytes — **PASS** (`ok:true`, `type:complete`, `receipt_source:note`)
- Worktree-absolute AGY paths are no longer required for that SHA
- PR #10 later merged as `223436ab` using that portable evidence
- WI-546 continuity fixtures can consume the store

### When PR #10 can close

Already closed. Merged as `223436ab`. No remaining execution in this DAG.

### Does WI-545 precede broader parity?

Yes. Stop/finalization fixtures are meaningless while `svc-enforce` classifies the adapters as dangling.

### Which WI-546 parts depend on WI-547?

Review/audit continuity, “real AGY evidence consumable from Grok/Cursor/main”, and “historical worktree removal does not invalidate evidence.” Shared-policy and Stop fixtures do not need 547.

### Must dispatch precede restart continuation?

Yes. WI-552 asks the resolver for `verify.restart` and must not invent a Claude fallback.

## 4. PR #10 status

Landed as `223436ab`. WI-542 and WI-543 are VERIFIED-L3. Do not re-open, rebase, or re-merge PR #10. Dual-WI last-wins remains a WI-550 implementation concern for future same-SHA closeouts, not a PR #10 action.

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
| PR #10 | landed `223436ab` |

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
