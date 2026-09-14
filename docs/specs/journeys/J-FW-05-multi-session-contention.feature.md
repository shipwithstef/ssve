# J-FW-05: Two Live Sessions Share One Machine Without Corrupting Each Other

**Journey ID:** J-FW-05
**Persona:** S1 — Framework Orchestrator (×2 concurrent — the user's real
multi-clauding workflow, 25% of measured messages)
**Covers:** claims discipline, session-scoped guard state, isolated bootstrap,
task-state compatibility, contract staleness, notes-ref races, and gh-auth flips
**Priority:** Critical

## Why This Journey Matters

Every incident class in this journey happened live this week: foreign-claim
execute-pressure, cross-session loop-guard pollution, fresh-worktree contract
blocks, notes-push races, mid-flight gh-account flips. Multi-clauding is the
user's normal mode — the framework must be deterministic under it, not just
solo.

## User Motivation

The user runs parallel orchestrators on the same checkout tree and expects
each to act only on its own WIs, end its own turns, and reconcile shared
append-only state without loss.

## Behavior Specification

# Feature: Concurrent sessions stay isolated where it matters and merge where it's safe

  # Background:
  - Given session A and session B run concurrently against the same repo
  - And each session has its own claims under .svc/claims/

  Scenario: FW05-S1 Foreign fresh claim downgrades completion pressure
    Given session B holds a fresh claim (uuidish session id) on WI-X
    When session A's Stop fires while WI-X has actionable tasks
    Then the completion guard emits an advisory naming the foreign claim instead of a block
    And an unattributable claim (agent-name id) keeps the normal block
    # Maps to: WI-399 A6 (c8 learning, fired 2x); validate-completion-guard-no-max-escape.sh

  Scenario: FW05-S2 Pressure cap ends infinite wedges loudly
    Given the same pressure status recurs for one session and one checkout
    When the attempt count exceeds SVC_COMPLETION_MAX
    Then the guard downgrades to a LOUD advisory telling the user what is stuck
    And the first MAX attempts still blocked (lazy-agent pressure intact)
    # Maps to: WI-399 A6 reconciled with WI-183; counter keyed session+cwd (c9 learning)

  Scenario: FW05-S3 Loop-guard fingerprints never cross sessions
    Given sessions A and B issue similar repeated commands in the same checkout
    When the loop guard evaluates repetition
    Then each session's counters live in its own state file (session-keyed)
    And session B's repetitions never push session A toward a block
    # Maps to: WI-399 A7; .svc/loop-guard-state-<session>.json (gitignored)

  Scenario: FW05-S4 Fresh worktree's committed contract warns, never wedges
    Given a new worktree checks out the tracked session contract (last committed line is stale)
    When the first in-worktree Write fires
    Then the freshness gate emits the bootstrap WARN with the append recipe
    And appending any line ends the bootstrap window (git-clean predicate, not mtime)
    And a stale contract in the MAIN checkout still hard-blocks
    # Maps to: WI-399 A3 (live-hit 2026-06-10 ×3); validate-session-contract-freshness.sh F2/F3 repros

  Scenario: FW05-S5 Shared append-only ledgers merge by set-union, never truncate
    Given both sessions appended to pipeline-decisions/session-contract/learning-fires ledgers
    When a fast-forward or reconcile would overwrite local appends
    Then the flow is save → checkout → pull → set-union re-append in ONE step
    And live-appended files (learning-fires) are in the preserved set
    # Maps to: WI-398 merge driver; J-FW-03-S4; live-hit 2026-06-10 (run2 deploy)

  Scenario: FW05-S6 gh auth flips between sessions never silently misroute pushes
    Given a parallel session switches the active gh account mid-flight
    When any push/PR/merge/pull against the private repo runs
    Then the flow switches to the repo owner account IMMEDIATELY before the operation
    And a "Repository not found" on fetch/push triggers the deterministic auth recovery, never gh auth login
    # Maps to: route-workflow Publication-State auth recovery; live-hits ×4 this week

  Scenario: FW05-S7 Foreign graphs do not deny safe inspection
    Given two foreign sessions each own a live in-progress graph
    And the current session has no mutation binding
    When the current session runs a proved read-only inspection
    Then the inspection is allowed without selecting either foreign graph
    And an arbitrary mutation is denied as missing current authority
    # Maps to: SIB-01 through SIB-03

  Scenario: FW05-S8 One bounded bootstrap establishes complete authority
    Given the requested WI, branch, and worktree target are free
    And unrelated tracked and untracked residue exists in the default checkout
    When the current session invokes the canonical bootstrap command
    Then one isolated worktree, graph, claim, and session binding form a complete tuple
    And every unrelated residue byte remains unchanged
    And governed mutation still requires the exact current skill receipt
    # Maps to: SIB-09, SIB-10, SIB-16, SIB-24

  Scenario: FW05-S9 Same-WI bootstrap race has one winner
    Given two sessions concurrently bootstrap the same new WI
    When both operations cross the repository/WI transaction boundary
    Then exactly one returns a complete winning tuple
    And the loser returns an actionable conflict without partial artifacts
    # Maps to: SIB-11 through SIB-15

  Scenario: FW05-S10 Claude and Codex resolve only the exact binding
    Given one valid owned tuple plus foreign graphs and receipts
    When the same fixture is evaluated by Claude Stop and Codex PreToolUse
    Then both select only the exact owned graph and worktree
    And wrong-WI, wrong-worktree, foreign-receipt, and forged-override variants never grant authority
    # Maps to: SIB-04 through SIB-08, SIB-19 through SIB-25

  Scenario: FW05-S11 Legacy inspection never migrates implicitly
    Given supported, lossless legacy, future-version, malformed, and fresh-foreign graph fixtures
    When compatibility inspection runs
    Then only supported bound state can become authority
    And legacy state receives a read-only normalized view or quarantine recommendation without byte changes
    And disk migration requires explicit authorization, backup, digests, and a terminal receipt
    And fresh foreign state remains unchanged
    # Maps to: SIB-26 through SIB-35

  Scenario: FW05-S12 Unchanged unsupported state cannot loop forever
    Given one session encounters the same unsupported state bytes during PreToolUse or Stop
    When the hook handles the same session and state digest repeatedly
    Then the first result is actionable and subsequent unchanged results are advisory or allow
    And changing the state digest permits exactly one new actionable diagnosis
    And another session has an independent bounded result
    # Maps to: SIB-36 through SIB-42

  Scenario: FW05-S13 Operation scope overrides session context without erasing it
    Given a session cwd, explicit tool workdir, and file targets can name different filesystem scopes
    When a mutation hook resolves the operation
    Then the original session repository remains available for diagnostics
    And relative workdir and every target canonicalize before exact worktree comparison
    And missing, dangling, contradictory, mixed-worktree, nested-repository, and symlink-escape variants deny
    # Maps to: WI-502 OS-01 through OS-10

  Scenario: FW05-S14 Controller handover changes generation atomically
    Given one active controller lease and a different stable session principal
    When the owner prepares and the new session accepts a valid one-time handover
    Then compare-and-swap leaves exactly one controller at the next generation
    And the old controller receipts and old-generation child capabilities cannot mutate or merge
    And same-session resume does not change generation
    # Maps to: WI-502 AU-01 through AU-07

  Scenario: FW05-S15 Disjoint child tasks mutate isolated worktrees and merge sequentially
    Given one execute-changeset stage with two pairwise-disjoint leaf tasks
    When the parent issues and each stable child accepts its scoped delegation
    Then each child mutates only its own inner worktree and allowed paths
    And overlapping, unknown, shared, parent-state, sibling-state, and denied paths never run concurrently
    And the parent recomputes each completion receipt before sequential merge and revalidation
    # Maps to: WI-502 DG-01 through DG-10

  Scenario: FW05-S16 Hook authority and filesystem containment remain distinct
    Given a Bash command can change directories, use absolute paths, redirect output, or spawn a subprocess
    When the framework evaluates and executes it
    Then obvious structured cross-root forms are denied by the hook
    And supported hosts enforce the authorized write root with a sandbox or wrapper
    And a host without trustworthy child identity or containment reports mutating child execution unsupported
    And documentation never describes PreToolUse alone as complete shell containment
    # Maps to: WI-502 SB-01 through SB-04
