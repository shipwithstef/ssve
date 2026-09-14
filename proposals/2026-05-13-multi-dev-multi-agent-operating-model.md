# Framework Evolution — 2026-05-13 — Multi-Dev, Multi-Agent Operating Model

**Status:** DRAFT
**Severity:** HIGH (load-bearing for any team scaling beyond single-dev solo)
**Author:** Claude Opus 4.7 — extension of the 2026-05-13 concurrent-session-collision discussion
**Related:**
- `proposals/2026-05-13-concurrent-session-collision-on-main.md` (PR #145 — narrow fix)
- `WORKTREES.md`
- `references/chain-receipt-contract.md`
- `feedback_always_use_worktrees_base44.md` (memory)

## Problem statement

The framework currently assumes a **single developer running a single agent at a time** in a given repo. Real usage is already past that:

- Today's session: two concurrent Claude agents stepped on each other in `~/app-workspaces/seriousvibecoding/` (HEAD drift between bash calls, receipts bound to wrong SHA — see PR #145 for the symptom).
- Reasonable next state: same developer running **2-4 concurrent agents** across example-marketplace + seriousvibecoding + other projects.
- Future state: **multiple developers + multiple agents per developer**, all touching the same repo from different clones.

Each scale exposes new failure modes that the current `.svc/` in-repo state model doesn't handle:

| Scale | Failure mode | What breaks |
|---|---|---|
| 1 dev, 1 agent | None — current design works | — |
| 1 dev, 2+ agents, same machine, same checkout | HEAD drift, lane-tasks rewrite races, session-contract interleaves | PR #145 fix-scope |
| 1 dev, 2+ agents, separate worktrees | Cross-worktree `.svc/` write races, shared ledgers tear | Worktree-only-isolation insufficient |
| 2+ devs, separate clones | "Is Bob's agent already working on WI-238?" has no answer | New gap — no cross-clone coordination |
| 2+ devs, mixed humans + agents | Human commits race agent commits; PR-vs-direct-push collision (already observed in PR #122) | New gap — claim semantics don't exist |

## Three-layer operating model

Build three independent registries with clear ownership boundaries. Each can ship as its own tier.

### Layer 1 — Local session registry (per machine, per dev)

Path (XDG-respecting): `~/.config/svc/sessions/active.jsonl`

One entry per active local session. Tracks all agents this developer is currently running across all projects.

```json
{
  "session_id": "sess-2026-05-13T15-30-claude-opus47-pid12345",
  "started_at": "2026-05-13T15:30:00Z",
  "last_heartbeat_at": "2026-05-13T15:42:00Z",
  "host": "claude-code",
  "model": "claude-opus-4-7",
  "tty": "/dev/pts/3",
  "pid": 12345,

  "project": "example-marketplace",
  "repo_root": "/home/svc-user/app-workspaces/example-marketplace",
  "worktree_root": ".worktrees/feat-wi-238",
  "branch": "fix/wi-238-wallet-debit-groq-fallthrough",
  "claim_ref": "refs/svc-claims/WI-238/sess-2026-05-13T15-30-...",

  "wi_id": "WI-238",
  "wi_title": "AIWallet silent money loss",
  "intent_summary": "Fix wallet→groq fallthrough + add regression test",
  "execution_mode": "end_to_end",
  "status": "active"
}
```

Solves: "what am I running on this machine?", local crash recovery, per-machine `svc session list`.

### Layer 2 — Remote WI claim refs (cross-clone, cross-dev)

The core innovation. Instead of a centralized service, use **git itself as the distributed lock manager**.

When a session wants to claim WI-238, it pushes a git ref to origin:

```bash
refs/svc-claims/WI-238/sess-2026-05-13T15-30-claude-opus47-host-alice-machine
```

The ref points at a commit (created locally, never merged to main) containing a single `claim.json` blob:

```json
{
  "wi_id": "WI-238",
  "session_id": "sess-2026-05-13T15-30-claude-opus47-host-alice-machine",
  "developer": "alice@example.com",
  "host": "claude-code",
  "model": "claude-opus-4-7",
  "started_at": "2026-05-13T15:30:00Z",
  "branch_intent": "fix/wi-238-wallet-debit-groq-fallthrough",
  "expires_at": "2026-05-13T19:30:00Z",
  "intent_summary": "Fix wallet→groq fallthrough + add regression test"
}
```

#### Atomic claim semantics

Claim attempt:

```bash
git push origin "refs/svc-claims/WI-238/sess-<my-session-id>:refs/svc-claims/WI-238/sess-<my-session-id>" \
  --no-thin --atomic \
  --force-with-lease=refs/svc-claims/WI-238/sess-<my-session-id>:0000000000000000000000000000000000000000
```

The `--force-with-lease` with a zero-sha base means: "only succeed if this ref does not yet exist." Git rejects the push if any other claim ref already exists with this session-id. This is **standard git CAS** — already battle-tested for distributed lock-management patterns.

Pre-check before the push:

```bash
git ls-remote origin "refs/svc-claims/WI-238/*"
# If any active (non-expired) claim exists for WI-238, refuse the claim.
```

#### Heartbeat

Every N minutes (default: 15), the holding session amends the claim commit with an updated `expires_at` and force-pushes to its own claim ref:

```bash
git push origin "refs/svc-claims/WI-238/sess-<my-id>" --force-with-lease
```

The ref's `committer_date` IS the heartbeat. Stale claim = `committer_date + 2 × heartbeat_interval < now`.

#### Release

```bash
git push origin --delete "refs/svc-claims/WI-238/sess-<my-id>"
```

Auto-fires on clean session exit. If the session crashes without releasing, the heartbeat-stale GC reclaims after the 2× interval.

#### GC

Any session can run:

```bash
svc claims gc --max-age 30m
```

…which lists `refs/svc-claims/*`, fetches commit timestamps, and deletes any older than the cutoff. The git server is the authority — no central service needed.

#### Read-only queries

```bash
# All active claims globally:
git ls-remote origin "refs/svc-claims/*"

# Who has WI-238?
git ls-remote origin "refs/svc-claims/WI-238/*"

# What's Alice working on?
git ls-remote origin "refs/svc-claims/*" | grep alice
```

This works from any clone. No API. No tokens beyond the standard git push credential.

### Layer 3 — Sync glue

`svc session start` is the atomic operation:

1. Write local entry to `~/.config/svc/sessions/active.jsonl`
2. If `--wi <WI-NN>` provided: attempt the atomic claim push to origin
3. If claim fails (someone else holds it): refuse start, print who holds it + their `expires_at`
4. If claim succeeds: bind the local entry's `claim_ref` field to the just-created ref name
5. Start heartbeat daemon (background process; uses `last_heartbeat_at` in local entry + periodic claim-ref push)

CLI surface (final form):

```bash
svc session start --wi WI-238 --intent "fix wallet path"
svc session list                           # local + remote summary
svc session list --all                     # all claims across all clones
svc session claim WI-240                   # add a second claim to existing session
svc session release WI-238                 # release one claim
svc session end                            # end session: release all claims, archive entry
svc session resume sess-<id>               # reattach after disconnection
svc session status                         # current session info
svc claims list                            # all active claims globally
svc claims gc                              # heartbeat-stale cleanup
svc claims show WI-238                     # who has it + expires_at
```

## What this solves (multi-dev case)

| Question | How answered |
|---|---|
| "Is anyone working on WI-238 right now?" | `git ls-remote origin refs/svc-claims/WI-238/*` |
| "What is Bob's machine doing?" | `git ls-remote origin refs/svc-claims/*` + grep |
| "Bob crashed mid-session — can I pick up WI-238?" | Wait for heartbeat-stale GC (≤30 min) OR run `svc claims gc` manually |
| "Two devs both want WI-240" | First push wins atomically; second gets clear refusal with link to existing claim |
| "What did Alice work on last week?" | `git log refs/svc-claims/*-archived-2026-W19/` (archived claim history) |
| "What's the lifecycle event log?" | Each claim commit captures who/when/intent — git log on claim refs is the audit trail |

## Failure modes + recovery

### Crashed session leaves orphan claim

**Symptom:** session terminated before clean release; claim ref still exists on origin.

**Recovery:** heartbeat stops; `committer_date` ages past the 2× interval threshold; any session running `svc claims gc` reaps it. Worst-case latency: 2× heartbeat (default 30 min). Can be manual: `svc claims release WI-238 --force` after confirming the original session is dead.

### Network partition

**Symptom:** local session can't reach origin to heartbeat.

**Recovery:** session enters `degraded` status locally; next successful heartbeat resumes. Other devs see stale `committer_date` and may reclaim after threshold. On reconnection, the local session sees its claim was reclaimed and prompts the user to either: (a) re-claim if no one else took it, or (b) abandon if someone else now holds it.

### Lost laptop / abandoned machine

**Symptom:** dev's machine permanently offline with active claims.

**Recovery:** another dev runs `svc claims gc --force --max-age 1h` (or whatever threshold makes sense). Manual override available with `svc claims release WI-238 --owner alice --force` — logs the forced release with the operator's identity for audit.

### Refs namespace pollution

**Symptom:** thousands of stale claim refs accumulate over months.

**Recovery:** weekly cron OR a pre-push hook that runs `svc claims gc`. Released claims are deleted, not archived (the claim COMMITS remain garbage-collectable; refs deleted is the cheap operation). Historical attribution via separate archival branch if needed (deferred).

## Migration plan

| Phase | Effort | What ships |
|---|---|---|
| **P0 — design freeze** | 1 day | This proposal lands; design reviewed by ≥1 cross-host reviewer |
| **P1 — local-only Layer 1** | 1 day | `svc session start/list/end` writes local registry; no remote claim yet |
| **P2 — remote Layer 2, opt-in** | 2-3 days | `svc session claim --wi` adds the ref push; opt-in via env flag |
| **P3 — heartbeat daemon** | 1 day | Background process maintains heartbeat |
| **P4 — GC + recovery flows** | 1 day | `svc claims gc`, force-release, archive |
| **P5 — default-on + skill integration** | 2 days | `route-workflow` auto-starts session; mutating skills require an active claim for their WI |
| **P6 — multi-dev validation** | 1 day | Two-dev test scenario: Alice + Bob both try to claim WI-238 from separate clones; verify atomic refusal |
| **P7 — deprecate old session-contract** | 2 days | Migrate `.svc/session-contract.jsonl` consumers to read from local registry instead; eventually remove the in-repo file |

Total: ~8-12 dev days. Can ship P1-P3 in a week and provide value; P4-P7 can follow.

## What this does NOT propose

- **Does not require a central service.** Git is the database. No new infra (no Redis, no Postgres, no API server, no auth). Existing GitHub/GitLab credentials are sufficient.
- **Does not block solo single-agent workflows.** A solo dev running one agent at a time pays minimal overhead (one local file write per session start, one ref push per claim). Heartbeat is opt-in if running a single short-lived session.
- **Does not break offline work.** Layer 1 (local registry) works offline. Layer 2 (remote claims) is reach-best-effort; offline sessions can mark themselves `offline-degraded` and reconcile on reconnect.
- **Does not replace WORKTREES.md doctrine.** The worktree IS where the session runs; this proposal adds the *coordination layer* on top. The worktree-everything follow-up (mentioned in PR #145) is independent and complementary.

## Acceptance criteria

- [ ] `svc session start --wi <WI>` writes a local entry AND atomically claims the WI via `refs/svc-claims/<WI>/<session-id>`.
- [ ] If WI is already claimed by another session anywhere, the start refuses with that session's metadata (developer, machine, started_at, intent).
- [ ] `svc session list` shows local sessions; `svc session list --all` queries origin for global view.
- [ ] Heartbeat updates the claim commit's timestamp at the configured interval.
- [ ] `svc claims gc` reaps refs whose `committer_date` is older than `2 × heartbeat_interval`.
- [ ] Two-dev test: from two separate clones of the same repo, both running `svc session start --wi WI-XXX` — exactly one succeeds, the other gets a clean refusal naming the holder.
- [ ] Single-dev solo test: starting + ending a session leaves no orphan refs.
- [ ] `route-workflow` invocation automatically calls `svc session start` if no active session exists for the current intent.
- [ ] No mutating skill proceeds without an active claim for its declared WI (override flag `--no-claim` available for emergencies; logged to `.svc/pipeline-decisions.jsonl` with `claim_override=true`).

## Confidence

HIGH that this design is correct. Git's atomic-push semantics for ref creation are well-established (distributed-systems folklore — see `git-lfs` lockfiles, branch protection, several lock-manager implementations using a similar pattern).

MEDIUM-HIGH on cost estimate: ~8-12 dev days for P1-P7. The architecture is simple; the work is mostly in skill integration + edge-case handling.

## Why now

Today's session ate ~30 minutes of recovery time across two PRs (#145, #146) due to a class of issue that this design eliminates. Multiplied by N concurrent sessions × M developers, the cost scales fast. The single-agent assumption baked into `.svc/` ledger files is the load-bearing assumption that needs lifting BEFORE the framework grows further.

The narrower PR #145 fix (Option A — explicit `--sha` flag on `emit-receipt.mjs`) is a useful band-aid for the receipt-binding subset. This proposal is the structural fix that supersedes the band-aid once shipped.
