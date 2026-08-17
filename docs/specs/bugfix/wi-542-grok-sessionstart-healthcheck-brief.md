# Bugfix brief — WI-542 / WI-543: Grok SessionStart 1 red

**Skill:** diagnose-bug | **WI:** WI-542 (parent), WI-543 (wirer schema) | **Lane:** bugfix | **Severity:** high
**Date:** 2026-08-17 | **Host:** Grok Build CLI | **Workspace:** `/home/dianast`
**Verdict:** both defects CONFIRMED by live session logs + hook replay. Scope is wider than the red icon.

---

## Domain classification (diagnose-bug 0.3)

| Domain | Verdict |
|---|---|
| **Code** | **Yes — primary.** Parser bug in `findMissingHookScripts()` and a host-wiring schema mismatch. |
| Test-logic | No. The TUI red status matches a real timeout. |
| Test-fixture | Partial enabler: tier-1 self-heal tests use isolated HOME + empty Claude JSON, so they never see `~` TOML. |
| Platform | Partial: Grok default observe-hook timeout is 5s; Claude-compat loads `~/.claude/settings.json` hooks. Those are real platform facts the code must honor, not the root defect. |

---

## Spec / journey anchor

No product journey covers Grok TUI hook chrome. The contract that broke is framework-internal:

- **WI-124 AC1:** `svc-session-start-healthcheck.mjs` exits 0 **silently** when state is healthy.
- **WI-124 AC:** SessionStart self-heal never blocks the session.
- **WI-116 / hook-coverage-spec:** SessionStart healthcheck is a soft warn, not a gate.
- **`provision/hosts/grok.json`:** `timeout_default: 30`.
- **Grok user-guide `10-hooks.md`:** observe hooks default to 5s; failures (timeouts) are fail-open and recorded in the TUI as failed (red).

**Persona:** the builder running Grok. They start a session. Expected: healthcheck silent or a short stderr warn. Actual: SessionStart 1 red, setup re-run every session, 5s stall at start.

**Classification:** code defect against WI-124 (healthy state is not silent/fast) plus a spec-drift on Grok hook TOML (`FRAMEWORK-STATE.md` vs live Grok docs).

---

## Reproduction

```
Trigger:  Start any Grok session (this host, this install).
Expected: SessionStart hooks succeed. Healthcheck is silent. No setup.
Actual:   SessionStart 1 is red. Log: timed out after 5000ms.
```

**Causal class:** **Action bug** in the healthcheck (it does the wrong work), which then becomes a **platform-timeout** symptom in the TUI.

### Live proof

`~/.grok/sessions/%2Fhome%2Fdianast/01a00df9-39ab-7ca1-b4fa-711b8635b0aa/updates.jsonl` line 1:

```json
"name":"global/settings:session_start[1].hooks[0]",
"status":{"status":"failed","error":"timed out after 5000ms","elapsed_ms":5019}
```

Same `[1]` timeout on sessions `01a00df0` and `01a00de5`.

Hook identity (`~/.claude/settings.json` SessionStart[1]):

```
node /home/dianast/.claude/skills/hooks/svc-session-start-healthcheck.mjs
```

No `timeout` field → Grok default 5s.

### Replay proof

```bash
/usr/bin/time node ~/.grok/skills/hooks/svc-session-start-healthcheck.mjs </dev/null
```

```
[svc-session-start:grok] self-heal: detected 11 issue(s) (0 dangling, 11 missing hook script(s)), re-running setup
[svc-session-start:grok] self-heal: 11 issue(s) still present after setup (exit=0).
elapsed=14.41 exit=0
```

Python reconstruction of the TOML fallback regex against live `~/.grok/config.toml`:

```
count=11
 exists=False  /.grok/skills/hooks/svc-worktree-isolation-guard.mjs
 exists=False  /.grok/skills/hooks/svc-workflow-guard.mjs   (×3)
 exists=False  /.grok/skills/hooks/svc-skill-artifact-authenticity.mjs
 exists=False  /.grok/skills/hooks/svc-session-contract-freshness.mjs
 exists=False  /.grok/skills/hooks/svc-inertia-check.mjs
 exists=False  /.grok/skills/hooks/svc-lane-tasks-validator.mjs
 exists=False  /.grok/skills/hooks/svc-session-start-healthcheck.mjs
 exists=False  /.grok/skills/hooks/svc-prompt-stale-state.mjs
 exists=False  /.grok/skills/hooks/svc-session-end-log.mjs
```

Zero dangling skill symlinks. The 11 real files exist under `~/.grok/skills/hooks/`.

---

## Expected behavior

From WI-124 AC1, copied as the contract:

> `hooks/svc-session-start-healthcheck.mjs` exits 0 silently when state is healthy.

A Grok install whose `config.toml` commands point at existing scripts via
`~/.grok/skills/hooks/*.mjs` **is healthy**. SessionStart 1 must be green.
Setup must not run.

---

## Root cause

### Immediate cause

`findMissingHookScripts()` in `hooks/svc-session-start-healthcheck.mjs`
parses JSON first. `~/.grok/config.toml` is not JSON, so it falls through
to:

```js
for (const match of raw.matchAll(/\/[^\s"'`]+?\.(?:mjs|js|sh)\b/g)) {
  if (!existsSync(match[0])) missing.push(...)
}
```

`wire-grok-hooks.mjs` `toPortablePath()` writes:

```toml
command = "/abs/node ~/.grok/skills/hooks/svc-worktree-isolation-guard.mjs"
```

The regex starts at the `/` after `~`, so it checks `/.grok/skills/hooks/....mjs`.

### Enabling condition

- Grok Claude-compat is on by default → the Claude SessionStart healthcheck
  (no timeout) is what the TUI runs as SessionStart 1.
- That Claude-copied script still `detect-host`s **grok** (we are in Grok),
  then scans `~/.grok/config.toml`.
- `healEnforcementSource()` plus `runSetup()` (14s) exceed Grok's 5s default.

### Why the system allowed it

- WI-124 added absolute-path scanning for Claude JSON. The TOML fallback
  was a later host-aware addition (WI-186) and never tokenized/`~`-expanded.
- `toPortablePath()` is intentional (portable across machines). The checker
  never learned the same convention.
- Tier-1 `validate-session-start-self-heal.sh` uses isolated HOME +
  `{"hooks":{}}` JSON. It cannot see this class.
- `./setup --host grok` was already run (receipt
  `~/.svc/install-state/grok.json`). Re-running it cannot rewrite a
  parser hallucination, so the loop is stable.

### Causal chain

```yaml
symptom: "Grok TUI SessionStart 1 is red on every session"
proximate_cause: "healthcheck timed out after 5000ms while re-running setup"
root_cause: "TOML path regex treats ~/.grok/skills/hooks/foo.mjs as /.grok/skills/hooks/foo.mjs"
systemic_cause: "portable ~ paths and a slash-seeking existence check never shared a contract; Claude-compat + 5s default made the lie visible as a red hook"
prevention: "tokenize + expand ~/$HOME before existsSync; never self-heal on unexpanded ~; fixture the TOML ~ case in tier-1; stamp timeout:30 on SessionStart healthcheck; write the hook schema Grok actually executes"
```

---

## Defects in this diagnosis (all confirmed)

| ID | Defect | Severity | WI |
|---|---|---|---|
| A | `findMissingHookScripts` TOML regex false-positives `~/...mjs` as `/.…mjs` | HIGH | WI-542 |
| B | False-positive list always triggers `runSetup` (6–14s); setup cannot repair it | HIGH | WI-542 |
| C | Claude SessionStart healthcheck has no `timeout`; Grok default 5s < setup time | HIGH | WI-542 |
| D | Same `toPortablePath()` + same parser against `~/.kimi/config.toml` | HIGH | WI-542 |
| E | Happy-path `healEnforcementSource` still spends a 5s-budget probe; must stay cheap once A is fixed | MEDIUM | WI-542 |
| F | `wire-grok-hooks.mjs` writes flat `[[hooks]]`/`event=` tables; live Grok sessions only execute `global/settings:*` (Claude compat). Official Grok docs use `[[hooks.<Event>]]` | HIGH | WI-543 |
| G | `FRAMEWORK-STATE.md` / `provision/hosts/grok.json` document the dead flat schema | MEDIUM | WI-543 |
| H | Grok-native PreToolUse/Stop guards in `config.toml` are not evidenced as running; Claude copies are | HIGH | WI-543 |
| I | After F is fixed, identical healthcheck must not run twice (Claude-compat + Grok-native) | MEDIUM | WI-543 |

Running `./setup --host grok` again is **not** a fix. Already proven: setup
exit 0, 11 "missing" remain.

---

## Pattern Scan

**Scope:**

- `findMissingHookScripts` / slash-seeking `*.mjs|js|sh` regex in `hooks/` and `scripts/`
- `toPortablePath` in `scripts/wire-*.mjs`
- `~/.*/skills/hooks/` commands in live host configs
- SessionStart hooks without `timeout` in Claude `settings.json`

**Findings:**

| Location | What |
|---|---|
| `hooks/svc-session-start-healthcheck.mjs:83` | The defective regex. Only production copy. |
| `scripts/wire-grok-hooks.mjs:42-47` | Writes `~` + `[[hooks]]` flat tables |
| `scripts/wire-kimi-hooks.mjs:54` | Same `toPortablePath`; Kimi's documented schema **is** flat `[[hooks]]` (correct for Kimi, still false-positive for the healthcheck) |
| `~/.kimi/config.toml` | 28 `~/.kimi/skills/hooks/...` commands |
| `~/.claude/settings.json` SessionStart healthcheck | no timeout |
| `scripts/wire-cursor-hooks.mjs` | quoted absolute node + absolute script (no `~` false-positive) |
| `test-framework/evals/tier-1/validate-session-start-self-heal.sh` | never feeds `~` TOML |
| `test-framework/evals/tier-1/validate-session-start-healthcheck-multi-host.sh` | does not cover this parser class |

**Followups:** WI-542 covers A–E + the missing fixture. WI-543 covers F–I.

---

## Register Discoveries

**Corrections found:** 2 independent programs

- **WI-542** — parser + timeout + no false self-heal + Kimi sibling + cheap happy path — Lane 4 bugfix — **HIGH**
- **WI-543** — write the hook schema Grok actually executes; prove native hooks fire; dedup healthcheck — Lane 4 bugfix — **HIGH**

**Routing:** WI-542 first (makes SessionStart 1 green while Claude-compat is still the runner). WI-543 second (needs a live Grok parse probe; contract change on `wire-grok-hooks.mjs`).

---

## Smallest safe fix

### WI-542 (do first)

1. Replace the TOML fallback in `findMissingHookScripts()` with tokenize → strip quotes → expand `~` and `$HOME` → `existsSync` only on `*.mjs`/`*.js`/`*.sh` tokens. Ignore the interpreter token.
2. Do not call `runSetup` unless at least one expanded path is still missing or a dangling symlink exists.
3. Do not stamp `timeout: 30` on Claude SessionStart (would kill real Claude setup). Grok-native timeout ≥ 30 only after the WI-543 probe. Happy path must fit Grok's 5s default.
4. Add a hermetic tier-1 case: TOML body with `command = "node ~/.fakehost/skills/hooks/foo.mjs"` and the file present under `$HOME/.fakehost/...` → `missing = []`, no setup, silent, under 5s (target <1s).

**Preserve:** never-block (`exit 0`); `SVC_SELF_HEAL_DISABLE`; dangling-symlink detection; real missing-absolute-path detection; WI-134 worktree rejection; WI-487 enforcement heal.

### WI-543 (do second)

1. Probe live Grok (`grok inspect` / hook reload / a one-line SessionStart) to confirm which TOML shape it executes.
2. Change `wire-grok-hooks.mjs` to that shape (expected: `[[hooks.<Event>]]` + inner handlers).
3. Update `FRAMEWORK-STATE.md` and `provision/hosts/grok.json`.
4. Dedup the healthcheck so Claude-compat + Grok-native do not both fire the same script.
5. Update cross-host hook validators that lock the flat table.

**Preserve:** governed Stop launcher path; matcher strings; existing PreToolUse/PostToolUse/SessionEnd set.

---

## Proof of fix

1. Unit/fixture: `findMissingHookScripts` on current `~/.grok/config.toml` and a copied `~/.kimi/config.toml` → 0 missing.
2. Time healthcheck on this machine → silent, exit 0, no `self-heal:` line, t < 5s (target <1s; 1–5s files a follow-up WI).
3. New tier-1 `~` TOML fixture green; existing self-heal T1–T3 green.
4. Next Grok session `updates.jsonl`: healthcheck `status=success`.
5. After WI-543: session_start (or pre_tool_use) includes a non-`global/settings` origin for a wired Grok hook.

---

## Pillar Revisit Audit

| # | Pillar | Affected? | Evidence / follow-up |
|---|---|---|---|
| 1 | Product fit | no | SessionStart healthcheck remains a valid install-resilience capability (WI-124). No kill signal. |
| 2 | Journey | no | No product journey. Operator start-session is framework chrome. Opened J-FW-* index; none describe TUI hook color. |
| 3 | Acceptance criteria | yes | WI-124 AC1 is the AC that should have caught this. Adding AC-542-* and AC-543-* on the new WIs. No product feature-spec AC. |
| 4 | UX | no | No product UI. TUI hook color is host chrome; we restore the intended silent-healthy state, we do not redesign it. |
| 5 | UI | no | No visual/token/layout change in any product surface. |
| 6 | Tech architecture | yes | WI-543 changes the Grok hook TOML contract `wire-grok-hooks.mjs` emits. Bundled as WI-543, not silently folded into the parser patch. |
| 7 | Cost model | no | Fewer SessionStart setup invocations. No paid API. |
| 8 | Operations & ownership | yes | Session-start noise and a red hook on every Grok launch. Fix is the runbook: healthy = silent. No new pager/SLA. |

### Pillars Coverage Matrix (close-out target)

| # | Pillar | State |
|---|---|---|
| 1 | Product fit | `[UNCHANGED — VERIFIED]` — WI-124 capability still valid |
| 2 | Journey | `[N/A — justified: framework host-hook chrome, no product journey]` |
| 3 | Acceptance criteria | `[UPDATED]` — AC-542-* / AC-543-* on the new WIs |
| 4 | UX | `[N/A — justified: no product user surface]` |
| 5 | UI | `[N/A — justified: no product visual surface]` |
| 6 | Tech architecture | `[UPDATED]` — WI-543 Grok hook schema |
| 7 | Cost model | `[UNCHANGED — VERIFIED]` — no paid path |
| 8 | Operations & ownership | `[UPDATED]` — SessionStart healthy-path contract restated in WI-542 |

---

## Affected artifacts

- WIs: WI-542 (new), WI-543 (new), INDEX.md
- Brief: this file
- Plan: `docs/plans/2026-08-17-wi542-grok-sessionstart-hooks/manifest.md`
- Code (not yet changed): healthcheck, grok/kimi/claude wirers, tier-1 self-heal, FRAMEWORK-STATE, grok host manifest
- Journeys / product e2e: none
- Feedback memory / rule: see Learnings

---

## Learnings

A host-config existence check must use the **same path convention the wirer writes**. If the wirer emits `~/...`, the checker must expand `~` (or the wirer must write only paths `existsSync` understands). A slash-seeking regex over a mixed `node ~/.path/file.mjs` string will invent `/.path/file.mjs`.

Tier-1 that isolates HOME and writes empty JSON will not catch TOML/`~` host configs. Any new host wirer that introduces a path convention needs a fixture in the healthcheck validator.

Grok's default observe-hook timeout is 5s. Any SessionStart hook Grok may load via Claude-compat needs an explicit timeout, even if the Grok-native copy already has one.

---

## Out of scope

- Disabling `[compat.claude] hooks` (would drop learning-preload / zombie-sweep / briefing / delta-preload, which the Grok wirer does not install).
- Re-running setup as the repair.
- WI-138 Strategy 3 hardening (still backlog; different edge).
- Changing Grok TUI timeout defaults upstream.

**Next:** implement `docs/plans/2026-08-17-wi542-grok-sessionstart-hooks/manifest.md` T1–T3 (WI-542), then T4–T5 (WI-543).
