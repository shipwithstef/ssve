# Framework Evolution — 2026-05-13 — Multi-Session Collision on Main Checkout

**Status:** DRAFT
**Severity:** MEDIUM (real session disruption, low data-loss risk thanks to existing receipt machinery)
**Author:** Claude Opus 4.7 — observed during Example Marketplace WI-238 → svc framework-evolution session
**Related:** `WORKTREES.md` lines 17-20, `rules/destructive-git-ops.md`, `references/chain-receipt-contract.md`

## Method

Empirical: real collision observed end-to-end this session while landing PR #143 (`feat(provider-fidelity): test-contract rule + framework learnings + AP-34`). Reproduced with concrete commit SHAs and receipt mis-routing.

## Observed failure mode

While preparing receipts for cherry-picked commit `d332c279` (now landed as `b7b9e9c1` → squash-merged as `485e952c`), the following sequence happened:

1. Session A (mine) was on branch `feat/pf-test-contract-v2` (HEAD = `d332c279`)
2. Session A emitted 3 receipts (plan-manifest, review-plan, exec-record) — all correctly written to `.svc/receipts/d332c27/`
3. Between the 3rd and 4th emit, **Session B (concurrent)** switched HEAD on the shared checkout to `fix/session-contract-freshness` then to `main`
4. Session A's 4th emit (review-exec) wrote to `.svc/receipts/839fb9b/` — the wrong SHA (`839fb9b5` was the merge commit on local main)
5. Session A had to detect the mis-routing, `git checkout feat/pf-test-contract-v2`, and re-emit review-exec

Cost: ~5 minutes of confusion + 1 wasted receipt entry. The framework's chain-receipt validator caught the mis-routing during push (`check-chain-receipts.mjs` returned `incomplete` for the right SHA), which prevented the receipt-less push from succeeding — that's the existing safety net working as designed.

Secondary fallout from the same root cause:

- Local `main` ended up 2 commits ahead of `origin/main` (`839fb9b5` merge + `b9b5607c`) because Session B had been working on main and left commits unpushed
- My first push attempt of `feat/pf-test-contract-v2` got the wrong push-range (`origin/main..HEAD` included Session B's unpushed commits) → chain-receipt validator complained about missing receipts for Session B's commits → push refused
- Recovery: cherry-pick `d332c279` onto `origin/main` directly into a fresh branch `feat/pf-test-contract-v3`, re-emit 5 receipts for the new SHA, then push (succeeded as PR #143)

Total recovery cost: ~15 minutes including a `git branch -D` that required emitting the destructive-git preamble.

## Why the framework's current docs didn't prevent this

`WORKTREES.md` lines 17-20 explicitly say framework doc edits + spec writing + reviews "Never" need a worktree:

> | Framework doc edits (DOCTRINE, WORKTREES, FRAMEWORK-STATE, AGENTS) | **Never** | These docs govern main itself; worktree adds friction with no isolation benefit. Direct commit with post-commit tier-1 validation. |
> | Spec writing (`write-spec`) | **Never** | Single-file edits, safe on main |

The reasoning was: a single agent doing single-file framework-doc edits on main is safe — no concurrent build/test/E2E to isolate.

What the table didn't anticipate: **multiple concurrent agent sessions operating on the same physical checkout**. When Session A is mid-receipt-emission and Session B switches branches, the receipt machinery (which reads `git rev-parse HEAD` to determine target SHA) binds to the wrong commit. The work isn't lost — just mis-attributed.

This is the user-reported confusion: *"I thought all is worktree based — how come?"* The answer is "it isn't, by design, for framework-doc work — and that design assumed single-session-at-a-time."

## Proposed fix (3 options, ranked)

### Option A (RECOMMENDED): Receipt-emission must pin HEAD via `--sha` flag, not infer from `git rev-parse`

`scripts/emit-receipt.mjs` currently writes to `.svc/receipts/<HEAD-sha>/<type>.json` and updates the git note for `HEAD`. If a concurrent session moves HEAD, the emit binds wrong.

**Fix:** add a required `--sha <sha>` flag. The caller must explicitly state which commit the receipt is for. The script refuses to fall back to `git rev-parse HEAD`.

```bash
# Before (current — implicit HEAD)
cat receipt.json | node scripts/emit-receipt.mjs --type plan-manifest --wi WI-XYZ

# After (explicit SHA — collision-safe)
cat receipt.json | node scripts/emit-receipt.mjs --type plan-manifest --wi WI-XYZ --sha d332c279
```

**Cost:** small. ~20-line change to `emit-receipt.mjs` + every caller updated to pass `--sha $(git rev-parse HEAD)` once at the start of the receipt sequence, then reuse.

**Benefit:** no more cross-session HEAD-drift can mis-route a receipt. The receipt is a property of the commit, not of "wherever HEAD happens to be right now."

### Option B: Pre-emit branch verification — refuse if HEAD changed since last receipt

Track the expected HEAD between consecutive emits for the same WI. If HEAD changed and the new HEAD is not the same as the last emit's target, refuse.

**Cost:** medium. Per-WI state file at `.svc/receipt-session-pin/<WI>.json` storing the expected SHA.

**Benefit:** catches the same class of mis-routing, but only between SAME-WI emits — doesn't help if Session B is emitting receipts for an unrelated WI.

### Option C: Per-session worktree even for framework-doc edits

Amend `WORKTREES.md` table: framework doc edits use a lightweight session-pinned worktree at `.worktrees/session-<session-id>/` to guarantee multi-session isolation.

**Cost:** high. Every doc-edit session pays worktree setup cost, the framework's "framework doc edits run on main" doctrine inverts, and existing skills (like create-skill, evolve-framework, blend-external) need to learn worktree handling.

**Benefit:** complete isolation. But this is the heavy hammer for what Option A solves with a 1-flag change.

## Recommendation: ship Option A as a tiered fix

| Phase | Action | Effort |
|---|---|---|
| **P1 (this WI)** | Add `--sha <sha>` flag to `emit-receipt.mjs`. Fall back to `git rev-parse HEAD` with a deprecation warning logged to `.svc/pipeline-decisions.jsonl`. | 20 min |
| **P2** | Update callers in chain skills (`plan-changeset`, `review-plan`, `execute-changeset`, `review-exec`, `audit-implementation`) to capture HEAD at start and pass `--sha` to every receipt. | 1 hour |
| **P3** | Flip deprecation warning to hard error if `--sha` is missing. Bake into `references/chain-receipt-contract.md`. | 15 min |
| **P4 (deferred)** | Optional: add concurrent-session detection on the framework checkout (lockfile or git rev-parse polling). Only if Option A doesn't fully solve. | TBD |

## What this does NOT propose

- **Does not change WORKTREES.md doctrine.** Framework doc edits still don't need a full worktree per edit. The fix is at the receipt-binding layer, not the working-tree layer.
- **Does not block parallel sessions on main.** Multiple sessions CAN still operate on the framework checkout — they just can't accidentally bind a receipt to each other's HEAD.
- **Does not require a lockfile.** Receipt-binding is per-SHA-and-WI; lockfile is heavier than needed.

## Acceptance criteria

- [ ] `emit-receipt.mjs` accepts `--sha <full-sha-or-short-sha>` and uses it as the target for both `.svc/receipts/<sha>/` mirror and the git note.
- [ ] If `--sha` is omitted, log a deprecation entry to `.svc/pipeline-decisions.jsonl` (P1) → later hard-fail (P3).
- [ ] Chain skills capture `BASE_SHA=$(git rev-parse HEAD)` once at the start of receipt emission and pass it to every emit-receipt call in the chain.
- [ ] Regression test: run two concurrent shell sessions, have Session A emit-receipt while Session B `git checkout` switches branches. Receipt MUST land on Session A's intended SHA.
- [ ] Update `references/chain-receipt-contract.md` to document the `--sha` requirement.

## How this was discovered

- Real session 2026-05-13 (Example Marketplace WI-238 → svc PR #143 landing)
- Symptom: `cat receipt.json | node scripts/emit-receipt.mjs --type review-exec ...` wrote to `.svc/receipts/839fb9b/review-exec.json` instead of `.svc/receipts/d332c27/review-exec.json`
- Root cause: `git rev-parse HEAD` inside emit-receipt.mjs returned `839fb9b5` (Session B's HEAD) instead of `d332c279` (Session A's intended commit)
- Recovery: explicit `git checkout feat/pf-test-contract-v2` before each subsequent emit-receipt call. Painful but workable.
- Framework's existing safety net (chain-receipt validator on push) caught the mis-routing and refused the push — that's the existing receipt machinery working as designed.

## Confidence

HIGH that Option A solves the observed failure mode for ~30 minutes of work. The fix is minimal, doesn't change doctrine, doesn't require new infrastructure.
