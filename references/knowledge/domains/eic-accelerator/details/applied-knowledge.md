# Applied Knowledge — EIC Funding Portfolio (synthesized 2026-06-07)

> Synthesis agent: Claude in-session (fallback). gemini-cli dispatch failed twice — `synthesize-meaning.mjs` embeds the ~275KB detail package in one argv, exceeding Linux MAX_ARG_STRLEN (128KiB); recorded in the prescope. Inputs: CAPABILITIES.md + 9 detail files + .activity.json.

## 1. Distilled positions per theme

**Theme: What the EIC funds (and refuses to fund)**
- "have a innovative, game changing product, service or business model that could create new markets or disrupt existing ones... but the risks involved are too high for private investors alone to invest" — the Accelerator funds market-creating deep tech that private capital won't carry alone; ordinary commercial SaaS is out of thesis. (`accelerator-program.md` § Mechanism)
- "at least all activities for TRL 5, i.e. 'Validation in relevant environment', has been achieved" — TRL 5 is a hard entry gate, interpreted for AI as validation "in a simulated or laboratory environment that closely mimics real-world conditions... using real datasets." (`accelerator-program.md`; `faq-verbatim-2026.md` Accelerator section)
- Grant pays TRL 6-8 only; investment pays anything to TRL 9+ — "Clinical trials can be included in the grant component (as part of innovation activities, for TRL 6 to 8)." (`faq-verbatim-2026.md`)

**Theme: Money on the table (2026)**
- Accelerator €634M (Open €414M + Challenges €220M): grant "below EUR 2.5 million" + investment "€1 - €10 million". STEP Scale Up €300M at €10-30M tickets. Pathfinder €262M (≤€4M grants). Transition €100M (≤€2.5M). Pre-Accelerator €20M→€40M (€0.3-1M at 70%). AIC pilot €6M (€300K → €2.5M lump sums). (`CAPABILITIES.md` table; `other-programs.md`)
- Cut-offs 2026 — Accelerator full proposals: 7 Jan / 4 Mar / 6 May / 8 Jul / 2 Sep / 4 Nov; STEP: 11 Feb / 6 May / 9 Sep / 25 Nov; Pathfinder Open 12 May; Pathfinder Challenges 28 Oct; Transition 16 Sep. (`application-process.md`, `other-programs.md`)

**Theme: Process discipline**
- Three rejections end your Horizon-Europe run: "you may submit up to 3 unsuccessful applications... After the third rejection, you will not be able to submit again to the EIC Accelerator under the Horizon Europe Framework Programme." Counter reset 1 Jan 2024. (`application-process.md`; `faq-verbatim-2026.md`)
- Short proposal anytime (batched first Tuesday monthly, 4-6 weeks to result) → full proposal at six 2026 cut-offs (8-9 weeks to remote result) → 45-min jury interview (results 2-3 weeks). Realistic short-to-interview wall clock: ~5-6 months. (`application-process.md` § Analysis)
- "Consultants or other third parties must not take part in the interview." Employees, board members, investors only. (`application-process.md`)

**Theme: The equity machine**
- "The EIC Fund is an alternative investment fund (AIF)... the AIFM... makes decisions on investments"; EIB advises and runs DD but doesn't decide. Equity seeks ≥1:1 matching per round and ≥1:3 portfolio leverage; SAFEs/convertibles bridge low-maturity cases. (`eic-fund-investments.md`)
- Timing traps: blended investment "must take place no later than 12 months following the end date of the grant"; Grant-First requires the key milestone "no later than six months before the end of the project." (`eic-fund-investments.md`)
- Economic security: AI/semiconductor/quantum/biotech companies may face HQ-stays-in-Europe clauses; CRM-challenge applicants file ownership-control declarations. (`eic-fund-investments.md`, `eligibility-and-rules.md`)

**Theme: Side doors and consolation prizes**
- Fast Track (HE/H2020 projects incl. EIT KICs) and Plug-In (50 certified national programmes, 21 MS + 3 ACs) skip the short-proposal stage after a project review. Bulgaria is NOT on the certified Plug-In list at extraction time. (`application-process.md`)
- Seal of Excellence at ≥13/15 without interview invite or post-interview NO-GO: fraud-proof label + EEN-assisted alternative-funding search + BAS access. (`application-process.md`)
- BAS quasi-money: ACCESS+ "50% of the service cost... up to EUR 60,000"; InnoMatch pilots "up to EUR 60,000 per pilot"; InnoNext fully-funded 3-6-month internships. (`business-acceleration-services.md`)

## 2. Cross-domain implications (project-context applied)

- **For this builder (BG solo software founder, svc/Example Marketplace/CoVibeFusion):** the realistic EIC map is narrow. The Accelerator's deep-tech + TRL5 + scale-up-capital framing does not fit a Base44-hosted SaaS or a dev-framework business today. The two genuinely open doors: (a) **EIC Pre-Accelerator** — Bulgaria is a widening country, mono-SME, €0.5-1M at 70%, but next call 5 May 2027-18 Nov 2027 and still requires lab-validated deep tech (TRL 4+); (b) **BAS-adjacent ecosystems** via any future EIC/Seal status. Nearest-term EU money remains the EIT route (see `domains/eit-urban-mobility`), not EIC.
- **EIT ↔ EIC composition:** EIT Urban Mobility appears by name on the Fast Track list — a startup funded under an EIT KIC scheme can be project-reviewed straight into the Accelerator's full-proposal stage. Sequencing: EIT KIC money (≤€2.5M blended, mobility-scoped) → Fast Track → EIC Accelerator blended (≤€2.5M grant + ≤€10M equity) → STEP (€10-30M). This is the documented non-dilutive-to-equity ladder for an EU deep-tech venture.
- **If the builder pivots any project toward deep tech** (e.g., a GenAI4EU-class model-level innovation rather than app-level), the 2025 GenAI4EU challenge text defines the bar: "explainability, dealing with hallucinations, transparency, trust, reliability, Multimodality, Models size" — application-layer integration alone is explicitly sub-threshold.
- **Proposal mechanics transfer:** GenAI use in proposals is allowed with declaration; NCP/EEN support is free; one short proposal (12 pages + 10 slides + 3-min video) is a bounded, low-cost validation artifact — but the 3-rejection lifetime cap means do NOT fire a speculative application just to test the water.

## 3. Contradictions / open questions

- **Accelerator investment floor:** main page says investment "€1 - €10 million" while the 2026 Work Programme summary says "investments from €0.5 to €10 million." Likely page-update lag; treat €0.5M as the WP-authoritative floor. (`accelerator-program.md` vs `other-programs.md`)
- **Pathfinder Challenges 2026 budget:** Pathfinder hub says "€96 millions" for Challenges; CAPABILITIES of the WP2026 page lists Pathfinder total €262M with Open €166M — consistent internally (166+96=262), but the WP PDF was not parsed to confirm per-challenge splits.
- **Plug-In certified list churn:** "50 programmes... including 16 certified 'with conditions'" — the list evolves; Bulgaria's absence should be re-verified before advising anyone (page is a living document).
- **Women TechEU status:** FAQ page is preserved from the 2021 pilot (results "early 2022"); whether a successor call exists under EIE was NOT determinable from this site alone.
- **Challenges hub staleness:** the generic challenges hub still centers 2024 content while 2026 challenge pages are live — navigate by year-specific pages, not the hub.

## 4. Recency-weighted insights

- `.activity.json`: verdict **active** — 56 news posts in 12 months, 25 in 6 months, latest 2026-06-05 ("EIC Impact Report 2026: Europe strengthens its position global deep tech scaling hub").
- The 2026 Work Programme (adopted 6 Nov 2025) is the operative regime: 20-page full proposals (was 50), 2-month evaluation cadence (was 6), all-instrument lump sums, equity-only without prior grant, deeper pre-DD tech assessment. Pre-2026 third-party guides are materially stale.
- 2026 cut-offs are mid-cycle at extraction (next Accelerator batch: 8 Jul 2026).

## 5. Source map

| Claim cluster | File : section |
|---|---|
| Accelerator amounts, TRL split, eligibility, Open vs Challenges | `accelerator-program.md` : Mechanism |
| 3-step process, 2026 cut-offs, resubmission cap, interview rules, Fast Track/Plug-In, Seal | `application-process.md` : Mechanism |
| 2025/2026 challenge topics + budgets | `accelerator-challenges-2025-2026.md` : Mechanism |
| Pathfinder/Transition/Pre-Accelerator/STEP/AIC budgets, deadlines, eligibility | `other-programs.md` : Mechanism |
| EIC Fund structure, scenarios, qualified investors, DD, safeguards, timing traps | `eic-fund-investments.md` : Mechanism |
| BAS catalog, ACCESS+/InnoMatch €60K, eligibility incl. Step-1 applicants | `business-acceleration-services.md` : Mechanism |
| Country rules, UK status, concurrent applications, lump-sum Type 2, IP provisions | `eligibility-and-rules.md` : Mechanism |
| All verbatim Q&A bodies (≈150 Q&As, 15 FAQ pages) | `faq-verbatim-2026.md` : per-URL sections |
| EIC identity €10.1B, prizes amounts, Women TechEU mechanics | `prizes-and-context.md` : Mechanism |
| Activity verdict | `.activity.json`, `details/blog-recent.md` |

## 6. What this distillation does NOT capture

- **The EIC Work Programme 2026 PDF itself** (and Annexes, Investment Guidelines, Rules of Contest) — only their site-level summaries; page-level citations (e.g. "WP2026 p.90") are pointers, not parsed content.
- **News/events corpus** (392 news + 176 event pages excluded by prescope scoping) beyond the activity scorecard; success stories and the EIC Fund portfolio-company pages (323) — i.e., no win-rate or portfolio-composition analytics.
- **Evaluation award criteria text** (the actual scoring rubric lives in the WP PDF / F&T portal call pages, not on the site pages extracted).
- **Statistics**: success rates per stage, typical grant sizes awarded, jury pass rates — not published on the extracted pages.
- **Legacy closed calls** (H2020 pilots, FET, Horizon Prizes detail pages) — deliberately excluded as superseded.
