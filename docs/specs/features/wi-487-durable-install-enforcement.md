---
status: BASELINED
type: Enabler
mode: contract-change
wi: WI-487
landscape_state: inapplicable
landscape_inapplicable_reason: internal framework install-integrity and host-denial-diagnostic contract with no customer-facing market flow
created: 2026-07-17
---

# Feature: Durable installed enforcement source

**Status:** BASELINED
**Type:** Enabler
**Consumers:** framework `setup`/upgrade, install-drift check, session-start healthcheck, Claude/Codex mutation + Stop guards, all-host first-run migration, operators on stderr-swallowing hosts
**Priority:** critical
**Source:** accepted owner contract, `docs/specs/work-items/WI-487.md`, `proposals/2026-07-15-framework-improvement-durable-install-source.md`

## Delta contract

**Invariant behavior preserved:** legitimate `.worktrees/` development still installs against the canonical main checkout (never a worktree path); `setup` and self-heal stay idempotent and never touch unrelated user host configuration; WI-485 exact-skill enforcement and WI-486 session-authority/bootstrap semantics are unchanged; the SessionStart healthcheck still never blocks a session.

**Behavior changed:** governed-mutation hooks now run THROUGH a durable, NON-symlinked per-user enforcement launcher (`~/.svc/enforcement/<migration_version>/bin/svc-enforce`, copied real bytes materialized by setup/migration) that lives OUTSIDE the source checkout it guards; the launcher validates the real enforcement source at run time and FAILS CLOSED — denying the governed mutation with an actionable diagnostic and a home-local receipt — even when the entire source checkout has been deleted. An installed enforcement source that is EPHEMERAL (resolves under `/tmp`, `$TMPDIR`, `/dev/shm`, `/var/tmp`, or a removed worktree) is refused or materialized to a durable canonical checkout BEFORE hooks/skills install; a dangling or non-executable installed enforcement command now produces a VISIBLE FAIL-CLOSED denial for governed mutations instead of silently allowing them; EVERY blocking hook (mechanically inventoried, not only the two mutation guards) emits an actionable denial (identity + reason code + operation + recovery), durable for stderr-swallowing hosts, and deduplicated by the exported `denialStateDigest` WITHOUT converting the denial into permission; the first run after upgrade inventories and migrates every host declared by `provision/hosts/`, bounded by a pinned N=3 retry ceiling, resumable, with a versioned rollback, aligning hooks, skills, install receipts, launcher, and legacy WI state in one pass. All home-local state (`~/.svc/...`) is resolved through ONE shared state-root resolver, and receipts are evidence only — never authorization.

**Explicit boundary:** legacy WI-state graph transformation is owned by WI-486 (`hooks/lib/task-state-compatibility.mjs` / `scripts/svc-migrate-task-state.mjs`); WI-487 INVOKES that compatibility contract and may never invent a second task-graph/WI-state migrator. Session-authority resolution, atomic worktree bootstrap, and task-state compatibility classification remain WI-486.

## Problem Statement

Framework `setup` can leave a host's hooks and skills symlinked to an EPHEMERAL source (e.g. a `/tmp/.../scratchpad/fw-wt/hooks` dir) that later disappears. When the enforcement executable becomes dangling, the host silently stops enforcing a previously-active safety guard — a fail-OPEN loss of a critical mutation guard whose lifetime depends on an unrelated temporary directory. Concurrently, blocking hook denials render as anonymous `PreToolUse hook (failed)` / `hook exited with code 1` with no hook identity, reason, affected operation, or recovery; the same opaque message repeats many times; and stderr-swallowing hosts show the operator nothing at all. On machines with older framework/work-item state, the first upgrade run loops instead of performing one bounded compatibility migration, and existing repairs only cover the active host rather than every configured host.

## Goals

- Define "durable canonical source" and refuse or materialize ephemeral install sources before installing enforcement.
- Convert loss-of-enforcement into a VISIBLE fail-closed denial for governed mutations — never a silent allow.
- Record ONE effective resolved source that hooks and skills share, and repair both atomically.
- Make every blocking hook denial actionable, durable on stderr-swallowing hosts, and deduplicated without weakening it.
- Migrate every configured host in one versioned, transactional, bounded, resumable, idempotent first run that preserves user work.
- Align legacy WI state through WI-486's compatibility contract, or terminate fail-closed with no retry loop.
- Give every first-run/PreToolUse/Stop path a hard retry ceiling so unchanged bad state cannot loop forever.

## Non-goals

- Re-implementing session-authority resolution, atomic worktree bootstrap, or task-state graph classification/migration (WI-486 owns these).
- Inventing a second WI-state/task-graph migrator (AC-487-11 delegates to WI-486).
- Weakening WI-485 exact-skill enforcement or any mutation-authority gate.
- Deduplicating arbitrary non-svc host hook error rendering unrelated to enforcement-source loss.
- Adding a new lane, review gate, external provider, or paid runtime dependency.
- Changing which hosts exist; hosts are read dynamically from `provision/hosts/*.json`.

## System flow

```text
setup / upgrade
  -> resolve requested symlink source
       -> classify source durability (realpath, ephemeral-prefix + worktree + existence check)
            -> durable canonical checkout: install hooks + skills, WRITE per-host install receipt (one effective source)
            -> ephemeral/worktree: repoint to canonical main (git-common-dir) OR refuse with actionable hard failure
       -> idempotent: re-run changes nothing; unrelated user host config preserved

governed mutation (PreToolUse / Stop)
  -> guard installed enforcement source integrity FIRST
       -> source durable + executable: proceed to WI-485/WI-486 authority gates
       -> source dangling / non-executable / ephemeral-vanished: FAIL-CLOSED deny
            -> emit actionable denial {hook id, reason code, cause, operation, recovery}
            -> stderr-swallowing host: ALSO write durable per-session denial receipt; short message carries reason code + lookup path
            -> dedup by session + state digest: first = actionable, repeat = suppressed OUTPUT, still DENY (never allow)
       -> retry ceiling reached: fail-closed terminal state (no PreToolUse/Stop loop)

first run after upgrade
  -> inventory EVERY host in provision/hosts/*.json (dynamic, not hard-coded)
  -> per host: backup config -> detect ephemeral/dangling install -> repoint to durable source -> verify -> receipt (before/after)
       -> transactional + resumable (interrupted run resumes) + bounded + idempotent (3rd run = byte no-op)
  -> align legacy WI state in the SAME pass -> DELEGATE to WI-486 task-state-compatibility / svc-migrate-task-state
       -> WI-486 contract unavailable OR unsupported state: actionable fail-closed terminal, NO retry loop
```

## Consumer Stories

### US-1 — Installed enforcement has a durable, observable source

**As** a framework installer/upgrade and a governed-mutation guard,
**I need** the installed hook/skill source to be a durable canonical checkout and its loss to fail closed,
**So that** a previously-active safety guard can never silently stop enforcing when a temporary directory vanishes.

### Acceptance Criteria — US-1

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| AC-487-1 | Setup refuses an ephemeral source such as `/tmp`, or materializes/repoints it to a verified durable canonical checkout before installing hooks or skills. | — | 🔲 | fixture (extend canonical-resolution) |
| AC-487-2 | A dangling or non-executable installed enforcement command produces a visible fail-closed diagnostic for governed mutation; it never silently converts deny behavior into allow behavior. | — | 🔲 | negative fixture (extend double-dead-pointer) |
| AC-487-3 | Setup or healthcheck detects existing ephemeral/dangling installs and deterministically repairs them or reports an actionable hard failure. | — | 🔲 | fixture |
| AC-487-4 | Canonical worktree installs still resolve to the durable repository source without breaking legitimate `.worktrees/` development. | — | 🔲 | fixture (extend canonical-resolution) |

### US-2 — One recorded effective source, repaired atomically and idempotently

**As** a host with both hooks and skills installed,
**I need** hooks and skills to share one recorded effective source that repairs together and re-runs safely,
**So that** repair is coherent and never overwrites unrelated host configuration.

### Acceptance Criteria — US-2

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| AC-487-5 | Repair covers hooks and skills as one installed surface and records the effective resolved source used by the host. | — | 🔲 | schema fixture |
| AC-487-6 | Repeated setup/repair is idempotent and does not overwrite unrelated user host configuration. | — | 🔲 | idempotency fixture |

### US-3 — Blocking denials are actionable, durable, and deduplicated

**As** an operator (including on a host that swallows hook stderr),
**I need** each blocking hook denial to name itself, its reason, the operation, and the exact recovery — once per unchanged state,
**So that** I can recover from a real denial instead of decoding an anonymous `exited with code 1` storm.

### Acceptance Criteria — US-3

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| AC-487-7 | Every blocking hook result emits a stable hook identifier, machine-readable reason code, human-readable cause, affected operation, and exact recovery command/action; an anonymous nonzero exit is a test failure. | — | 🔲 | fixture (new denial validator) |
| AC-487-7A | For hosts that truncate or swallow hook stderr, the hook writes the same diagnostic to a durable per-session receipt/log and the shortest host-visible message includes its reason code and lookup path; host-specific fixtures prove the effective surface. | — | 🔲 | host fixture (new denial validator) |
| AC-487-8 | Repeated identical failures for the same session, hook, reason, and state digest are deduplicated or rate-limited after the first actionable denial, without converting the denial into permission. | — | 🔲 | repeated replay (new denial validator) |

### US-4 — Versioned, bounded, all-host first-run migration

**As** the first run after an upgrade on any machine,
**I need** to inventory and migrate every configured host in one transactional, resumable, idempotent pass that delegates WI-state to WI-486,
**So that** old installs across all hosts converge without looping and without a second graph migrator.

### Acceptance Criteria — US-4

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| AC-487-9 | The first run after upgrade dynamically inventories and migrates every host declared by `provision/hosts/` (currently Claude, Codex, Gemini, Kimi, OpenCode, Antigravity, Cursor, and Mimo-Code), rather than repairing only the active host or relying on a hard-coded subset. | — | 🔲 | inventory fixture (new migration validator) |
| AC-487-10 | Migration is versioned, transactional, bounded, resumable after interruption, and idempotent; it preserves unrelated host configuration and user work and emits one per-host before/after report. | — | 🔲 | failpoint/replay (new migration validator) |
| AC-487-11 | Old hooks, skills, install receipts, and supported legacy WI state are aligned in one first-run orchestration pass; WI transformation delegates to WI-486's compatibility contract. Until that contract is available, unsupported WI state ends in an actionable fail-closed terminal state rather than being retried. | — | 🔲 | delegation fixture (new migration validator) |
| AC-487-12 | A migration or hook failure has a hard retry ceiling and fail-closed terminal recovery state for governed mutations, so unchanged bad state cannot produce an infinite first-run, PreToolUse, or Stop loop. | — | 🔲 | loop replay (new migration + denial validators) |

## System Dependencies

### This feature depends on

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|---|---|---|---|---|
| WI-486 compatibility contract | Internal enabler | `docs/specs/features/wi-486-session-isolated-bootstrap.md` | `hooks/lib/task-state-compatibility.mjs` classification + `scripts/svc-migrate-task-state.mjs` explicit backed-up WI-state migration | Fixture graphs (supported/legacy/quarantine) + a stub authorization file; assert WI-487 CALLS the CLI, never rewrites graphs itself |
| `setup` canonical resolution | Existing framework contract | this repo | `git rev-parse --git-common-dir` canonical-main resolution and worktree refusal | Transient worktree off HEAD (as the canonical-resolution fixture already builds) |
| `provision/hosts/*.json` | Config contract | this repo | Dynamic host inventory (8 hosts) + per-host `skills_path`/capabilities | Temporary manifest set with a mix of current/stale/dangling/ephemeral/missing/user-owned entries |
| `resolve-host-paths.mjs` | Internal helper | this repo | Host skills/config path resolution used by healthcheck | Real helper against fixture host manifests |
| Git worktrees + symlinks | Local integration | existing framework contract | Ephemeral/dangling install reproduction | Temporary repository + removed worktree + `/tmp` source |

### Other features depend on this

| Consumer | Type | What it needs from us |
|---|---|---|
| `setup` / upgrade | Installer | Durable-source classification, one install receipt, idempotent all-host repair |
| Session-start healthcheck | Guard infrastructure | Ephemeral/dangling detection + bounded migration or actionable hard-fail |
| Claude/Codex mutation + Stop guards | Guard infrastructure | Fail-closed enforcement-source guard + actionable deduplicated denial helper |
| Operators on stderr-swallowing hosts | Human recovery | Durable per-session denial receipt referenced by the visible message |
| WI-486 migration | Peer framework work | The all-host first-run entrypoint that invokes its task-state compatibility contract |

## Input and output contracts

### Durable-source classification input

- A candidate source path (the resolved symlink target or `.source-repo` pointer value).
- The host name and its `skills_path` from `provision/hosts/<host>.json`.
- The current process working checkout (for `git rev-parse --git-common-dir` canonical resolution).

### Durable-source classification output

| Classification | Meaning | Install/guard action |
|---|---|---|
| `durable-canonical` | realpath exists, executable, NOT under an ephemeral prefix or `/.worktrees/`, is the git-common-dir main checkout | install/enforce normally; write receipt |
| `ephemeral` | realpath under `/tmp`, `$TMPDIR`, `/dev/shm`, `/var/tmp` | refuse or materialize to canonical main before install; fail-closed for a live guard |
| `worktree-bound` | realpath under `/.worktrees/` | repoint to git-common-dir canonical main (legitimate dev path) |
| `dangling` | realpath does not exist / not executable | fail-closed deny for governed mutation; actionable repair diagnostic |

### State-root resolver (single source, F-011)

Exactly one `resolveStateRoot()` expands `~/.svc` for every Bash and Node consumer (`setup`, `check-install-drift.sh`, healthcheck, migration CLI, launcher, denial helper). It is HOME-anchored with an explicit fail-closed behavior when HOME is unset or unreadable (it refuses rather than falling back to a world-writable or CWD-relative path). Receipts written under the resolved root are EVIDENCE ONLY: a consumer always re-realpaths and re-classifies the live hook/launcher/source before accepting a converged state, and rejects a symlinked, wrong-owner, or schema-invalid receipt file. No consumer treats a receipt as authorization.

### Durable enforcement launcher (`~/.svc/enforcement/<migration_version>/bin/svc-enforce`, copied real file, 0700)

Materialized by setup/migration as real bytes (never a symlink into the checkout). Governed-mutation hook commands invoke `svc-enforce <hook-id>`. It resolves + validates the real enforcement source and, when the source is missing/dangling/non-executable (including a fully-deleted checkout), fails closed with an actionable denial + home-local receipt from a self-contained deny path. The version segment lets an upgrade install a new launcher without disturbing a running one.

### Denial identity digest (`denialStateDigest`, F-010)

One exported `denialStateDigest(state)` = SHA-256 of canonical (sorted-key, whitespace-free) JSON over ENFORCEMENT-RELEVANT state only: `{ resolved_command_path, target_exists, target_executable, effective_source, source_or_receipt_class, hook_id, reason_code }`. Timestamps and output text are excluded so the digest is stable cross-process. It is the dedup key. WI-486's digest primitive is reused only if its input contract matches this field set exactly with identical canonicalization; WI-486's advisory/allow disposition behavior is never reused.

### Install-state receipt (per host, home-local via `resolveStateRoot()`, `~/.svc/install-state/<host>.json`, 0600)

| Field | Meaning |
|---|---|
| `schema_version`, `migration_version` | Receipt + install-migration version |
| `host`, `skills_path` | Which host and its resolved skills root |
| `effective_source`, `source_classification` | The ONE resolved source shared by hooks + skills, and its durability class |
| `launcher_path`, `launcher_version` | The materialized durable launcher and its version segment |
| `framework_commit` | The commit of the durable source at install time |
| `hooks_installed`, `skills_installed`, `installed_at` | Coverage + timestamp |
| `before`, `after` | Per-host migration before/after state (AC-487-10) |

The receipt is evidence only (F-011); idempotency compares against it AFTER re-realpathing the live install.

### Hook-denial contract

| Field | Meaning |
|---|---|
| `hook_id` | Stable identifier of the emitting hook (never anonymous) |
| `reason_code` | Machine-readable enum (e.g. `SVC-ENFORCE-SOURCE-DANGLING`) |
| `cause` | Human-readable explanation |
| `operation` | The governed operation being denied |
| `recovery` | Exact recovery command/action |
| `session_id`, `denial_state_digest` | Dedup key (the exported `denialStateDigest`): first occurrence actionable, repeat suppresses OUTPUT only, never the DENY |
| `receipt_path` | Durable per-session receipt path (home-local, via `resolveStateRoot()`) referenced by the short host-visible message (AC-487-7A) |

## Event Contracts

| Event | Producer | Consumer | Payload | AC |
|---|---|---|---|---|
| `install.source_classified` | `durable-source.mjs` | setup/healthcheck/guards | candidate path, classification, canonical target | AC-487-1,2,4 |
| `install.receipt_written` | setup / migration | drift check / healthcheck | per-host effective source + coverage | AC-487-5,6 |
| `hook.denial` | `hook-denial.mjs` | operator / durable receipt | hook id, reason code, operation, recovery, dedup key | AC-487-7,7A,8,12 |
| `install.host_migrated` | `svc-migrate-install.mjs` | operator | per-host before/after, terminal result | AC-487-9,10,11,12 |
| `install.wi_state_delegated` | `svc-migrate-install.mjs` | WI-486 CLI | authorization handoff to `svc-migrate-task-state.mjs` | AC-487-11 |

## Feature Toggles

No behavior-weakening toggle is introduced. `SVC_SELF_HEAL_DISABLE=1` continues to silence self-heal but MUST NOT convert a dangling enforcement source into a silent allow: the fail-closed enforcement guard on governed mutation is independent of self-heal and has no fail-open flag. The advanced `SVC_SETUP_ALLOW_WORKTREE` override still requires a non-empty reason and still repoints to the canonical main checkout (never installs a worktree/ephemeral source).

## Industry Grounding

**Source:** proposals/2026-07-15-framework-improvement-durable-install-source.md + package-manager / lockfile / immutable-store prior art (npm/pnpm content-addressable store + symlink integrity, Nix store immutability & GC roots, Homebrew Cellar/opt symlinks, systemd/OPA fail-closed defaults)
**Landscape state:** internal framework install-integrity + host-denial-diagnostic contract; no customer-facing competitor landscape
**Gate verdict:** SKIP (internal system-integrity capability, not a market-facing flow)
**Branch taken:** internal grounding against established package-manager and fail-closed-enforcement primitives

The relevant grounding is established package-manager install integrity and security fail-closed defaults, not a customer-facing competitor landscape — but the design still aligns with proven prior art.

### What the industry does

Mature package managers never let an installed artifact depend on the lifetime of a temporary build directory. npm/pnpm materialize packages into a durable content-addressable store and link consumers to it; pnpm verifies store integrity and re-links on drift. Nix builds in sandboxed temp dirs but installs into an immutable `/nix/store` with GC roots so a live dependency is never collected. Homebrew installs into a durable `Cellar` and exposes stable `opt` symlinks so upgrades relink atomically without dangling. Security and policy enforcement engines (systemd unit conditions, OPA/Gatekeeper admission control, seccomp/AppArmor loaders) adopt fail-CLOSED defaults: when the policy source is missing or unreadable, the governed action is denied, not allowed. Diagnostics carry a stable identifier, a reason code, and a remediation path (systemd `systemctl status`, OPA decision logs) rather than an anonymous nonzero exit.

### What we're doing

We adopt exactly those primitives, framework-scoped. Setup classifies the install source durability (realpath + ephemeral-prefix + worktree + existence/executable checks) and refuses or re-points an ephemeral/worktree source to the durable canonical main checkout (`git rev-parse --git-common-dir`) BEFORE installing — the framework equivalent of an immutable store + stable opt-link. It also materializes a durable, NON-symlinked enforcement launcher outside the checkout (the framework equivalent of Homebrew's stable `opt` shim that survives Cellar churn) so that the guard which detects source loss cannot itself vanish with the source — the OPA/systemd rule that the policy *loader* is durable even when a policy file is missing. It records ONE per-host install receipt naming the effective source shared by hooks and skills, so repair is coherent and idempotent. On the governed-mutation path a fail-closed enforcement-source guard DENIES when the installed enforcement command is dangling/non-executable/ephemeral-vanished — the OPA/systemd fail-closed default — and a shared denial helper emits `{hook_id, reason_code, cause, operation, recovery}`, writes a durable per-session receipt for stderr-swallowing hosts, and deduplicates by session + state digest without ever converting the denial into permission. A versioned first-run migration inventories every host from `provision/hosts/*.json` and repairs them transactionally, resumably, idempotently, delegating any legacy WI-state transformation to WI-486's explicit backed-up migration CLI.

### Why we differ (or align)

We **align** with the established pattern rather than differ: immutable/durable install stores, stable relink-on-drift, fail-closed policy sourcing, and identifier-plus-reason-plus-remediation diagnostics are all proven prior art. The framework-specific choices are (a) reusing the git-common-dir main checkout AS the durable store (svc has no separate content-addressable store, and the canonical checkout is already the single durable artifact every host symlinks into); (b) a denial-dedup that suppresses repeated OUTPUT while keeping the DENY in force — distinct from WI-486's compatibility marker, which is allowed to downgrade to advisory/allow on repeat because a compatibility diagnosis is not a security denial; and (c) delegating legacy WI-state transformation to WI-486's contract rather than shipping a second migrator, so there is exactly one backed-up, receipted graph-rewrite path in the framework.

### Reversibility

Reversible, with an explicit external-state undo. `setup` and `scripts/check-install-drift.sh` gain additive classification/receipt/launcher steps that preserve their existing CLI and exit semantics; the session-start healthcheck keeps its never-block contract and adds a bounded repair/hard-fail branch; the mutation-guard changes add a fail-closed pre-check whose absence restores the prior (fail-open) behavior. The launcher, three new lib/CLI modules, and two schemas are additive; the two new tier-1 validators register alongside the extended pair; the per-blocking-hook `emitDenial` adoptions are additive. Home-local runtime dirs (`~/.svc/enforcement/`, `~/.svc/install-state/`, `~/.svc/denial-receipts/`, `~/.svc/install-migrations/`) are disposable caches. Because the first-run migration rewrites EXTERNAL host configuration/symlinks/launcher on user machines, a plain `git revert` cannot undo it — so the post-merge revert procedure COUPLES the code-revert PR with `scripts/svc-migrate-install.mjs --rollback`, which restores each host from its per-host backup under a precondition digest, verifies, and replays idempotently. Install and denial receipts are regenerable evidence, never authority.

## Technical Design

### Architecture

WI-487 adds a durable enforcement launcher plus three narrow modules and reuses existing entry points rather than forking them.

- `bin/svc-enforce.mjs` (new) — the durable enforcement launcher TEMPLATE. Setup/migration COPY it (real bytes, never a symlink) to `$LAUNCHER = ~/.svc/enforcement/<migration_version>/bin/svc-enforce` (0700), and rewrite every governed-mutation hook command to invoke `$LAUNCHER <hook-id>`. At run time the launcher resolves the real enforcement source for the hook, validates it via `classifySource` (realpath exists + executable + durable-canonical), exec-delegates to the real hook logic when valid, and when the source is missing/dangling/non-executable — INCLUDING when the whole checkout was deleted — FAILS CLOSED: it denies the governed mutation and writes a home-local denial receipt. Its deny path is self-contained (inlines/vendors the minimal `denialStateDigest` + receipt-write primitive), so it needs nothing from the guarded source to deny. This launcher is what closes the self-reference defect: the detector of source-disappearance no longer lives in the disappearing source.
- `hooks/lib/durable-source.mjs` (new) — pure source-durability service. `classifySource(path)` returns `durable-canonical | ephemeral | worktree-bound | dangling` from a realpath + ephemeral-prefix + `/.worktrees/` + existence/executable test. `resolveDurableCanonical(fromDir)` wraps the `git rev-parse --git-common-dir` resolution `setup` already performs, so the definition of "canonical" is single-sourced. `resolveStateRoot()` is the SINGLE home-anchored expander of `~/.svc` (explicit fail-closed behavior when HOME is unset/unreadable) that every Bash and Node consumer uses, so paths never diverge. `guardEnforcementSource(ctx)` is the fail-closed check the governed-mutation hooks call through the launcher: a non-`durable-canonical` enforcement source returns a DENY decision (never allow). No writes.
- `hooks/lib/hook-denial.mjs` (new) — the actionable-denial emitter every blocking hook calls. `emitDenial({hook_id, reason_code, cause, operation, recovery})` renders the machine+human diagnostic, writes a durable per-session receipt (0600 under `.svc/denial-receipts/` keyed by session + state digest) for stderr-swallowing hosts, and returns the short host-visible message carrying the reason code + receipt lookup path. Dedup: first `{session, hook, reason, state_digest}` is actionable; an identical repeat suppresses OUTPUT and returns the SAME deny with `deduped:true`. The denial is never downgraded to allow.
- `scripts/svc-migrate-install.mjs` (new) — the versioned all-host first-run migration CLI. It reads `provision/hosts/*.json` dynamically (no hard-coded host list), and for each host: snapshots config, classifies the install source, materializes/repoints the durable launcher, repoints to the durable canonical source, verifies hooks+skills resolve, writes the per-host install receipt with before/after. It is transactional (per-host backup + reverse rollback), resumable (a completion marker per host + digest), bounded (a PINNED N=3 attempt ceiling per `{migration_version, host_id, pre_state_digest}` → fail-closed terminal record, no further auto-retry for that key), and idempotent (a converged host is a byte no-op). It also exposes a versioned `--rollback` (per-host / `--all-hosts`) that restores pre-migration host config + launcher from the per-host backup with a precondition digest, verification, and idempotent replay. Legacy WI-state alignment in the same pass DELEGATES to WI-486: it imports `hooks/lib/task-state-compatibility.mjs` to classify and, only for migratable state, shells out to `scripts/svc-migrate-task-state.mjs --wi <n> --authorization <file>`. If the WI-486 contract is absent or the state is unsupported, it terminates fail-closed with an actionable message and NO retry — it never rewrites a graph itself.

Existing entry points modified: `setup` (classify + refuse/materialize + materialize the launcher via copy + rewire governed hooks through it + write receipt via the resolver), `scripts/check-install-drift.sh` (surface ephemeral/dangling enforcement source + missing/stale launcher + cite receipt, re-realpathing live), `hooks/svc-session-start-healthcheck.mjs` (detect ephemeral/dangling/missing-launcher → bounded `svc-migrate-install` or actionable hard-fail, N=3-ceilinged), and — for the fail-closed enforcement guard — the two governed-mutation guards `hooks/svc-task-completion-guard.sh` + `hooks/codex/svc-codex-skill-load-enforcer.mjs` (routed through `$LAUNCHER`, calling `guardEnforcementSource` + `emitDenial`). Additionally, EVERY blocking hook mechanically inventoried from `hooks/hooks.json` + `provision/hosts/*.json` + the codex hooks adopts `emitDenial`, so no blocking surface emits an anonymous `code 1`; a fixture enumerates the inventory and fails if any inventoried blocking hook returns a nonzero exit lacking the complete diagnostic + durable receipt.

```text
                 +----------------------------+
setup / upgrade->| durable-source.classify    |--durable--> install hooks+skills + WRITE receipt (one effective source)
                 | resolveDurableCanonical     |--ephemeral/wt--> repoint to git-common-dir main OR actionable refuse
                 +-------------+---------------+
                               |
 governed mutation ----------->| guardEnforcementSource
   (PreToolUse / Stop)         |   durable+exec -> pass to WI-485/WI-486 gates
                               |   dangling/ephemeral -> FAIL-CLOSED deny
                               v
                 +----------------------------+
                 | hook-denial.emitDenial     |--> machine+human {id,reason,op,recovery}
                 | durable per-session receipt|--> stderr-swallowing host lookup path
                 | dedup(session,reason,digest)|-> repeat suppresses OUTPUT, keeps DENY
                 +----------------------------+

 first run ----> svc-migrate-install (dynamic provision/hosts/*.json inventory)
                   per host: backup -> classify -> repoint -> verify -> receipt(before/after)
                   transactional + resumable + bounded(ceiling->fail-closed) + idempotent
                   legacy WI state -> DELEGATE -> task-state-compatibility + svc-migrate-task-state (WI-486)
                                    -> unavailable/unsupported -> actionable fail-closed terminal (no loop)
```

### Components

| Component | Type | Responsibility | New/Modify |
|---|---|---|---|
| `bin/svc-enforce.mjs` | Enforcement launcher | Durable non-symlinked run-time validate-then-delegate; self-contained fail-closed deny; closes the self-reference defect | New |
| `hooks/lib/durable-source.mjs` | Source service | Classify durability; resolve canonical; single state-root resolver; fail-closed enforcement guard | New |
| `hooks/lib/hook-denial.mjs` | Diagnostic service | Actionable denial + durable receipt + session/digest dedup | New |
| `scripts/svc-migrate-install.mjs` | Migration CLI | Versioned transactional all-host install migration; delegate WI-state to WI-486 | New |
| `schemas/install-state-receipt.schema.json` | Data contract | Per-host effective-source + before/after receipt | New |
| `schemas/hook-denial-receipt.schema.json` | Data contract | Durable per-session denial receipt shape | New |
| `setup` | Installer | Classify + refuse/materialize ephemeral source; write install receipt | Modify |
| `scripts/check-install-drift.sh` | Drift check | Report ephemeral/dangling enforcement source; cite recorded receipt | Modify |
| `hooks/svc-session-start-healthcheck.mjs` | Self-heal | Detect ephemeral/dangling; bounded migration or actionable hard-fail | Modify |
| `hooks/svc-task-completion-guard.sh` | Claude Stop guard | Fail-closed enforcement guard + actionable denial | Modify |
| `hooks/codex/svc-codex-skill-load-enforcer.mjs` | Codex PreToolUse | Fail-closed enforcement guard + actionable denial | Modify |
| `test-framework/evals/tier-1/validate-actionable-hook-denial.sh` | Test harness | Denial identity/receipt/dedup/never-fail-open proof | New |
| `test-framework/evals/tier-1/validate-all-host-install-migration.sh` | Test harness | Dynamic inventory, transactional/resumable/idempotent, WI-486 delegation, retry ceiling | New |
| `validate-setup-worktree-canonical-resolution.sh` | Test harness | Extend: ephemeral `/tmp` refusal + durable materialization | Modify |
| `validate-self-heal-survives-double-dead-pointer.sh` | Test harness | Extend: dangling enforcement → fail-closed deny | Modify |

Eight new files (one launcher, two libs, one CLI, two schemas, two validators) — plus the small structured-results parser `scripts/check-tier1-env-red-set.mjs` used by the baseline gate — plus two extended validators, and `emitDenial` adoption across the mechanically-inventoried blocking hooks. The launcher was added by round-1 review (F-001) to close the self-reference defect; it does not change the design's shape, only its durability. The per-blocking-hook `emitDenial` edits are additive one-line adoptions, not new modules.

### Fixture strategy (extend two, add two — justified)

The proposal directs extending `validate-setup-worktree-canonical-resolution.sh` and `validate-self-heal-survives-double-dead-pointer.sh` and forbids a third OVERLAPPING validator "unless diagnosis proves a genuinely distinct failure class." Diagnosis proves two distinct classes that do NOT overlap those two fixtures:

- **Actionable-denial rendering + dedup** (AC-487-7/7A/8) is a hook-OUTPUT-shape + session-dedup failure class, not a source-resolution or self-heal class. Cramming it into the canonical-resolution fixture would couple unrelated assertions and an adversarial reviewer would (correctly) flag the overlap. → new `validate-actionable-hook-denial.sh`.
- **All-host migration transactionality/idempotency/resumability + WI-486 delegation** (AC-487-9/10/11/12) is a multi-host orchestration + delegation failure class distinct from single-host self-heal. → new `validate-all-host-install-migration.sh`.

The two source-durability + fail-closed-enforcement classes (AC-487-1/4 and AC-487-2/3) DO overlap the named fixtures and are added there, not duplicated. Each new validator carries a tier-1 promotion note (see plan manifest §Tier-1 Promotion).

### Data Model

No database or network state. Four home-local runtime surfaces, all resolved through the single `resolveStateRoot()`:

- `~/.svc/enforcement/<migration_version>/bin/svc-enforce` (0700) — the durable COPIED (non-symlinked) enforcement launcher.
- `~/.svc/install-state/<host>.json` (0600) — per-host install receipt (`install-state-receipt.schema.json`), evidence only.
- `~/.svc/denial-receipts/<session-hash>/<denialStateDigest>.json` (0600 under 0700 tree) — durable per-session denial receipt (`hook-denial-receipt.schema.json`).
- `~/.svc/install-migrations/v<version>/<host>/{backup/, marker.json, report.json, attempts.json}` — per-host migration backup + resume marker + before/after report + atomic N=3 attempt ledger keyed on `{migration_version, host_id, pre_state_digest}`.

### Delegation boundary to WI-486 (AC-487-11, stated once)

WI-487 performs NO WI-state graph transformation. It calls `classifyTaskState(bytes)` (from `hooks/lib/task-state-compatibility.mjs`) to decide whether a graph is `supported` / `legacy-lossless` / `quarantine-recommended`, and for migratable state invokes `scripts/svc-migrate-task-state.mjs --wi <n> --authorization <file>` (the ONLY backed-up receipted graph-rewrite path). If the module/CLI is absent or the state is unsupported, `svc-migrate-install.mjs` records an actionable fail-closed terminal result and stops — it does not retry and does not rewrite bytes. This is the AC-487-11 invariant an adversarial reviewer must be able to verify by grep: no `writeFile`/`JSON.stringify` of a lane-tasks graph exists in `svc-migrate-install.mjs`.

### External Dependencies

None. Node built-ins, git, Python3 (already used by `setup`/`check-install-drift.sh`), the existing `resolve-host-paths.mjs`, and WI-486's already-merged compatibility modules. All tests run against temporary local repositories + fixture host manifests with no credentials, network, or model calls.

### Cost Model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Compute | One realpath + prefix classification per install/guard; one per-host repoint on first run | Hook-local; ≤8 hosts on migration | $0 | Linear in hosts/symlinks | Local operator machine |
| Storage | One sub-kilobyte receipt per host; one per-session denial receipt per unique digest | Rare install/denial events | $0 | Linear in hosts/unique digests | Local disk |
| Bandwidth / External API / Background jobs | None | 0 | $0 | Constant zero | N/A |

**Red line:** no network or paid-model call may enter setup, the enforcement guard, the denial helper, or the migration. **Projection:** $0 first month and year 1; negligible local CPU/disk.

### Operations & Ownership

| Dimension | Answer |
|---|---|
| **Owner** | svc framework maintainers |
| **On-call** | Best effort; no paging |
| **SLA / SLO** | Install/guard decisions complete within the host hook timeout; no availability guarantee outside a healthy local git/Node runtime |
| **Error budget** | Zero-tolerance: any silent fail-open of a governed mutation is a security failure |
| **Monitoring** | Tier-1 canonical-resolution, self-heal, denial, and all-host-migration fixtures + per-host install receipts |
| **Alerting** | First actionable denial / first per-host migration report is the operator signal; repeats are deduped |
| **Runbook** | Recovery command is embedded in every denial and in `check-install-drift.sh` output |
| **Failure modes** | Ephemeral/dangling source, partial per-host install, interrupted migration, WI-486 contract absent, unsupported WI state |
| **Recovery procedure** | Re-run `./setup --host <host>` or `svc-migrate-install --resume`; `svc-migrate-install --rollback --host <host>` reverses an external migration from backup; for WI-state run WI-486's explicit migration CLI |
| **Backup / restore** | Per-host config + launcher backup before repoint; versioned `--rollback` restores under a precondition digest, verifies, and replays idempotently; touches only svc-owned artifacts |
| **Dependencies' failure impact** | Missing Node/git or absent WI-486 contract yields one fail-closed actionable error; never a degraded mutation-authority grant |

### Feasibility Matrix

| AC | Persona pressure | Feasible? | Design proof |
|---|---|---|---|
| AC-487-1 | N/A - system-only | Yes | `classifySource` + `resolveDurableCanonical` before install |
| AC-487-2 | N/A - system-only | Yes | The durable non-symlinked launcher runs `guardEnforcementSource` and returns DENY on a non-durable/missing/deleted source, from a self-contained deny path |
| AC-487-3 | N/A - system-only | Yes | Healthcheck detect → bounded migration or hard-fail |
| AC-487-4 | N/A - system-only | Yes | git-common-dir resolution preserves `.worktrees/` dev |
| AC-487-5 | N/A - system-only | Yes | One receipt records the shared effective source for hooks+skills |
| AC-487-6 | N/A - system-only | Yes | Converged host is a byte no-op; config backup untouched |
| AC-487-7 | N/A - system-only | Yes | `emitDenial` requires id+reason+op+recovery; empty → test fail |
| AC-487-7A | N/A - system-only | Yes | Durable receipt + short message carries reason + lookup path |
| AC-487-8 | N/A - system-only | Yes | session+digest dedup suppresses output, keeps DENY |
| AC-487-9 | N/A - system-only | Yes | Glob `provision/hosts/*.json`; no hard-coded list |
| AC-487-10 | N/A - system-only | Yes | Per-host backup/rollback + resume marker + idempotent digest |
| AC-487-11 | N/A - system-only | Yes | Import task-state-compatibility; shell svc-migrate-task-state; no self graph write |
| AC-487-12 | N/A - system-only | Yes | Pinned N=3 ceiling per `{migration_version, host_id, pre_state_digest}` + denial dedup → fail-closed terminal record; changed state digest resets the key |

All 12 ACs are feasible with existing Node/git/Python capabilities and the merged WI-486 contract; none requires a spec revision or external dependency.

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Fail-closed guard denies a legitimate durable install (false positive) | Framework mutation stalls | Classify strictly against ephemeral prefixes + existence/executable; canonical worktree dev proven by the extended canonical-resolution fixture |
| Migration overwrites unrelated user host config | User data loss | Snapshot + reverse rollback; only svc-owned symlinks/receipts touched (as `setup`'s existing svc-owned guard does) |
| A second graph migrator is introduced by accident | Two rewrite paths, WI-486 boundary breach | AC-487-11 grep invariant: no lane-tasks write in `svc-migrate-install.mjs`; delegation-only fixture |
| Denial dedup suppresses a REAL new denial | Missed enforcement signal | Dedup keyed by state digest — changed state → new digest → new actionable denial (WI-486 digest pattern) |
| Retry ceiling (N=3) reached mid-migration leaves a host partial | Inconsistent host | Atomic attempt ledger per `retry_key`; resume marker + fail-closed terminal record names the incomplete host and the exact `--resume`/`--rollback` recovery command; a changed pre-state digest starts a fresh N=3 budget |

### Trade-offs

| Trade-off | Chose | Over | Rationale |
|---|---|---|---|
| Durable store | git-common-dir main checkout as the durable source | A separate content-addressable store | svc already symlinks every host into the canonical checkout; a new store adds surface with no benefit |
| Denial repeat behavior | Suppress OUTPUT, keep DENY | Downgrade to advisory (WI-486 pattern) | A security denial must never become permission; only compatibility diagnoses may downgrade |
| WI-state migration | Delegate to WI-486 CLI | A second install-scoped migrator | One backed-up receipted graph-rewrite path in the framework (AC-487-11) |
| Fixtures | Extend 2 + add 2 (justified) | Cram 4 classes into 2 fixtures | Distinct failure classes; coupling would draw an adversarial overlap finding |

### Adversarial Engineering Review (G4)

- `[Layer 1] [Confidence: 10/10]` A durable, non-symlinked enforcement launcher OUTSIDE the guarded checkout (round-1 F-001) is what makes fail-closed real: the detector of source loss cannot vanish with the source, so a deleted checkout still produces a visible deny + home-local receipt — the OPA/systemd rule that the policy loader is durable even when a policy file is missing.
- `[Layer 1] [Confidence: 10/10]` A fail-CLOSED enforcement-source guard is strictly safer than the current fail-open self-heal; loss of enforcement becomes a visible deny, matching OPA/systemd defaults.
- `[Layer 1] [Confidence: 9/10]` Reusing the git-common-dir canonical checkout as the durable store avoids inventing a parallel store and single-sources "canonical" with existing `setup` logic.
- `[Layer 2] [Confidence: 9/10]` Denial dedup that suppresses OUTPUT but keeps the DENY is the correct distinction from WI-486's advisory downgrade; a state-digest key admits exactly one new actionable denial per real change.
- `[Layer 1] [Confidence: 10/10]` Delegating WI-state transformation to WI-486 (no self graph write, grep-verifiable) preserves a single backed-up rewrite path.
- `[Layer 3] [Confidence: 9/10]` A hard host-attempt ceiling plus a fail-closed terminal report closes the first-run/PreToolUse/Stop loop without a fail-open escape.

**G4 verdict:** PASS. Responsibilities are separated, all ACs are feasible, the design is reversible, no second migrator is introduced, and it stays at (not above) the scope trigger.

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UPDATED] | `proposals/2026-07-15-framework-improvement-durable-install-source.md` + WI-486 diagnosis confirm the install-lifecycle gap |
| 2 | Journey | [UPDATED] | `docs/specs/journeys/J-FW-05-multi-session-contention.feature.md` (install-integrity scenarios) — journey sync deferred to execution per plan |
| 3 | Acceptance criteria | [UPDATED] | This spec transcribes AC-487-1..12 |
| 4 | UX | [N/A — justified] | Internal installer/hook Enabler; operator diagnostics specified as output contracts |
| 5 | UI | [N/A — justified] | No visual component, layout, or screenshot surface |
| 6 | Tech architecture | [UPDATED] | This spec defines durable-source service, denial helper, all-host migration, receipts, host adapters |
| 7 | Cost model | [UNCHANGED — VERIFIED] | Local filesystem/git only; no paid provider or recurring cost |
| 8 | Operations & ownership | [UPDATED] | Maintainers own receipts, denial diagnostics, migration reports, rollback |

## Implementation Notes

- `PLANNED` — add `bin/svc-enforce.mjs` (durable non-symlinked enforcement launcher; run-time validate-then-delegate; self-contained fail-closed deny) — built FIRST among implementation tasks (F-001).
- `PLANNED` — add `hooks/lib/durable-source.mjs` (classify + canonical resolve + single `resolveStateRoot` + fail-closed enforcement guard).
- `PLANNED` — add `hooks/lib/hook-denial.mjs` (actionable denial + exported `denialStateDigest` + durable home-local receipt + dedup).
- `PLANNED` — add `scripts/svc-migrate-install.mjs` (dynamic all-host transactional migration + versioned `--rollback` + pinned N=3 ceiling; delegate WI-state to WI-486).
- `PLANNED` — add install-state + hook-denial receipt schemas.
- `PLANNED` — modify `setup`, `check-install-drift.sh`, session-start healthcheck to materialize the launcher (copy) and consume the resolver + new services; route the two mutation guards through the launcher.
- `PLANNED` — adopt `emitDenial` across every mechanically-inventoried blocking hook (F-002).
- `PLANNED` — extend the canonical-resolution and double-dead-pointer fixtures (incl. deleted-checkout launcher case); add denial + all-host-migration validators.

## Journey References

| Journey | Scenarios | ACs Covered | Type |
|---|---|---|---|
| J-FW-05: Multi-session contention (install-integrity extension) | install-integrity scenarios (authored in execution) | AC-487-1..12 | System |

## Revision Log

| Date | AC | Was | Now | Why | By skill |
|---|---|---|---|---|---|
| 2026-07-17 | AC-487-1..12 | Accepted proposal criteria | Atomic testable BASELINED contract | Convert accepted owner/Fable requirements + WI-486 diagnosis into planning authority | write-spec |
