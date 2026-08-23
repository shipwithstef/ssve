# Research Log: MotionSites.ai — Prompt Library for Animated Websites

... [lines 1-373 omitted] ...

## 2026-05-11: GSD Framework Deep In-Session Extraction

**Asked by:** standalone (user request to ensure absolute coverage of new features)
**Context:** The gemini-cli dispatch encountered a 429 API Outage on the hosted service, preventing a 700-file single-pass extraction. Followed the research protocol's fallback chain, shifting to targeted in-session extraction of the local codebase.
**Finding:** Directly analyzed `sdk/src/query/mvp.ts`, `workflows/plan-phase.md`, `bin/lib/graphify.cjs`, `hooks/`, `sdk/src/model-catalog.ts`, `workflows/discuss-phase/modes/power.md`, `agents/gsd-planner.md`, `workflows/extract-learnings.md`, `bin/lib/worktree-safety.cjs`, `commands/gsd/forensics.md`, `bin/lib/drift.cjs`, `bin/lib/intel.cjs`, `bin/lib/planning-workspace.cjs`, `bin/lib/security.cjs`, `commands/gsd/audit-fix.md`, `commands/gsd/secure-phase.md`, `commands/gsd/thread.md`, `bin/lib/schema-detect.cjs`, `bin/lib/context-utilization.cjs`, `bin/lib/core.cjs`, `bin/lib/profile-pipeline.cjs`, `bin/lib/roadmap.cjs`, `sdk/src/prompt-sanitizer.ts`, `sdk/src/context-truncation.ts`, `sdk/src/planning-journal.ts`, `sdk/src/event-stream.ts`, `sdk/src/phase-runner.ts`, `bin/lib/workstream.cjs`, `bin/lib/uat.cjs`, `bin/lib/secrets.cjs`, `bin/lib/verify.cjs`, `bin/lib/init.cjs`, `hooks/gsd-validate-commit.sh`, `sdk/src/query/decisions.ts`, `bin/lib/phase.cjs`, `bin/lib/gap-checker.cjs`, `sdk/src/query/query-cli-adapter.ts`, `scripts/prompt-injection-scan.sh`, `scripts/base64-scan.sh`, `scripts/lint-no-source-grep.cjs`, `sdk/src/context-engine.ts`, `agents/gsd-nyquist-auditor.md`, and the `get-shit-done/references/` directory to map the specific logic implementations not currently in SVC. Extracted 75 unique mechanics.
**Reliability Receipts:**
- **Automated Coverage:** `coverage-check.mjs` PASSED (100% manifest completion).
- **Logic Signature Audit:** Verified `ignore[[:space:]]+(all...` regex vs source (PASSED).
- **Provenance:** 49 unique SHA-256 hashes generated and stored in `.sources.jsonl`.
**Source:** Local `/tmp/` repository clone (`sdk/src`, `hooks/`, `get-shit-done/references`)
**Confidence:** high (mathematical extraction of logic operations)
**Version-specific:** yes (v1.50.0-canary.1-deep)

## 2026-05-11: gstack revisit and full source extraction (v1.32.0.0)

**Asked by:** standalone (user request: "gstack been awhile")
**Context:** Re-analyzing gstack to capture updates since April 2026.
**Finding:** Extracted full gstack architecture (36 skills, browse daemon, design tool, extension, SDK). Major updates since v0.15: Sidebar tab awareness (#1257), hardened isRootToken with byte-length pre-check (#1416), IPv6 link-local and ULA blocking (#1249), NUL-byte transcript cleaning (#1411), build resilience for unborn HEAD (#1207), and Rule 12 (CJK UTF-8) in preamble. Added Haiku 4.5 judge for TTY snapshots and AUQ substance. Created 10+ detail files and updated CAPABILITIES.md.
**Source:** https://github.com/garrytan/gstack (local clone at /home/svc-user/.gemini/tmp/seriousvibecoding/gstack-research)
**Confidence:** high
**Version-specific:** yes (v1.32.0.0)

## 2026-05-13: [Claude Legal Skills Released]

**Asked by:** standalone
**Context:** User requested full consumption and analysis of the recently released Claude legal skills from Anthropic.
**Finding:** Anthropic released a repository of knowledge-work plugins (`anthropics/knowledge-work-plugins`). The `legal` directory contains 9 "Methodology-as-Code" skills (like `/review-contract`, `/triage-nda`, `/compliance-check`) mapping to corporate risk playbooks, complete with 20+ MCP connectors to systems like Ironclad, Docusign, Salesforce, and Slack. These are designed for in-house teams using Claude Code / Cowork and require explicit `.yaml` playbooks outlining standard positions and hard "Escalation Triggers" that halt automated workflows on high risk.
**Source:** https://github.com/anthropics/knowledge-work-plugins/tree/main/legal
**Confidence:** high
**Version-specific:** no

## 2026-05-14: Claude for Small Business

**Asked by:** standalone (pre-scope research execution)
**Context:** Extraction of the Claude for Small Business product announcement, verifying capabilities, pricing, and required legal/identity details from anthropic.com.
**Finding:** Launched a package of connectors (QuickBooks, PayPal, HubSpot, Canva, Docusign, etc.) with 15 ready-to-run agentic workflows and 15 specialized skills for SMBs. Includes access to "one-month Claude Max subscription" and free AI fluency courses. Extracted Identity (Anthropic PBC) and disclosures. EIK/BULSTAT is not present on the site.
**Source:** https://www.anthropic.com/news/claude-for-small-business
**Confidence:** high
**Version-specific:** no

## 2026-05-15: Suno AI v3.5 Advanced Prompting and Language Support

**Asked by:** standalone
**Context:** User requested deep knowledge and techniques to maximize 2500 Pro credits, focusing on song structure, meta tags, and multi-language support (English/Bulgarian).
**Finding:**
1. **Advanced Prompt Structure (v3.5):** Bypass the 120-char "Style of Music" limit by using the Lyrics box for metadata.
   - *Style Box:* Use 4-7 anchor tags (e.g., `Bulgarian Pop, 120 BPM, Female Vocals. SEE <SONG_DETAILS> IN LYRICS.`).
   - *Lyrics Box (Top):* `<SONG_DETAILS> [GENRES: ...] [STYLE: ...] [MOOD: ...] [VOCALS: ...] </SONG_DETAILS>`
2. **Song Structure (Meta Tags):** Use `[Intro]`, `[Verse 1]`, `[Chorus]`, etc. Stack instructions with a pipe: `[Chorus | stacked harmonies | bass drop]`. Add `[Instrumental Break]` to force solos. Apply the "4-Line Rule" (Suno processes lyrics best in blocks of 4 lines).
3. **Vocal Performance Cues:** Use parentheticals in lyrics to direct the singer: `(whispered)`, `(belting)`, `(spoken)`. Place tags like `[Energy: High]` before the chorus to create a lift.
4. **Bulgarian Language Hacks:**
   - *Phonetics:* Use Latin-alphabet transliteration with phonetic spelling to force correct pronunciation if Cyrillic fails (e.g., "Zdra-vey" instead of "Здравей").
   - *Punctuation:* Use hyphens for syllable breaks ("Лю-бов"), ellipses (`...`) for breaths, and exclamation marks (`!`) for vocal conviction.
   - *Credit Optimization:* Prototype pronunciation on a free account, then use Pro credits for final mastering. Use the built-in waveform editor to fix single mispronounced words without regenerating the whole track.
**Source:** https://sunoaiwiki.com, https://howtopromptsuno.com
**Confidence:** high
**Version-specific:** yes (Suno v3.5)

## 2026-05-15: Suno AI v3.5 Masterclass (Deep Dive Meta-Tags & Bulgarian Phonetics)

**Asked by:** standalone (deep dive request)
**Context:** User requested even deeper, undocumented, masterclass-level techniques for Suno AI (v3.5) with specific focus on precise vocal control and Bulgarian phonetic mapping.
**Finding:**
1. **Parameterized Meta-Tags (The "Colon" Syntax):** You can modify structure tags on the fly. Example: `[Verse: Whispered vocals, acoustic guitar only]`, `[Outro: Fading out, solo piano]`.
2. **Undocumented/Community Tags:**
   - `(break)`: Placing this in parentheses between sections forces a clean, short instrumental transition.
   - `[Stop]` / `[End]`: Place at the very end of lyrics to prevent AI from hallucinating extra verses or infinitely looping.
   - `#tags`: Using hashtags (e.g., `#choir`, `#strings`) in the Style field forces the AI to weight them differently than normal keywords.
   - `[Ad-lib]` / `[Silence]`: Forces vocal flourishes or dramatic pauses.
3. **Advanced Vocal Control:**
   - *Melisma (Vocal Runs):* Use `[Melismatic]` tag and physically elongate vowels in the lyrics (e.g., `Sky~~~~` or `I sawwwww you`).
   - *Falsetto:* Use `(falsetto)` inline. Combine with `[Airy]` or `[Breathy]` to prevent screaming.
   - *Vocal Fry:* Use `[Vocal Fry]` or `[Raspy]` (works best on slower genres like Lo-fi or Grunge).
   - *Staccato:* Use `(staccato)` inline to fix mumbling and force crisp, detached enunciation.
4. **Bulgarian Phonetic Deep Dive:**
   - *The "Ъ" (Schwa) Sound:* The hardest vowel. Use English "uh" or "er" (no 'r' sound). *България* = "Buhl-gah-ree-yah".
   - *Consonant Clusters:* Break tricky clusters with hyphens (e.g., *здрав* = "z-drav").
   - *The "Щ" (Sht) Sound:* Spell as "sh-t" or "sht".
   - *Rolled R:* Double the 'r' ("rr") or place it near percussive consonants.
   - *Vowels:* А="ah", Е="eh", Ж="zh", Х="kh" or "hh", Ц="ts", Я="yah", Ю="you".
5. **The "Blank Line" & Punctuation Rules:** Leave a full blank line between bracketed tags for the parser. Remove standard periods/commas at the end of lines and use line breaks instead; use exclamation marks `!` for volume/conviction.
**Source:** https://reddit.com/r/SunoAI, https://pronuncia.io
**Confidence:** high
**Version-specific:** yes (Suno v3.5)

## 2026-05-16: svc route-workflow research-trigger gate review

**Asked by:** route-workflow follow-up; user requested Gemini research and proper knowledge-system persistence.
**Context:** The framework proposal for the Example Marketplace WI-168-style failure needed a second-model review before promotion because the first draft risked turning a missing research route into the wrong enforcement contract.
**Finding:** Gemini CLI confirmed the framework already has four relevant contracts: capability-blocker routing, `research` invocation receipts, the research domain gate, and task-graph skill-load receipts. The real gap is narrower: `unknown-provider-api` signals are too literal, and `route-workflow` is not documented as a first-class detector/invoker for provider/API research-gated work. The proposal was amended so `route-workflow` must prove graph insertion of a blocking `research` task, not require a downstream research receipt before route closeout.
**Reliability Receipts:**
- Gemini CLI completed with local-file review on 2026-05-15T23:14:04Z.
- Domain gate approved writing to `references/knowledge/svc/`.
- Provenance written to `references/knowledge/svc/.sources.jsonl`.
**Source:** Local framework files: `proposals/2026-05-16-route-workflow-research-trigger-gate.md`, `route-workflow/references/routing-rules.md`, `route-workflow/references/lane-model.md`, `route-workflow/references/task-graph-protocol.md`, `research/SKILL.md`, `references/capability-blockers.json`, `scripts/diagnose-capability-blocker.mjs`, `FRAMEWORK-STATE.md`.
**Confidence:** high
**Version-specific:** yes (svc v1.5.2 self-knowledge snapshot)

## 2026-05-17: Cold Outreach Stack Tools Research

**Asked by:** standalone
**Context:** Researching specific, less-known cold outreach tools mentioned by the user for a new outreach stack.
**Finding:**
- **Apollo.io:** Industry standard for B2B data and sequencing.
- **AI Ark:** Next-gen B2B data intelligence platform. Refreshes data every 30 days, AI lookalike engine, 4-5x cheaper than Apollo.
- **Blitz-API:** Unverified/Unknown exact tool, possibly a specific data scraping API for outreach.
- **Prosp:** Likely refers to Prospeo or GetProspect, popular B2B email finding tools.
- **Reoon:** Highly accurate and cost-effective email verifier.
- **Milli (MillionVerifier):** Extremely cost-effective bulk email verifier, 99%+ accuracy, pay-as-you-go.
- **Mailninja (MailTester Ninja):** Affordable email verification, real-time API, privacy-first approach.
- **Infrasuite:** Unverified/Unknown exact tool. Likely a specialized infrastructure provider for setting up cold email domains and mailboxes at scale.
- **Instantly:** Leading sending tool with automated warmup and easy UI.
- **Claude Skills / Codex Skills:** Native agentic capabilities for drafting, personalization, and sequence management.
**Source:** Web Search
**Confidence:** medium
**Version-specific:** no
\n- Extracted knowledge from www.geminixprize.com on 2026-05-21 into hackathons domain

## 2026-05-20: Gemini XPRIZE & Antigravity Bonus

**Asked by:** standalone
**Context:** User requested deep research on Gemini XPRIZE rules and specifically how to activate the Antigravity bonus.
**Finding:** Extracted full rules, prize pool ($2M), and categories. The Antigravity bonus is a $100 credit for AI Ultra subscribers, activated via the "Perks" section in the Antigravity 2.0 app. Deadline: May 25, 2026.
**Source:** https://www.geminixprize.com/, https://xprize.devpost.com/rules, and Google search.
**Confidence:** high
**Version-specific:** yes — applies to 2026 hackathon cycle.

## 2026-05-27: PostHog full technological research

**Asked by:** research (standalone, invoked from Example Marketplace WI-316 follow-up)
**Context:** User challenged the earlier PostHog work as not being full SVC technological research and required Gemini/SVC-compliant research with local project comparison before implementation.
**Finding:** Extracted reusable PostHog knowledge into `references/knowledge/domains/posthog/`, covering official SDK/API docs, current npm packages, identity/person model, GDPR/consent controls, session replay privacy, feature flags, experiments, MCP verification, and Example Marketplace/CovibeFusion/Distrilicious fit. Current package metadata on 2026-05-27: `posthog-js@1.376.2`, `@posthog/react@1.9.1`. Official current React docs use `@posthog/react`; older local skill guidance that uses `posthog-js/react` should be treated as stale until corrected. For Example Marketplace, the researched implementation path is consent-first dynamic initialization on EU Cloud, no SDK/network/storage before Analytics consent and key availability, no replay/surveys/error/logs until separately reviewed, stable non-email user ID for identify, reset on logout/withdrawal, and live ingestion verification through authenticated PostHog MCP/API.
**Gemini receipt:** Attempted with `node research/scripts/dispatch-gemini.mjs --prescope docs/specs/research-prescope-posthog.md --domain domains/posthog`; Gemini CLI returned HTTP 429 `MODEL_CAPACITY_EXHAUSTED` for `gemini-3.1-pro-preview`, so the research skill fallback completed extraction in-session against the fetched official raw Markdown manifest.
**Source:** `docs/specs/research-prescope-posthog.md`, `docs/specs/research-posthog-raw-extraction.md`, `references/knowledge/domains/posthog/.sources.jsonl`, official PostHog docs, npm registry metadata, and local project files listed in the pre-scope.
**Confidence:** high
**Version-specific:** yes - applies to official PostHog docs and npm package metadata retrieved on 2026-05-27.

## 2026-06-05: UGC Scaling, Micro-Collaborations, and Growth Marketing Playbook (Lucas Patiri)

**Asked by:** standalone (user request to study Lucas Patiri's growth/UGC strategies and translate to framework/Example Marketplace pilots)
**Context:** Researching the viral growth principles outlined in http://x.com/lucaspatiri_/status/2062627926022238586 (equivalent to X Article 2062605635716370432 / Reddit r/AppBusiness study) to evolve Serious Vibe Coding (svc) project onboarding (`onboard-repo`), framework knowledge-base synthesis, and digital outreach playbooks for Example Marketplace.
**Finding:**
Lucas Patiri's "10 UGC mistakes that kill app campaigns before they start" (after 1.5B views, 25+ campaigns, and 500+ creators) shifts the focus from creative individual talent to operational scaling systems:
1. **Vague or Missing Briefs:** The single largest killer of UGC campaigns. A high-performing brief must specify a one-sentence objective, 2-4 key messaging points, a detailed target audience description, explicit format/length requirements, and 3-5 visual reference videos.
2. **Follower Count Vanity:** Do not hire based on follower count. Prioritize average view counts, hook quality, and responsiveness.
3. **Prioritizing "Polished" Content:** Seeking high-production-value, commercial-looking videos. The most effective UGC is raw, authentic, and feels native to the platform; if it feels like an ad, it often stops working.
4. **Lack of Pre-moderation:** Every draft must be manually reviewed and approved before posting.
5. **Slow/Generic Feedback:** Responses and feedback must be sent within 24 hours to keep creators motivated, using a consistent correction vocabulary.
6. **No Format Testing Cycles:** Content fatigue causes CPI to rise; teams must test 3-5 new creative formats weekly.
7. **Performance Incentives:** Avoid flat rates; align interests using Minimum Viable Content (MVC) contracts or conversion/retention performance clauses.
8. **Scattered Communications:** Centralize all feedback, briefs, and approvals in a single master tracking sheet and channel.
9. **Ignoring Retention Hooks (Mid-Funnel):** CPI is a vanity metric if users churn. Measure retention (Day 3, Day 7) by creator and format to identify actual quality.
10. **No Creator Tiers/Reviews:** Perform regular monthly performance tier reviews, offloading non-performers to free up capital.

**Example Marketplace B2B Outreach Pilot Recommendations:**
- *Instagram DMs & Cold Emails:* Transition from polished corporate pitches to raw, highly authentic "native" outreach messages referencing hyper-specific menu items, locations, or recent posts (e.g. from local food bloggers).
- *Format Testing:* Run outreach copy in small micro-pilot batches of 5-10 before scaling.
- *Sample Program Incentives:* Transition the referral loop to use performance-aligned merchant rebates.
- *Retention First:* Focus on Day-7 product activation (shifts scheduled, employee check-ins) instead of signup/trial volume.

**SVC Framework Onboarding (`onboard-repo`) & Knowledge Evolution:**
- *System over Individual:* Avoid scattered subagent memory by centralizing project-specific rules in `router-context.md` and `agent-topology.md`.
- *Systematic Sweeps:* Enforce directory-level sweeps in the first pass of onboarding/research to prevent missing capabilities that do not match narrow regex keywords.
- *Down-Funnel Verification:* Audit gates (G5/G6/G7) must require live runtime evidence (visual baselines, E2E playbacks) over vanity checkmarks (tests passing locally).

**Source:** http://x.com/lucaspatiri_/status/2062627926022238586 / Reddit r/AppBusiness (u/lptri)
**Confidence:** high
**Version-specific:** no

## 2026-06-06: EIT Urban Mobility Startup Investment Open Call (2026-2028)

**Asked by:** standalone
**Context:** Researching EIT Urban Mobility Open Call funding, corporate applying conditions, NetSuite registration, and due diligence requirements.
**Finding:** EIT Urban Mobility offers up to EUR 2.5 million per company in priced equity or SAFEs, co-investing pari-passu with a private lead investor. Pre-money valuation cap is EUR 50 million, and founders must hold >40% equity. Bulgaria is eligible as a RIS country, qualifying for a reduced co-funding rate of 25% (vs 35%). General app directions for EIT focus areas are categorized into Live Local Movement Planning, Accessibility-Aware Discovery, First/Last-Mile Commerce, Urban Traffic Smoothing, and District Mobility Data/AI.
**Source:** https://www.eiturbanmobility.eu and official call manual, FAQ, and Application Guidance PDF documents.
**Confidence:** high
**Version-specific:** yes (2026-2028 calls)


## 2026-06-07: EIC Accelerator — full-site funding-portfolio extraction (analysis mode)

**Asked by:** standalone (user request, gemini-cli explicitly requested)
**Context:** Builder evaluating EU funding routes after the 2026-06-06 EIT Urban Mobility extraction; target https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en widened to the full EIC funding-opportunities tree per "every program" instruction.
**Finding:** New knowledge domain `references/knowledge/domains/eic-accelerator/` (CAPABILITIES.md + 10 detail files). Headlines: Accelerator = grant <€2.5M (TRL 6-8) + EIC Fund equity €0.5-10M (to TRL 9), 2026 budget €634M, full-proposal cut-offs 7 Jan/4 Mar/6 May/8 Jul/2 Sep/4 Nov 2026, 3-step process (12p short proposal → 20p full → 45-min jury), lifetime cap of 3 rejections; Pathfinder ≤€4M (consortia), Transition ≤€2.5M (16 Sep 2026), Pre-Accelerator €0.3-1M for widening countries incl. Bulgaria (next call 5 May-18 Nov 2027), STEP Scale Up €10-30M (needs 20% investor pre-commitment); 50 certified Plug-In programmes (Bulgaria absent); Seal of Excellence at ≥13/15; BAS incl. ACCESS+ €60K co-financing. EIT Urban Mobility KIC is a named Fast Track route into the Accelerator — composes with `domains/eit-urban-mobility`.
**Source:** 64 URLs, eic.ec.europa.eu (sitemap-scoped from 1718; prescope docs/specs/research-prescope-eic-ec-europa-eu.md); extraction via gemini-cli in 6 slices; coverage-check 100% (lock d328a4d44906d87d); deep-extraction-check 64/64 pass; activity verdict: active (56 posts/12mo, latest 2026-06-05).
**Confidence:** high (site-verbatim; two rate-limited URLs independently re-fetched and verified)
**Version-specific:** yes — 2026 Work Programme regime (adopted 6 Nov 2025); cut-offs/budgets are 2026-specific; re-verify after WP2027 adoption (~Nov 2026).

## 2026-06-07: Claude Code Dynamic Workflows — full multi-source extraction

**Asked by:** standalone (`/research` with 2 URLs + "anything it can find for it, x and other guides")
**Context:** New Claude Code host capability (launched 2026-05-28 alongside Opus 4.8); host-capability-research rule mandates current-docs verification before any framework wiring touches it.
**Finding:** Extended `references/knowledge/domains/agent-harnesses/` with `details/claude-code-dynamic-workflows.md` + CAPABILITIES.md "Dynamic Workflows" section. Headlines: a dynamic workflow = plain-JS orchestration script Claude writes, runtime executes in background, script holds plan/state (not Claude's context); dozens-to-hundreds of agents (Cherny: "1-2 OOMs more than agent teams"); v2.1.154+, all paid plans (Pro opt-in /config, Enterprise default-off), API/Bedrock/Vertex/Foundry; strict opt-in via `ultracode` keyword (renamed from `workflow` in v2.1.160 after genericity complaints), `/effort ultracode` (xhigh + auto-orchestration), own-words ask, or saved/bundled commands (`/deep-research`). Runtime API (from community-archived product SKILL.md): `agent(prompt, {label, phase, schema→validated StructuredOutput, model, isolation:'worktree' (~200-500ms), agentType})`, `pipeline()` DEFAULT no-barrier, `parallel()` barrier, `phase()`/`log()`, `args`, `budget` (+500k-style HARD ceiling, agent() throws), nested `workflow()` 1-level; caps min(16, cores−2) concurrent / 1,000 per run; plain JS, `Date.now()`/`Math.random()` throw (deterministic resume); resume via runId longest-unchanged-prefix cache, same-session only; subagents always acceptEdits + inherit allowlist. Patterns: fan-out-synthesize, adversarial verify (majority-refute), perspective-diverse verify, tournament/judge panel, loop-until-dry, multi-modal sweep, completeness critic, quarantine, no-silent-caps. Case studies: Bun Zig→Rust (~750K lines, 99.8% tests, 11 days, 2 reviewers/file); isitchristmas (484 agents/16M tokens/$85; review wave caught a bug a 148,488-case suite missed). Reception: token-burn ("tokenmaxxing") is the dominant critique; Cloudflare name collision. MindStudio guide's mechanics are WRONG vs official docs (claims single-context autonomous loop) — its when-to-use heuristics are fine, never cite its mechanics.
**Source:** 13 URLs — 2 claude.com blogs (playwright; gemini-cli web_fetch failed this run, recorded in prescope), 3 code.claude.com docs .md (Mintlify machine-readable exception), archived SKILL.md + README (gh raw), benjaminste.in case study x2, HN 48311705 (Algolia API), @trq212 tweet (syndication API; 9.8K likes), X article inaccessible (500, no Wayback; content = harness-blog mirror). Prescope: docs/specs/research-prescope-claude-code-dynamic-workflows.md; raw: docs/specs/research-raw-claude-code-dynamic-workflows.md.
**Confidence:** high (official docs + archived product spec + two independent hands-on accounts agree on all mechanics)
**Version-specific:** yes — research preview, docs as of v2.1.157-era (2026-06-07); keyword/caps/plan-gating may change; re-verify via code.claude.com/docs/en/workflows.md + whats-new digests before wiring.

## 2026-06-20: Cowork vs Claude Code — shared usage, limits, and integration

**Asked by:** standalone (user)
**Context:** User asked whether Claude "Cowork" gives extra usage allowance on top of a Claude Code subscription, whether they share or have separate usage limits, and whether they can be used together (handoff / shared sessions / shared account).
**Finding:**
- **Cowork is NOT a separate subscription product** — it is an agentic feature/mode of the Claude Desktop app for multi-step knowledge work (vs Claude Code's coding focus). Released as research preview 2026-01, broader GA over Q1 2026. [official: anthropic.com/product/claude-cowork]
- **No extra allowance — shared pool.** All Claude product surfaces draw from ONE shared usage pool per plan. There is no "Claude Code subscription" separate from a Cowork allowance: a Pro/Max plan grants ONE quota that Claude chat, Claude Code, IDE usage, and Cowork all consume from. Official wording (Pro/Max article): "Both Pro and Max plans offer usage limits that are shared across Claude and Claude Code, meaning all activity in both tools counts against the same usage limits." Cowork is explicitly named as drawing from the same pool in the Enterprise consumption guide: "particularly Claude Code and Cowork—consume tokens at a significantly higher rate than standard chat."
- **Separate quotas? No.** One combined quota per plan tier (Pro / Max 5x / Max 20x are tiers with different sizes, but within a tier everything shares one pool). Cowork and Claude Code burn that pool FASTER than chat (officially acknowledged, no published coefficient).
- **Used together?** Same account, yes (one login, shared quota). Officially documented context-handoff / shared-session between Cowork and Claude Code: NOT available as of 2026-06. Team/Enterprise got centralized authorization across Claude chat / Claude Code / Cowork (MCP connectors) — that is auth scope, NOT context/session sharing. A shared-context feature request is open on the claude-code GitHub repo (known gap, not shipped). Practical handoff today = manual: shared project folder + CLAUDE.md convention.
**Source(s):**
- https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan [T1 official help center — shared-limits quote, direct-fetched]
- https://support.claude.com/en/articles/14782391-claude-enterprise-consumption-guide [T1 official help center — Cowork named in shared pool, corroborating search]
- https://support.claude.com/en/articles/11647753-understanding-usage-and-length-limits [T1 official help center — all surfaces same limit]
- https://www.anthropic.com/product/claude-cowork [T1 official product page — definition]
- https://github.com/anthropics/claude-code/issues/30675 [T2 official repo issue — shared-context feature request = handoff is a known gap]
**Triangulation:** Load-bearing shared-pool claim confirmed by ≥2 independent official help-center articles (Pro/Max article quote re-verified by direct WebFetch; Enterprise consumption guide naming Cowork confirmed by independent WebSearch). Independence: Pro/Max article and Enterprise consumption guide are distinct help-center pages, not paraphrases of each other. Integration-gap claim rests on official Enterprise-feature scope + an open GitHub issue (absence of a documented handoff feature).
**Confidence:** high (usage pool); medium (handoff — argued partly from documented absence + open issue, so "not documented" rather than "proven impossible")
**Volatility:** volatile (product features, limits, integration roadmap)
**As-of date:** 2026-06-20
**Re-verify after:** 2026-07-20 (30d — product surfaces/limits change; handoff feature may ship)
**Version-specific:** no (plan-level, not pinned to a CLI version)

## 2026-06-30T18:49:13Z — WI-470 model verification gate (claude-api)
- **Question:** exact Sonnet 5 model id + the HIGH reasoning-effort param shape, for references/model-registry.json + dispatch wiring.
- **Source:** `claude-api` skill (bundled), `shared/models.md` + "Thinking & Effort" + "Migrating to Claude Sonnet 5".
- **Findings (grounded, not memory):**
  - Model id = `claude-sonnet-5` (bare; no date suffix). 1M context, 128K max output.
  - High effort = `output_config: { effort: "high" }` — GA, no beta header, nested under output_config. Sonnet 5 supports low/medium/high/xhigh/max (first Sonnet with xhigh).
  - Adaptive thinking only: `thinking:{type:"enabled",budget_tokens:N}` 400s; omitting thinking runs adaptive. Registry stores effort, NOT a budget_tokens block.
  - Claude Code CLI invocation: `claude -p --model claude-sonnet-5`; effort enum matches low/medium/high/xhigh/max.
- **Decision:** add `sonnet-5` alias; svc-default EXEC + REVIEW -> sonnet-5 + effort:high; keep STRAT/PLAN on opus; PASS haiku; SENSE mimo.

## 2026-07-14: Codex hooks — scope authority and skill-loading enforcement

**Asked by:** `improve-framework` via the WI-481 planning session
**Context:** A Codex Stop hook tried to continue WI-479 after the user had only asked to locate today's improvement proposal. WI-479 was freshly claimed by a different Claude Fable session. The same audit checked whether Codex really enforces loading a routed skill before mutation.
**Finding:** Codex Stop hooks are unusually high-risk for stale continuation pressure because a Stop response of `{decision:"block",reason}` does not reject termination in place; it creates another continuation prompt. Codex hook payloads provide stable `session_id` and turn-scoped `turn_id`, so a Codex-only scope gate can bind each prompt and require session/turn/WI ownership before any Stop continuation. `stop_hook_active` is the loop signal. `UserPromptSubmit` and `Stop` ignore matchers. `PreToolUse` can intercept Bash, `apply_patch`/Edit/Write, and MCP tools, but official documentation explicitly says coverage is incomplete, so hooks are a guardrail rather than a complete enforcement boundary. Matching hooks from user and repository configuration all run, and matching command hooks run concurrently; the plan therefore must not rely on hook ordering. Hook commands run with the session CWD, so installed absolute paths or git-root resolution are required. Updated hook command hashes require review/trust through `/hooks`. Current official documentation says hooks are enabled by default and may be disabled with `[features] hooks=false`; the local knowledge page that calls hooks opt-in is stale.
**Local comparison:** `scripts/wire-codex-hooks.mjs` wires Codex's skill-load check to `hooks/kimi/svc-kimi-skill-load-enforcer.sh`, but that script exits successfully on every non-Kimi host. It also checks only `task-graph.mjs complete`, not mutation before the named skill is loaded. The shared authenticity/freshness hooks do not bind receipts to Codex `session_id` + `turn_id` + task, and their canonical-tool/path handling is incomplete for `apply_patch` and `docs/plans/`.
**Decision:** Add WI-485 as a Codex-only execution-integrity pillar. Wire a Codex prompt/Stop scope firewall and a Codex skill-load mutation gate through the Codex wirer only; keep other host behavior byte-for-byte unchanged. Use session/turn/task-scoped receipts, explicit resume language, absolute paths, replay fixtures, and cross-host non-regression assertions. Treat `/hooks` trust as explicit external state and do not claim hooks cover every mutation route.
**Source:** https://learn.chatgpt.com/docs/hooks (official Codex hooks reference, retrieved 2026-07-14), `scripts/wire-codex-hooks.mjs`, `hooks/svc-task-completion-guard.sh`, `hooks/kimi/svc-kimi-skill-load-enforcer.sh`, `hooks/svc-session-contract-freshness.mjs`, `hooks/svc-skill-artifact-authenticity.mjs`
**Confidence:** high
**Version-specific:** yes — Codex hook semantics and enablement/trust behavior are volatile; re-verify official docs before WI-485 execution.

## 2026-07-15: Claude/Codex external-review invocation audit

**Asked by:** owner, before shipping the WI-486–WI-488 framework intake
**Mode:** question
**Question:** Is the framework invoking external Codex/Claude reviewers in the best current way, and what must change before implementation?
**Finding:** No. The installed Codex CLI is 0.144.4 and the installed Claude Code CLI is 2.1.210. `review-cross-model/SKILL.md` documents `codex -p ... --output-format text`, but current Codex uses `codex exec`; `-p` means profile and Codex has no `--output-format` flag. `scripts/review-plan-codex.sh` also pins gpt-5.5, passes the package through argv, inherits user state, persists the default session, merges stderr into stdout, and accepts unstructured output.

**Recommended contract:** One canonical external-review launcher consumes the resolver's exact tuple and a package on stdin. Codex uses explicit 5.6 sol/high, read-only sandbox, ephemeral mode, user-config/rules isolation that preserves `CODEX_HOME` auth, strict config, JSONL + JSON Schema, separate final message, separate stderr, timeout, and a receipt that proves exact invocation tuple plus runtime effective tuple when exposed. Claude uses full Fable-5/high, safe mode, disabled tools/MCP, plan permission mode, no session persistence, one turn, schema JSON, timeout/budget ceiling, and verifies `modelUsage`. `--bare` is not the universal Claude default because it disables OAuth/keychain reads. The primary review call doubles as the availability probe; only a classified Fable model-unavailable/model-entitlement/provider-overload result may start a separate Opus-xhigh fallback. Auth, shared subscription-quota exhaustion, network, timeout, and schema failures never fall back. A hash over package + tuple + schema + launcher version permits reuse only when the effective tuple equals the requested primary tuple and no fallback occurred; fallback receipts never satisfy a later primary request.

**Billing correction:** Anthropic's current help-center notice says the announced separate Agent SDK credit change was paused. For now `claude -p`/Agent SDK usage remains within subscription usage limits and no separate monthly Agent SDK credit is available. The framework's earlier contrary claim was marked historical/superseded. Cost controls still matter because external reviews consume the shared allowance.

**Decision:** Expand WI-488's deterministic-review gap to include the canonical structured/isolated launcher, classified fallback, effective-model/cost receipt, duplicate suppression, CLI capability gate, direct-invocation migration inventory, and fixture-only Tier-1 coverage. Execute WI-488 before WI-486/WI-487 so later framework work uses the corrected high-effort review path. This intake records the contract and research only; it does not implement runtime launcher changes.

**Sources:** OpenAI official non-interactive mode and developer-command reference; Anthropic official headless/CLI reference and current Agent SDK credit support notice; installed CLI `--help`. SHA-256 provenance is recorded in `references/knowledge/domains/agent-harnesses/.sources.jsonl`.
**Confidence:** high for current CLI syntax and documented controls; high for current billing pause.
**Volatility:** high — model ids, flags, auth behavior, and billing policy can change.
**As-of date:** 2026-07-15
**Re-verify after:** 2026-08-14, or immediately before WI-488 execution if later.
**Version-specific:** yes — Codex CLI 0.144.4 and Claude Code 2.1.210.

**Independent review:** Fable 5 at high returned PASS. Its two medium refinements were accepted: fallback receipts cannot permanently stand in for a recovered primary reviewer, and shared subscription-quota exhaustion is a no-fallback hard failure. Four low consistency/provenance notes were also applied without changing the intake-only boundary.

## 2026-07-16: Claude structured-review turns and Fable safety routing

**Asked by:** `improve-framework` for WI-489
**Context:** Two real WI-486 Fable 5/high plan reviews through the promoted WI-488 launcher reached schema tool use but ended `error_max_turns` with no findings. The owner also required a scheduled Opus-high default with an easy receipted Fable re-enable.
**Finding:** Installed Claude Code 2.1.211 describes `--json-schema` as structured validation and exposes `--max-turns` as a turn bound. Anthropic's Agent SDK reference defines `max_turns` as agentic tool-use round trips, while its structured-output documentation says schema output is delivered after multi-turn tool use and can re-prompt on mismatch. Therefore the launcher must not equate one paid primary invocation with one CLI protocol turn: it should allow the minimum bounded schema handshake while separately enforcing one primary invocation, and classify schema-turn exhaustion as non-fallback. Anthropic also documents that automatic Fable model switching is enabled by default in Claude Code and re-runs a flagged request on Opus 4.8 in the same conversation. That provider-managed route is distinct from `--fallback-model` and from the launcher's own separate availability fallback; it must suppress a second Opus launch and cannot be cached as a Fable-primary result. The July 20 profile cutover is an owner policy and makes no claim about post-July-19 Fable pricing or entitlement.
**Source(s):**
- `claude --version` and `claude --help`, installed CLI 2.1.211 [T1 installed executable for exact flags]
- https://code.claude.com/docs/en/headless [T1 official Claude Code documentation]
- https://code.claude.com/docs/en/agent-sdk/structured-outputs [T1 official Agent SDK documentation]
- https://support.claude.com/en/articles/15363606-why-claude-switched-models-in-your-conversation-with-fable-5 [T1 official product behavior authority]
- https://www.anthropic.com/claude/fable [T1 official model page]
**Triangulation:** T1-primary single-source-justified for the installed flag surface and `max_turns` definition; structured-output retry semantics are corroborated by the official headless and SDK pages. Fable-to-Opus behavior is a vendor-defined product contract and is independently described by the official model page and Help Center behavior article.
**Confidence:** high
**Volatility:** volatile
**As-of date:** 2026-07-16
**Re-verify after:** 2026-07-23, or immediately before changing model-routing policy
**Version-specific:** yes — Claude Code 2.1.211 and current Fable 5 safeguard behavior

## 2026-07-22: XDG runtime directory unavailable versus insecure

**Asked by:** `improve-framework` for WI-506
**Context:** The current Codex/WSL host exports `XDG_RUNTIME_DIR=/run/user/1000/`, but the directory is absent. SVC bootstrap and skill loading fail before the intended framework/product task can proceed.
**Finding:** The XDG Base Directory specification defines the runtime directory as user-owned, user-private, and mode `0700`; it explicitly tells applications to use a replacement with similar capabilities and warn when `XDG_RUNTIME_DIR` is unset. It also says applications should attempt to create a nonexistent destination leaf with `0700` and handle write failure. `pam_systemd` normally creates `/run/user/$UID` on login and removes it after the last logout, but explicitly does nothing when systemd is not the init system. GLib provides a production precedent for falling back to the user cache directory when XDG runtime state is unset. The standards do not explicitly prescribe behavior for a variable that is set to an absent or unusable parent. WI-506 therefore adopts an explicit inference: treat missing/nonexistent configured state as unavailable and eligible for a private application fallback; treat an existing insecure/symlinked/foreign-owned root as hostile evidence and fail closed. SVC must not create `/run/user/$UID` itself.
**Source(s):**
- https://specifications.freedesktop.org/basedir-spec/latest/ [T1 primary specification]
- https://www.freedesktop.org/software/systemd/man/latest/pam_systemd.html [T1 official systemd contract]
- https://docs.gtk.org/glib/func.get_user_runtime_dir.html [T1 official GLib API documentation]
**Triangulation:** The security/lifetime invariants are definitional XDG T1-primary facts. systemd independently explains when `/run/user/$UID` exists and the non-systemd no-op. GLib independently demonstrates an established cache fallback. The invalid-but-set classification is marked as an SVC design inference rather than attributed to the standard.
**Confidence:** high for the standards and host behavior; medium-high for the explicit SVC invalid-but-set policy until adversarial design/security review.
**Volatility:** stable for XDG semantics; moderately volatile for host integration behavior.
**As-of date:** 2026-07-22
**Re-verify after:** 2027-07-22, or immediately if the XDG specification/systemd contract changes.
**Version-specific:** no; URLs were live-verified on 2026-07-22.

## 2026-07-23: Canonical precedent for phase-receipt-aware skip integrity

**Asked by:** `write-spec` / solution-confidence for WI-510
**Context:** The promoted WI-498 graph is rejected by the skip-conditions registry validator even though the affected tasks executed and carry structured Phase-D receipts. The correction must preserve no-silent-skip behavior and historical audit bytes.

**Finding:** The repository already defines the necessary four-way state model:

1. An executed task and a skipped task are distinct. The task-graph protocol says a real skip is `completed` with `skip_reason`, while execution requires the skill to be loaded.
2. Current delivery-graph skips are explicit, registry-backed, and require both reason and evidence.
3. Current Phase-D receipts declare typed, repository-relative evidence references and required phase IDs, while the existing cutoff preserves historical compatibility.
4. Existing task-state compatibility code uses one shared classifier and quarantines malformed current or lossy legacy shapes instead of scattering permissive checks.
5. WI-498's promoted commit has a tree-bound, independently reviewed, zero-waiver retroactive attestation. Its phase-log paths are ephemeral, but its durable changed-file/evidence package and graph bytes are auditable; WI-510 must not rewrite them.
6. The current skip-registry validator is the outlier: it still requires `output_artifact` or `validation_output`, while the lane-tasks integrity validator already recognizes a matching loaded receipt as executed.

The best-fit design is therefore one pure classifier for completed registry-skill tasks with outcomes `executed`, `authorized-skip`, `legacy-compatible`, or `invalid`. Safe evidence-reference resolution means canonical allowed type plus a non-empty repository-relative path that cannot escape the repository. It does not invent permanent retention of ignored command-output files; durable content/authenticity remains owned by Git history and chain receipts.

**Source(s):**

- `route-workflow/references/task-graph-protocol.md` around the valid SKIP path [T1 repository normative protocol]
- `references/phase-receipts.md` sections 3–6 [T1 repository normative schema]
- `scripts/validate-delivery-graph.mjs` `loadSkipIds`, `skipsFor`, and `validateGraph` [T1 executable contract]
- `test-framework/evals/tier-1/validate-skill-receipt-shape.sh` Phase-D enforcement and historical cutoff [T1 executable contract]
- `hooks/lib/task-state-compatibility.mjs` `classifyTaskState` and shared shape validation [T1 executable contract]
- `test-framework/evals/tier-1/validate-lane-tasks-integrity.sh` completed-task receipt behavior [T1 executable contract]
- Git note `refs/notes/svc-receipts` on `85b5b965b28667e0b8f16501c50446cb9f3ca73b` [T1 durable promoted attestation]

**Triangulation:** All load-bearing claims are defined by repository primary authorities. The task protocol and two independent executable validators agree on execution-versus-skip intent; the delivery-graph and receipt validators independently define current authorization/shape; the Git note proves the protected WI-498 audit boundary. No external source can override these local normative contracts.

**Confidence:** high
**Volatility:** stable inside the WI-510 base SHA; re-verify if the receipt, delivery-graph, or task-state schemas change.
**As-of date:** 2026-07-23
**Re-verify after:** next schema or enforcement-cutoff change
**Version-specific:** repository base `89806678a9d88a0eafa4784fba8a065ff367c0e0`

**Routed-to:** Local-primary fallback. The `deep-research` plugin required by the generic 4+-source boundary is not installed in this session; external research was unnecessary because this is an internal normative-contract question.

## 2026-08-10: Codex governed command is the effective serialized dispatcher

**Asked by:** `improve-framework` for WI-529
**Context:** Canonical Codex setup materialized the durable launcher and exited zero, but the immediate live drift check reported that neither the launcher nor governed hook marker existed in `~/.codex/hooks.json`.
**Finding:** The repository's current Codex capability node confirms one composite PreToolUse boundary and concurrent execution for multiple matching host hooks. `wire-codex-hooks.mjs` correctly collapses the child entries to that single dispatcher, but the final replacement discarded the earlier launcher-routed skill-load command. The safe repair is therefore to register and launcher-route the effective dispatcher itself; installing a separate launcher-routed enforcer would reintroduce concurrent duplicate execution. Setup also checked declared routing markers only for `post_install` wirers, not the Claude/Codex/Gemini `case` path.
**Source(s):**
- `references/knowledge/domains/codex-hooks/CAPABILITIES.md` [T1 repository capability authority]
- `references/knowledge/domains/codex-hooks/.sources.jsonl` [T1 official-doc provenance]
- `scripts/wire-codex-hooks.mjs`, `hooks/codex/svc-codex-pretool-dispatcher.mjs`, `setup`, and `scripts/check-install-drift.sh` [T1 executable local contract]
- live `~/.codex/hooks.json` and `~/.svc/install-state/codex.json` [T1 installed-state evidence]
**Triangulation:** The capability node establishes host concurrency and the composite design; the wirer and dispatcher establish the effective command/children; setup and drift checker independently demonstrate the writer/validator mismatch; live config reproduces it.
**Confidence:** high
**Volatility:** stable for the WI-529 base; host hook capabilities are version-sensitive.
**As-of date:** 2026-08-10
**Re-verify after:** any Codex hook API, dispatcher, launcher, or setup-wiring change.
**Version-specific:** repository base `0d75cb1d697d3c031e871f2bd182066a47f7bbb8`; official Codex hook provenance last refreshed 2026-05-10.

## 2026-08-15: Native Codex subagent availability does not carry SSVE mutation authority

**Asked by:** `research` / solution-confidence for WI-541
**Context:** WI-541 must decide whether current native Codex collaboration can replace the contained child launcher for governed parallel mutation without weakening worktree, identity, delegation, or allowed-path enforcement.
**Finding:** Current Codex releases support subagent workflows, and official guidance recommends beginning with read-heavy parallel work while treating concurrent write-heavy work carefully. The current hook lifecycle includes `SubagentStart` and `SubagentStop`, but lifecycle interception is not filesystem containment and does not create a persisted delegation. On the live Codex 0.147.0 host, the top-level CLI exposes working-directory and sandbox controls; however, the active native spawn interface carries only task instructions, task name, history-forking, and optional model/reasoning controls. It does not carry the stable child principal, exact canonical worktree, task token, disjoint allowed paths, environment handoff, or containment launcher required by the repository's mutation contract. Therefore `agents: true` means orchestration availability only. Native subagents remain read-only; governed child mutation uses `scripts/svc-contained-exec.mjs` with a persisted delegation and isolated inner worktree, or falls back to the controller.
**Source(s):**

- `codex --version`, `codex --help`, and the active `spawn_agent` tool schema [T1 installed/runtime authority]
- https://learn.chatgpt.com/docs/agent-configuration/subagents [T1 official OpenAI subagent guidance]
- https://developers.openai.com/codex/hooks [T1 official OpenAI lifecycle-hook contract]
- `provision/hosts/codex.json`, `scripts/svc-contained-exec.mjs`, and the repository durable mutation authority contract [T1 local normative and executable authority]

**Triangulation:** The installed/runtime schema proves what this session can actually transport; the official subagent page establishes availability and the read-heavy/write-heavy boundary; the official hook page establishes lifecycle observation; the repository contract defines the additional fields required for mutation. The conclusion is an explicit SSVE inference from those independent authorities.
**Confidence:** high
**Volatility:** volatile for Codex transport fields and lifecycle events; stable for the repository's current fail-closed authority requirement.
**As-of date:** 2026-08-15
**Re-verify after:** any Codex collaboration tool-schema, hook API, or contained-child transport change.
**Version-specific:** Codex CLI 0.147.0 and the active 2026-08-15 collaboration tool schema.

## 2026-08-23: Cursor effort and workspace are explicit review authority inputs

**Asked by:** WI-559 Sol High final-tree review
**Context:** The first local Cursor transport passed the selected base model but
only copied `effort: high` into receipts and inherited the caller's working
directory.

**Finding:** The installed `cursor-agent --help` documents parameterized models
and an explicit `--workspace <path-or-name>` flag, but a live exact-tree attempt
proved that the owner-policy aliases do not accept bracket syntax: both
`claude-fable-5[effort=high]` and `gpt-5.6-sol[effort=high]` were rejected before
review. The same diagnostic listed the installed concrete aliases
`claude-fable-5-high` and `gpt-5.6-sol-high`. The canonical transport therefore
invokes `--model <base-model>-<resolved-effort> --workspace <context-root>`.
Recording the effort without passing it is not exact tuple enforcement. The
remaining surface retains `--print`, JSON output, plan mode, and the enabled
sandbox, so the review package remains stdin-only and read-only.

**Source(s):**

- Installed `cursor-agent --help` on 2026-08-23 [T1 installed CLI authority]
- `scripts/run-external-review.mjs` and the WI-559 convergence fixture [T1 local executable contract]
- `.svc/external-review-artifacts/cross-model/wi559-bootstrap-final-sol-r3/` [T1 preserved independent review evidence]

**Confidence:** high
**Volatility:** volatile across Cursor Agent CLI releases.
**As-of date:** 2026-08-23
**Re-verify after:** any Cursor Agent upgrade or review transport change.
**Version-specific:** installed Cursor Agent reported `2026.08.11-e8db854` in the hermetic capability contract; live help was re-read on 2026-08-23.
