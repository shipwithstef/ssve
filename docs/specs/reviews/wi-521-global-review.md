# WI-521 — fresh-context global cross-check (audit-implementation stage)

**Reviewer:** Opus, fresh context by design — deliberately not the orchestrator, whose context is steeped in the work. ONE invocation, 2 passes (pass 2 changed nothing). Executor family anthropic, reviewer family anthropic — cross-family fence WARNs; §4g drain-queue debt.

**Verdict: LAND-WITH-FOLLOWUPS.** Every load-bearing check was re-run by the reviewer rather than taken from the batch records: the 18-case validator suite, the WI's own receipts file, both land gates, the essential fence, `generate`, the EMPTY/UNRESOLVED/usage exit codes, and the full tier-1 suite against both `main` and `HEAD`.

## G1–G10

| G# | Closes end-to-end? | Evidence |
|---|---|---|
| G1 | **PARTIAL → closed at landing** | The CLI exists and is called from `land-changeset` Step 1f and Self-Verify row 8; ran green. But G1's *second* clause survived: two Self-Verify rows still bound index freshness to a per-scope `audit-*-contract.mjs` that has never existed in svc. Fixed inline at landing — see the sixth instance below. |
| G2 | YES | `route-workflow` P3 bash block; Self-Verify 2b re-pointed. `--diff main..HEAD` emits JSON with all 6 essential stages `active`; `--conditions` naming `plan` exits 2. |
| G3 | YES | Valid-sha index citing nothing → `[EMPTY] index cites nothing…`, exit 1. The EMPTY/UNRESOLVED split is real, not cosmetic. |
| G4 | YES | 42 stages / 6 / 26 / 10, arithmetic verified. Three consumers all load the registry; the private table is gone; `DEFAULT_CONDITIONS` ↔ registry set-equality asserted. No embedded fallback anywhere. |
| G5 | YES | The gitignore line is deleted and the sidecar is committed. Missing, unparseable, and post-stamp-citation cases each produce a SOFT note. |
| G6 | YES (advisory, as specified) | Row-cap comment plus the Superseded sentence at both restamp points. Nothing enforces it mechanically — the plan's declared minimal form. |
| G7 | YES | Template and script carry the same 10 axis names, quote-matched to `audit-feature`. |
| G8 | YES | `write-spec` carries the literal invocation block; `IN_CAP=50` with a pre-cap `truncated` denominator. |
| G9 | YES | `SKILL.md:1` → `[UNRESOLVED] … unresolvable: SKILL.md matches 103 files […(+98 more)]`, exit 1, capped at 5. The two-segment tier gets the same treatment. |
| G10 | YES | Step 1f carries both gates with Self-Verify rows 7 and 8 and correct exists-first ordering. The cross-link lands in `svc-auto-drive.mjs`'s `verify-promotion` receipt — a documented deviation, because `land-changeset` emits no receipt of its own. |

**AC coverage: 17/18 verified at review time; AC-18 closed in the hygiene commit.**

## The sixth reachability instance — found

Five instances of *correct logic that cannot run* were found and fixed across the three batches: a script with no caller; a check inside an already-failing branch; a `main()` guard that no-ops under a symlinked `scripts/` dir; a permissive `git()` helper that failed OPEN once a gate depended on it; and an essential fence present in the producer but absent from two consumers.

The global pass found the sixth, and it is the sharpest: **Batch B built the caller that makes `branchIndexFresh()` runnable, and Batch A flipped `align-feature` Self-Verify rows 3 and 5 off their UNVERIFIED caveat — but row 1, the branch-index row, the one G1 is actually about, was left pointing at the nonexistent `audit-*-contract.mjs`.** Same for `audit-feature` row 2. The failure mode is silence in the exact prescribed way: an agent runs `align-feature`, reaches row 1, finds no per-scope contract script, and records UNVERIFIED — reproducing the pattern this WI just eliminated, two rows below it, on the very check the WI built a CLI for.

Fixed inline at landing: both rows now cite `node scripts/check-branch-index.mjs --index docs/specs/relations/<scope>.branches.md`.

## Findings and disposition

| Sev | Finding | Disposition |
|---|---|---|
| HIGH | G1 half-open — the sixth instance above. | **FIXED INLINE** at landing. |
| MEDIUM | This WI introduced a tier-1 red: `land-changeset` Step 1f's remediation pointer cited `references/branch-index-template.md`, but the file is `write-spec/references/…`. `validate-markdown-ast` failed on it (0 occurrences on `main`), and `land-changeset`'s own Self-Verify row 5 requires tier-1 green post-merge — self-blocking. | **FIXED INLINE**; validator back to 2475 passed / 0 failed. |
| LOW | AC-18 unmet — WI-519/520 INDEX rows still `status:identified`. | **CLOSED** in the hygiene commit. |
| LOW | Loader asymmetry #2 — duplicate-stage-key and situational-in-profile checks reach only `audit-story-receipts.mjs`. | **WI-523** |
| LOW | `write-spec:96` says `Derived-at: HEAD`, which `parseBranchIndex` rejects as malformed. | **WI-523** |
| LOW | `route-workflow` 235 lines against a 220 budget (pre-existing red, +9 here). | **WI-523** |
| LOW | A P3 bash block is abbreviated and fails if copied verbatim. | **WI-523** |
| INFO | One `execSync` interpolation in `findStoryReceiptSha256`; path is git-derived and regex-filtered, so exposure is theoretical. | **WI-523** |

## Claims spot-checked

"No embedded fallback" ✅. "42 stages, 6/26/10" ✅. "Two align-feature rows are real checks again" ✅. "Schema declaration deliberately not landed" ✅ **and safe** — the reviewer read the schema and confirmed no `additionalProperties:false`, so the undeclared field is tolerated and WI-522's deferral breaks nothing today.

## The dogfood artifact — honest

Validator run by the reviewer: **STORY ALIGNED, exit 0.** Every `done` stage's evidence resolves — both commit SHAs are real objects, the review record is tracked and committed, and every cited script and skill is tracked. The single `na` (`ledger`) is legitimate for a framework WI. The round-1 forced green is genuinely corrected: `spec-sync` is `done` with tracked evidence and `review-exec` was pinned after the review rather than before.

One disclosed soft spot: `spec-sync`'s `grounded_on` cites the WI-521 row in `INDEX.md`, which exists only in the hygiene commit — true at PR time, not at `main..HEAD` when the reviewer looked.

## Cross-batch

The three registry loaders agree on key presence, class enum, and a non-empty essential set. The two receipt systems are genuinely not merged — one `story_receipt_sha256` field, derived from the merge commit's own tree, `null` on ambiguity or error.
