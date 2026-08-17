# Implementation Plan — WI-542 / WI-543 Grok SessionStart hooks

**Spec Reference:** [docs/specs/bugfix/wi-542-grok-sessionstart-healthcheck-brief.md](../../specs/bugfix/wi-542-grok-sessionstart-healthcheck-brief.md)
**WIs:** [WI-542](../../specs/work-items/WI-542.md), [WI-543](../../specs/work-items/WI-543.md)
**Branch Name:** `bugfix-wi-542-grok-sessionstart-healthcheck`
**Status:** SIMULATED
**Base Branch:** `main`
**Base SHA:** `8c79c243f185678936a661357197da8439b36d9b`
**Created At:** 2026-08-17T04:50:00Z
**Revised At:** 2026-08-17T08:56:00Z
**Lane:** bugfix
**Execution mode:** `inline` (orchestrator executes with this diagnosis loaded; §3a blueprints skipped)
**Archetype:** incremental extension of `svc-session-start-healthcheck` plus a **gated** Grok-wirer schema follow-up
**Review:** F1–F8 plus residual F9–F10 ACCEPTED in review-log.yaml; this revision applies them

---

## Host-compatibility self-review (gate for this plan)

Reviewed before promoting this draft to a complete plan-changeset. Findings that would break non-Grok hosts were removed from the execution graph.

| Host | Config | How healthcheck sees it | Verdict after this plan |
|---|---|---|---|
| Claude | JSON settings under the home .claude dir, absolute node /home/.../foo.mjs, default command timeout 600s | JSON branch: token starts with slash and ends in mjs/js/sh | **Safe.** Parser still checks absolute script tokens. Relative tokens and dollar-brace VAR stay ignored. Do **not** stamp timeout 30 (would kill real setup, budget 240s). |
| Codex | JSON hooks file under the home .codex dir | JSON branch | **Safe.** Same tokenize rules. Codex SessionStart JSON-on-stdout empty-object path is untouched. |
| Cursor | JSON hooks file under the home .cursor dir, quoted absolute node + absolute script | JSON branch | **Safe.** |
| Gemini | JSON settings under the home .gemini dir | JSON branch | **Safe.** |
| Kimi | TOML hooks tables, portable tilde skills/hooks paths | TOML fallback (today false-positives) | **Improved.** Same tilde expand that fixes Grok. Kimi wirer is **verify-only**, not rewritten. |
| Grok | TOML config under the home .grok dir plus Claude-compat JSON | TOML fallback today; Claude-compat is what the TUI ran | **Fixed** by task-1-parser. Native schema is task-3-grok-schema and **gated**. |
| OpenCode / MiMo / Antigravity | hooks capability false or plugin TS | `hooksSupported` false → `findMissingHookScripts` returns `[]` | **Safe.** No scan, no setup. |

**Dropped from the earlier draft (would break Claude):**

- Stamping `timeout: 30` on Claude SessionStart healthcheck. Claude default is 600s. Real self-heal runs `./setup` with an internal 240s budget.

**Dropped in this revision (review F7):**

- Optional `healEnforcementSource` already-ok short-circuit. It is not specified tightly enough to fail closed on WI-487 loss. Out of this changeset. Latency follow-up is filed only when a healthy replay is 1s <= t < 5s (checkpoint still passes). t >= 5s fails the checkpoint.

**Retained safety rules for the shared parser:**

1. Unify JSON and TOML on tokenize → strip quotes → expand only `~` / `~/` / `$HOME/` → `existsSync` only if the token is **absolute after expand** and ends in `.mjs`, `.js`, or `.sh`.
2. Do not resolve relative `hooks/foo.mjs` against cwd.
3. Do not treat `${VAR}/...mjs` or `%VAR%` as missing.
4. Do not treat the interpreter (`node`, `/.../bin/node`, `bash`) as a script.
5. Dangling-symlink detection and WI-134/WI-487 paths stay as they are (no short-circuit around `healEnforcementSource`).
6. `exit 0` stays. `SVC_SELF_HEAL_DISABLE` stays.
7. task-3-grok-schema may edit **only** `scripts/wire-grok-hooks.mjs`, `provision/hosts/grok.json`, Grok rows in `FRAMEWORK-STATE.md`, and the new Grok TOML roundtrip validator — never Kimi/Cursor/Claude/Codex/Gemini wirers.

---

## 1. Implementation Summary

Fix Grok SessionStart 1 going red by making `findMissingHookScripts()` understand the portable `~/...mjs` commands the Grok and Kimi wirers already write. A healthy Grok or Kimi install must be silent and must not invoke `./setup`. Then, only after a live `grok inspect --json` probe, emit the hook TOML schema this Grok build actually executes — with dual-schema parse/remove, backup, and restore-on-failure so a nested rewrite cannot duplicate hooks on revert.

### Invariants

- All repo mutation happens in a linked worktree created by `scripts/worktree.sh create`.
- SessionStart never blocks (`process.exit(0)`).
- Claude/Codex/Gemini/Cursor JSON installs that already use absolute script paths keep the same missing/present verdicts as today (except `~` tokens, which become real checks).
- Kimi portable `~` commands become true negatives, not false missing.
- Real missing absolute paths and real dangling skill symlinks still trigger self-heal.
- WI-487 `healEnforcementSource` still runs on the **first** SessionStart invoke in a session. A same-session second invoke (Claude-compat + Grok-native) is a stamp no-op.
- No host wirer except Grok is rewritten in this changeset.
- Claude-compat is not disabled.
- `./setup --host grok` is not the repair.

---

## 2. Files Planned

| File | Action | Task | Purpose |
|------|--------|------|---------|
| hooks/svc-session-start-healthcheck.mjs | MODIFY | task-1-parser | Tokenize + expand `~`/`$HOME`; no setup on false-positives; leave WI-487 probe intact; atomic wx same-session claim in a user-owned 0700 dir |
| test-framework/evals/tier-1/validate-session-start-self-heal.sh | MODIFY | task-2-tests | Isolated-HOME TOML `~` and `$HOME/` fixtures; parallel claim test; keep T1–T3 |
| test-framework/evals/tier-1/validate-session-start-healthcheck-multi-host.sh | MODIFY | task-2-tests | Grok + Kimi TOML `~` present-path cases |
| test-framework/evals/tier-1/validate-grok-hook-toml-roundtrip.sh | CREATE | task-3-grok-schema | Lossless user hooks, three-rewire identity, immutable backup + rollback, fail-closed read |
| scripts/wire-grok-hooks.mjs | MODIFY | task-3-grok-schema | Dual-schema parse/remove; lossless non-SVC keep; nested emit with standalone `command =`; immutable + rollback backups |
| provision/hosts/grok.json | MODIFY | task-3-grok-schema | Document live TOML shape + timeout |
| FRAMEWORK-STATE.md | MODIFY | task-3-grok-schema | Grok hook-format row matches live Grok only |
| docs/specs/contract-maps/wi-542-grok-sessionstart-hooks.md | CREATE | G5 evidence | System Contract Map |
| docs/specs/test-evidence/WI-542/old-new-path-probe.json | CREATE | G5 evidence | Old-path/new-path cross-system probe |
| docs/specs/test-evidence/WI-542/old-new-path-probe-run.json | CREATE | G5 evidence | Probe run bytes |
| docs/specs/test-evidence/WI-542/pre-post-evidence.json | CREATE | G5 evidence | Pre/post validation evidence |
| docs/specs/verification/wi-542-inspect-summary.md | CREATE | G5 evidence | Inspect before/after summary |
| docs/specs/verification/wi-542-grok-inspect-before.hooks.json | CREATE | G5 evidence | Tracked inspect extract (before) |
| docs/specs/verification/wi-542-grok-inspect-after.hooks.json | CREATE | G5 evidence | Tracked inspect extract (after) |
| docs/specs/bugfix/wi-542-grok-sessionstart-healthcheck-brief.md | CREATE | diagnose-bug | Bugfix brief |
| docs/specs/work-items/WI-542.md | CREATE | diagnose-bug | WI-542 |
| docs/specs/work-items/WI-543.md | CREATE | diagnose-bug | WI-543 |
| docs/specs/work-items/WI-544.md | CREATE | follow-up | Live Kimi `/tmp/fake` leftover — not cleaned here |
| docs/specs/work-items/INDEX.md | MODIFY | diagnose-bug | Index rows |
| docs/plans/2026-08-17-wi542-grok-sessionstart-hooks/manifest.md | CREATE | plan-changeset | Plan |
| docs/plans/2026-08-17-wi542-grok-sessionstart-hooks/review-log.yaml | CREATE | review-plan | F1–F10 dispositions |
| .svc/lane-tasks-WI-542.json | CREATE | route-workflow | Lane graph |
| .gitignore | MODIFY | G5 residue | Ignore local full inspect dumps |

`validate-hook-host-residuals`, `validate-cross-host-hook-conformance`, and `validate-governed-wirer-fail-fast` do **not** assert Grok TOML table headers. They are not in this file set unless a later inspect shows they started asserting shape.

---

## 3. Task Graph

### `task-1-parser` (Prerequisites: worktree exists)

* **Description:** In the worktree, replace the TOML regex fallback and tighten the JSON token loop in `findMissingHookScripts()` per the host-safe contract. Setup runs only when dangling symlinks or truly missing **expanded absolute** script paths remain. Do not add a healEnforcementSource short-circuit. Add an **atomic exclusive same-session claim** (AC-543-6 runtime half): if `GROK_SESSION_ID` (or a peer host session id) is set, `wx`-create `svc-sshc-<host>-<sid>` in a validated user-owned 0700 directory (`~/.svc/sshc` or `SVC_SSHC_DIR`) **before** the healthcheck path. EEXIST skips. No session id always runs. Shared `/tmp` stamps are forbidden. This is not a WI-487 skip: the first invoke in a session still runs `healEnforcementSource`.
* **Files:** hooks/svc-session-start-healthcheck.mjs
* **AC Coverage:** AC-542-1, AC-542-2 (pre-merge time bound), AC-542-3, AC-542-4, AC-543-6 (runtime stamp)
* **Validation:** See task-4-premerge-replay. Must include `SVC_HOST=grok` and `SVC_HOST=kimi`.
* **Checkpoint:** `checkpoint-1-parser`

### `task-2-tests` (Prerequisites: `task-1-parser`)

* **Description:** Extend the two existing SessionStart tier-1 scripts with hermetic HOME fixtures: TOML command `node ~/.fakehost/skills/hooks/foo.mjs` where the file exists → silent; same path absent → missing. Keep current dangling-symlink multi-host cases.
* **Files:** test-framework/evals/tier-1/validate-session-start-self-heal.sh, test-framework/evals/tier-1/validate-session-start-healthcheck-multi-host.sh
* **AC Coverage:** AC-542-6
* **Validation:** Run those two scripts from the **worktree** root; both exit 0.
* **Checkpoint:** `checkpoint-2-tests`

### `task-3-grok-schema` (Prerequisites: `task-2-tests`)

* **Description:** WI-543. Run the **exact probe** below. Then change `wire-grok-hooks.mjs` so `parseExistingToml` / serialize understand **both** flat `[[hooks]]` and nested `[[hooks.<Event>]]` (remove svc-owned entries of either shape, keep user hooks). Emit only the shape the probe proved Grok loads. Byte-backup the live config before any write. Two consecutive rewires of an isolated copy must be byte-identical. If live inspect after write does not show a Grok-home `source.path`, restore the backup and stop. Add the dedicated roundtrip validator. Do not edit other host wirers.
* **Files:** scripts/wire-grok-hooks.mjs, provision/hosts/grok.json, FRAMEWORK-STATE.md, test-framework/evals/tier-1/validate-grok-hook-toml-roundtrip.sh
* **AC Coverage:** AC-543-1 through AC-543-5, AC-543-6 (inspect half), AC-542-5
* **Validation:** Probe receipt + isolated two-rewire identity + live inspect Grok-home origin (or restore and fail the task). Inspect may show two healthcheck **registrations** (Claude-compat + Grok-native). Pass AC-543-6 inspect half when Grok-home-sourced healthcheck count == 1 and Claude-sourced healthcheck count <= 1. Do not require total count == 1.
* **Checkpoint:** `checkpoint-3-grok-schema`

### `task-4-premerge-replay` (Prerequisites: `task-1-parser`, `task-2-tests`)

* **Description:** Pre-merge proof only. Replay the **worktree** copy of the healthcheck against isolated HOME copies of the live Grok and Kimi configs (or the live files read-only) with `SVC_HOST` set. Do not start a fresh Grok chat to prove unmerged code.
* **Files:** none in-repo
* **AC Coverage:** AC-542-1..4 pre-merge
* **Validation:** Both commands print empty stderr, exit 0, no `self-heal` line. Timing: t < 1s pass; 1s <= t < 5s pass with a note and file a follow-up WI; t >= 5s fail (would still be red on Grok).
* **Checkpoint:** `checkpoint-4-premerge-replay`

### `task-5-verify-promotion` (after land; lane skill `verify-promotion`)

* **Description:** Post-merge only. Prove AC-542-7 with a new Grok session `updates.jsonl` healthcheck `success`. Prove AC-543-2 with `grok inspect --json` showing at least one loaded hook whose `source.path` is under the Grok home directory (not only `.claude`).
* **AC Coverage:** AC-542-7, AC-543-2
* **Checkpoint:** `checkpoint-5-postmerge`

---

## 4. AC-to-Task Mapping

| AC | Description | Task |
|----|-------------|------|
| AC-542-1 | tilde Grok hook path expands and counts present | task-1-parser, task-4-premerge-replay |
| AC-542-2 | Healthy Grok install: missing=[], silent, under 5s (target <1s) | task-1-parser, task-4-premerge-replay |
| AC-542-3 | No setup on unexpanded-tilde only | task-1-parser, task-4-premerge-replay |
| AC-542-4 | Same parser correct for Kimi tilde commands | task-1-parser, task-4-premerge-replay, task-2-tests |
| AC-542-5 | Grok-native healthcheck timeout >= 30; Claude SessionStart timeout unchanged | task-3-grok-schema |
| AC-542-6 | Tier-1 TOML tilde fixture | task-2-tests |
| AC-542-7 | Live Grok session_start healthcheck success | **verify-promotion only** (not pre-merge) |
| AC-543-1 | Wirer emits the schema inspect proves Grok loads | task-3-grok-schema |
| AC-543-2 | inspect shows a hook sourced from the Grok home config, not only Claude-compat | task-3-grok-schema (inspect after wire) and verify-promotion (confirm still true after land) |
| AC-543-3 | Grok-native healthcheck timeout >= 30 in the file Grok loads | task-3-grok-schema |
| AC-543-4 | FRAMEWORK-STATE + grok.json match live schema | task-3-grok-schema |
| AC-543-5 | New roundtrip validator covers dual schema; Kimi wirer unchanged | task-3-grok-schema |
| AC-543-6 | Exactly one Grok-home healthcheck registration; Claude-compat may add one more; runtime second invoke is a stamp no-op | task-1-parser (stamp), task-3-grok-schema (inspect counts) |

AC-542-5 is already the revised text on WI-542.md. This plan does not change it again.

**AC-543-2 is not waived** if the probe shows flat tables already execute. That result means "do not rewrite the table header." It still requires inspect to list a Grok-home-sourced hook. If inspect still shows only `.claude` sources after a successful wire, the task fails.

**AC-543-6 is not "total healthcheck registrations == 1".** After native wire, two registrations are expected and allowed: Claude-compat (`.claude`) plus Grok-native (`.grok`). The inspect half fails only if Grok-home healthchecks != 1 or Claude healthchecks > 1. The runtime half is the session stamp in task-1-parser.

---

## 5. AC-to-Test Mapping

| AC | Test type | Execution |
|----|-----------|-----------|
| AC-542-1 | Unit/fixture + replay | Isolated TOML with tilde path present; SVC_HOST=grok replay |
| AC-542-2 | Timed hook | SVC_HOST=grok replay of worktree hook |
| AC-542-3 | Fixture | Present tilde paths must not print `self-heal` |
| AC-542-4 | Fixture + replay | SVC_HOST=kimi plus Kimi-shaped TOML in isolated HOME |
| AC-542-5 | Static | Grok wirer/config grep timeout; Claude SessionStart healthcheck has no new timeout field |
| AC-542-6 | Tier-1 | validate-session-start-self-heal.sh + multi-host script |
| AC-542-7 | Live session | verify-promotion: updates.jsonl |
| AC-543-1 | Probe | grok inspect --json before/after |
| AC-543-2 | Probe | inspect hook source.path under Grok home |
| AC-543-3 | Static + inspect | timeout field on the Grok-sourced healthcheck |
| AC-543-4 | Static | FRAMEWORK-STATE + grok.json |
| AC-543-5 | Tier-1 | validate-grok-hook-toml-roundtrip.sh |
| AC-543-6 | Probe + stamp | inspect: grok-home healthcheck == 1, claude healthcheck <= 1; second invoke with same GROK_SESSION_ID exits immediately |

No product E2E. write-e2e is skipped on the lane graph with that reason.

---

## Prerequisite Alignment Matrix

| Prerequisite | State | Trace |
|---|---|---|
| UX design | N/A | No product screen. Persona is the framework operator running Grok, not a product persona. |
| UI design | N/A | TUI hook color is host chrome; we restore silent-healthy, we do not restyle it. |
| Tech design | Diagnose-bug brief | Host-safe parser contract + gated wirer probe. design-tech skipped on the lane graph. |
| Style contract | Unchanged | Match existing ESM, `spawnSync`, no new deps. |
| Persona | framework-operator | Session start must not show a red observe-hook on a healthy install. |

---

## 6. Validation Plan

1. Parser fixture: Grok TOML tilde present / missing / absolute missing / `${VAR}` ignored / relative ignored / Claude JSON absolute still works.
2. `bash test-framework/evals/tier-1/validate-session-start-self-heal.sh`
3. `bash test-framework/evals/tier-1/validate-session-start-healthcheck-multi-host.sh`
4. Time healthcheck with **SVC_HOST=grok** and **SVC_HOST=kimi** against isolated HOME copies.
5. Confirm Claude SessionStart healthcheck still has no `timeout` key after the changeset.
6. WI-543 `grok inspect --json` probe before any live Grok config write.
7. Isolated two-rewire byte identity + backup restore drill.
8. Post-merge: new session `updates.jsonl` + inspect Grok-home origin.

---

## Grok schema probe (exact)

Baseline captured 2026-08-17 on this machine (read-only):

```
session_start count = 5
all vendor=claude
all source.path = /home/dianast/.claude
source paths across every hook = .claude and two claude plugin caches
zero source.path under /home/dianast/.grok
healthcheck timeout = null
```

**Command (read-only, no config write):**

```bash
grok inspect --json > "$WT/.svc/wi-543-inspect-before.json"
python3 - "$WT/.svc/wi-543-inspect-before.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
rows=[{
  "vendor": h.get("vendor"),
  "path": (h.get("source") or {}).get("path"),
  "timeout": h.get("timeout"),
  "target": h.get("target"),
} for h in d.get("hooks",[]) if h.get("event")=="session_start"]
print("session_start", len(rows))
for r in rows:
    print(r)
grok_native=[r for r in rows if r["path"] and ".grok" in r["path"]]
print("grok_native_session_start", len(grok_native))
PY
```

**How to decide:**

| inspect result | Meaning | Action |
|---|---|---|
| `grok_native_session_start == 0` (baseline today) | Flat `[[hooks]]` in user Grok config are **not** loaded | Wirer must emit the nested `[[hooks.<Event>]]` form Grok documents, after dual-schema parse exists |
| `grok_native_session_start >= 1` | Flat tables already execute | Do **not** change table headers. Still must set timeout >= 30 on that Grok-sourced healthcheck and still must satisfy AC-543-2 (this row is the proof, not a waiver) |

`grok inspect --help` is **not** a probe.

**Live config mutation procedure (only after isolated roundtrip passes):**

1. `cp -a "$HOME/.grok/config.toml" "$HOME/.grok/config.toml.wi543.bak"`
2. Record `sha256sum` of the backup.
3. Run worktree `wire-grok-hooks.mjs --config "$HOME/.grok/config.toml"`.
4. Re-run inspect to `$WT/.svc/wi-543-inspect-after.json`.
5. Pass only if a session_start (or at least one wired event) hook has `source.path` containing `/.grok`.
6. Run the wirer a second time. `sha256sum` of config.toml must match the file from step 3.
7. On any failure: `cp -a "$HOME/.grok/config.toml.wi543.bak" "$HOME/.grok/config.toml"` and confirm inspect matches `wi-543-inspect-before.json`.

**Wirer contract before the first live write:**

- Parse and remove svc-owned hooks from both `[[hooks]]` and `[[hooks.<Event>]]`.
- Keep hooks whose command contains neither `svc-` nor `/skills/hooks/`.
- Isolated fixture must include one user hook plus both schema styles; two rewires produce identical bytes; a simulated failure path restores the fixture backup.

---

## Execution Command Sequence

```bash
cd /home/dianast/app-workspaces/seriousvibecoding
scripts/worktree.sh create bugfix-wi-542-grok-sessionstart-healthcheck --from main --wi WI-542
WT="/home/dianast/app-workspaces/seriousvibecoding/.worktrees/bugfix-wi-542-grok-sessionstart-healthcheck"
cd "$WT"

# After task-1-parser — explicit hosts, never a bare node invocation
node --check hooks/svc-session-start-healthcheck.mjs
SVC_HOST=grok /usr/bin/time -f 'elapsed=%e exit=%x' node hooks/svc-session-start-healthcheck.mjs </dev/null
SVC_HOST=kimi /usr/bin/time -f 'elapsed=%e exit=%x' node hooks/svc-session-start-healthcheck.mjs </dev/null

# After task-2-tests
bash test-framework/evals/tier-1/validate-session-start-self-heal.sh
bash test-framework/evals/tier-1/validate-session-start-healthcheck-multi-host.sh

# Before any live Grok config write
grok inspect --json > .svc/wi-543-inspect-before.json

# After task-3 isolated roundtrip
bash test-framework/evals/tier-1/validate-grok-hook-toml-roundtrip.sh
```

RECOVERY_IF_FAIL:

- Parser regresses Claude JSON: restore the absolute-only JSON rule and add tilde expansion as an extra branch, not a replacement.
- Multi-host dangling test fails: parser must not change `findDanglingSymlinks`.
- Replay still prints `self-heal` with SVC_HOST=grok: the parser is not done; do not touch the wirer.
- Isolated two-rewire bytes differ: do not write the live Grok config.
- Live inspect after wire has zero Grok-home sources: restore `config.toml.wi543.bak` immediately.

---

## 8. Checkpoint Plan

| Checkpoint | After | Pass means |
|---|---|---|
| checkpoint-1-parser | task-1-parser | SVC_HOST=grok and SVC_HOST=kimi replays: 0 missing; no setup; exit 0 |
| checkpoint-2-tests | task-2-tests | Two named SessionStart tier-1 scripts exit 0 |
| checkpoint-3-grok-schema | task-3-grok-schema | Probe JSON saved; dual-schema wirer; isolated two-rewire identity; inspect Grok-home origin or backup restored |
| checkpoint-4-premerge-replay | task-4-premerge-replay | Silent, both hosts, t < 5s. If 1s <= t < 5s: pass with note + follow-up WI |
| checkpoint-5-postmerge | verify-promotion | New session healthcheck success + inspect still shows Grok-home origin |

Loop-backs: if the parser cannot distinguish `${VAR}` from a path without false negatives, stop and amend the brief. If inspect after a careful nested wire still shows only `.claude` sources, restore backup and leave WI-543 open — do not invent a third schema.

---

## 9. Promotion Readiness Checklist

- [ ] Worktree used for every repo mutation (`scripts/worktree.sh create`)
- [ ] AC-542-1..4 and AC-542-6 green on fixtures/tier-1 + SVC_HOST replays
- [ ] AC-542-5 (Claude timeout untouched; Grok-native timeout >= 30)
- [ ] AC-542-7 deferred to verify-promotion (not claimed pre-merge)
- [ ] AC-543-2 proven by inspect Grok-home source.path, not waived
- [ ] `git -C "$WT" diff -- scripts/wire-kimi-hooks.mjs scripts/wire-hooks.mjs scripts/wire-cursor-hooks.mjs` empty
- [ ] Live Grok config backup exists before any write; restore path rehearsed
- [ ] No ORM/schema files (N/A)
- [ ] No Base44 entities (N/A — framework host hooks)

---

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | Host filesystem outside repo | Grok/Kimi skills hook scripts must exist for tilde expansion to count present | coupled | healthcheck existsSync after expand; setup still repairs real holes |
| 2 | Host config files | Reads Grok and Kimi TOML plus Claude/Codex/Gemini/Cursor JSON via resolveHostPaths. task-3 may rewrite live Grok config | coupled | Immutable `config.toml.pre-migration.bak` created once; per-attempt `config.toml.svc-wire.rollback`; fail-closed config reads; restore-on-failure; inspect before/after. Live `.wi543.bak` was already overwritten (same hash as current nested config) and is **not** the original flat pre-migration backup |
| 12 | Downstream framework artifacts | FRAMEWORK-STATE Grok hook-format row; grok host manifest; new roundtrip validator | coupled | task-3 updates those with the probe result |
| 15 | Runtime logs + inspect JSON | Grok updates.jsonl and grok inspect --json | decoupled-justified | Inspect JSON is saved under the worktree `.svc/` as the probe receipt. Fresh-session updates.jsonl is verify-promotion evidence, not a git file |

Untouched environments (walked the taxonomy, found nothing): 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14.

Decoupled-justified (15): Grok session logs are host-owned. Pre-merge we do not treat a new session as proof of unmerged code. Post-merge recovery if still red: re-read the newest updates.jsonl; if timeout, measure SVC_HOST=grok replay again.

---

## Simulation Report

Walked disk vs planned against current `main` @ `8c79c243`.

| Check | Layer | Result |
|---|---|---|
| hooks/svc-session-start-healthcheck.mjs exists; findMissingHookScripts at lines 54–90 | disk | PASS |
| JSON branch already tokenizes (line 69–71); TOML fallback is the regex at 83 | disk | PASS |
| wire-grok-hooks.mjs toPortablePath writes tilde | disk | PASS |
| parseExistingToml only matches a line that is exactly [[hooks]] (lines 189–190) | disk | PASS — F2 confirmed |
| wire-kimi-hooks.mjs same toPortablePath | disk | PASS |
| wire-hooks.mjs SessionStart healthcheck has no timeout field (lines 394–399) | disk | PASS |
| Claude default timeout 600s in provision/hosts/claude.json | disk | PASS |
| grok inspect --json lists hooks with source.path | live | PASS — 5 session_start, all .claude |
| Named WI-543 validators do not assert TOML headers | disk | PASS — F6 confirmed |
| scripts/worktree.sh create exists | disk | PASS |
| No new production modules beyond the listed validator CREATE | planned | PASS |

Journey Scenario Walkthrough: no product journey. Operator "start Grok on a healthy install" maps to task-1-parser + task-4-premerge-replay; fresh TUI color maps to verify-promotion.

Assumptions (scoped to this repo + this user's host configs):

- Scope: this checkout and this HOME. Claim: 11 false-positives are `/.grok/skills/hooks/*.mjs` from tilde slicing. Probe: Python regex replay on 2026-08-17.
- Scope: this Grok build. Claim: config.toml hooks are not loaded. Probe: `grok inspect --json` 2026-08-17, zero `.grok` source.path.
- Scope: this plan. No unprobed "no PR / no deploy" sentence.

No unresolved FAIL.

---

## Lane-model validation

Mandatory bugfix chain remains:

`plan-changeset → review-plan → execute-changeset → review-gate → review-exec → audit-implementation → land-changeset → verify-promotion`

Recorded in `.svc/lane-tasks-WI-542.json`.

---

## New-lane necessity

None. Fits existing bugfix lane.

---

## Next

Plan revised for F1–F8. Mechanical re-check required after this edit. Then `review-plan` can re-read this file; execute starts with `scripts/worktree.sh create` and `task-1-parser`.
