# Blend Plan: coreyhaines31/marketingskills v1.9.0 → v2.6.0

**Source:** https://github.com/coreyhaines31/marketingskills
**SHA:** v2.6.0 tag = `2815104d5459357d44c5f9031fcca0525b00c991` (main at extraction: `0ba2a7fa`, 2026-07-13)
**Date:** 2026-07-13
**Previous blend:** v1.9.0 / `1bcff9fc` (2026-04-28, WI-135/WI-136 — predates blend-registry; retro-registered this run)
**WI:** WI-476 (this analysis) → WI-477 proposed (addon update implementation)
**Delta:** 12 releases, 87 commits, 265 files, +17,182/−1,221 lines
**deferred_until**: 2026-08-25
**reason**: The accepted work is sequenced across WI-477 through WI-480; retain the source proposal until the remaining WI-479 and WI-480 leaves complete.

## Summary

**3 patterns to blend, 1 addon update (with breaking-rename migration), 5 skips, 1 watch item.**

| # | Pattern | Target | What breaks without it | What changes after |
|---|---------|--------|----------------------|-------------------|
| 1 | Loop state/idempotency contract + two-tier action guardrails | `references/autonomous-loop-contract.md` (new) consumed by company-operating-fleet + ad fleet + any `/loop`-scheduled routine | Company fleet's unattended loop re-nags the same accounts, double-acts after restarts, and has no per-loop caps/kill-switch — fleet brains "propose only" but nothing constrains a future Tier-2 executor | Every recurring svc loop carries watermark/dedupe/cooldown/in-flight state + run log + Tier-1/Tier-2 action classification + kill switch |
| 2 | Andromeda-era paid-creative doctrine (creative-as-targeting, statics>polish, platform split table) | `ad-strategist` agent knowledge + `ad-video-script` placement heuristics | ad fleet optimizes 60s polished video against 2024-era Meta assumptions; on post-Andromeda Meta that loses to static volume — CTR/CPA ledger learns it slowly and expensively | ad-strategist holds the platform creative-vs-targeting split and recommends static-first volume on Meta placements; video reserved for placements where it wins |
| 3 | Upstream-version staleness check for blend sources | `blend-external` SKILL.md audit mode + `references/blend-registry.json` | This exact incident: source shipped a BREAKING 2.0 + 12 releases and svc noticed 10 weeks later only because the user did | Blend audit mode mechanically compares registry SHA/tag vs `gh release list`; stale sources surface in evolve-framework passes |
| A | Addon update v1.9.0 → v2.6.0 pin + 17-rename migration | `EXTERNAL_ADDONS.md`, `~/.svc/external-skills/marketingskills`, ~14 live svc files referencing old skill names | svc skills route to skill names that no longer exist upstream (`page-cro`, `paid-ads`, `email-sequence`…) — every new install or addon refresh silently breaks route-workflow's marketing intents | Pin moves to `2815104d`; live cross-references migrated to v2 names (WI-475-style rename WI) |

## Blend items

### 1. Loop state/idempotency contract + two-tier guardrails → svc autonomous-loop contract

**From:** `skills/marketing-loops/references/loop-state.md` (all), `references/loop-guardrails.md` (all), `references/loop-orchestration.md` (rollout staging)
**Into:** new `references/autonomous-loop-contract.md`, referenced by the company-operating-fleet spec (chief-of-staff cadence), ad-fleet campaign loop, and any CronCreate/`/loop` routine svc authors

**The problem in svc today:**
The company-operating-fleet (WI-403..407) runs a weekly unattended cadence: chief-of-staff dispatches 8 brains, synthesizes decision cards. The ad fleet levels up from a campaigns ledger. Neither has a *loop-state contract*: nothing stores a watermark of what was already processed, dedupe keys for accounts/prospects already acted on, per-entity cooldowns, or in-flight guards. Concrete failure: a churn-watch or outbound-design loop that re-runs after a crash re-emits the same decision cards for the same accounts; when a future iteration graduates any brain from propose-only to bounded execution (the stated direction), there is no cap/allowlist/kill-switch machinery to bound it — svc's chain guards *commits*, not *recurring external actions*. svc's `.svc/loop-guard-state.json` is a host anti-repeat guard, not a per-loop memory.

**How the source solves it:**
One JSON per loop (`.agents/loops/<name>.json`) holding `cursor` (watermark), `handled` (dedupe set), `cooldowns` (per-entity suppression), `in_flight` (conflict guard), `counters` (attempt-driven stop conditions) — plus an append-only run log (`checked=N acted=M note`) that doubles as a vanity-loop detector (weeks of acted=0 → kill it; acts every run → chasing noise). Guardrails: every action classified Tier 1 (read/analyze/diff/score/draft/stage — autonomous-safe) or Tier 2 (spend/send/publish/delete/change-live — gated unless explicitly authorized AND bounded by hard caps + ≤20% per-run change limit + allowlist), an always-escalate list, and a required kill switch. Compliance duties (CAN-SPAM/GDPR/FTC/ToS) are mapped per loop class, PII kept out of state/logs.

**What this changes in svc:**
New `references/autonomous-loop-contract.md` defining: (a) loop-state file schema (svc path: `.svc/loops/<loop>.json` for framework loops, `.agents/loops/` for onboarded product repos — matching upstream so the addon's own loops interoperate); (b) run-log line format + vanity-loop review rule wired into the fleet's weekly WBR narrative; (c) the Tier-1/Tier-2 action table adapted to svc's fences (Tier 2 = anything the fleet agents today mark "proposes only — never sends/spends/publishes"); (d) kill-switch + caps prerequisites for ANY future promotion of a brain from propose-only to bounded-execute. Fleet agent prompts get one line pointing at the contract; chief-of-staff synthesis gains a "loop health" check reading run logs.

**What NOT to take:**
The 43-loop catalog itself (runtime content — comes free via the addon update, svc shouldn't copy it); the `.agents/` path convention for framework-internal loops (svc state lives under `.svc/`); scheduling mechanics (svc already has `/loop`, ScheduleWakeup, CronCreate doctrine — upstream explicitly defers here too).

**Hybrid opportunity:**
Neither source has *auditable* autonomous loops. Upstream has state+caps but no evidence trail beyond a run log; svc has receipts/claims but nothing for recurring external actions. The hybrid: Tier-2 loop actions emit svc-style receipts (action, cap consumed, allowlist entry, approver) appended to the loop's run log — giving the company fleet what the mandatory chain gives commits. That's a stronger machine than either repo ships.

**Why this matters:**
The company fleet is svc's flagship autonomous artifact and its stated risk posture is "proposes only" *because* bounded execution machinery didn't exist. This blend is that machinery, pre-debugged by a 38k-star repo's community, with compliance mapping svc would otherwise have to research from scratch. Without it, the first fleet loop that touches email/spend either stays permanently manual or ships unguarded.

### 2. Andromeda paid-creative doctrine → ad-strategist / ad-video-script

**From:** `skills/ads/SKILL.md` — "Audience Understanding & Targeting" rewrite (platform split table, lines ~135–168) + "Modern Meta playbook (Andromeda era — 2026+)" section
**Into:** `ad-strategist` agent definition (heuristics/knowledge block) + `ad-video-script/SKILL.md` placement-selection guidance

**The problem in svc today:**
The ad fleet (ad-strategist → ad-video-script → ad-video-producer) is video-first by construction: 60s = 6×10s beat sheets. ad-strategist picks ICP + scenario + placement and levels up from CTR/CPA ledger signal. Its baked-in assumptions predate Meta's 2025 Andromeda change. Concrete failure: for a Meta placement, the strategist produces one polished 60s video per campaign; post-Andromeda that under-delivers versus high-volume static creative (upstream cites top advertisers whose "down-and-dirty native statics beat 2.5-month-production VSLs"), and interest-stacked targeting — a plausible strategist output — is now *actively harmful* on Meta. The ledger would eventually learn this, but at real ad-spend cost.

**How the source solves it:**
A platform-by-platform split of where audience knowledge goes (Meta 80%+ creative / Google Search 60% targeting / PMax 70% creative / LinkedIn 60% targeting / TikTok 70% creative / X 50-50); the "creative IS the targeting" doctrine (broad audience + segment-specific creative variants, duplicate-and-strip-targeting A/B test); creative volume as the binding constraint (~1hr/week fresh creative for the winning offer); a 4-component funnel-stage retargeting framework with different offers per stage; and the named failure mode "trying to fix weak creative with hyper-precise targeting."

**What this changes in svc:**
ad-strategist gains a "platform doctrine" knowledge block: on Meta/TikTok placements, default to broad targeting + N creative variants keyed to distinct audience identifiers (identity-trigger keywords in hooks); flag interest-stacking as an anti-pattern; recommend static-first volume for Meta, reserving the 60s beat-sheet video pipeline for placements where video wins (YouTube, top-of-funnel brand). ad-video-script's placement/awareness selection cites the same table. The campaigns ledger gains a `creative_format` field so the CTR/CPA learning loop can verify the doctrine empirically rather than trust it.

**What NOT to take:**
Google RSA output spec (comes via the addon at runtime — ad-strategist can invoke `ads` directly); Brazilian CFM compliance rules (not our vertical); the platform-account operational sections (svc agents hold no ad-account secrets by design).

**Hybrid opportunity:**
Upstream states the ratios as static directional advice ("test in your actual account"). svc has a campaigns ledger and a measure-then-promote culture: encode the doctrine as *priors* the ledger updates — each campaign records format+targeting mode and realized CPA, and the strategist's platform table becomes self-correcting per-account. Neither source has a self-updating version of this doctrine.

**Why this matters:**
This is spend-adjacent knowledge with a shelf life. The ad fleet exists to produce performant creative; operating on pre-Andromeda Meta assumptions is the single most expensive stale prior it can hold. One blended knowledge block converts a slow, paid ledger lesson into a free prior.

### 3. Upstream-staleness check for blend sources → blend-external audit mode

**From:** upstream repo practice — `VERSIONS.md` as machine-comparable version table + `sync-skills.js` auto-version-sync (fixed after a 3-release plugin.json drift, their #323) + the v2.5.1 lesson (version-bump even for description-only changes so update checks fire)
**Into:** `blend-external/SKILL.md` mode 3 (audit) + `references/blend-registry.json` (add `upstream_ref_cmd` per source)

**The problem in svc today:**
This run is the evidence: coreyhaines shipped a breaking v2.0.0 on 2026-05-05 and six further releases; svc's knowledge layer, EXTERNAL_ADDONS pin, and live cross-references sat stale for 10 weeks until the user manually noticed "huge amount of update." Worse, the v1.9.0 blend was never registered in blend-registry.json at all, so audit mode (mode 3, "walk every entry") would have silently skipped the pack's *largest* source. Registry coverage and freshness are both unenforced.

**How the source solves it:**
Upstream treats version visibility as a product feature: a single machine-comparable VERSIONS.md, CI that fails when manifest versions drift, and a norm of bumping versions even for routing-only changes precisely so consumers' update checks fire.

**What this changes in svc:**
(a) Every blend-registry source gains a one-liner freshness probe (`gh release list -R <repo> -L 1` or `git ls-remote <url> HEAD`), and audit mode runs it mechanically before any analysis, emitting a stale-sources table. (b) blend-external gains a self-verify row: "source being analyzed exists in blend-registry — if absent, register a baseline entry before writing the plan" (this run's miss, made structural). Optionally a low-cadence check lands in evolve-framework's gap scan.

**What NOT to take:**
Their JS sync tooling (svc's linter architecture already covers manifest drift); per-skill semver inside svc skills (WI-CLN-15 already added SKILL.md version fields — no change needed).

**Hybrid opportunity:**
Pure transplant is correct for the probe itself. The svc-native twist is wiring the stale-sources table into the existing evolve-framework/improve-framework triggers ("a blend source shipped updates" is already a listed trigger — it just has no mechanical feeder today).

**Why this matters:**
svc's knowledge system is the compounding asset; a knowledge layer that silently drifts 10 weeks behind a 38k-star, 2-3-week-cadence source is a false-green — the exact class (unfed trigger, coverage gap) the framework keeps paying for elsewhere (cf. WI-474's severed learning loop).

## Assessment A: Blend Opportunities

Items 1–3 above. Watch item (not blendable yet — unreleased): `marketing-council` on main — simulated advisor board with grounding rules ("every take must be grounded in what the advisor actually wrote"). Structurally parallel to svc's judge panels and SME spine; when it ships in a release, assess whether its *grounding-rules* pattern (per-persona citation discipline) improves svc's SME agents' source-fidelity. Re-check at next re-blend.

## Assessment B: External Addon Viability

**Runtime addon?** YES — already adopted (EXTERNAL_ADDONS.md, v1.9.0). This assessment is the **update path**.
**License:** MIT (unchanged).
**Install (new pin):**
```bash
cd ~/.svc/external-skills/marketingskills && git fetch --tags && git checkout 2815104d  # v2.6.0
```

**Integration point:** unchanged in shape (marketing-class intents route from route-workflow / landing-page / fleet agents into addon skills) but **17 skill names changed + 1 consolidation** — the interop contract is broken at the naming layer until migration.

**Breaking-rename migration (the real work — proposed WI-477, chain-bound):**
1. Re-pin the central install to `2815104d`; reinstall per upstream's v2.0.0 "must reinstall" instruction.
2. Update `EXTERNAL_ADDONS.md` § coreyhaines: version, pin, 46-skill category table, new context filename (`.agents/product-marketing.md`).
3. Migrate live svc cross-references old→new names (rename map in `references/knowledge/competitors/coreyhaines-martech/details/new-skills-v2.0-v2.6.md`). Live surface (~14 files; the other ~37 grep hits are `proposals/done/`, archives, and historical WI docs which stay untouched as record): `route-workflow/SKILL.md` (self-verify #9 list), `route-workflow/references/intent-routing.md`, `routing-rules.md`, `hot-path-operational-details.md`, `landing-page/SKILL.md`, `build-personas/SKILL.md`, `ad-video-script/SKILL.md`, `assess-market-readiness/SKILL.md`, `_shared/live-evidence.md`, `skills-manifest.json`, `EXTERNAL_ADDONS.md`, `references/skill-pack-comparison.md`, `OPEN-PROPOSALS.md` (verify each at execution — list from 2026-07-13 grep).
4. Wire new capabilities to their fleet consumers (one pointer line each): revops→`prospecting`/`sms`, comms→`public-relations`+`social` listening, growth-lead→`marketing-plan`/`marketing-loops`, ad-strategist→`ads` (item 2 covers the doctrine). Fleet agents live on `feat/company-operating-fleet` (unpushed) — apply there or note as follow-on.
5. Post-migration: `node scripts/lint-skills-manifest.mjs` + tier-1 suite + a routing smoke check that marketing intents resolve to v2 names.

**What svc should NOT rebuild:** all 46 runtime marketing skills, the 43-loop catalog content, 65 CLIs, 93 integration guides, compliance references (TCPA/A2P/CAN-SPAM/GDPR per channel).
**What svc should still own:** routing/lane governance, receipts/verification, the loop-contract *enforcement* layer (item 1 hybrid), ad-fleet rendering pipeline, campaigns-ledger learning.

## Full Dimensional Comparison

Every dimension from both CAPABILITIES.md files; delta-scoped rows marked ✦.

| Dimension | Source has (v2.6.0) | svc has | Verdict | Action |
|---|---|---|---|---|
| ✦ Recurring marketing ops (marketing-loops) | 43-loop catalog, 9-part anatomy, state/guardrails/orchestration refs | company-operating-fleet cadence + /loop/cron primitives, receipts; no loop-state contract | different-valid, complementary | **BLEND+ADDON** (item 1) |
| ✦ Loop safety (two-tier actions, caps, kill switch) | Mechanically specified | Propose-only fences + chain (commit-scoped) | theirs-better (for recurring external actions) | **BLEND** (item 1) |
| ✦ Paid ads doctrine | Andromeda playbook, platform split, RSA spec | ad fleet (video-first) + old-name `paid-ads` addon | theirs-better (fresher) | **BLEND+ADDON** (item 2) |
| ✦ Offer design (offers) | Value Equation, 6-component anatomy, guarantee/bonus/scarcity refs | monetization-architecture (gating matrix), pricing via addon | gap (direct-response offer construction) | ADDON |
| ✦ fCMO planning (marketing-plan) | 13-section AARRR generator, budget science | growth-lead decision cards, roadmap-evaluation | different-valid (artifact vs cards) | ADDON (growth-lead may invoke) |
| ✦ Prospecting + github-prospects CLI | 3-motion list building, compliance | revops brain (outbound DESIGN, unwired) | gap (execution layer) | ADDON (wire revops) |
| ✦ SMS channel | Full compliance-first skill | nothing | gap | ADDON |
| ✦ Earned media / PR | public-relations 4 modes, newsjacking rubric+veto | comms brain (recommends "PR-agent cluster") | gap (comms's named tool now exists) | ADDON (wire comms) |
| ✦ Social listening | listening.md triage, curl recipes, sources template | data-collection brain (design-level) | different-valid | ADDON (recipes feed data-collection) |
| ✦ Co-marketing | Partner ID + joint campaigns | nothing | gap | ADDON |
| ✦ AI-SEO currency (OKF, Google guide) | v2.1.0 current | addon at v1.9.0 | theirs-better | ADDON (update) |
| ✦ Image/video model currency | May-2026 lineups | svc hyperframes/video skills current; addon stale | comparable post-update | ADDON (update) |
| ✦ Naming hygiene | v2.0.0 shortened names, consistent conventions | svc keeps descriptive names; conventions doc | different-valid | SKIP (adopt names only as interop) |
| ✦ Update-check infra | VERSIONS.md + CI version-sync | linter + .version files; no upstream probe | theirs-better (upstream freshness) | **IMPROVE** (item 3) |
| ✦ Persona judge panel (marketing-council) | Unreleased on main | judge panels, SME spine, strategic-reviewer | comparable (ours broader, theirs grounded personas) | SKIP for now (watch item) |
| Foundation context pattern | `.agents/product-marketing.md` | product-marketing-context interop already adopted (WI-135) | comparable | ADDON (filename migration only) |
| CRO cluster | Consolidated `cro` + satellites | landing-page/benchmark-landing + addon interop | comparable | ADDON (rename migration) |
| Copy/content cluster | copywriting/copy-editing/emails/social | addon interop + svc humanizer/x-article-craft | comparable | ADDON |
| SEO cluster | 7 skills | addon interop + svc ai-seo consumers | comparable | ADDON |
| Analytics/testing | analytics, ab-testing | addon interop + PostHog MCP native | comparable | ADDON |
| Retention | churn-prevention, community-marketing | customer-success brain + addon | comparable | ADDON |
| CLI tool layer (65) | Zero-dep node CLIs | svc scripts (framework-scoped) | different-valid | ADDON |
| Integration guides (93) | API/auth/MCP guides | plan-capabilities MCP recommendations | different-valid | ADDON |
| Evals | Per-skill evals incl. new skills | Tier 1–3 test framework | comparable | SKIP |
| Community PR model | 38k stars, external contributors | Private solo repo (deliberate — monetize-then-public) | different-valid | KEEP SKIP (strategy memory) |
| Dev pipeline/governance (svc core: lanes, gates, receipts, chain, worktrees) | — | Full | ours-better / gap on their side | N/A |
| Knowledge system / research / learnings (svc core) | — | Full | gap their side | N/A |
| Video production pipeline (svc: hyperframes, ad-video-producer, beat sheets) | Model *selection* guidance only | Full render pipeline | ours-better | N/A (their `video` = model picker; ours = producer) |

## Skipped items

| External | Reason for skip |
|----------|----------------|
| 43-loop catalog content | Runtime content — consumed via addon, not copied into svc |
| Google RSA spec verbatim | Runtime — ad-strategist invokes `ads` skill directly |
| CFM (Brazilian medical) compliance rules | Not our vertical |
| Skill-name shortening for svc's own skills | svc naming favors explicit descriptive names; conventions differ validly |
| JS version-sync tooling | svc linter already enforces manifest agreement |
| marketing-council | Unreleased (main-only); revisit when tagged |

## Rethink: past blend reassessment (v1.9.0 adoption)

| Blended pattern | svc location | Verdict | Action |
|---------|-----------|---------|--------|
| Addon adoption + interop contract (WI-135/136) | EXTERNAL_ADDONS.md, route-workflow marketing intents | Adaptation was right (adopt-don't-rebuild); but pin went stale silently and the blend was never registered | KEEP + fix registration this run (registry entry added) + item 3 prevents recurrence |
| Knowledge extraction (CAPABILITIES + details) | references/knowledge/competitors/coreyhaines-martech/ | Good structure; changelog's "no breaking changes, additive" assumption was falsified by v2.0.0 | KEEP — assumption row corrected in version-changelog.md |

| Skipped pattern (then) | Original reason | Reassessment | Action |
|----------------|-----------------|--------------|--------|
| Community PR model | Private repo strategy | Still true (monetize-then-public) | KEEP SKIP |

## Attribution update

NOTICES: add coreyhaines31/marketingskills (MIT, © Corey Haines) — patterns derived: loop state/idempotency + guardrail model (→ autonomous-loop contract), Andromeda paid-creative doctrine (→ ad-strategist), upstream-staleness check practice (→ blend-external audit mode). Addon usage already governed by EXTERNAL_ADDONS.md.

## Item status

| Item | Status |
|------|--------|
| 1 Loop contract | PENDING — implement via chain (framework lane; pairs naturally with fleet work) |
| 2 Andromeda doctrine | PENDING — implement via chain (touches agent defs on feat/company-operating-fleet + ad-video-script) |
| 3 Staleness check | PENDING — implement via chain (blend-external SKILL.md + registry schema) |
| A Addon update + rename migration | PENDING — proposed **WI-477** (M-class, full chain; WI-475 is the template) |
