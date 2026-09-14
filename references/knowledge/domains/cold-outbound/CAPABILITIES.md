# Cold Outbound Capabilities

**Version:** 2026-05-17
**Scope:** B2B cold email/outbound operating model for early launch, scaling, and deliverability diagnosis.
**Primary source:** User-provided transcript of @axtalks, "87 lessons from 5 years of sending 20M+ cold emails," cross-checked against current Google/Yahoo sender requirements, UK ICO, Ireland DPC, FTC CAN-SPAM, Smartlead public benchmarks, and Example Marketplace launch docs.

## Use When

- A project is planning cold email, Apollo/Smartlead campaigns, or outbound launch tests.
- A campaign needs metrics, kill/scale gates, sender-domain hygiene, or sequence discipline.
- A founder asks whether to scale volume or keep a small pilot.
- A launch pack needs to distinguish deliverability failure from offer/list/copy failure.

## Core Metrics

| Capability | Rule |
|---|---|
| PCPL | Track prospects contacted per positive reply as the summary metric; default article benchmark is PCPL <= 500, but early pilots should use tighter learning gates. |
| Reply rate including OOO | Treat total reply rate, with out-of-office replies included, as the fastest placement/deliverability diagnostic. |
| Positive reply rate | Once replies are landing, use positive reply rate to diagnose relevance, angle, and next-step friction. |
| Bounce separation | Split hard bounces from sender bounces; bad addresses are a list problem, sender bounces are an infrastructure/reputation/copy-fingerprint problem. |
| Opens | Do not optimize for opens in cold outreach; tracking pixels are unreliable and can hurt placement. |
| Revenue | Revenue remains the north star, but early campaigns may validly optimize for qualified conversations first. |

## Copy And Offer

| Capability | Rule |
|---|---|
| Short first touch | Default first email should be under 70 words; under 30 words can work when the offer and next step are obvious. |
| One CTA | Use one clear question; multiple calls to action create delay and lower response. |
| Four whys | Every email must answer: why me, why now, why your thing, and what should I do next. |
| Observable segmentation | Segment only on observable data: role, visible tools, public signals, geography, size, hiring, or visible initiatives. |
| Angle testing | Test audience + pain + solution framing before micro-copy. Word swaps are usually noise. |
| Low-friction next step | Cold email should not ask for a high-commitment buying decision; sell a small diagnostic, walkthrough, audit output, or relevant reply. |
| Proof | Use compact proof that matches the buyer's success metric; relevant proof beats large but unrelated proof. |

## Sequence Discipline

| Capability | Rule |
|---|---|
| Few follow-ups | For small TAM or early validation, use 1-2 touches, then rest and re-contact later with a structurally different script. |
| No bumps | Every follow-up must add proof, context, a routing question, or a clearer next step. |
| Re-contacting | Treat re-contact as a scheduled system, not ad hoc resending; keep the winning angle but rotate script structure. |
| Links | Avoid attachments, calendar links, and heavy links in email 1 unless explicitly testing that variable. Send assets after reply when possible. |

## Deliverability

| Capability | Rule |
|---|---|
| Primary-domain protection | Never send scaled cold email from the product/transactional primary domain. |
| Authentication | Configure SPF, DKIM, DMARC, PTR/reverse DNS, TLS, and RFC-compliant messages before sending. |
| Spam thresholds | Keep user-reported spam below 0.1% where possible and never near 0.3%; both Google and Yahoo use 0.3% as a critical threshold. |
| Domain-level monitoring | Measure reply rate by sending domain, not only sender mailbox; sender-level metrics can hide domain decay. |
| Domain pause rule | If 7-day reply rate falls below 2% after 100+ sends on a domain, pause/replace the domain and diagnose infrastructure before rewriting the offer. |
| Volume | Keep per-inbox cold sends low, ramp gradually, and keep warmup running after launch. |
| Copy fingerprinting | At scale, rotate structurally distinct scripts; synonym swaps around the same skeleton are insufficient. |

## Compliance

| Region | Operating rule |
|---|---|
| UK B2B | Corporate subscribers can receive B2B marketing without PECR consent, but identity must not be hidden and a valid opt-out address must be provided; sole traders and some partnerships are treated as individual subscribers. |
| Ireland B2B | DPC guidance distinguishes individuals from businesses; business recipients may be contacted until they request stop, then subsequent marketing is an offence. |
| US | CAN-SPAM applies to B2B commercial email; use accurate headers, non-deceptive subjects, ad identification where required, physical postal address, opt-out, and honor opt-outs within 10 business days. |
| Platform reputation | For Gmail/Yahoo reputation, fulfill unsubscribe requests within 48 hours where possible even when legal max timelines are longer. |

## Early-Stage Launch Interpretation

- A first-revenue founder should not blast a large list before validating placement, list quality, angle, and reply handling.
- A 100-prospect pilot is a hygiene and learning gate, not a statistically final winner declaration.
- Do not apply the 1,000-prospects-per-variant test rule until the campaign has clean infrastructure, a protected TAM, and enough lead supply to spend.
- The first scale decision should require both delivery health and buyer signal, not reply rate alone.

## UGC & Micro-Collaboration Growth Scaling

| Capability | Operating Rule |
|---|---|
| Structured Briefing | High-performing creator campaigns must use a 5-part brief containing objective, audience, core message, format/length, and visual references. |
| Vanity Metric Exclusion | Evaluate partnerships based on average views, hook strength, and speed of communication rather than follower count. |
| Raw Native Aesthetics | Prioritize organic, platform-native look and feel over high-production-value corporate or polished videos. |
| Pre-Moderation Gating | Mandate manual review and approval of all partner/creator drafts before publication. |
| Down-Funnel Auditing | Measure success using Day-3 and Day-7 retention metrics by format and creator rather than Cost Per Install (CPI) vanity targets. |

## Source Reliability Notes

- The @axtalks article is operator experience, not a regulator or platform requirement. Treat its numeric thresholds as strong heuristics that need vertical validation.
- Google, Yahoo, ICO, DPC, and FTC sources are authoritative for sender/compliance constraints.
- Smartlead benchmark numbers are vendor data and should be useful but not neutral.
- The Lucas Patiri UGC framework is based on social media growth operator heuristics and must be translated to B2B contexts using micro-pilots and activation milestones.
