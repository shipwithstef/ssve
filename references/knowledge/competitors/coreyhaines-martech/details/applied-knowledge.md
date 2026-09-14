# Applied Knowledge — coreyhaines-martech (synthesized 2026-07-13, WI-476)

How svc applies what this source knows. Derived from the v2.6.0 re-blend analysis (all claims sourced from upstream files read in-session; see Source map).

## 1. Distilled positions

- **The offer is the thing, not the page.** Most "better copy" requests are "better offer" requests in disguise; copy on a weak offer compounds slowly (offers/SKILL.md). svc application: validate-feature and monetization-architecture asks should precede copy/CRO passes; the `offers` addon skill is the execution layer.
- **Creative IS the targeting (post-Andromeda).** Audience research stays the highest-leverage work, but it goes into creative (hooks, identity-trigger keywords), not targeting filters; interest-stacking on Meta is actively harmful; statics + volume often beat polished video (ads/SKILL.md 2.1.0). svc application: ad-strategist priors + campaigns-ledger verification (blend item 2).
- **Marketing is loops, not tasks.** One-shot skills become an operating system only when recurring loops with explicit state, cadence matched to signal speed, guardrails, and stop conditions orchestrate them (marketing-loops). svc application: the company-operating-fleet's cadence is the same thesis; the loop-state/guardrail contract is blend item 1.
- **PR is a multiplier, not a channel.** Earned media buys backlinks, legitimacy, AI-citation surface, and sales ammo — not direct conversions; the story is the trend/data/conflict/human, the product is evidence (public-relations).
- **Version visibility is a product feature.** Machine-comparable VERSIONS.md, CI version-sync, and bumping versions for routing-only changes keep consumers' update checks honest (v2.2.0/v2.5.1 fixes). svc application: blend item 3 (upstream-staleness probe in blend-registry + audit mode).

## 2. Cross-domain implications

- **Company fleet:** revops brain's "find→enrich→sequence" design now has a concrete execution layer (`prospecting` + github-prospects CLI + `sms`); comms brain's recommended "PR-agent cluster + social-listening tooling" exists as `public-relations` + `social/references/listening.md`; growth-lead can hand `marketing-plan` a full fCMO artifact request instead of composing one.
- **Ad fleet:** the video-first 60s beat-sheet pipeline needs a placement-conditional: Meta favors static volume; reserve rendered video for placements where video wins. Campaigns ledger should record `creative_format` to verify the doctrine empirically.
- **Framework process:** the never-registered v1.9.0 blend proves registry coverage is unenforced — any structured-knowledge gate scoped by convention rather than mechanism is silently incomplete (same class as the WI-142 keyword-gate lesson).
- **Autonomy governance:** their two-tier action model (autonomous-safe vs gated) + caps/allowlists/kill-switch is the missing execution-side complement to svc's commit-side chain; hybrid = Tier-2 actions emit receipts.

## 3. Contradictions

- **Statics-beat-video (their Meta claim) vs svc's ad fleet being a video producer.** Resolution: not a contradiction at the strategy layer — the claim is platform- and funnel-stage-conditional; ad-strategist should choose format per placement, and the ledger arbitrates with real CPA data rather than either prior.
- **Their guardrails vs svc's chain.** Upstream trusts caps + staging queues with no evidence trail; svc requires receipts and adversarial review. For recurring external actions both are half-right: caps without receipts aren't auditable, receipts without caps don't bound blast radius. The blend adopts caps and keeps receipts.
- **Their breadth-fast cadence (12 releases/10 weeks, community PRs of varying depth) vs svc's one-WI-per-run deliberateness.** Not resolved — deliberately different postures; svc consumes their breadth as an addon instead of imitating it.

## 4. Recency

- Andromeda Meta-algorithm doctrine: describes a 2025 platform change, written 2026-07 — volatile; re-verify before major ad-spend decisions after ~2027-01.
- OKF (Open Knowledge Format): v0.1 spec introduced 2026-06-12 on Google Cloud blog; explicitly a "register early" protocol bet, not a confirmed ranking signal — watch for v1.0 + engine adoption.
- Image/video model lineups: May 2026 snapshot; stale within months by nature.
- Skill roster: v2.6.0 (2026-07-01); main already carries unreleased marketing-council + ad-creative 2.7.0 — expect v2.7.0 soon (probe: `gh release list -R coreyhaines31/marketingskills -L 1`).

## 5. Source map

- Upstream clone at tag v2.6.0 (`2815104d`), main `0ba2a7fa`, read 2026-07-13: VERSIONS.md (release notes v1.10–v2.6), skills/{ads,offers,marketing-plan,marketing-loops,prospecting,public-relations,sms,co-marketing,marketing-council}/SKILL.md, skills/marketing-loops/references/{loop-state.md,loop-guardrails.md}.
- svc-side: EXTERNAL_ADDONS.md §coreyhaines (v1.9.0 pin), WI-135/136 (adoption), proposals/2026-07-13-blend-coreyhaines-v2.6.0.md (this analysis), references/blend-registry.json entry.
- Sibling layers: ../CAPABILITIES.md (Layer 2), new-skills-v2.0-v2.6.md, version-changelog.md, infrastructure.md, tools-registry.md, skill-improvements.md.

## 6. What this distillation does NOT capture

- Skill-by-skill quality of the 38 pre-existing skills' v2.0 content changes (only renames + flagged expansions were delta-read; bodies not re-audited).
- The 43-loop catalog's individual loop bodies and the marketing-plan reference set (13 files) — consumed at runtime via the addon, not extracted.
- Empirical validity of the Andromeda claims (upstream cites practitioner reports, not controlled studies) — svc's campaigns ledger is the verification path.
- The 65 CLIs' API surface drift since v1.9.0 (tools-registry.md remains at the v1.9.0 snapshot except counts).
- Post-v2.6.0 main content beyond frontmatter reads (marketing-council grounding rules, ad-creative 2.7.0 modes).
