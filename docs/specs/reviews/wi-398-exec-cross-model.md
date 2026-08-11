# WI-398 — G6 cross-model review + resolutions

**Primary reviewer:** codex — **credit-exhausted** (verified live: `ERROR: You've hit your usage limit … try again at Jun 11th, 2026`), a legitimate mid-run primary failure.
**Fallback reviewer:** gemini (per `resolve-adversarial-reviewer.sh` Claude→Codex→Gemini). Diff-only, scope-locked review (`--approval-mode plan`, package piped via stdin per `cli-prompt-packages-stdin-not-argv`). **Date:** 2026-06-08.
**Verdict:** 5 findings (2 HIGH, 2 MEDIUM, 1 LOW) — **all accepted and fixed.**

| # | Sev | Finding | Resolution (accepted) |
|---|-----|---------|------------------------|
| 1 | HIGH | On a true `Conflict`, the driver exited 1 but left `%A` = ours-content (valid JSON, no markers). An agent could `git add` it and **silently discard theirs**. | Driver now writes STANDARD conflict markers into `%A` (`<<<<<<< ours … ======= … >>>>>>> theirs`, both sides verbatim → invalid JSON, visible). Git still records the unmerged path; the file can no longer be silently resolved as valid ours-only. Locked by a fixture assertion (markers present AND file is invalid JSON). |
| 2 | HIGH | Array merge `Set`/`Map`-keyed by `idOf` silently **collapsed legitimate duplicate** primitives/objects on a real 3-way merge (and `capability-registry.json` / allowlists ARE primitive arrays). | Id-less / primitive arrays now use a 3-way **multiset** merge: per-value count = `max(0, ours + theirs − base)` — preserves duplicates, merges disjoint additions, honors deletions. Element-wise keyed merge is kept ONLY when every element on both sides carries a stable id. Locked by a duplicate-preservation fixture (`["x","x"]` + `o` + `t` → `x×2,o,t`). |
| 3 | MEDIUM | `idOf`/`deepEqual` used `JSON.stringify`, which is **key-order dependent** → the same object serialized with different key order produced distinct identities (spurious duplication / missed equality). | Introduced `canon(x)` — a recursive key-sorted canonical serialization — used for both `deepEqual` and array identity. Order-independent now. |
| 4 | MEDIUM | The tier-1 fixture configured the driver via a hand-written `git config` instead of running `install-svc-merge-driver.sh`, so **installer bugs would pass** the gate. | Fixture now runs the REAL installer (`bash install-svc-merge-driver.sh --repo "$TMP" --driver "$ABS_DRIVER"`) and asserts the config landed — end-to-end coverage. |
| 5 | LOW | `init-project-state.mjs` `.gitattributes` sync spliced the trimmed template against the remainder; if the old END marker had no following newline, subsequent rules could **jam onto the marker line** (commented out). | Sync path now inserts exactly one newline between the template and the remainder (`rest===""?"\n":rest.startsWith("\n")?"":"\n"`). |

**Self-review (P1):** the driver is deterministic and hermetic; lossless by construction on clean merge (object deep-merge + array multiset/keyed merge), conflict-with-visible-markers on true overlap (never silent loss), canonical identity (order-independent), foreign-worktree safe (argv-only, absolute installer path). All three ACs proven by live `git -C` fixtures inside the tier-1 gate.

**Rejection action:** patch-in-place (driver merge logic revised + 2 validator assertions added + 1 init-project hardening), re-verified — `validate-svc-state-merge-safety.sh` 15/15, full tier-1 green. Iteration count: 1.
