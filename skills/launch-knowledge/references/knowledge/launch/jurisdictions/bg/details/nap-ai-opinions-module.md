# BG Tax Research — NAP Opinions Module with AI (kik-info)

**Layer:** 3 (detail)
**Topic:** Operational tool for searching Bulgarian National Revenue Agency (НАП) tax opinions with AI-assisted summary
**Source:** `sources/2026-05-08-nap-ai-opinions-module-kik-info.md`

---

## Mechanism

KiK Info maintains a continuously updated database of official NAP opinions issued since 2010. Each opinion is presented with:

1. **Original opinion text** in readable format + downloadable original file
2. **AI-generated summary** for relevance triage
3. **AI analysis with structured conclusions** per question raised

### Search dimensions

- Legal reference (law / article / paragraph / point)
- Administrative metadata (outgoing/incoming file numbers)
- Date range
- Free-text keywords

### Access model

- **Free during initial launch period** (duration unspecified in source)
- **After initial period:** restricted to KiK Info full-access subscribers (€8.33/month billed annually = ~€100/year)

### Editorial integrity claim

Source emphasizes: "originalните текстове на становищата се запазват напълно, без редакторска намеса" — the original opinion texts are preserved without editorial intervention. AI processing operates within "стотици правила за сигурност и точност" (hundreds of security/accuracy rules) tuned for BG tax legislation.

### Stated limitations

Functions as supplementary research tool — NOT a substitute for legal counsel. Final responsibility for applying the law remains with the practitioner.

---

## Analysis

### What this is useful for

Bulgarian tax law has gaps that NAP fills via official opinions (становища). When the law is ambiguous, a published NAP opinion is often the best practical guide. Examples relevant to a software EOOD:

- Exact чл. 97а ЗДДС registration timing edge cases
- VAT treatment of MoR-routed payments
- Cross-border digital service VAT classification
- Treatment of platform fees as foreign-vendor invoices
- AI-related deductions and depreciation

Reading raw NAP opinions is slow. The AI summary lets you triage 20 opinions in 10 minutes vs an hour. Worth knowing about as a research tool.

### When this matters for the launch-knowledge skill

When `launch-knowledge` (or `research`) is invoked for a BG-specific tax question that the framework's stored knowledge doesn't fully resolve, this module is a fast next step before committing to a paid lawyer/accountant consultation.

Workflow:
1. Check stored framework knowledge (`bg-vat-2026-sme-regime.md`, `bg-kid-codes.md`, etc.)
2. If question still ambiguous → search kik-info NAP opinions module for "становище" matching the question
3. Read AI summary + original opinion
4. If still ambiguous → escalate to paid consultation (€100 with accountant)

This adds a free / low-cost intermediate layer between framework knowledge and paid expert advice.

### Cost-benefit for Example Marketplace-style projects

| Cost | Benefit |
|---|---|
| Free for now (initial period) | Cuts research time on BG-specific tax edge cases |
| ~€100/year subscription after initial period | Worth it if running 2+ tax research sessions per year; otherwise pay-per-question via accountant |

For pre-revenue dormant EOOD, the subscription is unnecessary. For active EOODs with quarterly accounting questions, €100/year for AI-summarized NAP opinions beats hourly accountant research time at €30-50/hr.

### Caveats

1. **AI summaries can drift.** Always read the original opinion before relying on the AI summary for any high-stakes decision (e.g., late чл. 97а registration analysis). The source's "hundreds of accuracy rules" is a marketing claim, not an audit.

2. **NAP opinions are advisory, not binding.** A NAP opinion supports your interpretation but doesn't immunize against penalty if NAP later reverses position. The same opinion might be cited differently in future audits.

3. **Database is BG-only.** Not useful for EU-wide questions (CJEU rulings, other member states' practice).

### Operational integration

Add to project's research path:
- `docs/specs/research-log.md` entries can cite kik-info NAP opinion IDs as sources
- BG-specific research questions in any svc skill should check this module before defaulting to WebSearch

---

## L4 Pointers

- **kik-info NAP opinions module landing page:** https://kik-info.com/novini/novini-i-akcenti/Modul-Stanovishtata-na-NAP-AI-obrabotka-za.204981.php
- **kik-info subscription pricing:** https://kik-info.com/abonament/
- **NAP official opinions directory:** https://nra.bg/wps/portal/nra/staticnp/AbouttheNRA/Reports
- **Sibling research tools:** Бaлансс.bg accountancy news, Експертbg, Accountingnews.bg

For project-specific application:
- Used as research aid when framework knowledge is incomplete on a BG tax question
- Captured in `references/knowledge/launch/jurisdictions/bg/CAPABILITIES.md` as a research-aid resource
