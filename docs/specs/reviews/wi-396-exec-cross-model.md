# WI-396 — G6 cross-model review (Codex) + resolutions

**Reviewer:** codex (codex-cli), primary per `resolve-adversarial-reviewer.sh`. **Date:** 2026-06-08.
**Diff:** WI-396 envelope-integrity fixes (`quick-fix-eligibility.mjs`, `check-chain-receipts.mjs`, `emit-receipt.mjs`, `validate-envelope-integrity.sh`).
**Iterations:** 2 — first pass went off-script (file-dump, the known `reviewer-off-script` pattern); a scope-locked diff-only re-run produced the findings below. **Both accepted and fixed.**

| # | Sev | Finding | Resolution (accepted) |
|---|-----|---------|------------------------|
| 1 | HIGH | A forged exec-record/review-exec could OMIT `tree_hash`; since both the diff_hash 64-hex check and the tree-bind were gated on `tree_hash` *presence*, omitting it skipped everything → empty/fabricated diff_hash passes on a new forged envelope. | Grandfather by an **explicit metadata marker (`schema_version >= 2`)**, not by tree_hash absence. `emit-receipt` now stamps exec-record/review-exec at schema_version 2 + tree_hash. check-chain-receipts: when `schema_version>=2 OR tree_hash`, diff_hash MUST be 64-hex AND tree_hash MUST be present and match the commit tree (omission → reject). Legacy v1 receipts grandfathered (historical main with placeholder diff_hash, e.g. `1ceb4b62`, stays valid). |
| 2 | MED | The tier-1 test missed the omission vector (only tested empty diff_hash WITH tree_hash present). | Added two assertions: (a) legacy v1 envelope (no tree_hash) is grandfathered; (b) a v2 receipt with tree_hash OMITTED + empty diff_hash is REJECTED. Test now 8 green. |

**Residual (documented):** a deliberate forger could hand-craft a `schema_version:1` exec-record/review-exec on a *new* commit to claim legacy status and skip the binds — narrower than the reproduced hole (requires bypassing `emit-receipt`, which always stamps v2). A committer-date cutoff would close it fully; deferred as a fast-follow (the practical + lazy-agent vectors are closed).

**Self-review:** both reproduced holes closed with golden negatives; the load-bearing ROOT CAUSE (`loadSchema` cwd-relative → validateReceipt a no-op from any other cwd) was found and fixed during implementation; non-breaking verified live on `2a20d372` (WI-395) + `1ceb4b62`. Full tier-1 203/0.
