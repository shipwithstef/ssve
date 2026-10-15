# Pre-revenue demand ladder

Worksheet for the growth-lead mode of the same name. Reflect every filled section in the decision card this skill already appends. Do not create a second artifact and do not add keys to the card. Put the open gate, the decision, the counts, the threshold, and the approval ask in `recommendation`. Use `ask: approve` when the card proposes spend, a campaign, or a payment change. Leave that approval blank until a person writes it.

Baseline, target, sample window, cost ceiling, and kill rule stay the fields required by the skill procedure. This file is the gate those fields attach to before any payment exists.

Leave a section blank only when the open gate has not reached it, or when a zero budget makes the spend arithmetic and the spend calendar not apply.

## Promise

- Offer under test (one sentence):
- What the product does today (one sentence):
- Audience segment this test may speak to:
- How often a successful user naturally has the job again: occasional / weekly / daily
- Budget ceiling (currency and amount, zero allowed):

## Open gate

The open gate is the first row whose exit evidence is missing. Paid acquisition (L1) is conditional. A zero budget may close L1 with an evidenced organic or referral acquisition test, or with an explicit justified skip recorded on the card. A test that only ran does not close L1. A justified skip closes only L1. The next open gate still starts at propose / awaiting evidence.

| Gate | Exit evidence present? | Notes |
|---|---|---|
| L0 Waitlist | yes / no | |
| L1 Acquisition | yes / no | Paid or organic/referral exit is an aged pass, not a test that only ran. A justified skip is a recorded reason |
| L2 Concierge | yes / no | |
| L3 Usage | yes / no | |
| L4 First payment | yes / no | |

## L0 checklist

Every row is true before L1. A miss keeps admission closed and slides the calendar.

| # | Minimum | Evidence |
|---|---|---|
| 1 | Opt-in: a confirm message arrives at an address the operator controls. The address is confirmed only after that person confirms | |
| 2 | The privacy notice is the published page, not a draft. The notice version is stored on the confirmed record. Cite `privacy-dpo` review evidence for the purpose, processor, retention, deletion, and rights inventory. Do not restate that inventory | |
| 3 | Erasure: withdraw and erase were run once. No later message is sent. No link contains the email address | |
| 4 | Every language the build ships is finished: page, mail, and notice. Do not buy traffic in a draft language | |
| 5 | Public copy, including ad drafts, states only what exists today | |
| 6 | Admission fails closed. A missed flag keeps sign-up off. While closed, no control opens account recovery, an inbox, or checkout that does not exist | |
| 7 | The product name has a domain and trademark check in the markets the test will advertise. Register the domain only when that check is clear. Domain cost is outside the ad budget | |
| 8 | If the free product uses personal data for anything beyond delivering what the person asked for, terms are published before that use. This worksheet does not draft those terms | |

## Measurement contract

Funnel: impression → click → visit → submit → confirmed. Confirmed is the only count ads buy.

| Count | Source | Called by the live page or server? |
|---|---|---|
| Impression | platform-reported export, labeled platform-reported. A first-party counter only when the impression is on our page | no for a platform export |
| Click | platform-reported export, labeled platform-reported. A first-party counter only when the click is on our page | no for a platform export |
| Visit | first-party counter | |
| Submit | first-party counter | |
| Confirmed | server row, with the campaign code stored | |

- Campaign code scheme (UTM fields plus a short ref code):
- Unknown or malformed ref: accept the sign-up, store the raw code as noise, credit no campaign. Never blame the email field or the consent box for a bad code
- Pixels and third-party tags: off. A platform export may supply labeled impressions, clicks, and spend. It is not the visit, submit, or confirm source
- Aged-spend floor before a kill rule applies: 48 hours, unless this record justifies another delay
- Organic and referral column: confirmed people only. Do not credit the operator's own code or an unknown code
- Organic or referral acquisition test: that column, aged, meeting the pre-registered success thresholds, with no fired kill rule and a recorded gate decision. It does not close L1 until that aged pass is recorded. A justified L1 skip names why paid acquisition does not apply and closes L1 only when that reason is recorded on the card

A counter that exists in code and is never called measures nothing. A confirmed row with no campaign code measures nothing. Ask `growth-eng` for an instrumentation proposal when the page does not call the counters. Do not deploy that proposal from this mode.

## Budget worksheet

Write this before any spend recommendation. Use this experiment's own sourced CPC and confirm ratio. Leave it blank when the budget ceiling is zero.

```
confirm_rate = confirmed / clicks
cost_per_confirmed = CPC / confirm_rate
expected_confirmed = budget / cost_per_confirmed
```

If the sourced confirm rate is confirmed/visits, also source visits/clicks. Do not divide CPC by confirmed/visits alone.

```
cost_per_confirmed = CPC / ((visits/clicks) × (confirmed/visits))
```

Worked example from these inputs only: a budget of 400 currency units, a CPC of 0.50 to 1.50, and a confirmed/clicks rate of 5% to 15% produces about 13 confirmed sign-ups at the expensive end and about 120 at the cheap end. Another budget, CPC, rate, or currency produces a different yield.

| Input | Low | High |
|---|---|---|
| Budget | | |
| CPC | | |
| Confirm rate (confirmed/clicks). If the source is confirmed/visits, also record visits/clicks and use the product formula. Do not use confirmed/visits alone | | |
| Cost per confirmed | | |
| Expected confirmed | | |

Pre-registered thresholds. They sit above any spend recommendation:

- Maximum cost per confirmed sign-up:
- Minimum confirm rate, as confirmed/clicks, or as confirmed/visits together with visits/clicks:
- Five-second comprehension: a stranger can say what the product does and one thing it does not do
- Aged-spend floor for a zero-confirm kill:
- Unspent money on a killed channel stays unspent: yes

A passed test supports an unpaid-distribution proposal only; it grants no authority to send, contact people, or publish.

## Day-by-day calendar

Day 0 is the first morning the L0 checklist is true. If it is not true, slide every later day by the same amount. Do not shorten a kill window to fit a date. This calendar applies only when the card proposes spend. A zero budget does not open Day 1. Record the organic or referral acquisition test, or the explicit justified L1 skip, and do not invent a spend morning.

| Day | Action | Kill rule that may fire |
|---|---|---|
| 0 | Confirm L0. Spend nothing | None. A failed L0 row slides the calendar |
| 1 | First spend morning, only if Day 0 is true. Record the live CPC | None yet. Confirms have not aged |
| 2 | Read counters. Do not edit thresholds | None. Day-1 spend is not yet aged |
| 3 | Apply rules only to spend at least 48 hours old | Zero confirmed on aged spend, or cost per confirmed above the cap, or confirm rate below the floor |
| 4 | Keep or stop the aged slice. Leave unspent budget unspent if a rule fired | Same rules, still only on aged spend |
| 5 | Five-second comprehension on the live page, with people outside the team | Fail the sentence: pivot the message. Do not raise the budget |
| 6 | Write the gate decision from aged counts only | A passed test supports an unpaid-distribution proposal only; it grants no authority to send, contact people, or publish. |

## Metric fit

- Natural cadence:
- Leading indicator (must match that cadence):
- Who is in the denominator (only people who had a real, non-empty chance to do the job):
- Empty-supply days, excluded from the average:
- Willingness-to-pay question, asked separately from activation. A high answer is not L4:
- Fulfillable quota, required before any price is published:

Occasional job (a purchase, a filing, a seasonal decision): the leading indicator is "completed the job the next time the job existed." A weekly-return target is the wrong kill rule. Weekly or daily job: weekly return is allowed only among people given a non-empty reason to come back.

Empty supply is a supply failure. Do not average it into retention, and do not kill the product for failing a habit the product does not have.

## L2 through L4

- L2: name the people, the core job, and the human who performed it. Supply was real, not an empty state.
- L3: the leading indicator above moved, and only for people who had a real chance to use the product. L4 does not open to see if anyone pays. L3 traction is the entrance.
- L4: one real charge on a simple hosted checkout, for a plan the product can fulfill, with the price and the refund terms matching the page. Do not publish a price or turn checkout on before that traction and a quota the product can fulfill. Record tax, invoice, and renewal wording for a person to confirm. This mode does not answer those questions.

## Decision

Before a completed evaluation, the only decision is: propose current-gate experiment / awaiting evidence.

After a completed evaluation, one of: continue / pivot the message / pivot the segment / stop. Those four are advancement decisions. They are not valid while the gate is awaiting evidence.

| Decision | When |
|---|---|
| propose current-gate experiment / awaiting evidence | The gate is fresh or incomplete. No exit evidence yet. This is the decision before execution |
| Continue | A completed evaluation shows exit evidence for this gate, and the next gate's entrance is honest |
| Pivot the message | A completed evaluation: the segment responded. The sentence did not survive five-second comprehension or the claim check |
| Pivot the segment | A completed evaluation: the mechanism worked. This audience did not |
| Stop | A completed evaluation: a pre-registered kill rule fired, or the arithmetic cannot reach a useful sample inside the ceiling |

- Decision:
- Counts:
- Threshold:
- What new evidence would reopen the gate:

One decision. Do not offer a menu.

## Approval

Spend, campaign publication, and payment changes stay blank until a person writes an explicit approval. This card does not launch them.

- Human approval (who, when, and the exact action approved), or "none":
- Channel work stays a later growth-lead proposal and still needs approval. Refer to `stage-revenue` only when that skill's decision matrix applies. Passing L4 is not that trigger. This skill stays terminal.
