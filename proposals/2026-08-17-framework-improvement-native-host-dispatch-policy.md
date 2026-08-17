# Framework improvement: native-same-host dispatch for every review and subagent

**Status:** ACCEPTED → WI-551 (planning umbrella WI-548)
**Date:** 2026-08-17
**Source:** Owner requirement — global point-in-time config, session-overridable — plus WI-542 G5 adapter mismatch
**Severity:** high
**Category:** missing capability
**Plan-changeset class:** hot-path (dispatch resolver + owner policy + adapters)
**Sibling, not duplicate:** `proposals/2026-08-17-framework-improvement-risk-triggered-plan-exec-contracts.md` is about *what a plan must prove*. This proposal is about *who plans, who implements, who reviews, where feedback goes*.

## Gap

Dispatch must be **read from an owner config at resolve time**, then **overridable for this session / this work** when the owner asks. It is not a date hardcoded in the framework, not “the August 20 Codex flip,” and not a Claude/Codex table in the repo.

Today the framework remaps Cursor/Grok to Claude, ignores live entitlements, and has no session override except a SHA-bound retro-plan file aimed at one launcher. The owner’s mix (Grok native plan/self/exec, Cursor Fable+Sol, no Fable ping-pong, deny Sonnet 5, Opus 5 only for UI/design critique, Gemini 3.7 High only as last-resort or an explicit ask from any host or from AGY itself) cannot be expressed as config, and cannot be changed for one session without a code edit.

This is one gap: **global config = point-in-time truth; explicit session/work override on request; every review and every subagent invoke uses the same resolver.**

Do not expand WI-542 to implement this.

## Resolution order (this is the design)

Evaluate at each invoke (`now`, this host, this session, this WI, this role):

1. **Global owner file** — `~/.svc/dispatch-policy.json` (or `SVC_DISPATCH_POLICY`). Read now. Whatever it says *at this moment* is the default: entitlements, deny/allow, stations, feedback sink, iteration caps. Optional `from`/`until` inside **that file** are data, not framework calendars.
2. **Work overlay** — if a WI or worktree carries an explicit overlay path the owner attached, apply it on top of (1).
3. **Session override** — only if this session **requested** it (session-contract field, env `SVC_DISPATCH_OVERRIDE`, or a receipted owner message). Lasts for that session (or until cleared). Not inferred. Not silent.
4. **Deny is per-role, fail-closed.** A model denied for EXEC may be allowed for `review.design`. Session override may add an exception only when requested and receipted. Never silent-remap to Claude/`svc-default`.

No layer is “the 20th.” When Codex becomes available, the owner edits the config (or a `from` already in the file starts matching `now`). When they want Sol-only for this afternoon, they request a session override. When they want Grok exec this WI and Composer next WI, that is work overlay.

## Example of config contents (not a framework date)

The 2026-08-17 mix is **one snapshot** that belongs in the owner file, not in SSVE:

| Role | Snapshot example |
|---|---|
| Plan / self-review / EXEC | Grok Build native |
| Independent plan + exec | Cursor Fable **once** each, no round-trip |
| Other independent | Cursor Sol high |
| UI / design critique | Opus 5 allowed — issues and improvements only, not implement, not land authority |
| Gemini 3.7 High | **Last resort**, **or** owner explicitly asks — from **any** host (schedule it) **or** from AGY itself. Both valid. Never a default station |
| Feedback sink | Grok; justification required |
| On Grok reject | Escalate to Sol; never return to Fable |
| Deny (except UI critique) | Sonnet 5; Opus 5 for EXEC / code-review / land |
| Later EXEC candidates | Composer 2.5 or Opus 4.6, only after config/session says so |

A later snapshot might flip Codex on, mark Claude paid, split plan vs exec across families, or move EXEC to Cursor Ultra. Same resolver. Config change or session override. No SSVE commit.

## Evidence (framework cannot do layers 1–3)

| Surface | Today | Missing |
|---|---|---|
| `scripts/resolve-model.sh` | Host→profile; `*` → `svc-default` / Sonnet 5 | No owner file at `now`. No session override. Deny-list absent. |
| `~/.svc/reviewer-policy-v2.json` | Claude/Codex stations; AGY Gemini optional independent | Gemini is a default-optional station today. Owner wants it only as last-resort, or an explicit ask from any host or from AGY. |
| `resolve-adversarial-reviewer.sh` | Non-claude/codex **rewritten to claude** | Silent remap, the opposite of config+override. |
| `review-plan-codex.sh` | claude\|codex launcher only | Cannot mint receipts from “whatever the config says this session.” |
| WI-489 profile cutover | One scheduled Fable→Opus clock in-repo | Clock belongs in **owner config**, overridable per session, not a framework cutover. |
| Retro-plan SHA override | One exception for paid plan-after-exec | Not a general per-session dispatch override. |

WI-542: Grok already did plan + self-review + exec. The adapter still demanded Claude/Codex because nothing reads a global mix or a session exception.

## Diagnosis

- **Root cause:** Routing is compiled into repo profiles and one Claude/Codex policy, not *read config at now, then apply requested session/work override*.
- **Category:** missing capability.
- **Already in FRAMEWORK-STATE.md?** no.

## Design constraint

- **One resolver, every consumer.** Every review gate, lens, stage executor, implementor child, dispatch-waves, Task/Agent spawn.
- **Native-first relative to the active host**, unless config or session override names another station.
- **Config is external.** Repo ships schema + resolver + example. Live entitlements never land in SSVE.
- **Override is explicit.** Session/work override only when requested. Receipt: overlay sha, session id, WI, roles affected, expiry.
- **Iteration and feedback are config.** `max_invocations`, `feedback_sink`, `on_sink_reject` live in the file; session may tighten or (if requested) retarget escalate-to.
- **Land and WI-399 stay.** Production still needs whatever independents the *effective* policy marks required. S-sized inline. No nested spawns. Deny-list cannot be bypassed by `svc-default`.

## Preference order (effective policy after layers 1–3)

Per role: native same-host → configured independents with remaining budget → `escalate_to` on sink reject → requested session exception.

## Conditions the config may name (generic)

`detected_host`, `session_family`, `role`, `work_class` (e.g. `ui` / `design-ux` / `design-ui` / headless), `entitlement.*` (boolean or `from`/`until` **in the file**), `deny` / `allow` **per role**, `fallback_only` / `explicit_request_only`, `max_invocations`, `feedback_sink`, `on_sink_reject`, `station_unavailable` / `capacity`, `dual_paid_split`, `wi_size`, `execution_begun`, `chain_policy`, `nested_spawn`, `session_override_requested`.

## Example global file (illustrative)

```json
{
  "schema_version": 3,
  "authority": "repository-owner",
  "default_mode": "mixed-grok-cursor",
  "entitlements": {
    "grok_superheavy": true,
    "claude_paid": false,
    "codex": false
  },
  "deny": {
    "*": ["claude-sonnet-5"],
    "implementor": ["claude-opus-5"],
    "review.plan": ["claude-opus-5"],
    "review.exec": ["claude-opus-5"]
  },
  "allow": {
    "review.design": ["claude-opus-5"]
  },
  "fallback": {
    "id": "agy-gemini-3.7-high",
    "host": "agy",
    "model": "Gemini 3.7 Flash (High)",
    "effort": "high",
    "use_when": ["preferred_independents_unavailable"],
    "or_when": ["explicit_request_any_host", "explicit_request_on_agy"]
  },
  "modes": {
    "mixed-grok-cursor": {
      "plan": { "native": "grok-build" },
      "self_review": { "native": "grok-build" },
      "implementor": { "native": "grok-build", "allow": ["composer-2.5", "claude-opus-4-6"] },
      "review.design": {
        "when": { "work_class": ["ui", "design-ux", "design-ui"] },
        "stations": [
          { "id": "opus-5-design", "host": "cursor", "model": "claude-opus-5", "purpose": "critique-improve", "authority": "advisory" }
        ],
        "feedback_sink": "grok-self",
        "may_not": ["implement", "land"]
      },
      "review.plan": {
        "stations": [
          { "id": "grok-self", "kind": "native", "required": true },
          { "id": "fable", "host": "cursor", "model": "claude-fable-5", "max_invocations": 1, "round_trip": false },
          { "id": "sol-high", "host": "cursor", "model": "gpt-5.6-sol", "effort": "high" }
        ],
        "feedback_sink": "grok-self",
        "on_sink_reject": { "escalate_to": "sol-high", "forbid_return_to": ["fable"] }
      },
      "review.exec": {
        "stations": [
          { "id": "grok-self", "kind": "native", "required": true },
          { "id": "fable", "host": "cursor", "model": "claude-fable-5", "max_invocations": 1, "round_trip": false },
          { "id": "sol-high", "host": "cursor", "model": "gpt-5.6-sol", "effort": "high" }
        ],
        "feedback_sink": "grok-self",
        "on_sink_reject": { "escalate_to": "sol-high", "forbid_return_to": ["fable"] }
      }
    }
  }
}
```

Owner later sets `"codex": true` or `"codex": { "from": "<iso>" }` in **this file**. Session: `SVC_DISPATCH_OVERRIDE='{"implementor":{"native":"cursor","model":"composer-2.5"}}'` or a spoken “this session use Sol only” that is receipted. Neither requires a framework commit.

## Acceptance criteria

- **AC-01 — Single resolver** for every review and every subagent. Reads global file at `now`, then work overlay, then session override if requested.
- **AC-02 — Point-in-time config.** Changing the owner file changes the next invoke. No SSVE edit. Fixtures: file says `codex: false` → Sol skipped; file says `codex: true` → Sol allowed. Dates in the file are optional data, not ACs about 20 Aug.
- **AC-03 — Session override only when requested.** Without a request, session env/host must not change the global result. With an explicit request, effective topology matches the override, is receipted (session id, expiry, sha), and clears when the session ends or the owner clears it.
- **AC-04 — Work overlay.** A WI-attached overlay applies only to that WI. Another WI in another session still sees the global file.
- **AC-05 — Deny is per-role, fail-closed.** Fixture: `claude-opus-5` for `implementor` / `review.exec` / `review.plan` refuses. Same model for `review.design` on a UI/design work class is allowed, advisory only (issues + improvements), must not implement or count as land authority. `claude-sonnet-5` refuses on every role in this snapshot. `svc-default` Sonnet 5 cannot leak through.
- **AC-05b — Gemini 3.7 High is fallback or explicit ask.** Default resolve does not pick Gemini while Fable/Sol (or other preferred extras) are available. It may run if those stations are unavailable (classified, receipted) **or** the owner explicitly asked this session/work — from any host (schedule Gemini/AGY) **or** from AGY itself. Both request paths are valid. Requiring AGY CLI as the only ask path is a failing fixture. Spawning Gemini because reviewer-policy-v2 listed it as optional independent is a failing fixture.
- **AC-06 — Feedback + one-shot caps** come from the *effective* policy (global ⊕ work ⊕ session). Second Fable for same WI+role refused unless session override raises the cap (receipted).
- **AC-07 — Dual-paid split** is a config flag, evaluated now from entitlements in the file, not from a hardcoded vendor pair.
- **AC-08 — All consumers switched.** No Claude host rewrite. EXEC follows effective implementor, not Sonnet 5.
- **AC-09 — Land fence** uses the effective required independents. Native self-review alone is not production land.
- **AC-10 — Replay:** (1) global-only snapshot. (2) edit file, next resolve differs. (3) session override requested → differs, receipted. (4) no request → equals global. (5) WI overlay does not leak to another WI. (6) deny-list vs default profile. (7) missing global file → refuse, not Claude remap. (8) capacity miss → next allowed station from effective policy. (9) Opus 5 on `review.design` + UI work class allowed; same id on EXEC refused. (10) Gemini skipped while Fable/Sol available; Gemini allowed on preferred-unavailable, explicit ask from any host, or ask from AGY.

## Likely files

- Schema: global file, optional work overlay, session override envelope
- `scripts/resolve-dispatch.mjs`; `resolve-model.sh` / `review-topology-v2.mjs` become callers
- Host-neutral adapter (each vendor is a station)
- Skill + agent + subagent call sites
- Session-contract / env hook for “requested override”
- Tier-1 for AC-10; example JSON shipped, live entitlements never shipped

No SessionStart / Grok wirer changes in this WI.

## Route

**Lane:** framework  
**Sequence:** `write-spec` → `design-tech` → `plan-changeset` → `review-plan` → `execute-changeset` → `review-gate` → `review-exec` → `audit-implementation` → `land-changeset` → `verify-promotion`

Not a quick-fix.

## Rollback

Revert resolver + call sites. Keep WI-488 launcher as one station implementation. Keep WI-399 spawn limits.

## FRAMEWORK-STATE.md Mutations

Pending implementation. After land: point-in-time owner dispatch + session override; Known Gaps → Fixed for “review/subagent routing is hardcoded Claude/Codex.”

## WI-542 while this is unimplemented

The Claude/Codex launcher still cannot be pretended. Hand-running the current mix is the owner’s snapshot; it is not a v3 note until this resolver exists or a retro-plan override is issued.
