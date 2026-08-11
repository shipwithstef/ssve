# Cold Outbound Deliverability And Compliance - Detail

## Mechanism (factual)

Cold outbound deliverability depends on authentication, reputation, list quality, complaint control, and sending behavior.

Platform requirements and recommendations checked on 2026-05-17:

| Source | Requirement or operational implication |
|---|---|
| Google sender guidelines | All senders to Gmail need SPF or DKIM, valid forward/reverse DNS, TLS, RFC 5322 formatting, and spam rate below 0.3%. Bulk senders over 5,000/day to personal Gmail need SPF, DKIM, DMARC, alignment, and one-click unsubscribe for marketing/subscribed mail. |
| Google FAQ | A sender near 5,000/day to personal Gmail can be classified as bulk; bulk status is permanent once assigned. Google recommends keeping user-reported spam below 0.1% and avoiding 0.3%; unsubscribe requests should be fulfilled within 48 hours for reputation. |
| Yahoo Sender Hub | All senders should authenticate and keep spam complaint rate below 0.3%. Bulk senders need SPF, DKIM, DMARC alignment, list-unsubscribe, visible unsubscribe, and unsubscribe fulfillment within 2 days. |
| UK ICO | UK PECR electronic-mail consent rule does not apply to corporate subscribers, but senders must identify themselves and provide a valid opt-out address. Sole traders and some partnerships are individual subscribers; if unsure, treat as individual. |
| Ireland DPC | General electronic direct marketing requires affirmative consent, but DPC FAQ says direct marketing emails/texts to businesses may be sent until the business asks the sender to stop; further sends after stop are an offence. |
| FTC CAN-SPAM | US B2B commercial email still needs accurate headers, non-deceptive subject, physical postal address, opt-out, and honoring opt-outs within 10 business days. |

The article adds practical operating rules:

- Never send scaled cold email from the product or transactional primary domain.
- Monitor domain-level reply rate, not only mailbox-level reply rate.
- Keep per-inbox sends low, with about 20/day as a conservative baseline.
- Keep warmup running for the life of the inbox.
- Treat reply-rate collapse as deliverability first until placement is ruled out.
- If 7-day reply rate drops below 2% after at least 100 sends on a domain, pause/replace that domain.
- Separate hard bounces from sender bounces.
- Avoid heavy links, attachments, calendar links, and tracking pixels in first cold touches.

## Analysis (expert commentary)

- **Useful for:** Campaigns that are about to move from manual founder outreach to Apollo/Smartlead style sending.
- **Trade-offs:** Platform guidance is built for high-volume mail but still matters below formal bulk thresholds because recipient providers can degrade reputation before legal/regulatory lines are crossed.
- **Similar to:** Production traffic ramping. A sender domain is an asset with health, budget, and rollback rules.
- **Could improve svc by:** Treating sender-domain health as a first-class launch artifact, with per-domain reply rate and bounce taxonomy in CSV templates.
- **Assumptions:** The sender can access Smartlead/domain-level stats, DNS, suppression lists, and bounce classifications.
- **Watch out for:** Legal permission and inbox placement are separate. A send can be legally plausible and still damage sender reputation if it is too broad, link-heavy, unauthenticated, or complaint-prone.

## Key Source Files (L4 pointers)

- `https://support.google.com/a/answer/81126?hl=en` - Google sender requirements.
- `https://support.google.com/a/answer/14229414?hl=en` - Google FAQ on bulk sender classification, spam-rate enforcement, and unsubscribe handling.
- `https://senders.yahooinc.com/best-practices/` - Yahoo sender requirements and recommendations.
- `https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/` - UK B2B electronic marketing rules.
- `https://www.dataprotection.ie/en/organisations/rules-electronic-and-direct-marketing` - Ireland direct electronic marketing overview.
- `https://www.dataprotection.ie/en/faqs/direct-marketing/can-my-mobile-phone-be-targeted-marketing-phone-calls` - Ireland business-vs-individual direct marketing distinction.
- `https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business` - US CAN-SPAM compliance guide.
- `https://www.smartlead.ai/blog/email-deliverability-guide` - vendor deliverability guidance on warmup, bounce, complaints, and tracking.
