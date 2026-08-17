# Selected architecture — Portable Outcome Contract + Capability-Declared Adapters (POCCA)

**Planning WI:** WI-548
**Date:** 2026-08-17
**Status:** selected for implementation children; no runtime code in this PR

## One-sentence design

Keep one portable product-delivery contract across hosts, store bulky review
bytes in the WI-547 content-addressed store, keep small receipts in git notes
with collision-safe keys, resolve policy from git-common-dir, and let each host
declare native / adapter / unsupported behavior instead of pretending they
share internals.

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Owner-external config (dispatch + optional chain-policy)    │
│ ~/.svc/dispatch-policy.json     ~/.svc/chain-policy.json    │
└───────────────┬─────────────────────────────┬───────────────┘
                │ resolve at now              │ shared refuse
┌───────────────▼──────────────┐   ┌──────────▼───────────────┐
│ Dispatch resolver (WI-551)   │   │ Shared policy (WI-549)   │
│ global ⊕ work ⊕ session      │   │ git-common-dir authority │
└───────────────┬──────────────┘   └──────────┬───────────────┘
                │                             │
┌───────────────▼─────────────────────────────▼───────────────┐
│ Portable mandatory outcomes (all hosts)                     │
│ durable receipts · collision-safe multi-WI · review/audit   │
│ continuity · honest task state · canonical completion       │
│ post-exec/post-promo verify · autonomous closeout           │
│ no false done · no paid rerun for relocate · no paste bus   │
└───────────────┬─────────────────────────────────────────────┘
        ┌───────┴────────┬──────────────┬─────────────────────┐
        ▼                ▼              ▼                     ▼
  Notes envelope    Evidence CAS    Finalization         Host adapters
  {type,wi,sha}     WI-547 store    barrier WI-550       capability JSON
  WI-550            digest+reloc    Stop/VERIFIED        native|adapter|
                                                      unsupported
        │                │              │                     │
        └────────┬───────┴──────┬───────┴──────────┬──────────┘
                 ▼              ▼                  ▼
        Continuation (WI-552)   Risk contracts    Live acceptance
        baton + exactly-once    (WI-553)          (WI-546)
        native launch
```

## Architecture question → selected option

| # | Question | Selected | Rejected |
|---|---|---|---|
| 1 | Receipt/evidence object storage | **Split store:** git notes for receipt envelopes; WI-547 CAS (`$(git-common-dir)/svc-review-evidence/objects/<sha256>`) for bulky review bytes | Notes-only bulky artifacts; tracked `.svc/evidence/` in history; second general CAS for small JSON |
| 2 | Legacy relocation | **Hash-bound relocation manifest** already in WI-547: copy exact bytes, map historical path → object id, never rewrite receipts | Rewrite historical launcher receipts; keep original worktree forever; re-run AGY |
| 3 | Shared policy | **git-common-dir file is repository authority**; env override; owner-home fallback; missing → fail-closed refuse | Per-worktree copy as authority; silent warn-on-missing; owner-home only |
| 4 | Collision-safe identity | **Composite key `{receipt_type, wi, target_sha, phase?}`** with atomic merge and explicit supersession | Last-wins type@sha; notes-ref-per-WI (harder to check a SHA); append-only log without keys |
| 5 | Finalization barrier | **Canonical `check-chain-receipts` is authority**; Stop/VERIFIED/final success are consumers | Task-graph status as authority; warn-and-continue; host-specific success heuristics |
| 6 | Host capability manifests | **Extend `provision/hosts/<host>.json`** with `native \| adapter \| unsupported+blocker` plus mandatory-portable outcomes | Require identical hook mechanics; invent a parallel host registry; treat AGY as a 10th orchestrator |
| 7 | Dispatch resolver | **One `resolve-dispatch.mjs`** over owner-external JSON at `now`, then work overlay, then explicit session override | In-repo calendar cutovers; silent remap to Claude; host-hardcoded tables as truth |
| 8 | Restart continuation | **Hash-bound baton + exactly-once native launch + WI-502 authority** | Owner prompt bus; auto-drive synthetic proof; Claude fallback when Grok cannot launch |
| 9 | Authority transfer | **Reuse WI-502 generation-bound lease/handover**; isolated closeout worktree | Duplicate a second lease system; mutate canonical main; hand-edit claim files |
| 10 | Risk-triggered contracts | **Flag-compiled extra plan-contract sections + mechanical checks** | Always-on extra review stage; prose checklists in every SKILL.md |
| 11 | Adapter validation | **Setup/install fail-closed on non-executable bash runners** (WI-545) | Session-local chmod; classify missing as dangling forever |
| 12 | Worktree teardown | **Refuse removal while unpromoted review artifacts exist**; WI-547 promote-before-remove | Delete worktree first; copy bytes after the path is gone |
| 13 | Focused vs full validation | **Focused tests per child WI; one full Tier-1 at each landing boundary that policy requires** | Full suite on every planning save; paid review on every child |

## Why the split store is correct

Receipt envelopes are small JSON and already have a durable, pushable home:
`refs/notes/svc-receipts`. The WI-542/WI-543 closeout failure was not “notes
are the wrong store.” It was (a) bulky AGY packages living at worktree-absolute
paths and (b) type@sha last-wins overwrite.

WI-547 already implements the right store for (a). This plan does **not**
re-implement it. WI-550 fixes (b) in the note envelope.

## Host roles (non-negotiable)

| Host | Role |
|---|---|
| Grok Build | First-class orchestrator where configured |
| Cursor CLI | First-class orchestrator/subagent transport where configured |
| AGY | Independent Gemini **reviewer transport** only |
| Claude | Supported orchestrator/reviewer where configured |
| Codex | Supported orchestrator/reviewer where configured |

A missing native primitive produces an explicit capability-limited result.
It never silently remaps to Claude or Codex.

## Dependency DAG

```
WI-502 (exists)     WI-547 (LANDED #11)     WI-545     WI-549     WI-550     WI-551     WI-553     WI-544 (ops)
       \                    |                  |          |          |          |
        \                   |                  |          |          |          v
         \                  +----+-------------+----------+----------+----> WI-552
          \                      |
           \                     +
            \                    |
             +-------------------+-------------------------------> WI-546 live acceptance
```

No cycles.

## Rollback of the program

Each child rolls back independently. The program-level rollback is: leave
unlanded POCCA children unimplemented. Keep landed WI-542/543/547 and PR #10.
Do not restore silent remap or prompt-copy as success.
