# System Contract Map: Grok Host Identity

**WI:** WI-GROK-HOST-IDENTITY-02

**Status:** EXECUTED

**Scope:** Grok native `run_terminal_command` → Grok PreToolUse dispatcher →
bootstrap child process → shared controller lease → follow-on Grok command.
Example Marketplace application and media files are never inputs or outputs.

## Flow Diagram

```text
[Grok session + run_terminal_command]
              |
              v
[native dispatcher: SVC_HOST=grok]
              |
              v
[allowlisted SVC_HOST prefix + private session handoff]
              |
              v
[svc-ensure-worktree + controller lease(grok, session)]
              |
              v
[follow-on native dispatcher -> same principal]
```

## Handoff Table

| From | To | Transport | Data Shape | Sender Storage | Receiver Storage | Next Reader | Failure Mode |
|---|---|---|---|---|---|---|---|
| Grok runtime | Native dispatcher | stdin JSON | session, cwd, tool name, tool input | Grok session | process memory | host/session resolver | Imported Claude hook or Codex path fallback changes host |
| Dispatcher | Shell bootstrap | rewritten command plus one-use handoff | allowlisted host in argv; stable session in private handoff | process memory | command argv plus mode-0600 handoff | bootstrap parser and ensure-worktree | Host prefix makes bootstrap unrecognizable or session leaks into shell text |
| Bootstrap | Authority store | controller CAS | repo, WI, worktree, principal, generation | bootstrap process | Git common-dir authority v2 | follow-on guards | Lease stamped with Codex principal |
| Grok wirer | Grok CLI | transactional TOML | native hooks plus compat hook flags | landed framework source | `~/.grok/config.toml` | `grok inspect` | Foreign hooks remain effective or native dispatcher is absent |

## Origin / Storage Matrix

| Storage Layer | Origin / Owner | Written By | Readable By | Failure Mode |
|---|---|---|---|---|
| Hook payload | Grok runtime | Grok CLI | native hooks | Session ID is absent or evaluated under a foreign host |
| Bootstrap handoff | SSVE dispatcher | dispatcher | ensure-worktree | Session, repo, WI, branch, base, or command digest diverges |
| Controller lease | Example Marketplace Git common dir | authority-store CAS | mutation guards | Principal changes host or generation moves incorrectly |
| Grok config | local operator | landed `./setup --host grok` | Grok CLI | Foreign hooks remain enabled or native dispatcher is missing |

## External Platform Invariants

| Claim | Verification Source | Probe | Status |
|---|---|---|---|
| Grok exposes `run_terminal_command` and reserves `GROK_SESSION_ID` | Grok 1.0.13 runtime | exact native dispatcher fixture | verified-runtime |
| Compatibility cells can disable only vendor hooks | Grok inspect schema and TOML fixture | post-setup effective inventory assertion | verified-design |
| Controller authority remains generation-bound | authority-store contract | hermetic takeover fixture | verified-test |

## Falsification Probes

| Hypothesis | Confirmation Check | Falsification Check | Result | Evidence |
|---|---|---|---|---|
| Grok marker outranks Codex install path | Exact native bootstrap returns allow with Grok host prefix and private session handoff | Unknown host prefix and arbitrary env prefix remain rejected | holds | `docs/specs/test-evidence/WI-GROK-HOST-IDENTITY-02/cross-system-probe.json` |
| Authority takeover uses the same Grok session | Hermetic generation-bound takeover equals `principalId(grok, session)` | Mismatched explicit session is rejected | holds | execution-integrity fixture |
| Config convergence removes competing authority evaluators | TOML fixture has false compat hook cells and one native dispatcher | User hooks, comments, unrelated compatibility keys, modes, and backups remain unchanged | holds | Grok TOML round-trip fixture |

## Old Path / New Path Proof

| Same Input | Old Path Result | New Path Result | Conclusion | Evidence |
|---|---|---|---|---|
| Grok session invokes exact canonical bootstrap from a default checkout | Bootstrap child lost host and minted Codex principal; imported Claude hook later denied `controller principal changed` | Dispatcher returns allow with `SVC_HOST=grok`; the one-use handoff carries the same session without shell interpolation | Identity is stable across the process boundary | cross-system probe JSON and focused logs |

## Operational Boundary

Setup, live inspect, exact generation-bound takeover, and the two harmless
worktree observations occur only in `verify-promotion`. No lease file is edited
or removed directly, and no `ffmpeg` command is part of this contract.

## Iteration Escalation

A third diagnosis of the Grok host-identity/controller boundary within 14 days
must stop implementation and route the live payload, effective hook inventory,
and this map through `review-cross-model` before further mutation.
