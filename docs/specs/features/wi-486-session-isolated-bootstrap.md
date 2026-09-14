---
status: BASELINED
type: Enabler
mode: contract-change
wi: WI-486
landscape_state: inapplicable
landscape_inapplicable_reason: internal framework session-authority and local state-migration contract with no customer-facing market flow
created: 2026-07-15
---

# Feature: Session-isolated multi-WI bootstrap

**Status:** BASELINED
**Type:** Enabler
**Consumers:** framework orchestrators, Codex and Claude mutation/Stop guards, worktree bootstrap, setup/upgrade migration, WI-487 installation migration
**Priority:** high
**Source:** accepted owner contract, `docs/specs/work-items/WI-486.md`

## Delta contract

**Invariant behavior preserved:** arbitrary unbound mutation stays denied; fresh foreign claims never grant authority or continuation pressure; one session cannot reuse another session's receipt; WI-485 exact current-task skill loading remains mandatory.

**Behavior changed:** safe reads no longer depend on repository-wide graph uniqueness; a single bounded bootstrap establishes a complete isolated authority tuple; legacy/future/malformed graph handling terminates by session plus state digest; on-disk migration is explicit, backed up, receipted, and never rewrites fresh foreign state.

**Explicit boundary:** durable all-host installation, missing-hook recovery, actionable host-denial rendering, and failure deduplication/rate-limiting remain WI-487.

## Problem Statement

Framework orchestrators currently cannot start independent work safely when a repository contains multiple foreign live graphs. Codex confuses graph inventory with current-session authority and can deny reads before it checks whether the operation mutates. The canonical worktree helper rejects unrelated default-checkout residue and does not establish graph, claim, and binding as one transaction. Separate Claude/Codex ownership implementations drift at compatibility boundaries, while malformed legacy state bypasses the Stop pressure cap and can repeat forever.

## Goals

- Separate read-only inspection, diagnostic graph inventory, and mutation authority.
- Establish exactly one validated session/worktree/WI/claim/graph authority tuple.
- Bootstrap a complete isolated WI without altering foreign graphs or unrelated checkout residue.
- Make same-WI concurrent creation atomic with one complete winner and one clean loser.
- Give every supported host the same ownership decision for the same fixture.
- Normalize compatible old state read-only and migrate disk state only under explicit authority.
- Guarantee one actionable compatibility result per unchanged session/state digest, then advisory termination.

## Non-goals

- Weakening arbitrary mutation or exact skill-receipt gates.
- Rewriting pre-existing foreign graphs during normal bootstrap.
- Installing or repairing host-global hooks or skills.
- Deduplicating arbitrary host hook error rendering; WI-486 only bounds compatibility state results.
- Adding a new lane, review gate, external provider, or paid runtime dependency.

## System flow

```text
safe operation
  -> classify operation
       -> proved read-only: allow; graph inventory is diagnostic only
       -> mutation: resolve exact current binding
            -> validate repo/worktree/branch/WI/claim generation/graph
                 -> invalid or absent: deny without foreign authority
                 -> valid: require exact current skill receipt

bounded bootstrap
  -> acquire repository + WI lock
  -> reject only target/same-WI ownership conflicts
  -> create isolated worktree
  -> create or validate initial graph
  -> create claim
  -> create session binding
       -> complete tuple: commit transaction
       -> any failure: remove only artifacts created by this attempt

compatibility inspection
  -> hash exact state bytes + tuple context
  -> supported: normal resolver
  -> lossless legacy: normalized read-only view, never authority
  -> future/malformed/lossy: quarantine recommendation, never authority
  -> first session+digest result: actionable
  -> repeated unchanged result: advisory/allow terminal
  -> explicit upgrade: authorize -> exclude fresh foreign -> backup -> migrate -> digest -> receipt
```

## Consumer Stories

### US-1 — Reads and mutation authority are separate

**As** a framework orchestrator entering a repository with foreign live work,  
**I need** safe inspection to remain available while mutation requires my exact binding,  
**So that** I can understand and bootstrap my own work without taking over another session.

### Acceptance Criteria — US-1

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| SIB-01 | With at least two foreign live graphs and no current binding, a proved read-only operation is allowed. | — | 🔲 | fixture |
| SIB-02 | With the same state, an arbitrary mutation is denied as missing current authority without naming a foreign graph as current work. | — | 🔲 | fixture |
| SIB-03 | A shell command that chains, redirects, interpolates, or escapes beyond the read-only classifier is not treated as read-only. | — | 🔲 | negative fixture |
| SIB-04 | A valid current binding selects exactly one absolute worktree and `lane-tasks-<WI>.json` graph. | — | 🔲 | fixture |
| SIB-05 | An unset graph override cannot grant authority. | — | 🔲 | fixture |
| SIB-06 | An outside-repository, symlink-escaped, wrong-worktree, wrong-WI, or mismatched graph override cannot grant authority. | — | 🔲 | negative fixture |
| SIB-07 | A graph override matching the validated binding acts only as a consistency assertion and does not replace binding validation. | — | 🔲 | fixture |
| SIB-08 | Branch names and repository-wide graph inventory remain diagnostics and cannot independently grant mutation authority. | — | 🔲 | fixture |

### US-2 — Bootstrap is complete, isolated, and atomic

**As** a new mutating session,  
**I need** one bounded command to establish my isolated worktree and authority state,  
**So that** partial or competing setup cannot leave ambiguous ownership.

### Acceptance Criteria — US-2

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| SIB-09 | One canonical bootstrap command creates or validates the target worktree, initial graph, WI claim, and session binding under one repository/WI lock. | — | 🔲 | integration fixture |
| SIB-10 | A successful result returns the WI, branch, immutable base SHA, absolute worktree, absolute graph, owner session, claim generation, and created/resumed state. | — | 🔲 | schema fixture |
| SIB-11 | Two sessions concurrently bootstrapping the same new WI yield exactly one complete winner and one actionable conflict loser. | — | 🔲 | race fixture |
| SIB-12 | The race loser leaves no branch, worktree, graph, claim, binding, temporary file, or lock that it created. | — | 🔲 | race fixture |
| SIB-13 | A failure after any intermediate bootstrap stage rolls back only artifacts created by that attempt. | — | 🔲 | failpoint replay |
| SIB-14 | A same-session replay resumes only when the complete tuple matches WI, branch, worktree, graph, claim, and generation. | — | 🔲 | replay fixture |
| SIB-15 | A partial pre-existing tuple returns an actionable conflict and is not silently completed or deleted. | — | 🔲 | partial-state fixture |
| SIB-16 | Unrelated tracked modifications and untracked default-checkout files remain byte-for-byte unchanged across successful bootstrap. | — | 🔲 | digest fixture |
| SIB-17 | Bootstrap denies only conflicts involving the requested branch, worktree path, WI ownership, graph target, or session tuple. | — | 🔲 | matrix fixture |
| SIB-18 | Different WIs can bootstrap independently without reading authority from or mutating each other's state. | — | 🔲 | concurrent fixture |

### US-3 — Host parity preserves exact skill authority

**As** a chain gate running under Claude or Codex,  
**I need** both hosts to resolve the same current ownership tuple,  
**So that** changing orchestrators cannot widen or narrow mutation authority.

### Acceptance Criteria — US-3

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| SIB-19 | Claude and Codex use one shared authority resolver for supported session/worktree/WI bindings. | — | 🔲 | inventory |
| SIB-20 | The same authority fixture produces the same owned, foreign, missing, stale, malformed, and mismatch classification on Claude and Codex. | — | 🔲 | parity replay |
| SIB-21 | A fresh foreign session's Stop is allow/advisory and never creates continuation pressure or reads its graph contents. | — | 🔲 | fixture |
| SIB-22 | A bound session cannot mutate another worktree. | — | 🔲 | negative fixture |
| SIB-23 | A current session cannot satisfy its mutation gate with a receipt for a foreign graph, worktree, task, skill, or session. | — | 🔲 | negative fixture |
| SIB-24 | After bootstrap, governed mutation still requires WI-485's exact current task and canonical skill receipt. | — | 🔲 | replay fixture |
| SIB-25 | Read-only roles remain non-authoritative and cannot be upgraded into mutation authority by a graph path or branch name. | — | 🔲 | fixture |

### US-4 — Compatibility inspection and migration are distinct

**As** an operator opening a repository with older or unsupported task state,  
**I need** a safe diagnosis before any disk rewrite,  
**So that** compatibility recovery cannot seize or corrupt foreign work.

### Acceptance Criteria — US-4

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| SIB-26 | Supported current-version graphs validate normally and may become authority only through a valid binding. | — | 🔲 | fixture |
| SIB-27 | A losslessly readable legacy graph produces a versioned normalized read-only view without changing its bytes. | — | 🔲 | fixture |
| SIB-28 | Future-version, malformed, or lossy legacy graphs produce an actionable quarantine recommendation without changing their bytes. | — | 🔲 | fixture |
| SIB-29 | No normalized view, quarantine recommendation, branch name, or session contract becomes implicit mutation authority. | — | 🔲 | negative fixture |
| SIB-30 | On-disk migration runs only through a separately named explicit setup/upgrade command with an attributable authorization input. | — | 🔲 | CLI fixture |
| SIB-31 | Migration rejects a graph, claim, or binding owned by a fresh foreign session. | — | 🔲 | negative fixture |
| SIB-32 | Before changing eligible state, migration creates an immutable byte-for-byte backup and records its path and digest. | — | 🔲 | migration replay |
| SIB-33 | A successful migration records authorization, source and target versions, before and after digests, changed paths, backup paths, and terminal result in a schema-valid receipt. | — | 🔲 | schema/replay |
| SIB-34 | Migration failure preserves the original and backup, emits a failure receipt, and never reports the state as upgraded. | — | 🔲 | failpoint replay |
| SIB-35 | A completed migration replay is idempotent and emits a terminal already-migrated result without rewriting bytes. | — | 🔲 | replay fixture |

### US-5 — Compatibility handling terminates

**As** a session encountering unsupported state during PreToolUse or Stop,  
**I need** one actionable recovery message and bounded repeats,  
**So that** unchanged legacy state cannot trap the session in a retry loop.

### Acceptance Criteria — US-5

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| SIB-36 | Compatibility identity covers repository, session, absolute worktree, affected state paths, exact state-byte digest, and compatibility classification. | — | 🔲 | schema fixture |
| SIB-37 | The first PreToolUse or Stop result for a session/state digest emits one actionable classification, affected path, and exact recovery command. | — | 🔲 | fixture |
| SIB-38 | Repeated handling of the unchanged session/state digest becomes advisory/allow and cannot hard-block indefinitely. | — | 🔲 | repeated replay |
| SIB-39 | Changing the state bytes changes the digest and permits exactly one new actionable diagnosis for that session. | — | 🔲 | digest replay |
| SIB-40 | A different session receives its own bounded first diagnosis and never inherits another session's counter. | — | 🔲 | multi-session replay |
| SIB-41 | Supported current state does not create a compatibility counter or advisory. | — | 🔲 | clean fixture |
| SIB-42 | All Tier-1 authority, bootstrap, race, migration, and loop tests are fixture-controlled and make no external model calls. | — | 🔲 | inventory |

## System Dependencies

### This feature depends on

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|---|---|---|---|---|
| WI-484 session/worktree/WI binding | Internal enabler | `docs/specs/work-items/WI-484.md` | Claims, bindings, freshness, generation-bound transfer | Temporary repositories and host-shaped session IDs |
| WI-485 Codex exact skill gate | Internal enabler | `docs/specs/work-items/WI-485.md` | Prompt authority and exact current skill receipts | Fixture runtime root and canonical skill copies |
| Git worktrees | Local integration | existing framework contract | Isolated branch/worktree creation and cleanup | Temporary repository plus bare local origin |
| Task graph validation | Internal enabler | `scripts/task-graph.mjs` | Current graph shape and skill receipt enforcement | Supported/legacy/future/malformed graph fixtures |
| WI-488 external review | Internal enabler | `docs/specs/features/wi-488-deterministic-external-reviewer.md` | Fable-5-high plan and implementation review | Canonical launcher; Tier 1 uses fake CLIs only |

### Other features depend on this

| Consumer | Type | What it needs from us |
|---|---|---|
| `route-workflow` | Router | Safe first mutation and exact current graph selection |
| Claude/Codex hooks | Guard infrastructure | Shared authority and bounded compatibility classification |
| `svc-ensure-worktree` | Bootstrap CLI | Complete transaction and same-WI exclusivity |
| Setup/upgrade flows | Migration infrastructure | Explicit safe task-state migration and receipts |
| WI-487 | Dependent framework work | Compatibility primitive for all-host first-run migration |

## Input and output contracts

### Authority input

- Current hook payload/session identity and absolute working directory.
- Secure session binding and referenced claim.
- Optional graph override treated only as a consistency assertion.
- Operation classification from the existing conservative read-only classifier.

### Bootstrap output

| Field | Meaning |
|---|---|
| `wi`, `branch`, `base_sha` | Requested identity and immutable source |
| `absolute_worktree`, `absolute_graph` | Exact isolated targets |
| `owner_session`, `claim_generation` | Attributable ownership |
| `created`, `resumed` | Terminal transaction state |

### Compatibility output

| Classification | Authority | Mutation | Required terminal behavior |
|---|---|---|---|
| `supported` | Binding-dependent | Normal gate | No compatibility pressure |
| `lossless-read-only` | Never | Explicit migration only | Normalized view plus optional upgrade command |
| `quarantine-recommended` | Never | Explicit migration/quarantine only | One actionable result per session/digest |
| `fresh-foreign` | Never current | Forbidden | Advisory without graph read or rewrite |

## Event Contracts

| Event | Producer | Consumer | Payload | AC |
|---|---|---|---|---|
| `session_bootstrap.completed` | bootstrap helper | orchestrator/hooks | complete authority tuple and creation state | SIB-09–14 |
| `session_bootstrap.conflict` | bootstrap helper | losing session | target conflict, current owner, recovery | SIB-11–15 |
| `task_state.compatibility` | shared inspector | PreToolUse/Stop/operator | classification, state digest, affected path, recovery | SIB-26–29, SIB-36–41 |
| `task_state.migrated` | explicit migration CLI | setup/WI-487/operator | authorization, versions, backups, digests, changed paths | SIB-30–35 |

## Feature Toggles

No behavior-weakening toggle is introduced. Existing emergency fail-open flags do not convert unsupported or foreign state into authority and cannot satisfy migration authorization.

## Industry Grounding

**Source:** references/framework-learnings.jsonl (multi-session contention incidents) + git worktree / lockfile prior art  
**Landscape state:** internal concurrency-control contract; no customer-facing competitor landscape  
**Gate verdict:** SKIP (internal system authority, not a market-facing capability)  
**Branch taken:** internal grounding against established concurrency primitives

The relevant grounding is the framework's verified WI-484/WI-485 behavior and the reproduced multi-session incidents, not a customer-facing competitor landscape — but the design still aligns with established concurrency-control practice.

### What the industry does

Concurrent-agent and multi-worktree systems establish mutation authority from an **exclusive, crash-attributable ownership record**, not from ambient repository state: git uses per-worktree HEAD/index isolation and lockfiles (`index.lock`) naming the owning process; databases use write-ahead intent logs written *before* the mutation; distributed locks (flock, lease-based coordination) bind a lock to a liveness token (PID + boot time / session lease) so a dead holder can be safely reclaimed and a live holder is never preempted. Schema/state migrations are gated behind explicit, authorized, backup-first commands with terminal receipts, never performed as an implicit read side-effect.

### What we're doing

We adopt exactly those primitives, framework-scoped: a **bootstrap-intent marker written first** (record-intent-then-fsync-then-create, so `created_paths[]` is always a superset of on-disk artifacts) as the single ownership anchor; authority derived ONLY from one exact session/worktree/WI/claim/graph tuple (never from graph uniqueness or ambient checkout state); a **process-liveness token** (host:pid:process-start) that overrides a stale TTL and fails closed to LIVE on uncertainty; and a **separate, authorized, backup-first migration CLI** with a schema-valid terminal receipt (`svc-migrate-task-state.mjs`) as the only on-disk task-state rewrite path. Task-state compatibility inspection is pure and confers no authority.

### Why we differ (or align)

We **align** with the established pattern rather than differ: intent-log-before-write (WAL), liveness-scoped locks, and explicit gated migration are all proven prior art. The framework-specific choices are (a) a *completeness subset backstop* — an on-disk WI/branch artifact not listed in the marker's `created_paths[]` makes the state an ambiguous CONFLICT that is never auto-deleted (closing the record-then-create TOCTOU window from both sides), and (b) a **bounded** compatibility disposition (first-actionable / repeat-advisory) so a diagnosis can never hard-block a session indefinitely.

### Reversibility

Fully reversible. Every module is additive or a behavior-preserving refactor of an existing entry point: `svc-ensure-worktree.mjs` keeps its CLI signature and remains the sole bootstrap; the shared resolver replaces duplicated ownership logic without changing the ownership *decision*; migration is opt-in and backup-first (every run records an immutable byte-for-byte backup + digest, and `--restore` reverts from it). Reverting restores the prior (racier) behavior with no data migration required; the machine-local runtime dirs (`.svc/bootstrap-intent/`, `.svc/task-state-migrations/`) are gitignored and disposable.


## Technical Design

### Architecture

The design extends the existing `hooks/lib/resolve-wi.mjs` authority boundary instead of creating a second resolver. It validates one secure binding/claim/graph tuple and exposes the same result as an imported function for Codex and as a small JSON CLI mode for the Bash-based Claude Stop adapter. Repository-wide branch, contract, and graph scans stay diagnostic-only.

`scripts/svc-ensure-worktree.mjs` remains the only bootstrap entry point. Under its existing secure repository lock it checks all linked worktree bindings for a live same-WI owner, creates the isolated worktree, creates or validates an initial graph, then creates the claim and binding. Every newly created artifact is tracked in a transaction ledger and removed in reverse order on failure. It never edits the default checkout.

A new `hooks/lib/task-state-compatibility.mjs` inspects graph bytes independently of authority. It recognizes the current shape, produces a lossless read-only view for explicitly old supported shapes, or recommends quarantine. It stores only a secure runtime marker keyed by repository, session, worktree, state paths, exact bytes, and classification. A separate `scripts/svc-migrate-task-state.mjs` is the only on-disk migration path.

```text
                         +---------------------------+
hook payload ---------->| resolve-wi.mjs            |
                         | exact binding + claim     |
graph override -------->| + graph consistency only  |----> owned tuple
                         +-------------+-------------+
                                       |
                       diagnostic only | unsupported bytes
                                       v
                         +---------------------------+
                         | task-state-compatibility  |
                         | inspect + digest + bound  |
                         | first/repeat disposition  |
                         +-------------+-------------+
                                       |
                           explicit CLI| only
                                       v
                         +---------------------------+
                         | migrate: authorize        |
                         | exclude fresh foreign     |
                         | backup -> transform       |
                         | verify -> receipt         |
                         +---------------------------+
```

#### Authority state machine

```text
OPERATION
  -> READ_ONLY ----------------------------------------------> ALLOW
  -> MUTATION
       -> NO_SESSION ----------------------------------------> DENY_MISSING_AUTHORITY
       -> BINDING_MISSING/MALFORMED/RELEASED ----------------> DENY_MISSING_AUTHORITY
       -> REPO/WORKTREE/BRANCH/WI_MISMATCH ------------------> DENY_TUPLE_MISMATCH
       -> CLAIM_STALE/FOREIGN/GENERATION_MISMATCH -----------> DENY_CLAIM_MISMATCH
       -> GRAPH_MISSING/UNSUPPORTED/OVERRIDE_MISMATCH --------> DENY_GRAPH_MISMATCH
       -> OWNED_TUPLE
            -> EXACT_SKILL_RECEIPT_MISSING/MISMATCH ----------> DENY_SKILL_RECEIPT
            -> EXACT_SKILL_RECEIPT_VALID ---------------------> ALLOW_MUTATION
```

#### Bootstrap transaction

```text
LOCK_REPOSITORY
  -> validate origin/main and target identity
  -> scan live bindings/claims for same WI
  -> create worktree
  -> create-or-validate graph
  -> create claim
  -> create binding
  -> re-read complete tuple
       -> valid: SUCCESS + release lock
       -> failure: rollback created binding/claim/graph/worktree/branch in reverse order

Existing target state is never deleted by rollback. A competing process that
cannot acquire the lock exits cleanly before it creates an artifact.
```

### Components

| Component | Type | Responsibility | New/Modify |
|---|---|---|---|
| `hooks/lib/resolve-wi.mjs` | Authority service | Validate exact binding, claim, graph, and optional override; expose import and CLI results | Modify |
| `hooks/codex/lib/codex-hook-context.mjs` | Codex adapter | Delegate active task selection to the shared owned tuple; keep graph inventory diagnostic | Modify |
| `hooks/codex/svc-codex-skill-load-enforcer.mjs` | Codex PreToolUse | Allow proved reads first, allow only exact bootstrap syntax on default, enforce resolver plus WI-485 receipt for mutation | Modify |
| `hooks/svc-task-completion-guard.sh` | Claude/Stop adapter | Replace embedded ownership logic with shared resolver CLI; consume bounded compatibility disposition | Modify |
| `hooks/lib/wi-claim.mjs` | Ownership persistence | Expose secure cross-worktree live-WI inspection and selective release primitives | Modify |
| `scripts/svc-ensure-worktree.mjs` | Bootstrap transaction | Preserve default residue; create/validate graph, claim, binding, tuple; roll back selectively | Modify |
| `hooks/lib/task-state-compatibility.mjs` | Compatibility service | Inspect/version graph bytes, normalize read-only, hash state, and bound repeated diagnostics | New |
| `scripts/svc-migrate-task-state.mjs` | Explicit migration CLI | Authorize, exclude fresh foreign state, backup, transform, validate, and receipt | New |
| `schemas/task-state-migration-receipt.schema.json` | Data contract | Validate migration authorization, versions, digests, paths, and terminal result | New |
| Tier-1 bootstrap/compatibility fixtures | Test harness | Race, failpoint, residue, authority parity, version, migration, and loop replay | New/Modify |

Five new files are expected: the compatibility module, migration CLI, receipt schema, and two focused Tier-1 validators. This stays below the eight-new-file scope trigger and introduces two narrow services with non-overlapping responsibilities.

### Data Model

No database or network state is introduced.

#### Owned authority tuple

```json
{
  "classification": "owned",
  "wi": "WI-486",
  "repo_root": "/absolute/default-checkout",
  "worktree_root": "/absolute/.worktrees/framework-WI-486-...",
  "branch": "framework-WI-486-...",
  "graph_path": "/absolute/worktree/.svc/lane-tasks-WI-486.json",
  "session_id": "host-session-id",
  "claim_generation": 1
}
```

Every path is absolute and realpath-contained. The optional `SVC_CODEX_TASK_GRAPH` must equal `graph_path`; it is never a source for any other field.

#### Graph compatibility

- Current version is `1`. Existing structurally valid graphs with an omitted version are interpreted as current v1 compatibility, preserving already-verified WI-484/WI-485 graphs.
- Explicit version `0` fixtures are eligible for lossless read-only normalization when all fields map without deletion or coercion.
- Version greater than `1`, malformed JSON, unsafe paths, unknown task states, or lossy version-0 content are `quarantine-recommended`.
- Only `supported` current state may participate in authority resolution.

#### Runtime compatibility marker

```text
${SVC_TASK_STATE_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-~/.cache}/svc-task-state-runtime}/
  <repo-hash>/<session-hash>/<worktree-hash>/<state-digest>.json
```

The secure 0700 tree and 0600 marker record classification, first-seen time, affected relative paths, and digest only. First creation yields `actionable`; an existing identical marker yields `repeat-advisory`. Changing any state bytes changes the digest. Runtime state never grants authority.

#### Migration artifacts

```text
.svc/task-state-migrations/v1/<before-digest>/
  backup/<relative-original-path>
  receipt.json
```

The directory is local migration evidence and must be gitignored. The receipt schema requires `schema_version`, `migration_version`, authorization source/session, source/target graph versions, before/after SHA-256 digests, original/backup/changed paths, started/completed timestamps, and terminal result (`migrated`, `already-current`, `ineligible-fresh-foreign`, or `failed`). Backups are created with exclusive files and fsync before source mutation. The migrated source is written by temporary file, fsync, rename, and re-validated before success publication.

### Data Flow

1. A hook classifies the operation conservatively. Proved reads exit before authority lookup.
2. A mutation asks `resolveWI` for strict authority. The resolver finds only the current session's binding in the current worktree, validates the claim and generation, derives the exact graph path from the bound WI, inspects current graph compatibility, and checks an optional override for equality.
3. Codex uses the returned task to validate the exact canonical skill receipt. Claude Stop passes only the exact graph to the existing completion calculation. Neither host parses foreign graphs after a non-owned result.
4. Bootstrap locks the common repository before inspecting targets. A live same-WI tuple in any linked worktree is a conflict. Otherwise it creates or resumes a matching target, ensures a current graph, binds ownership, re-reads the tuple, and returns it.
5. Compatibility inspection hashes exact graph bytes and context. First unsupported output contains classification, path, and exact migration/quarantine command. Repeats for the same session/digest are advisory.
6. Explicit migration re-inspects under a lock, refuses fresh foreign ownership, backs up bytes, transforms only a known lossless version, verifies the after-state, and writes the receipt.

### External Dependencies

None. The implementation uses Node built-ins, git, the existing `wi-claim`, `state-io`, conservative command classifier, JSON-schema validator, and task-graph validators. All tests run against temporary local repositories with no credentials, network, or model calls.

### Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Authority boundary | Extend `resolve-wi.mjs` | It already validates session/worktree/WI bindings for the universal isolation guard; reuse closes host drift |
| Read ordering | Proved read-only classification before authority | Reads have no mutation authority to grant and must remain available for recovery |
| Bootstrap lock | Existing secure repository lock plus same-WI cross-worktree scan | One lock gives atomic race behavior without a second central ownership database |
| Initial graph | Validate existing exact-WI graph or create minimal current-v1 `route-workflow` graph with inferred lane | Makes bootstrap complete while preserving tracked intake graphs |
| Compatibility state | Separate byte inspector plus secure runtime session/digest markers | Keeps unsupported state diagnostic-only and bounds repeats without dirtying git |
| Disk migration | Separate explicit Node CLI with backup and schema receipt | Prevents normal hooks/bootstrap from acquiring migration authority |
| Persistence | Existing atomic temp/fsync/rename patterns | Matches repository conventions and provides crash-safe publication without dependencies |

### Cost Model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Compute | One bounded graph/binding scan and SHA-256 per governed hook; git operations only on bootstrap | Hook-local, typically fewer than 20 small state files | $0 | Linear in linked worktrees/state bytes | Local operator machine |
| Storage | One sub-kilobyte runtime marker per unique unsupported digest; migration backup equals source bytes | Rare compatibility events | $0 | Linear in unique digests/migrated bytes | Local disk |
| Bandwidth | None | 0 | $0 | Constant zero | N/A |
| External API calls | None | 0 | $0 | Constant zero | N/A |
| Background jobs | None | 0 | $0 | Constant zero | N/A |

**Scaling triggers:** warn if a repository has more than 100 linked worktrees or task-state inventory exceeds 10 MiB; neither condition is expected in normal svc operation. **Red line:** no network or paid-model call may enter bootstrap, authority, or compatibility handling. **Projection:** $0 first month and year 1; only negligible local CPU/disk use.

### Operations & Ownership

| Dimension | Answer |
|---|---|
| **Owner** | svc framework maintainers |
| **On-call** | Best effort; no paging service |
| **SLA / SLO** | Local bootstrap and hook decisions complete within existing host hook timeout; no availability guarantee outside a healthy local git/Node runtime |
| **Error budget** | N/A for best-effort local tooling; any false authority grant is zero-tolerance security failure |
| **Monitoring** | Tier-1 race/parity/replay fixtures and migration receipts |
| **Alerting** | First compatibility result is the actionable operator alert; repeated unchanged results are advisory |
| **Dashboard** | None; task graph, CLI JSON, and receipts are the inspection surfaces |
| **Runbook** | Exact recovery command in compatibility/bootstrap output; WI-487 will surface installed-host migration status |
| **Failure modes** | Lock contention, target conflict, malformed binding/claim/graph, unsafe path, partial creation, unsupported version, migration interruption |
| **Recovery procedure** | Retry clean lock contention; resolve named target conflict; run explicit migration/quarantine command; use backup/receipt after migration failure; roll back the complete WI-486 commit if resolver and bootstrap semantics regress |
| **Backup / restore** | Bootstrap rollback removes only newly created artifacts; migration preserves byte-for-byte original under its digest before mutation |
| **Dependencies' failure impact** | Missing Node/git or invalid repository state yields one fail-closed actionable CLI error; no degraded mutation authority |

### Feasibility Matrix

| AC | Persona pressure | Feasible? | Design proof |
|---|---|---|---|
| SIB-01 | N/A - system-only | Yes | Read classifier exits before resolver |
| SIB-02 | N/A - system-only | Yes | Strict resolver denies no binding |
| SIB-03 | N/A - system-only | Yes | Existing conservative lexical classifier |
| SIB-04 | N/A - system-only | Yes | Exact binding-derived graph path |
| SIB-05 | N/A - system-only | Yes | Override is optional consistency only |
| SIB-06 | N/A - system-only | Yes | realpath containment plus tuple equality |
| SIB-07 | N/A - system-only | Yes | Override compared after authority derivation |
| SIB-08 | N/A - system-only | Yes | Diagnostic fields never set `authority=true` |
| SIB-09 | N/A - system-only | Yes | Repository-locked transaction ledger |
| SIB-10 | N/A - system-only | Yes | Re-read tuple supplies JSON result |
| SIB-11 | N/A - system-only | Yes | Exclusive lock plus same-WI scan |
| SIB-12 | N/A - system-only | Yes | Loser exits before side effects; rollback assertions |
| SIB-13 | N/A - system-only | Yes | Ordered failpoints and reverse rollback |
| SIB-14 | N/A - system-only | Yes | Complete-tuple resume validation |
| SIB-15 | N/A - system-only | Yes | Partial state is conflict, never repair/delete |
| SIB-16 | N/A - system-only | Yes | No default-checkout write; before/after digests |
| SIB-17 | N/A - system-only | Yes | Target-scoped conflict matrix |
| SIB-18 | N/A - system-only | Yes | Lock serializes briefly; state is WI-scoped |
| SIB-19 | N/A - system-only | Yes | Imported resolver plus CLI adapter |
| SIB-20 | N/A - system-only | Yes | Same vector table drives both host fixtures |
| SIB-21 | N/A - system-only | Yes | Non-owned result exits before graph parse |
| SIB-22 | N/A - system-only | Yes | Current real worktree required |
| SIB-23 | N/A - system-only | Yes | Existing receipt tuple checks preserved |
| SIB-24 | N/A - system-only | Yes | WI-485 enforcer remains terminal gate |
| SIB-25 | N/A - system-only | Yes | Role check stays non-authoritative |
| SIB-26 | N/A - system-only | Yes | Current inspector result plus binding |
| SIB-27 | N/A - system-only | Yes | Pure version-0 normalization function |
| SIB-28 | N/A - system-only | Yes | Parse/version/loss checks return quarantine |
| SIB-29 | N/A - system-only | Yes | Compatibility module exposes no authority flag |
| SIB-30 | N/A - system-only | Yes | Separate named CLI and authorization argument |
| SIB-31 | N/A - system-only | Yes | Freshness check before backup/mutation |
| SIB-32 | N/A - system-only | Yes | Exclusive backup plus digest verification |
| SIB-33 | N/A - system-only | Yes | Shared schema plus semantic validation |
| SIB-34 | N/A - system-only | Yes | Staged write, retained backup, failure receipt |
| SIB-35 | N/A - system-only | Yes | Current-version terminal before rewrite |
| SIB-36 | N/A - system-only | Yes | Length-delimited context and byte hash |
| SIB-37 | N/A - system-only | Yes | Atomic first marker includes recovery |
| SIB-38 | N/A - system-only | Yes | Existing marker yields repeat advisory |
| SIB-39 | N/A - system-only | Yes | Changed bytes produce new digest key |
| SIB-40 | N/A - system-only | Yes | Session hash partitions markers |
| SIB-41 | N/A - system-only | Yes | Supported result bypasses marker write |
| SIB-42 | N/A - system-only | Yes | Local fake repositories only |

All 42 ACs are feasible with existing Node/git capabilities; none requires a spec revision or external dependency.

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Shared resolver change denies legitimate existing sessions | Framework mutation stalls | Preserve omitted-version v1 compatibility; replay WI-484/WI-485 fixtures before new vectors |
| Rollback removes pre-existing state | User data loss | Track `created_by_attempt` per artifact; never delete a pre-existing path; failpoint tests at every boundary |
| Same-WI ownership scan trusts malformed sibling state | False winner or unsafe takeover | Only a secure fresh binding/claim tuple blocks; malformed/undecidable state returns target conflict, never takeover |
| Runtime markers can be forged or cross sessions | Suppressed first diagnosis | Secure owned 0700/0600 paths, hashed session partition, no symlink following |
| Migration loses unknown fields | Irreversible state loss | Only known lossless version transforms; unknown/lossy state is quarantine-only; backup before write |
| Claude Bash adapter diverges from imported Codex result | Host inconsistency | CLI output is a serialization of the same resolver function; parity fixture consumes one vector table |

### Trade-offs

| Trade-off | Chose | Over | Rationale |
|---|---|---|---|
| Bootstrap concurrency | One short repository-wide lock | Per-WI distributed lock set | Simpler atomicity; worktree creation is rare and already serialized by git common state |
| Compatibility | Fail-closed current authority with read-only recovery | Best-effort automatic repair | Prevents unsupported state from becoming implicit authority |
| Migration evidence | Local ignored backup/receipt | Tracked machine-specific artifacts | Preserves recovery without polluting shared git state; WI-487 owns aggregate installation evidence |
| Resolver evolution | Extend established `resolve-wi` | New parallel resolver | Eliminates duplicate authority logic and minimizes new surface |

### Adversarial Engineering Review (G4)

- `[Layer 1] [Confidence: 10/10]` Reusing `resolve-wi.mjs` is safer than another authority service; it already protects universal worktree isolation.
- `[Layer 1] [Confidence: 10/10]` Whole-checkout cleanliness is accidental coupling; target-specific checks plus byte-digest fixtures preserve safety.
- `[Layer 1] [Confidence: 9/10]` Repository-wide locking is acceptable because git common state already serializes worktree mutations; per-WI locks add stale-lock and cross-target complexity without an AC benefit.
- `[Layer 3] [Confidence: 9/10]` Session-plus-state-digest compatibility markers separate security denial from repeated recovery pressure: authority remains fail-closed while unchanged unsupported state stops rewaking the agent.
- `[Layer 1] [Confidence: 10/10]` Explicit migration must remain a separate CLI; combining it with bootstrap would contradict foreign-byte preservation.

**G4 verdict:** PASS. Responsibilities are separated, all ACs are feasible, rollback and migration are reversible, no deprecated foundation or external dependency is introduced, and the design stays below the scope-reduction trigger.

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UPDATED] | `proposals/2026-07-15-framework-improvement-multi-wi-session-bootstrap.md` and accepted intake review confirm the framework workflow gap |
| 2 | Journey | [UPDATED] | `docs/specs/journeys/J-FW-05-multi-session-contention.feature.md` gains isolated bootstrap and compatibility scenarios |
| 3 | Acceptance criteria | [UPDATED] | This spec defines SIB-01 through SIB-42 |
| 4 | UX | [N/A — justified] | Internal CLI/hook enabler with no browser or end-user interaction surface; operator diagnostics are specified as output contracts |
| 5 | UI | [N/A — justified] | No visual components, layout, motion, responsive, or screenshot surface |
| 6 | Tech architecture | [UPDATED] | This spec now defines the shared resolver, bootstrap transaction, compatibility inspector, migration CLI, and host adapters |
| 7 | Cost model | [UNCHANGED — VERIFIED] | Local filesystem/git operations only; no paid provider or recurring service cost; runtime bounds belong in Technical Design |
| 8 | Operations & ownership | [UPDATED] | Framework maintainers own locks, backups, migration receipts, compatibility diagnostics, and rollback |

## Implementation Notes

- `PLANNED` — extend `resolve-wi.mjs` into the single graph-aware authority resolver and CLI adapter.
- `PLANNED` — reorder Codex read/authority handling and preserve exact skill receipt enforcement.
- `PLANNED` — replace Claude Stop's embedded binding resolver with the shared result.
- `PLANNED` — make `svc-ensure-worktree` residue-safe and transactionally complete.
- `PLANNED` — add graph compatibility inspection, bounded runtime disposition, explicit migration, backups, and receipts.
- `PLANNED` — add hermetic authority, bootstrap race/failpoint, host parity, migration, and loop replay fixtures.

## Journey References

| Journey | Scenarios | ACs Covered | Type |
|---|---|---|---|
| J-FW-05: Multi-session contention | FW05-S1 through FW05-S12 | SIB-01–SIB-42 | System |

## Revision Log

| Date | AC | Was | Now | Why | By skill |
|---|---|---|---|---|---|
| 2026-07-15 | SIB-01–SIB-42 | Accepted proposal criteria | Atomic testable contract | Convert accepted owner/Fable requirements and diagnosis into planning authority | write-spec |
