# Developer Tools (AI Studio, Gemini CLI, Code Assist, Antigravity, Jules, Cloud credits)

## Overview

Pro subscribers get **higher quotas** across Google's developer-facing AI surfaces, plus a **$10/mo Google Cloud credit** via the Google Developer Program (GDP). For a builder already on Claude Code as primary EXEC harness, most coding-agent value is duplicative — but the cost floor on ad-hoc API calls drops to ~zero with the Cloud credit.

## AI Studio (aistudio.google.com)

Browser-based playground for Gemini models. Tier 1 (paid) limits as of 2026:

| Metric | Tier 1 (Pro) | Free |
|---|---|---|
| RPD on Gemini 3 Pro (preview models) | **250 / day** | 100+ / day |
| RPM | **150–300** | 10–50 |
| Pay-as-you-go fallback | available | available |

Note: Google **slashed free quotas 50–92%** on 2025-12-07. Current numbers above reflect post-cut state.

## Gemini CLI (the actual command-line tool the svc framework uses for `research`)

| Tier | RPM | RPD |
|---|---|---|
| **Free (personal Google account)** | 60 | 1,000 |
| **AI Pro** | higher (exact RPM/RPD not publicly itemized — vendor docs say "higher limits") | higher |
| **AI Ultra** | highest | highest |

Setup: connect a Pro-subscribed Google account via `gemini login` to inherit the higher tier automatically. The CLI then routes through Gemini Code Assist quotas for individuals.

Authoritative source: [Gemini CLI Quotas and Pricing](https://geminicli.com/docs/resources/quota-and-pricing/).

## Gemini Code Assist (IDE extension)

Higher per-day completion + chat limits inside VS Code / IntelliJ family. Free tier already gives 60 RPM / 1,000 RPD per the same Code Assist license; Pro raises both. Specific Pro RPM/RPD not publicly documented — Google references it as "higher" without a number.

**Google Antigravity (agentic IDE)**

VS Code-derived "agent-first" IDE released 2025-11-18 alongside Gemini 3.

**Models available inside Antigravity:**
- Gemini 3.1 Pro (High and Low modes)
- Gemini 3 Flash
- Claude Sonnet 4.6
- Claude Opus 4.6
- GPT-OSS 120B

**Features:** Editor view (VS Code-like) + Manager view (control center for parallel agents); AgentKit 2.0 ships 16 specialist agents + 40+ skills + 11 commands; full MCP support added early 2026.

**Pricing:** Pro plan ($19.99/mo) **includes built-in credits** but exact amount is **not publicly documented**. Beyond the included pool, credits are $25/2,500 = **$0.01/credit**.

**Gemini XPRIZE Bonus:** AI Ultra subscribers ($100/mo) can claim a **$100 bonus** inside the Antigravity 2.0 app (Perks section) by **May 25, 2026**. These credits cover token overages after the main quota is spent.


**Strategic note:** Antigravity gives **Claude Opus 4.6** and **Sonnet 4.6** under Google's billing — potentially a way to access Anthropic models without burning Claude Max quota, IF the Pro built-in credits are generous. But the lack of published numbers makes it impossible to plan around.

## Jules (async coding agent)

Asynchronous coding agent — runs in background, fixes bugs / writes tests / applies version updates while you do other work.

| Plan | Daily tasks | Concurrent tasks |
|---|---|---|
| **Free** | 15 | 3 |
| **AI Pro** | **100** | **15** |
| **AI Ultra** | higher | higher |

Mechanically distinct from Claude Code (sync, foreground) and Antigravity (interactive). Jules is closer to a CI/job-runner pattern: hand it a task, walk away, come back to a PR.

## Google Developer Program (GDP) — $10/mo Cloud credit

**The actually-actionable benefit.**

How to claim:
1. Go to [developers.google.com/program/my-benefits](https://developers.google.com/program/my-benefits)
2. Log in with the Google account subscribed to AI Pro
3. Find "Google Cloud Credits" section → click "Activate" / "Claim"
4. Link a Google Cloud Billing Account (create one if absent — card verification required, no charge unless you exceed the credit)
5. Credits appear in [Cloud Console Billing](https://console.cloud.google.com/billing)

Spend on:
- **Vertex AI** — direct Gemini/Claude/Imagen API access
- **Cloud Run** — deploy the app
- **Gemini API** — pay-as-you-go beyond AI Studio limits

**Family sharing caveat:** under verification — community thread questions whether each family member can claim their own $10 (and $100/mo on Ultra) or if it's one shared claim per subscription.

## Strategic implications for the svc stack

| Tool | Genuinely unique value | Verdict |
|---|---|---|
| AI Studio | playground for Gemini-only experiments | Useful for prototyping Gemini-backed skills |
| Gemini CLI | the research skill's PRIMARY sub-agent | **Critical** — already wired into svc |
| Code Assist | IDE-native completion | Skip if Claude Code is primary IDE |
| Antigravity | distinct agent IDE; Claude Opus 4.6 access via Google billing | Worth a 30-min eval — could shift some EXEC off Claude Max |
| Jules | async background tasks | Worth pilot — fits "set it and forget it" framework chores |
| **$10/mo Cloud credit** | Ad-hoc API spend at no marginal cost | **Activate immediately** regardless of other decisions |

## L4 pointers

- [GDP for AI Pro/Ultra announcement](https://blog.google/innovation-and-ai/technology/developers-tools/gdp-premium-ai-pro-ultra/)
- [Gemini CLI quotas](https://geminicli.com/docs/resources/quota-and-pricing/)
- [Code Assist quotas](https://developers.google.com/gemini-code-assist/resources/quotas)
- [Jules limits & plans](https://jules.google/docs/usage-limits/)
- [Antigravity homepage](https://antigravity.google/)
- [AI Studio rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
