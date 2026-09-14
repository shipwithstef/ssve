# WI-478 Change-Set Manifest — Andromeda paid-creative doctrine → ad-strategist

**Date:** 2026-07-13 (rev 3 — post review-plan round 2; rounds 1+2 findings all accepted) | **Lane:** framework | **Risk class:** M
**Execution mode:** inline single-orchestrator (one worktree, one migration commit)
**Spec:** `docs/specs/work-items/WI-478.md` ACs (amended this round) + `proposals/2026-07-13-blend-coreyhaines-v2.6.0.md` § Blend item 2
**Doctrine source (quote, no fabrication):** `references/knowledge/competitors/coreyhaines-martech/details/new-skills-v2.0-v2.6.md` § "ads rewrite" (upstream `ads` 2.1.0)

## File set & two-commit strategy (R7)

**Commit P (planning, exempt-class, lands on main BEFORE the worktree):** this manifest, `docs/plans/2026-07-13-wi478-andromeda-doctrine/review-log.yaml` (+ raw review captures), the amended `docs/specs/work-items/WI-478.md`, `.svc/lane-tasks-WI-478.json`, `.svc/pipeline-decisions.jsonl` appends. Because P precedes the worktree branch, the plan + review log exist inside the worktree.

**Commit M (implementation, worktree branch `WI-478-andromeda-doctrine`):** blueprints #1–4 below. **Blueprint #5 (the WI-478.md AC amendment) lands in Commit P**, not M — it is a planning-artifact change and must exist before the worktree is created.

## Scope decisions (all 8 round-1 findings resolved)

1. **Source-faithful, Meta-scoped (R2 no-fabrication):** broad-targeting / static-volume / interest-stacking-harmful rules are **Meta-specific** (they are Meta claims in the source). TikTok/Search keep ONLY their split ratios. "**five variants per segment**" (not "N"). Playbook labeled "**2026+**" per source. "Static-first" is marked as svc's operational inference from "statics often outperform," not a source quote. **No "YouTube/top-of-funnel = where video wins" claim** — the source names no "video wins here" placements, so svc does not assert them; video is reserved only for placements the owner designates.
2. **Contradiction fix (R3):** the blanket sentence *"Most failures are targeting failures, not messaging failures."* in BOTH `agents/ad-strategist.md:18` and `ad-video-script/SKILL.md:54` is **replaced** with a platform-conditional rule (targeting-led on Search/LinkedIn; creative-led on Meta/TikTok post-Andromeda). No two incompatible instructions remain.
3. **No phantom static-production branch (R4):** the fleet stays **video-only**. The doctrine adds a *recommendation* the agent surfaces — a `static_comparator_recommended` flag + rationale in the return contract — NOT a static production path. The agent still runs `ad-video-script`, still emits `beat_sheets`, still hands off to `ad-video-producer`. Return contract is extended with the optional flag.
4. **Claude mirror is GENERATED (R5):** edit **`agents/ad-strategist.md` only**, then `node scripts/sync-native-agents.mjs`; verify `--check`. Do NOT hand-edit `.claude/agents/ad-strategist.md`.
5. **Ledger schema is decision-adequate (R6):** the `campaigns.jsonl` append contract gains `platform`, `placement`, `creative_format` (static\|video\|carousel), `targeting_mode` (broad\|stacked — **Meta-scoped**; other platforms omit or use their own), a stable `campaign_id`, and explicit shipped-event vs outcome-event append semantics — enough to evaluate a platform-conditional prior. Additive optional fields; no migration (no `campaigns.jsonl` exists yet; loop inert until real signal).
6. **Behavioral recency (R8):** the block records source version, extraction date (2026-07-13), review-due (2027-01), and **stale behavior** (after review-due, do not apply until re-extracted or account evidence reconfirms).

## External State Lifecycle (R1)

Taxonomy walk per `references/external-state-lifecycle-protocol.md` (15 entries):

| # | Environment | This plan | Coupling |
|---|-------------|-----------|----------|
| 1 | Host filesystem outside repo | untouched (no addon re-pin; WI-477 already did that) | — |
| 3 | Out-of-tree but version-controlled | **TOUCHED** — creates branch `WI-478-andromeda-doctrine` + a sibling worktree under `.worktrees/` | coupled → create (from main after commit P) / land (PR+merge) / remove worktree post-merge are one sequence; **abort cleanup**: on any pre-merge failure, remove the worktree (worktree.sh remove) and delete the branch to restore single-branch state (Exec + Checkpoints) |
| 12 | Downstream framework artifacts | **TOUCHED** — `.claude/agents/ad-strategist.md` is GENERATED from `agents/ad-strategist.md` by `scripts/sync-native-agents.mjs`; the mirror must be regenerated + `--check`-verified, not hand-edited | coupled → Exec step regenerates + checks |
| (runtime) | Installed addon `ads` skill | **RELIED ON, decoupled-justified** — the doctrine points ad-strategist at the addon `ads` skill (installed at v2.6.0 by WI-477); this plan does not install/modify it, only names it as a runtime reference | decoupled-justified — see paragraph below |
| 2,4,5,6,7,8,9,10,11,13,14,15 | (config, registries, schedulers, services, SaaS, DB, caches, DNS, search, CI, secrets, runtime FS) | untouched | — |

**Addon decoupled-justification (required paragraph):** the doctrine only *references* the addon `ads` skill by name (like `ad-video-script` today); it does not read the addon at plan/exec time, so a missing or version-drifted addon cannot break this change's landing or the agent's core video job. **Monitoring:** the WI-477 symlink guard (`validate-claude-skills-symlinks.sh`) and the addon `.version` file already track addon presence/version; the ad-strategist doctrine block carries the review-due 2027-01 stale-flag so an addon source drift surfaces as a doctrine-refresh task. **Recovery:** if an agent run finds the `ads` skill absent, it falls back to its existing behavior (the doctrine priors are self-contained in the block; the `ads` pointer is an enrichment, not a hard dependency) — reinstall path is WI-477's documented `EXTERNAL_ADDONS.md` install+relink.

Untouched: all except 3, 12 + the addon runtime reference. No machine-local mutation, no post-merge flip (unlike WI-477).

## File blueprints

| # | File | Action |
|---|------|--------|
| 1 | `agents/ad-strategist.md` | (a) Replace the L18 blanket "Most failures are targeting failures…" with the platform-conditional rule. (b) Add the `## Platform doctrine (Andromeda-era priors…)` section (scratchpad-drafted, source-faithful) after "Your job". (c) Add addon `ads` pointer in step 3 / doctrine. (d) Extend the return contract with optional `static_comparator_recommended` + rationale. |
| 2 | `.claude/agents/ad-strategist.md` | **GENERATED** — `node scripts/sync-native-agents.mjs` after #1; `--check` must pass. Not hand-edited. |
| 3 | `ad-video-script/SKILL.md` | (a) Replace the L54 blanket "Most failures are targeting failures…" with the same platform-conditional rule. (b) In Step 2, add a one-line pointer to the ad-strategist platform doctrine for the creative-vs-targeting / format decision (pointer, not duplication). |
| 4 | `agents/ad-strategist.md` | Ledger append-contract bullet: add `platform`, `placement`, `creative_format`, `targeting_mode` (Meta-scoped), `campaign_id`, shipped/outcome event semantics. (Part of #1's file; listed separately for clarity.) |
| 5 | `docs/specs/work-items/WI-478.md` | Amend AC1 to Meta-scoped wording (remove the unsupported Meta/TikTok generalization) — lands in **commit P** with the other planning artifacts, not commit M. |

## Execution Command Sequence

```bash
set -euo pipefail
ROOT=/workspace/seriousvibecoding
# commit P (planning incl. amended WI-478.md) lands on main FIRST, then:
bash scripts/worktree.sh create WI-478-andromeda-doctrine
WT="$ROOT/.worktrees/WI-478-andromeda-doctrine"; cd "$WT"
# edits #1,#3,#4 on agents/ad-strategist.md + ad-video-script/SKILL.md
node scripts/sync-native-agents.mjs           # regenerate #2
node scripts/sync-native-agents.mjs --check    # must print "native agents in sync"
# --- exact-content assertions (not presence-only) ---
grep -q 'Platform doctrine (Andromeda-era priors' agents/ad-strategist.md
grep -q 'Platform doctrine (Andromeda-era priors' .claude/agents/ad-strategist.md
grep -q '80%+ creative' agents/ad-strategist.md
grep -q '60% targeting' agents/ad-strategist.md
grep -q 'five creative variants per segment' agents/ad-strategist.md
grep -q '2026+' agents/ad-strategist.md
grep -q 'Review due 2027-01' agents/ad-strategist.md
grep -q 'do not apply' agents/ad-strategist.md          # F-205: stale BEHAVIOR, not just the label
grep -qE 'addon \*\*`ads`\*\*|addon `ads`' agents/ad-strategist.md
# --- return-contract + ledger fields — assert ALL of them (F-205) ---
grep -q 'static_comparator_recommended' agents/ad-strategist.md
grep -q 'static_comparator_rationale' agents/ad-strategist.md   # F-205: exact rationale field
for f in platform placement creative_format targeting_mode campaign_id; do grep -q "$f" agents/ad-strategist.md; done
grep -qiE 'shipped[- ]event|outcome[- ]event' agents/ad-strategist.md  # F-205: event semantics
# --- negative assertions (source over-claims must NOT appear) ---
! grep -qiE 'TikTok[^.]*(broad|static-first|interest-stack)' agents/ad-strategist.md
! grep -qiE 'YouTube|top-of-funnel brand' agents/ad-strategist.md
# --- contradiction gone AND replacement present, BOTH files (F-205) ---
! grep -q 'Most failures are targeting failures, not messaging failures' agents/ad-strategist.md
! grep -q 'Most failures are targeting failures, not messaging failures' ad-video-script/SKILL.md
grep -q 'targeting-led on Search/LinkedIn' agents/ad-strategist.md    # the replacement rule
grep -q 'targeting-led on Search/LinkedIn' ad-video-script/SKILL.md
grep -q 'platform doctrine' ad-video-script/SKILL.md
node scripts/sync-native-agents.mjs --check
bash test-framework/evals/run-all-evals.sh --tier1
# then: review-exec (G6) -> audit -> land (PR+merge) -> verify-promotion (lint+tier1 on main)
```

## Prerequisite Alignment Matrix

| Upstream skill | Status | Evidence |
|----------------|--------|----------|
| route-workflow | completed | session contract 2026-07-13 + lane graph |
| blend-external (WI-476) | completed | blend plan item 2 (merged 64e6ecb1) |
| WI-477 (addon rename) | completed | merged PR #126 — ad-strategist carries renamed `ads`; addon installed v2.6.0 |
| write-spec / design-ux / design-ui / define-code-style | skipped | decisions logged (`.svc/pipeline-decisions.jsonl`); agent-knowledge change, no code/UX surface |
| design-tech | completed-inline (task graph + ledger reconciled to `completed`, F-203) | § External State Lifecycle (generated-mirror coupling + addon runtime dependency + entry-3 worktree coupling) — recorded as a completed-inline receipt on lane-task 4, decision ledger `design-tech completed-inline` entry |
| explore-solutions | completed-inline (task graph + ledger reconciled to `completed`, F-203) | R4 resolution chose "video-only fleet + static comparator recommendation" over "format selection w/ non-video handoff" — smaller scope, preserves fleet purpose; recorded on lane-task 5 + decision ledger |
| plan-changeset | completed | this manifest |

## Validation plan

| Check | Command | Expected |
|-------|---------|----------|
| Mechanical plan gate | `bash scripts/verify-plan-mechanical.sh docs/plans/2026-07-13-wi478-andromeda-doctrine/manifest.md` | PASS |
| Mirror in sync | `node scripts/sync-native-agents.mjs --check` | "native agents in sync" |
| Exact-content + negative + contradiction assertions | Exec step | all pass |
| No-fabrication | every doctrine claim traces to the source; over-claims negatively asserted | verified round 2 |
| Tier-1 | `bash test-framework/evals/run-all-evals.sh --tier1` | all pass |

## Checkpoints & rollback

- Commit P (planning, main, exempt) → worktree commit M → PR + merge → verify-promotion (lint + tier-1 on main). No machine-local flip.
- Rollback (commit-scoped): for behavioral rollback, `git revert <commit-M-merge-sha>` (the implementation merge) — additive agent-knowledge text + a replaced sentence + one jsonl schema doc, no data/code logic. Commit P (planning) is retained as audit history unless the entire WI is cancelled, in which case also `git revert <commit-P-sha>`.
- Blast radius: ad-strategist's placement/format decisions + the platform-conditional targeting rule. Worst case: a stale prior after 2027-01 — mitigated by the behavioral stale rule + ledger-verification hybrid (real CTR/CPA overrides).
