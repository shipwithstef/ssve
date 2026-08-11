# Solution Confidence: WI-511 quality-preserving optimizations

**Status:** direction selected
**Mode:** `design_auto`
**Decision:** Implement creator-owned, bounded stale loop-state cleanup; reject or defer the remaining pasted bundle items.
**Confidence:** high for the accepted change; high that the rejected items should not ship under this WI.

## 1. Decision question

Which portions of the pasted multi-script optimization proposal improve the current framework without reducing auditability, determinism, validation rigor, authority isolation, or state durability?

## 2. Current implementation grounding

| Surface | Current fact | Consequence |
|---|---|---|
| Candidate project identity | `resolveProjectId(root)` is called once in `main()` | An in-process cache removes no subprocess. |
| Candidate mirror | WI-508 specifies one deterministic JSON contract | An undefined Markdown parser creates a second format and drift surface. |
| SQLite contention | `PRAGMA busy_timeout = 5000` plus transactional rollback already bounds locks | Five outer retries can multiply latency and replay whole transactions. |
| Receipt ranges | WI-509 enumerates the range once and validates through bounded, ordered, per-SHA workers | Replacing workers with “one Git log” misstates the remaining subprocess work and removes isolation. |
| Completed-task integrity | Regexes are already top-level; timestamp validation performs strict calendar/offset checks and then `Date.parse()` | The proposed replacement is stale and weaker. |
| Receipt equality | `isDeepStrictEqual` compares exact structured payloads | Hashing adds canonicalization/collision failure modes without a measured bottleneck. |
| Task graph paths | Evidence paths are repository-relative; canonical worktree roots are authority data outside the graph | A blanket relative-path rewrite has no coherent target and can weaken ownership boundaries. |
| Loop guard | One bounded JSON state file per session; no expiry lifecycle | This is the one reproduced lifecycle gap. |

## 3. Prior decisions recovered

1. [WI-399](../../../work-items/WI-399.md) introduced per-session guard state to prevent cross-session counter pollution. Cleanup must preserve this isolation.
2. [WI-440](../../../work-items/WI-440.md) requires zero-loss optimization children to ship one-per-run and records that naive consolidations were rejected.
3. [WI-452](../../../work-items/WI-452.md) makes the resolved repository `.svc` directory the only valid hook-state home and proves out-of-repo writes must not seed state.
4. [WI-508](../../../work-items/WI-508.md) intentionally selects deterministic JSON plus bounded SQLite contention for the candidate reservoir.
5. [WI-509](../../../work-items/WI-509.md) intentionally selects ordered, timeout-bounded receipt workers to preserve per-SHA fail-closed attribution.
6. [WI-510](../../../work-items/WI-510.md) preserves strict structured evidence and refuses prose or malformed-data bypasses.
7. [Leftover disposition](../../../../references/leftover-disposition.md) classifies loop-guard state as generated machine-local residue, unlike append-only audit history.

These are current local framework contracts and therefore stronger evidence for this repository than a generic optimization checklist.

## 4. User and operator outcome

The operator sees no new command or output. Long-lived repositories stop accumulating abandoned loop-guard session files. Current-session loop detection, warnings, denials, and persistence remain unchanged.

## 5. Surface and compatibility review

- **Web/mobile/native:** not applicable; no product runtime or rendered surface.
- **Hosts:** the shared `.mjs` loop guard remains the only changed execution surface, so all provisioned hosts consuming it retain the same input/output contract.
- **Stored state:** existing JSON remains readable; no schema migration.
- **Legacy:** the unsuffixed `loop-guard-state.json` file is eligible under the same age rules but the current path is always excluded.
- **Security:** only exact basenames in the resolved `.svc` directory are considered; symlinks and non-regular files are refused.

## 6. Cache and freshness analysis

No correctness cache is introduced.

Cleanup is freshness-based maintenance:

- expiry: strictly older than seven days by filesystem `mtime`;
- scan cadence: when the current session state file is absent or itself has been inactive for at least 24 hours;
- active path: always excluded regardless of age;
- concurrent sibling write: candidate deletion acquires the same state-file lock with zero wait and skips a locked file;
- failure: cleanup fails open while loop detection continues.

A SHA-only reconcile cache is rejected because receipt notes, policy, and validator semantics can change without the commit SHA changing.

## 7. Cost model

| Dimension | Accepted design | Pasted broad bundle |
|---|---|---|
| Hot-path CPU | One `lstat` per call; directory scan at most once per active day/session | New parsing, cache validation, hashing, and retry paths across five scripts |
| Filesystem | Removes expired generated files | Adds reconcile cache and possibly dual candidate mirrors |
| Storage | Decreases local generated file count | Increases cache/format state |
| Network / paid APIs | None | None |
| Failure complexity | One best-effort owner-local helper | Cross-cutting invalidation and migration logic |

Expected monetary cost is $0. The performance red line is any measurable loop-hook latency regression beyond normal timing noise; focused timing and full Tier-1 guard this.

## 8. Sourced precedents

| Precedent | Lesson applied |
|---|---|
| WI-399 A7 per-session state | Do not merge or glob-delete live session state. |
| WI-440 zero-loss epic | Ship one independently provable child; reject attractive but semantically coupling edits. |
| WI-452 scoped state resolver | Operate only in the resolved repository `.svc`; no cwd or global sweep. |
| WI-508 local state contract | Preserve deterministic format and bounded transactional behavior unless a separate contract WI justifies change. |
| WI-509 bounded workers | Keep isolation and failure attribution when optimizing orchestration. |
| WI-510 strict integrity | Never replace strict structural checks with permissive parsing or prose-like shortcuts. |
| Leftover disposition contract | Generated loop state is reclaimable; audit/decision/task evidence is not. |

## 9. Options considered

### A. Apply the pasted bundle literally

Rejected. Several premises are already implemented, and several changes weaken explicit contracts or add undefined formats.

### B. Creator-owned eager cleanup with lock-aware deletion

Selected with modification: scan only when the current session is new or inactive for 24 hours, not on every tool call.

### C. Lazy cleanup only when reading a named stale file

Rejected. The guard reads only the current session file, so abandoned sibling files would remain unreachable and never be reclaimed.

### D. Central cleanup in `scripts/task-graph.mjs`

Rejected. Task graphs neither create nor consume loop state; coupling lifecycle cleanup there violates ownership and misses calls that never invoke task-graph.

### E. Separate janitor command or daemon

Rejected. It adds scheduling, discoverability, and lifecycle state for a small local maintenance concern.

## 10. Tradeoff matrix

| Criterion | A literal bundle | B creator-owned cleanup | C lazy named cleanup | D task-graph cleanup | E janitor |
|---|---:|---:|---:|---:|---:|
| Preserves current contracts | fail | pass | pass | risk | pass |
| Reclaims abandoned siblings | mixed | pass | fail | partial | pass |
| Hot-path bounded | risk | pass | pass | pass | pass |
| Correct ownership | fail | pass | pass | fail | partial |
| No new persistent state | fail | pass | pass | pass | fail |
| Easy rollback | fail | pass | pass | pass | partial |

## 11. Falsification and failure cases

The selected design is rejected by tests if any of these occur:

- current state is removed;
- a file at or newer than the cutoff is removed;
- a symlink, directory, unrelated name, or outside path is removed;
- a locked candidate is removed or blocks the hook;
- `readdir`, `lstat`, lock acquisition, or unlink failure changes the current hook decision;
- malformed current JSON prevents cleanup or current-state recovery;
- existing five-repeat blocking, pagination, or cross-host payload fixtures change.

## 12. Assumptions and reversibility

- Assumption: loop-guard files are machine-local generated state, confirmed by `.gitignore` and leftover-disposition policy.
- Assumption: all loop-guard writers use `writeJsonAtomic`, confirmed in the current hook.
- Assumption: seven days is the user-specified expiry and safely exceeds normal session inactivity.
- Reversal: revert the helper import/call and focused validator; no migration or data restoration is required.
- Deferred contract work: semantic candidate IDs require a separate feature WI with normalization/collision rules.

## 13. External suggestion triage

| Suggestion | Verdict |
|---|---|
| Markdown candidate parsing | reject |
| project ID cache | unrelated/no-op |
| candidate ID regex broadening | defer |
| SQLite exponential retries | reject as proposed |
| single bulk Git log | unrelated/already present at discovery layer |
| SHA-only reconcile cache | reject |
| regex hoisting | already satisfied |
| `Date.parse()` only | reject |
| SHA-256 payload equality | reject |
| relative task-graph paths | reject |
| seven-day loop-state pruning | modify and adopt in the owner hook |

## 14. Action-by-action approval packet

| Action | Why / how | Positive outcome | Negative or risk outcome | If skipped | Proof gate |
|---|---|---|---|---|---|
| Add lifecycle helper | Centralize exact filename, cutoff, lock, and file-type rules under `hooks/lib/` | Small testable safety boundary | One new internal module | Orphaned files continue accumulating | Unit-like helper fixtures plus hook process replay |
| Invoke cleanup from loop guard | Run only when current state is absent or inactive for 24h, before current-state load | Bounded automatic cleanup | Small `lstat` hot-path cost | Helper is inert | Existing loop behavior and latency remain green |
| Extend focused validator | Seed stale/fresh/current/symlink/locked/error fixtures | Mutation-red proof of deletion boundary | Slight Tier-1 duration increase | Safety relies on prose | Focused validator fails on disabled/overbroad cleanup |
| Update framework records | Record accepted/rejected optimization decisions | Prevents future unsafe reapplication | Documentation maintenance | Same stale proposal can recur | Spec/plan/audit consistency checks |
| Land and replay | Full chain, final-SHA receipts, promoted focused test and reconcile | Proven main behavior | Merge latency | Only local confidence | PR merge, final receipts, promoted replay |

**Outcome coverage:** WI511-AC1 through WI511-AC8 are covered.
**Final confidence:** High. The accepted change is narrow, reversible, owner-local, lock-aware, and directly testable; the excluded bundle items lack either a current bottleneck or a quality-preserving contract.
