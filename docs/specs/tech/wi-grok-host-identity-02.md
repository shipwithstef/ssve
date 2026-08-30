# WI-GROK-HOST-IDENTITY-02 Technical Design

**Status:** BASELINED
**Work item:** WI-GROK-HOST-IDENTITY-02

## Context

Grok 1.0.13 discovers Claude-compatible hooks by default. SSVE also installs a
native Grok hook set. Running both makes mutation authority depend on which
vendor hook evaluates first, and an imported Claude dispatcher can rewrite a
Grok bootstrap while identifying itself as Claude. The rewritten shell command
then loses hook-local environment and defaults to Codex.

## Alternatives

| Option | Result | Decision |
|---|---|---|
| Disable foreign hooks only; install a complete Grok-native governed boundary | One host, one principal, no duplicate mutation guards; foreign skills/rules remain discoverable | selected |
| Make imported Claude hooks dynamically guess Grok | Path and explicit `SVC_HOST=claude` remain misleading; risks weakening real Claude identity | rejected |
| Treat `codex`, `claude`, and `grok` principals as equivalent | Removes cross-host isolation and makes real foreign ownership ambiguous | rejected |
| Require users to type `SVC_HOST=grok` before every bootstrap | Fragile operator ritual and violates zero-block bootstrap UX | rejected |

## Architecture

```text
Grok run_terminal_command
        |
        v
native Grok dispatcher (SVC_HOST=grok)
        |
        +-- canonical bootstrap recognition
        +-- one-use handoff creation
        +-- rewritten command carries SVC_HOST=grok
        v
svc-ensure-worktree
        |
        +-- binding(session_id, WI, worktree)
        +-- controller principal = sha256(grok, session_id, agent_id)
        v
follow-on Grok command -> same dispatcher -> exact principal match
```

Foreign compatibility remains enabled for non-hook surfaces. Grok config pins:

```toml
[compat.claude]
hooks = false

[compat.cursor]
hooks = false
```

## Component Changes

| Component | Change | Preserved contract |
|---|---|---|
| `scripts/wire-grok-hooks.mjs` | Prefix Grok hooks with `SVC_HOST=grok`; wire the consolidated dispatcher; converge foreign hook compatibility to false | Transactional, mode-preserving, idempotent TOML rewrite |
| `hooks/codex/svc-codex-pretool-dispatcher.mjs` | Recognize Grok's reserved session marker, put validated `hostId` in the rewritten command, and carry stable session only in the private one-use handoff | Existing parser, isolation, child gates |
| `hooks/lib/resolve-wi.mjs` | Recognize `GROK_SESSION_ID` for session and host resolution | Allowlisted wired `SVC_HOST` wins, then the Grok marker, then payload host; unknown wired hosts fail closed |
| `scripts/svc-ensure-worktree.mjs` and `hooks/lib/wi-claim.mjs` | Resolve one trusted host for every binding/claim/controller write and reject missing or unsupported identity before mutation | Direct and dispatcher bootstrap stamp the same host/session principal |
| `scripts/svc-authority.mjs` | Accept `GROK_SESSION_ID` as trusted identity for generation-bound takeover | Flag/environment equality checks remain fail-closed |
| Tier-1 fixtures | Prove TOML compatibility isolation, dispatcher host prefix, bootstrap propagation, and Grok resolver behavior | Existing host cases remain unchanged |

## Data and State

No schema changes. Controller lease v2, binding, handoff, and receipt shapes are
unchanged. Existing malformed legacy state is not silently rewritten by setup.
The one live synthetic lease is repaired separately through the existing
generation-bound authority recovery API after the landed setup is installed.

## Security

- No principal equivalence or bypass is introduced.
- `hostId` is selected from the dispatcher's fixed known-host allowlist before
  interpolation into the rewritten shell command.
- Disabling foreign hooks reduces duplicate authority evaluators; it does not
  disable Grok-native isolation, workflow, receipt, or stop gates.
- Recovery must bind expected principal, generation, worktree, WI, and live
  evidence. A blind delete or lease-file edit is forbidden.

## Idempotence and Rollback

The TOML transformer updates or inserts only `hooks = false` in the two compat
tables and preserves unrelated keys/comments. Repeated setup produces identical
bytes. Existing immutable and per-attempt rollback backups remain authoritative.
Any late write failure restores the previous config bytes.

## Cost and Operations

No paid services or additional steady-state process. Grok loses redundant
foreign hook executions and gains one native dispatcher invocation whose
read-only observation path is already optimized. Setup verification uses
`grok inspect --json` to assert effective—not merely textual—hook state.

## Acceptance Proof

1. **AC-1:** Focused identity fixtures resolve `GROK_SESSION_ID` consistently.
2. **AC-2:** The rewritten bootstrap exports only validated host identity; the
   private one-use handoff carries the stable session without shell interpolation.
3. **AC-3:** The Grok TOML transformer is lossless, transactional, and idempotent.
4. **AC-4:** `./setup --host grok` converges the live config and `grok inspect
   --json` reports Claude/Cursor hooks disabled and exactly one
   SSVE consolidated dispatcher from Grok config.
5. **AC-5:** Exact compare-and-swap moves the observed synthetic lease to the
   Grok principal without deleting or editing the lease file.
6. **AC-6:** Exact HoursHub bootstrap plus harmless follow-on observation passes;
   no HoursHub media/application bytes change and `ffmpeg` is never executed.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | One stable principal across both calls | PASS — host propagated explicitly |
| 2 | Foreign hook collision removed narrowly | PASS — hooks only; other compat retained |
| 3 | Isolation and WI binding preserved | PASS — no authority predicate weakened |
| 4 | External config rewrite idempotent/rollback-safe | PASS — existing transactional wirer retained |
| 5 | Operational proof covers effective merged config | PASS — `grok inspect --json` required |

**Next:** `plan-changeset` — produce the exact implementation and verification manifest.
