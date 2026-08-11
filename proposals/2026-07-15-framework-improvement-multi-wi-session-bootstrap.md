# Framework improvement: session-scoped multi-WI bootstrap

**Status:** DRAFT
accepted_wi: WI-486
**Date:** 2026-07-15
**Source:** Example Marketplace parallel-session failure after WI-485; Fable 5 high-effort review
**Candidate severity:** high
**Severity:** high
**Plan-changeset class:** hot-path

## Gap

The Codex execution-integrity guard treats multiple repository-wide in-progress task graphs as ambiguous current authority. It denies before read-only classification and before a new session can create an isolated graph/binding. The supported model of multiple WIs in separate sessions and worktrees therefore has no safe bootstrap path when the default checkout does not name a single WI.

This is one gap: **current-session authority and bootstrap cannot be derived safely in a repository containing foreign live work**. The default-checkout cleanliness restriction belongs here because it makes that same bootstrap path unreachable when unrelated untracked residue exists.

The normal bootstrap path is non-mutating with respect to every pre-existing graph, claim, binding, and default-checkout file. Legacy compatibility is a separate mode of the same authority resolver: it may derive a read-only normalized view without authorization, but any on-disk migration requires an explicit setup/upgrade invocation, a versioned migration marker, a before-state backup, and a receipt. It never rewrites state owned by a fresh foreign session.

## Evidence

- Example Marketplace contained two non-completed graphs with in-progress tasks: `WI-JRUN-01` and `WI-RECEIPT-INTL-01`.
- `hooks/codex/svc-codex-skill-load-enforcer.mjs` denied ambiguity before allowing read-only operations.
- `hooks/codex/lib/codex-hook-context.mjs` scanned all non-completed graphs when neither a valid current binding nor a WI-named branch selected one.
- A new WI had no graph to select yet, so graph selection could not bootstrap its own authority.
- `scripts/svc-ensure-worktree.mjs` rejected a default checkout containing unrelated untracked files, even though an isolated worktree could be created without changing them.
- A manual `git worktree add` plus `scripts/session-worktree-binding.mjs create` successfully established an isolated WI-486 binding without touching foreign state, proving the missing operation is bounded.
- On a separate machine, old or unsupported work-item state caused repeated continuation behavior instead of a bounded compatibility diagnosis. Legacy graphs must not become current-session authority merely because the current framework cannot parse their schema.
- The intake Tier-1 run found an eight-hour stale WI-481 session contract. Stale shared contracts are expected migration input and must not create current-session pressure or make first run retry indefinitely.

## Relationship to existing controls

This extends WI-484's session/worktree/WI ownership binding and WI-485's Codex exact-skill gate. It does not weaken either control and does not create a new lane or review gate. The fix belongs in the existing context resolver, mutation guard, binding helper, and worktree bootstrap helper.

Host/model labels used by any replay must resolve through `references/model-routing.md`; the behavioral acceptance criteria are host-contract assertions, not assumptions about an unverified model alias.

## Proposed change boundary

Likely implementation surfaces after planning:

- `hooks/codex/lib/codex-hook-context.mjs`
- `hooks/codex/svc-codex-skill-load-enforcer.mjs`
- Claude ownership/completion guards that share the invariant
- `scripts/svc-ensure-worktree.mjs`
- focused multi-session and bootstrap fixtures under `test-framework/evals/tier-1/`

No product repository task graph may be rewritten as part of the framework fix.

## Acceptance criteria

- **AC-486-1:** With at least two foreign live graphs and no current binding, read-only operations are allowed; arbitrary mutation remains denied with a diagnostic that identifies missing current authority without claiming foreign work.
- **AC-486-2:** A bounded bootstrap command can create a new isolated worktree, graph, claim, and session binding without reading authority from or mutating foreign graphs.
- **AC-486-2A:** Graph, claim, and binding creation is atomic and exclusive for a WI: when two sessions bootstrap the same new WI concurrently, exactly one wins and the loser receives an actionable conflict without partial state.
- **AC-486-3:** After bootstrap, the current session resolves only its explicitly bound WI graph and absolute worktree path.
- **AC-486-4:** An unset, forged, outside-repository, wrong-worktree, wrong-WI, or mismatched `SVC_CODEX_TASK_GRAPH` value cannot grant authority.
- **AC-486-5:** A bound session cannot mutate another worktree or satisfy its skill receipt from a foreign graph.
- **AC-486-6:** Worktree bootstrap succeeds when the default checkout has unrelated tracked modifications or untracked residue and proves all residue is byte-for-byte unchanged; it may deny only when the requested branch/worktree target itself conflicts.
- **AC-486-7:** Claude and Codex replay fixtures enforce the same ownership invariant; foreign-session Stop remains allow/advisory rather than creating continuation pressure.
- **AC-486-8:** Once bootstrap completes, WI-485's exact skill-load receipt remains mandatory before governed mutation.
- **AC-486-9:** Legacy, future-version, malformed, or unsupported task graphs receive a read-only normalized view when lossless, otherwise an actionable quarantine recommendation; they never become implicit current authority. On-disk normalization/quarantine runs only through an explicit setup/upgrade migration, backs up the original, records authorization and before/after digests, and never rewrites a fresh foreign session's state.
- **AC-486-10:** Stop and PreToolUse compatibility handling is bounded and keyed by session plus state digest, so the same unsupported work-item state cannot create an unbounded retry/continuation loop.

## Negative tests

- Two foreign in-progress graphs on a neutral branch.
- Completed and stale graphs mixed with live graphs.
- Shell chaining that hides a mutation behind a read command.
- Path traversal and symlink escape in graph/worktree inputs.
- Forged environment overrides and replayed bindings.
- Bootstrap replay after partial graph, claim, or binding creation.
- Two sessions concurrently bootstrapping the same new WI, asserting one complete winner and one clean loser.
- Unrelated tracked modifications and untracked files in the default checkout.
- Pre-upgrade task-graph schemas, unknown schema versions, malformed graphs, and mixed old/new graph sets.
- Stale session contracts, fresh foreign contracts, and contracts whose WI no longer has a supported graph.
- Repeated Stop and mutation attempts against an unchanged unsupported-state digest, proving the loop breaker.

## Route

**Lane:** framework
Severity: high — the regression blocks supported parallel sessions and tempts unsafe state takeover.
**Plan class:** full mandatory chain; hot-path hook and concurrency semantics are not a quick fix.
**Sequence:** diagnose-bug → write-spec → plan-changeset → adversarial review → execute-changeset → review-exec → audit-implementation → land-changeset → verify-promotion.

## Rollback and replay proof

Rollback restores the prior guard and helper behavior together; partial rollback is forbidden because guard and bootstrap semantics must remain paired. Verification must replay the exact Example Marketplace two-graph fixture, a clean single-WI fixture, the atomic same-WI race, and versioned legacy/unsupported graph fixtures. The bootstrap proof must show no pre-existing or fresh-foreign graph, claim, binding, or default-checkout file changed. The separately authorized migration proof must show a backup plus receipted before/after changes only for eligible legacy state and must prove termination.
