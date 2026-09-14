# Framework Improvement — 2026-04-26 — `launch-knowledge` Skill

**Status:** DRAFT — proposed during example-marketplace session 2026-04-26.

## Origin

Multiple research dispatches in a single example-marketplace session re-derived the same generic-knowledge questions:
- "Find me a $30/mo bundle alternative to Base44"
- "What about my $300 GCP credit, are there other trials / Vertex programs?"
- "Are NVIDIA Inception / Microsoft Founders Hub stackable?"
- "Wife will register БУЛСТАТ — is that the only thing she needs?"
- "I'm above the social security cap — does that change the math?"
- "Can one BULSTAT cover N apps?"
- "Do we need a separate skill for all that?"

The user clarified the framing: **"I need that GENERALLY KNOWS ALL FOR LAUNCHING AND STUFF. The last thing I need it to know more about me — but eventually it will."**

Key insight: the skill is **primarily a universal knowledge base** about launching a software product (legal, tax, credits, hosting, payments, distribution, early traction). User personalization is a **thin overlay that accretes over time** — not the primary value.

## Goal

A single skill that holds the canonical, current, factually-cited knowledge any founder needs to launch a software product — independent of who they are. Personalization layers on top via a small per-user file that grows incrementally.

## Scope (universal knowledge, not personal decision)

The skill's knowledge base covers:

### A. Legal vehicles by jurisdiction
- BG (свободна професия / БУЛСТАТ / EOOD / OOD)
- EE (e-Residency / OÜ)
- US (Delaware LLC / C-Corp / sole prop / Stripe Atlas)
- UK (sole trader / Ltd)
- DE / NL / IE / EU-general (cross-border VAT MOSS / OSS)
- Tax-residency rules, social security floors, dual-employment caps, CFC implications
- When to incorporate (revenue triggers, PII triggers, fundraising triggers)

### B. Startup credit programs (cataloged, eligibility-cut)
- Microsoft for Startups Founders Hub (stages, Azure OpenAI angle)
- NVIDIA Inception (AWS Activate $100K, Nebius $150K)
- AWS Activate (Founders / Portfolio / Builders / Web3)
- Google for Startups Cloud Program (tiered)
- Cloudflare for Startups
- PostHog for Startups ($50K)
- MongoDB Atlas for Startups
- Perplexity for Startups
- xAI Grok deposit ($150/mo perpetual)
- Notion / Linear / Sentry for Startups
- Stripe Atlas (and CFC trade-off for non-US)
- Y Combinator deals (non-YC accessible)
- Brex / Mercury startup partnerships
- Female-founder-specific programs (AWS Impact Accelerator, Pipeline Angels referrals, Backstage Capital, Google for Women Founders)

For each: $ value, duration, eligibility cuts, application difficulty, stackability matrix, US-only flag, geo-eligibility flags.

### C. Hosting / platform bundles
- All-in-one MoR-style platforms (Base44, Replit, Convex, Appwrite Cloud)
- Composable stacks (Cloudflare Workers + D1 + R2, Vercel + Neon, Supabase Pro)
- Cost projections at three scale points: zero traffic / 100 MAU / 1k MAU / 10k MAU
- Cloud trial credits (GCP $300, Azure $200, AWS new 2025/26 $100-$200, DO $200, Vultr $100)
- Perpetual free tiers (Cloudflare, Oracle, Groq, Google AI Studio, GitHub Models, OpenRouter)
- LLM gateway pricing (OpenAI / Anthropic / Bedrock / Azure OpenAI / Vertex AI / xAI / Groq / OpenRouter)
- Migration cost matrix between platforms

### D. Payment processing
- MoR vs direct processor — composes with `mor-vs-stripe` skill (which is upstream-of-checkout decision)
- Per-platform fee tables (Dodo, Paddle, Lemon Squeezy, Polar, Stripe, Braintree, Adyen)
- Subscription vs one-time vs metered vs license-key fits
- Tax compliance burden by model

### E. Distribution & early traction
- Cold outreach (composes with `cold-email`, `prospect`, `ai-cold-outreach` skills)
- Communities by product type (HN, Reddit subs, Indie Hackers, Product Hunt, X, niche forums)
- Lead magnets, free tools (composes with `lead-magnets`, `free-tool-strategy`)
- Launch playbooks (composes with `launch-strategy`)
- First 100 customer playbooks for B2B SaaS / B2C subs / dev tools / vertical SaaS

### F. Cost-benefit calculators (parameterized, not personalized)
- "If you have main employment above max insurable cap, registering self-employed = €X net"
- "If credit program approval rate is Y%, expected value = $value × Y%"
- "Migration to platform X is net-positive if you'll burn ≥$Z/mo of free credits there"
- "Annual cost of incorporation breakeven point at revenue R"

### G. Accountant / lawyer touchpoints
- When to hire (revenue trigger, complexity trigger)
- Cost ranges by jurisdiction
- What to ask (checklist)
- What NOT to ask the AI vs what TO ask

## Personalization layer (thin, incremental, optional)

A separate per-user file — **not the skill's primary value, but it's where the personalization accretes:**

```
~/.svc/founder-profile.md
```

Tracked fields (initially empty, filled in when user surfaces them naturally):
- Tax residence
- Employment status + income vs jurisdictional caps
- Spouse / co-founder / household applicant pool + their employment context
- Risk tolerance for incorporation
- Existing credits already claimed (so we don't recommend re-applying)
- Programs previously rejected (with reason, so we don't waste time)
- Past project portfolio + outcomes (for the "build-no-launch trap" detection)
- Distribution channels that worked / didn't for their past projects

The skill reads this file if it exists and biases recommendations accordingly. If the file is empty, the skill gives generic best-practice advice (still useful — covers the 80% case).

**Crucial:** the skill must work GREAT with an empty profile. Personalization makes it sharper, not functional.

## Composition with existing skills

| Existing skill | Relationship |
|---|---|
| `mor-vs-stripe` | Composes — `launch-knowledge` recommends payment-processor *type*; `mor-vs-stripe` runs the deeper MoR-vs-direct trade study once type is chosen |
| `manage-finops` | Downstream — once you're operating, manage-finops takes over for ongoing cost tracking |
| `roadmap-evaluation` | Downstream — uses launch-knowledge's runway figure to set milestone budgets |
| `pricing-strategy` | Composes — launch-knowledge says *whether* to charge; pricing-strategy says *how much* |
| `launch-strategy` | Composes — launch-knowledge sets the launch *vehicle*; launch-strategy runs the launch *campaign* |
| `cold-email`, `prospect`, `ai-cold-outreach` | Composes — launch-knowledge identifies distribution *channels*; these skills execute outreach |
| `mine-builder` | Composes — mine-builder discovers user context; launch-knowledge feeds the per-user profile from that |
| `platform-operating-architect` | Adjacent — launch-knowledge advises on platform *choice*; platform-operating-architect runs the operating model on a chosen platform |

## Knowledge-base layout

```
references/knowledge/launch/
├── INDEX.md
├── jurisdictions/
│   ├── bg.md
│   ├── ee.md
│   ├── us-de.md
│   ├── uk.md
│   ├── de.md
│   ├── nl.md
│   ├── ie.md
│   └── eu-general.md
├── credit-programs/
│   ├── INDEX.md
│   ├── microsoft-founders-hub.md
│   ├── nvidia-inception.md
│   ├── aws-activate.md
│   ├── google-cloud-startup.md
│   ├── cloudflare-startups.md
│   ├── posthog-startups.md
│   ├── perplexity-startups.md
│   ├── mongodb-startups.md
│   ├── xai-grok-deposit.md
│   ├── stripe-atlas.md
│   ├── notion-linear-sentry.md
│   ├── brex-mercury.md
│   ├── ycombinator-deals.md
│   └── female-founder-programs.md
├── platforms/
│   ├── INDEX.md
│   ├── all-in-one/
│   │   ├── base44.md
│   │   ├── replit.md
│   │   ├── convex.md
│   │   └── appwrite-cloud.md
│   ├── composable/
│   │   ├── cloudflare-workers-d1-r2.md
│   │   ├── vercel-neon.md
│   │   ├── supabase-pro.md
│   │   └── pocketbase-fly.md
│   ├── trial-credits.md
│   ├── perpetual-free-tiers.md
│   └── llm-gateways.md
├── payment-processors/
│   ├── INDEX.md
│   ├── mor-detail/
│   │   ├── dodo.md
│   │   ├── paddle.md
│   │   ├── lemon-squeezy.md
│   │   └── polar.md
│   └── direct/
│       ├── stripe.md
│       ├── braintree.md
│       └── adyen.md
├── distribution/
│   ├── INDEX.md
│   ├── cold-outreach.md
│   ├── community-channels.md
│   ├── launch-platforms.md
│   ├── first-100-customers-b2b-saas.md
│   ├── first-100-customers-b2c-subs.md
│   ├── first-100-customers-dev-tools.md
│   └── first-100-customers-vertical-saas.md
├── calculators/
│   ├── runway-projection.md
│   ├── credit-stack-evaluator.md
│   ├── incorporation-breakeven.md
│   └── platform-migration-roi.md
└── advisor-touchpoints/
    ├── when-to-hire-accountant.md
    ├── when-to-hire-lawyer.md
    └── what-to-ask-vs-what-not-to.md
```

That's ~50 knowledge files at full coverage. Most are short (50-200 lines, structured tables + URL citations). They are populated by `/research` dispatches over time — v1 ships with the ~25 highest-value files; the rest accrete via on-demand `/research` calls that write back to this knowledge base.

## Skill outputs (per invocation)

When the skill is invoked:
1. Reads `~/.svc/founder-profile.md` if it exists (biases recommendations)
2. Reads project's `.svc/capability-registry.json` (revenue model, customer geography)
3. Produces project-specific outputs:
   - `docs/specs/launch-vehicle-decision.md` — recommended legal entity for THIS project + when to revisit
   - `docs/analysis/credit-stack-plan.md` — ranked credit programs to apply, eligibility-cut against profile (if any)
   - `docs/analysis/runway-projection.md` — months of free runway given chosen stack
   - `docs/analysis/distribution-plan.md` — first 100 customer playbook for this product type
4. Updates `~/.svc/founder-profile.md` with anything new the user volunteered during the conversation

## Trigger conditions

Added to `route-workflow`'s "Auto-Invoke On-Demand Skills (Pre-Lane)" table:

| Signal | Skill | When |
|--------|-------|------|
| First time on this project AND no `docs/specs/launch-vehicle-decision.md` exists | `launch-knowledge` | Before first feature lane in any new project |
| User mentions "launch", "startup", "credits", "incorporate", "register", "freelance", "tax", "$X/mo bundle" without a specific code task | `launch-knowledge` | Standalone Q&A mode |
| `~/.svc/founder-profile.md` >12 months old | `launch-knowledge --refresh` | At session start when profile is stale |

## Acceptance Criteria

- AC-01 New skill `launch-knowledge/SKILL.md` with frontmatter (inputs, outputs, chain, self-verify), `references/`, and minimal `details/` covering knowledge-base navigation.
- AC-02 `route-workflow/SKILL.md` "Auto-Invoke On-Demand Skills (Pre-Lane)" table updated with the new trigger rows.
- AC-03 `skills-manifest.json` updated with new skill entry + `produces` / `readBy` graph edges.
- AC-04 New tier-1 validator `validate-launch-knowledge-freshness.sh` — flags any knowledge file under `references/knowledge/launch/credit-programs/` or `jurisdictions/` that hasn't been verified in >12 months (programs revise annually, jurisdictional rules change annually).
- AC-05 Knowledge base seeded at v1 with at minimum:
  - 3 jurisdictions: BG, EE, US-DE (cited from current research artifacts in example-marketplace repo + verified gemini-cli dispatches)
  - 8 credit programs: MS Founders Hub, NVIDIA Inception, AWS Activate, Google Cloud Startup, xAI Grok, Cloudflare Startups, PostHog Startups, Perplexity Startups
  - 4 platform-bundle entries: Base44, Supabase Pro, Cloudflare full-stack, Vercel + Neon
  - 1 distribution playbook: B2B SaaS first-100-customers
- AC-06 SKILL.md works correctly with EMPTY `~/.svc/founder-profile.md` — outputs generic best-practice advice; no errors, no degraded UX.
- AC-07 SKILL.md correctly biases recommendations when profile contains user-specific info (tested via 2 fixture profiles: "BG above-cap solo" and "US-LLC dual-cofounder").
- AC-08 Composition links: SKILL.md links upstream/downstream skills per the composition table above.
- AC-09 New tier-1 validator `validate-launch-knowledge-empty-profile-graceful.sh` — invokes the skill against an empty profile and asserts no errors + non-trivial generic output.
- AC-10 Full tier-1 sweep PASS.

## File Impact (v1)

| Category | Files |
|---|---|
| Skill core | `launch-knowledge/SKILL.md`, `launch-knowledge/references/{cost-benefit-calculator,skill-composition,knowledge-base-protocol}.md` (4 files) |
| Knowledge base seed (v1, ~25 files) | jurisdictions × 3 + credit-programs × 8 + INDEX × ~5 + 1 distribution playbook + 4 platform bundles ≈ ~25 files |
| Wiring | `route-workflow/SKILL.md` (modify), `skills-manifest.json` (modify), `mor-vs-stripe/SKILL.md` (modify — add link upstream) |
| Validators | `test-framework/evals/tier-1/validate-launch-knowledge-{freshness,empty-profile-graceful}.sh` (2 files) |
| **Total v1** | **~32 files** |

Subsequent knowledge files (the remaining ~25 in the layout above) accrete on-demand via `/research` dispatches that write back to this knowledge base. No need to ship all 50 at v1.

## Scope boundary

- touches: ~32 files for v1, all under `launch-knowledge/`, `references/knowledge/launch/`, `route-workflow/SKILL.md` (link add), `skills-manifest.json` (entry add), `mor-vs-stripe/SKILL.md` (link add), `test-framework/evals/tier-1/`.
- must-not-touch: existing skill SKILL.md files outside the link-additions; hooks; setup; worktree.sh; framework state machinery.

## Plan-changeset trigger evaluation

Per `rules/plan-changeset-trigger.md`:
- **Purely additive?** Mostly yes — new skill, new knowledge files. Three existing files modified (route-workflow, mor-vs-stripe, skills-manifest.json) with link additions and entry additions only.
- **Risk signals?** None — no contract change, no hot-path edit, no refactor.

**Decision:** Additive exemption applies; direct commit on a feature branch then PR. No plan-changeset ceremony needed.

## Rollback

Single PR revert. Knowledge files don't affect runtime if the skill is removed; the wiring changes are 3 line additions.

## Size

- Files: ~32 at v1.
- Lines: ~1500 (mostly knowledge content with citations, not code).
- Risk: low.

## What this saves

For Stefan specifically (50+ projects, $0 cumulative revenue per builder profile):
- One conversation about "which credits do I apply for" instead of one per project
- One per-user `~/.svc/founder-profile.md` instead of re-deriving from scratch each time
- Annual freshness validator catches when BG VAT threshold or NVIDIA Inception eligibility changes
- Composition with `prospect` / `cold-email` / `launch-strategy` means launch-knowledge feeds distribution intent into the actual outreach skills

For other framework users (when seriousvibecoding is shared):
- Universal knowledge usable from any geography
- Profile starts empty — first-session experience still excellent
- Profile accretes naturally; doesn't require a "configure me" wizard

## Out of scope for v1

- Live monitoring of credit-program changes (covered by AC-04 staleness validator + manual annual refresh via `/research` dispatch)
- Country coverage beyond BG/EE/US-DE at v1 (additional jurisdictions added on-demand when first project surfaces for that geography)
- Tax filing automation (accountant territory, not framework)
- Active distribution execution (delegated to existing `cold-email`, `prospect`, `launch-strategy` skills)

## Promotion

Promote to WI-NNN via `improve-framework` once user greenlights this proposal. Implementation lands on a feature branch, PR, merge to main, then `setup --host claude` symlinks the new skill into `~/.claude/skills/`.
