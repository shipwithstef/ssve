# Resend — Email API for developers

**URL:** https://resend.com
**Captured:** 2026-04-27 (pattern.md only; hero.png/.webm TODO-capture)
**Sector:** high-performer-cross-sector (calm-minimal-data-tool)

## What it does well

- **Hero copy is 6 words: "Email API for developers."** Calm-minimal at its purest — single noun phrase, exact target audience named. No qualifiers, no adjectives.
- **Hero visual is a code-snippet panel with a working `resend.emails.send({...})` call.** Visitor sees the entire integration surface in one frame — "this is the API I'd write." Snippet uses real product fields, not lorem-ipsum placeholders.
- **React Email integration shown as the differentiator visual.** Side-by-side code: JSX email component + rendered email. Communicates "build emails like UI components" — the Vercel-developer-aesthetic appeal.
- **Trust bar is small but precise: tier-1 dev-tool brands (Vercel, Linear, Resend itself's customers).** Quality > quantity logo strategy — 6 logos instead of 30, all from a coherent peer-cluster.
- **Pricing page is genuinely flat: Free 3k/mo + $20 50k/mo + $90 100k/mo + Enterprise.** Predictable scaling with no per-domain or per-feature surprise costs. Matches developer-trust expectations.
- **Status page linked from footer with current uptime metric live.** Operational transparency for an infrastructure product where uptime IS the product.
- **Documentation feels like product surface, not afterthought.** Code samples in 6 languages, copy-paste-ready, with API explorer playground. Docs are the second-most-load-bearing marketing surface after hero.
- **Founder-led narrative on the about page.** Zeno Rocha (creator of Dracula theme) lends design-credibility — buyers familiar with his open-source work transfer trust to Resend.
- **Domain verification flow shown in product screenshots.** A common SendGrid pain point (slow domain verification) is highlighted as Resend's strength via clear UX screenshots.

## What it gets wrong

- The minimalism leaves no room for "why Resend over SendGrid/Postmark/Mailgun" — visitors familiar with incumbents need a wedge story before adopting.
- Hero doesn't showcase the React Email integration prominently enough — that's the actual differentiator and gets buried in scroll.
- Bulk-sending and marketing-email use cases aren't differentiated from transactional — buyers with mixed needs aren't sure if Resend serves both.

## Reusable archetype name

**Calm-minimal hero with code-snippet integration surface** — 6-word headline + named target audience, hero visual is real working code snippet showing entire integration surface, framework-specific differentiator visualized via side-by-side code+output, flat predictable pricing with no surprise dimensions.

## When to use this archetype

When the product is a developer-API with a genuinely simple integration AND the target audience is high-context (knows the category, just needs to evaluate fit). NOT a fit for: low-context buyers, products with complex multi-step setup, products where the wedge story requires explanation.

## Feature mix surfaced

- "Email API for developers": full-page hero (6 words, no decoration)
- "Send emails with `resend.emails.send()`": code-snippet hero panel with real fields
- "Build emails as React components": React Email integration section with side-by-side JSX+rendered preview

## Adoption notes

When porting this archetype, the most common mistake is copying the surface aesthetic without copying the underlying buyer-context that makes it work. Verify the buyer-segment fit BEFORE imitating the visual signature — the archetype name names the technique, not just the look. If the buyer-context match is weak, downgrade to a borrowed sub-element (one bullet) rather than the whole pattern.
