# Knowledge Base Protocol

The launch knowledge base lives at `references/knowledge/launch/`. It follows the same Layer 1 → Layer 2 → Layer 3 pattern as the rest of `references/knowledge/` (see `references/knowledge-protocol.md` for the global protocol).

## Layout

```
references/knowledge/launch/
├── INDEX.md                              ← Layer 1: one-liner per domain
├── jurisdictions/
│   ├── INDEX.md                          ← Layer 2: domain table
│   ├── bg.md                             ← Layer 3: detail
│   ├── ee.md
│   └── us-de.md
├── credit-programs/
│   ├── INDEX.md
│   ├── microsoft-founders-hub.md
│   ├── nvidia-inception.md
│   ├── aws-activate.md
│   ├── google-cloud-startup.md
│   ├── xai-grok-deposit.md
│   ├── cloudflare-startups.md
│   ├── posthog-startups.md
│   └── perplexity-startups.md
├── platforms/
│   ├── INDEX.md
│   ├── all-in-one/
│   │   └── base44.md
│   └── composable/
│       ├── cloudflare-workers-d1-r2.md
│       ├── vercel-neon.md
│       └── supabase-pro.md
└── distribution/
    ├── INDEX.md
    └── first-100-customers-b2b-saas.md
```

## Read order during a `launch-knowledge` invocation

1. **Always** read `references/knowledge/launch/INDEX.md` first (~150 lines).
2. **Conditionally** descend into `<domain>/INDEX.md` only for domains relevant to this invocation. (E.g., a US-LLC founder does NOT need `jurisdictions/bg.md`.)
3. **Lazily** read individual detail files only when the calculator (`references/cost-benefit-calculator.md`) needs a specific number.

This is the same pattern as `references/knowledge-protocol.md` Section "Read Order". Do NOT pre-load all 25+ detail files — that defeats the purpose of layering.

## Refresh discipline

Files under `credit-programs/` and `jurisdictions/` go stale annually because programs revise eligibility / amounts and tax rules change. The tier-1 validator `test-framework/evals/tier-1/validate-launch-knowledge-freshness.sh` enforces a **12-month max age** by mtime.

When a file goes stale:

1. Dispatch `/research <topic>` with a focused prompt asking for current 2026/2027/etc. facts and the official URL.
2. The research skill writes back to the same file.
3. `git commit` with `WI-NNN: refresh skills/launch-knowledge/<domain>/<file>` to bump mtime.

**Files under `platforms/`** are NOT covered by the freshness gate (platforms revise more often but the structural advice — "Cloudflare D1 is SQLite at the edge, $5/mo Workers Paid minimum" — changes less than the per-program eligibility cuts).

## Adding a new file

1. Write the detail file at the appropriate Layer-3 path (e.g., `references/knowledge/launch/credit-programs/new-program.md`).
2. Add a one-liner to the corresponding `<domain>/INDEX.md`.
3. Add an entry to the top-level `references/knowledge/launch/INDEX.md` if a new domain.
4. Cite **every** non-trivial claim with a URL inline.
5. Include a **last-verified date** at the top of the file.

## Citation requirements

Every threshold value (caps, VAT triggers, fees, credit amounts, eligibility cuts) MUST link to an official source URL. Acceptable sources:

- Vendor official pages (e.g., `https://www.microsoft.com/en-us/startups`)
- Government revenue authorities (НАП for BG, IRS for US, HMRC for UK, etc.)
- Vendor-cited research artifacts in this repo or sibling repos (e.g., `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md`)

NOT acceptable as primary citation:
- Reddit threads (acceptable as supplementary signal, never as primary)
- LLM responses without official-page corroboration
- Outdated blog posts (must be <12 months old to count)

## Stub files

If a file genuinely needs content the agent cannot source (gemini-cli unavailable, vendor page down, official source missing), write the file as a **stub** with this exact marker:

```markdown
# <Topic>

> **STUB** — needs /research dispatch to fill
>
> Author: <agent>
> Date: <YYYY-MM-DD>
> Reason: <why content unavailable>
```

The freshness validator treats stubs as stale on day 1 (mtime check is unaffected; downstream readers see the stub marker and know to skip rather than cite). Once `/research` runs against the topic, the stub gets replaced by real content.

## Layer 2 INDEX format

Each domain INDEX.md follows this template:

```markdown
# <Domain> Knowledge

| File | Topic | Last verified | Source |
|---|---|---|---|
| [bg.md](bg.md) | Bulgarian self-employment + EOOD basics | 2026-04-26 | НАП + НОИ official pages |
| [ee.md](ee.md) | Estonian e-Residency + OÜ basics | 2026-04-26 | e-Residency.gov.ee |
```

This makes it easy for the skill to scan a single table and decide what to read deeper.
