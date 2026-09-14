# Merge-Gate Permission + Blocked-On-User Protocol (WI-464)

The auto-mode classifier blocks an agent from merging its **own** PR (`[Self-Approval]`)
and from pushing to the default branch. This is correct — it is the two-party-review
boundary. But two failure modes were observed repeatedly (2026-06-29 session, PRs
#109–#115): (a) an agent in a `/goal` / autonomous loop **re-fires the blocked merge
endlessly**, and (b) the agent **tool-shops** for a surface that works. Both waste the
user's budget and patience. This doc makes the resolution deterministic.

## 1. The standing merge-helper permission (the durable fix — an informed tradeoff)

`scripts/merge-pr-with-review-receipt.mjs` is NOT a raw `gh pr merge`: it calls
`scripts/validate-review-receipt.mjs`, which **refuses to merge** unless
`.svc/review-receipts/pr-<N>.json` has `result` in PASS/approved, a **non-empty
`evidence[]`**, and `self_review !== true` (`validate-review-receipt.mjs:89–91`).

**Be honest about what that gate is.** Those are FIELDS in an **agent-authored** receipt.
The helper checks that the agent *claimed* a non-self PASS with evidence — it does NOT
cryptographically verify that a real independent reviewer produced it. So the receipt is
an **honesty / discipline gate** (meaningful only if the agent actually ran the
cross-model review it cites — e.g. `codex review` — before writing the receipt), **not a
provenance guarantee**. (This session saw a near-miss where a receipt was written before
its review actually ran — caught and corrected.)

**The tradeoff.** Granting

```jsonc
// ~/.claude/settings.json  → permissions.allow[]
"Bash(node scripts/merge-pr-with-review-receipt.mjs:*)"
```

removes the per-merge auto-mode human prompt and leaves the agent-authored review-receipt
as the only runtime gate. For a **solo / trusted-agent / private** context — where the
auto-mode prompt is friction the operator wants gone and they trust the review-receipt
discipline plus the cross-model review behind it — this is a reasonable, deliberate
choice. **Do NOT grant it if you require a hard human-in-the-loop merge gate.** The agent
CANNOT self-add it (auto-mode blocks settings self-modification, by design) — add it via
`/permissions`.

## 2. Blocked-on-user protocol (when no permission exists)

When a merge / push-to-default is denied by the auto-mode classifier AND the agent is
running autonomously (a `/goal` or end_to_end loop), the agent MUST, exactly once:

1. **Record the block** — write `.svc/merge-blocked-on-user.json`:
   `{ "pr": <N>, "blocked_at": "<iso>", "reason": "auto-mode self-approval", "unblock": [...] }`
2. **Surface the one action** — state the single user step (add the permission above /
   `Shift+Tab` auto-mode off + retry / Squash-merge on GitHub).
3. **STOP retrying.** Do NOT re-attempt the same merge, do NOT tool-shop another surface
   (gh CLI → MCP → settings edit). Repeated attempts are flagged as bad-faith tunneling
   and burn the user's budget. The state file is the terminal `blocked-on-user` marker.

This is a HARD behavioral contract, not a suggestion. Re-firing a known-blocked merge is
the anti-pattern this protocol exists to kill.

## 3. Host limitation (honest scope)

The `/goal` Stop hook that re-fires the loop is a **host (Claude Code) feature** — svc
cannot stop the host from re-prompting. What svc controls is the **agent's** response:
the `.svc/merge-blocked-on-user.json` marker + this protocol make the agent halt cleanly
on the first block instead of looping. The *durable* removal of the friction is §1 (the
standing permission), which the user adds once.

## Unblock paths (any one)
| Path | Effect | Who |
|---|---|---|
| Add the §1 standing permission | permanent — agent merges review-gated PRs directly | user (once) |
| `Shift+Tab` → auto mode OFF → retry | one-window unblock | user |
| Squash-and-merge on GitHub | merges that one PR | user |

Referenced from `land-changeset/SKILL.md` Step 4.
