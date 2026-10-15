# Launch panel

Load this file only for `--stage launch-panel`. Product facts live in the committed common brief. Do not paste a private run into this skill.

The 8-dimension formulas, weights, judge prompts, routing table, and `docs/specs/readiness-assessment.md` stay in `SKILL.md`. This file says who looks, how a finding is written, and which report feeds which existing dimension.

## When

Run before the first moment strangers or money touch the product: opening a waitlist, a first paid test, a public launch post, or a marketplace listing. Run again after a major positioning or landing change, before that change gets traffic.

Do not run on an ordinary commit, bugfix, or feature. A diff review stays `review-gate`, `review-exec`, or `review-cross-model`.

## Roster

Fit the roster to the product. Drop a row that does not apply. Add a row the product needs. A one-sided product does not get a supply-side seat. A marketplace does.

| Id | Role | What they own | Skip when |
|---|---|---|---|
| x-legal | Legal and compliance | Consume `counsel`. For personal data, consume `privacy-dpo`. Jurisdiction lookup may read `launch-knowledge`. Missing artifact: run that skill and keep its preflight and human checkpoint. Launch-only: which gate the finding blocks. | Never, when the gate collects personal data for the first time. |
| x-ba | Business analyst | What is live, what to cut, the cheapest test that can fail. | — |
| x-competitors | Competitors | Landscape and positions. Call `analyze-competitors` when the artifact is missing or stale. This seat consumes it. | A fresh committed competitor artifact already answers the question. |
| x-growth | Growth | Consume the approved `growth-lead` experiment. Missing: run `growth-lead` and keep its preflight and human checkpoint. Launch-only: place that experiment on the calendar. | — |
| x-marketing | Marketing context | Consume `analyze-marketing`'s `docs/specs/marketing-context.md`. Missing: run `analyze-marketing` and keep its preflight. Launch-only: which of those claims this build can support. | — |
| x-pitches | Later narrative | A later raise or partner conversation. Not a deck to send now. | The founder has ruled out fundraising and partnerships. |
| x-roles | Company roles | Hats a small team can hold, and the first contracts that are not optional. | — |
| x-pricing | Pricing and finance | Consume `fin-analyst`'s decision artifact. Missing: run `fin-analyst` and keep its preflight and human checkpoint. Launch-only: apply that evidence to the gate that is opening. | — |
| x-supply | Supply side | How the other side of a two-sided product joins, what they are promised, cold start. | The product is one-sided. |
| r1, r2 | Two full reviews | Bugs, performance, security, compliance-in-code. Same brief. Different model families. | Never. One family twice is not independence. |
| r-landing | Landing, SEO, and AEO | Public page: conversion, search, answer-engine readability, both shipped widths. | No public page. Say so in the index. This seat is not the `benchmark-landing` rubric. |
| p1–p7 | Simulated beta testers | 5–7 people spanning languages, segments, and devices. | Never below 5 when strangers will see a public surface. |
| perception | First impression | `benchmark-landing`'s visitor panel, on the current landing at desktop and phone width. | The installed skill has no visitor-panel mode. Record the skip. Do not invent its steps. |

`build-personas` writes the persona files when that skill exists and the project has no committed set. This panel then simulates those people against the current screens. It does not rewrite the persona skill.

Families come from the owner reviewer policy. The two full reviews are the pair that must differ. Specialists may share a family. The landing review may use either resolved family.

## Directory

Create `docs/plans/YYYY-MM-DD-launch-review/` with `briefs/`, `reports/`, `screens/`, and a `.gitignore` that ignores `logs/`. Reports are committed. Logs stay local.

## Screenshots

Capture the current build before dispatch:

- Desktop width and phone width.
- Each language first traffic will use.
- The state first traffic will see, not only the state that is live today. Label which is which.
- Date the folder. An older capture may sit beside it only with the date in the folder name.

Browser capture is serial. One browser-driving agent at a time.

## Briefs

One common brief, `briefs/common.md`, read first by every agent:

1. Product facts a stranger could check: who it is for, what is live, what is off, stage, and the approved budget. No internal names that are not on the page.
2. Hard constraints: no spend, no lawyer, no contacting real people, no paid model calls inside the product, read-only on the repo and on live forms.
3. Where the current build is, and where the dated screenshots live.
4. Gate names from the committed plan. If the plan has none, L0 is the first moment strangers or money arrive, and later gates stay named and ordered.
5. The output contract below.
6. Find a solution for every problem, not a list of worries.

If a fact is not committed, it is not in the brief. Agents do not see untracked files. Commit the product's planning documents, the briefs, and the screenshots before the first wave.

One role brief per agent, `briefs/<id>.md`. It points at the common brief, names the role, lists the surfaces to open, and states the deliverable. Persona briefs also name language, segment, device, and the arrival path (ad, post, or listing). They require four scores — comprehension, likeability, trust, and join intent — each on this shared 0–10 scale:

| Score | Anchor |
|---|---|
| 0 | Cannot say what the product is, who it is for, or the next action. Would leave. |
| 3 | Understood only part of the offer. Would not trust it or join. |
| 5 | Understood the offer. Would not act today. |
| 7 | Understood it and mostly trusted it. Would join if one named doubt were resolved. |
| 10 | Understood it, trusted it, and would join from this screen. |

Each score needs evidence: a screenshot path or surface, plus one sentence naming what on that surface produced the number. A missing number, a number with no evidence, or a response that does not use this scale is `unavailable`. Do not fill it in. Persona agents think aloud in character, then step out for these scores and fixes.

### Output contract

Every finding uses this shape. "Someone should look at it" is not a finding.

| Column | Rule |
|---|---|
| Severity | Blocker, High, Medium, or Low. Blocker means the named gate cannot open. |
| Gate | L0 if it blocks first traffic. A later gate if it can wait. |
| Evidence | `file:line`, a URL with the date it was opened, or a screenshot path. |
| Fix | The wording, config, or change. |
| Effort | Hours, as a range when unsure. |
| Owner | Founder, engineer, or later. |
| Status | Verified (the agent opened the evidence) or suspected. |

Also require a three-line verdict, a short "already good" list so synthesis does not delete working parts, and at most five real founder decisions.

Persona reports add this block, using the same four names and the same 0–10 anchors as the brief. No other scale.

| Metric | Score | Evidence |
|---|---|---|
| comprehension | 0–10, or `unavailable` | Screenshot path or surface, and one sentence |
| likeability | 0–10, or `unavailable` | Screenshot path or surface, and one sentence |
| trust | 0–10, or `unavailable` | Screenshot path or surface, and one sentence |
| join intent | 0–10, or `unavailable` | Screenshot path or surface, and one sentence |

## Waves

- Agents run read-only (ask or read-only sandbox) with a memory cap and a time cap.
- Resolve r1 and r2 through the owner reviewer policy before any dispatch. Use `scripts/review-topology-v2.mjs` and the canonical launcher the way `review-exec` and `review-cross-model` do. Do not pick a family in this file.
- Launch text reviewers in waves. A wave is finished only when every seat in it has passed the coverage gate. A file that merely exists does not finish a wave.
- Browser-driving agents run one at a time.
- Write each report to `reports/<id>.md`. Append the exit status to a gitignored log.
- A quota, timeout, or capability failure is not a product finding and is not permission to switch family. Substitute only when the owner policy authorizes that substitute and the approved review budget still covers the call. Otherwise record the panel incomplete, name the missing seat, and request approval. Do not dispatch another paid review while waiting.
- A substituted agent counts as an independent family only when its actual family differs from the other full review. A retry on the same family does not create consensus.

| Agent | Planned family | Actual family | Reason |
|---|---|---|---|
| r2 | policy family B | — | Quota. Policy does not authorize another family inside the approved review budget. Panel incomplete. Approval requested. |

## Coverage gate

Before synthesis, and before any readiness score or ready/not-ready verdict:

1. `reports/<id>.md` exists, is nonempty, and the gitignored log records a successful exit for that id. Timeout, error, quota, and empty files are failed coverage.
2. r1 and r2 both passed, and their actual families are recorded and distinct.
3. When strangers will see a public surface, at least five persona reports passed. Fewer than five is failed coverage.

A row whose skip rule fired is not required, and the index must say why. Every other roster row is required. A missing or failed required seat stops the run: list the gaps in `README.md`, record the panel incomplete, and request approval before any further paid call. Do not compute the 0–100 score. Do not write a ready or not-ready verdict.

## Consolidation

The orchestrator writes this. Agents do not consolidate each other.

Merge findings that cite the same surface and the same failure. Keep every independent citation. Do not average severity down because another agent was silent.

Raise a consensus blocker only when:

1. At least two agents raised it independently, or
2. One agent raised it, and the orchestrator re-opened the cited evidence and reproduced the claim.

A single unreproduced claim stays in an appendix as suspected. Spot-check every candidate blocker that would spend money, collect personal data, or change a public claim. Open the file:line or the screenshot. If the claim fails, say so in the index and drop or downgrade it.

L0 blocks first traffic. Later gates are recorded and scheduled. They do not enter the L0 list because they are interesting.

| Kind | Owner | Test |
|---|---|---|
| Decision | Founder | Two or more real options. Record the reviewers' recommendation beside the question. |
| Founder task | Founder | No product code. Adopting a notice, registering a name, or passing copy in the language of the ad are founder tasks. |
| Build task | Engineer | A code or config change. Create or reuse a WI and route it through `route-workflow` on the matching lane. Name `plan-changeset` only when that WI already has the baselined feature spec that skill requires. |

Every blocker is exactly one of the three.

### Budget realism

Check the approved `growth-lead` experiment against the approved budget before it reaches the founder page. Consume that experiment's sourced acquisition assumptions, confirmation definition, attribution window, cost ceiling, and numeric stop condition. If any of those is missing, the experiment is not approved: run `growth-lead` and do not invent a forecast or a stop threshold. If its sourced target needs more than its cost ceiling, say that from those figures. Do not move unspent money across channels. Do not shorten the stop condition to protect a date. Slide the first-traffic date until the preconditions are true. This check does not approve spend.

### Calendar

Write a calendar from today to the first traffic date. Preconditions sit on the start line: mail works, measurement tags the row, claims match the build, notices exist. If a precondition is false on the planned morning, the date moves.

## Founder page

One page, `founder-page.md`, in the review directory. Do not leave it only in chat.

1. When the coverage gate passed: ready or not for first traffic, and the single biggest risk. When it failed: panel incomplete, the missing seats, and no readiness verdict.
2. Scores from the persona panel: comprehension, likeability, trust, join intent. For each metric, the median and range of the numeric scores that carried evidence. A metric with no such score is `unavailable`. Do not invent a score. These are not the 0–100 readiness score.
3. Consensus blockers and the plan (decision, founder task, or build task).
4. Decisions, each with the reviewers' recommendation and a blank for the founder's answer.
5. A manual test kit: one pass/fail line per item a person can run without a model. Examples: confirm mail arrives, withdraw works, the fold does not claim a feature that is off, phone width shows the primary action.

Copy the answers, including each kit result, into `founder-decisions.md` and commit it. The next session must be able to read them back. If the founder defers, write `deferred` and the date. A chat reply that was never written down does not count.

`README.md` in the review directory lists briefs, reports, screen folders, the consensus blockers, any family substitution, and a pointer to the founder page. Do not paste agent logs.

## How the readiness score uses the panel

After the coverage gate passes, run Step 2 through Step 7 of this skill with the launch weights. The panel reports are the evidence those steps read. Do not add a second score. If the gate failed, stop. There is no score to use.

| Dimension | Evidence to cite |
|---|---|
| Product completeness | Full reviews and the business-analyst report: which core journeys fail on the current build, plus open critical work items they confirmed. |
| User value clarity | Persona reports and, when it ran, the visitor panel. A stranger who cannot name the product, who it is for, and the next action is the existing vague-value deduction. Cite the report. |
| Competitive position | The `analyze-competitors` artifact the competitors seat consumed. Missing artifact: score 0, same as Step 2. |
| Visual quality | Dated desktop and phone screenshots plus the landing review. |
| Technical reliability | The two full reviews. Use their reproduced defects as the bug and security inputs. |
| Monetization readiness | The pricing seat consumes `fin-analyst`. The dimension still uses the four Step 2 checks at 25 points each: payment provider configured, pricing page with clear tiers, checkout flow tested, subscription management. Those four checks are the whole score at every gate. A missing payment flow is a blocking gap only when the gate being opened takes payment. On a waitlist or any other gate that does not take payment, the same four checks still score the dimension, and payment absence is nonblocking. |
| Distribution readiness | The growth seat plus the budget realism check. "No audience yet" stays traction-locked. |
| Market timing | Competitors and marketing-context reports. Default 50 when they bring no outside evidence, same as Step 2. |

Put the report path in the key-finding cell. Judge verdicts in Step 3 quote the panel. They do not replace the two full reviews.

An open L0 blocker is a blocking gap in Step 4. A missing payment flow is a blocking gap only when the gate being opened takes payment. Traction-locked gaps stay non-blocking under the existing Step 4 rule. Skip Step 5 ICP simulation and record the skip. Do not emit GTM first while any L0 blocker is still open or while the panel is incomplete. When no L0 blocker remains and the coverage gate passed, apply the existing routing table.

`**Next:**` names one lane skill. For an L0 build task, create or reuse the WI and follow `route-workflow`. Name `plan-changeset` only when `docs/specs/features/<name>.md` is already BASELINED and includes the technical design `plan-changeset` requires. Otherwise name the lane skill that produces that missing prerequisite. Founder tasks and decisions stay with the founder. Do not open a changeset for them. When the coverage gate failed, `**Next:**` is approval for the incomplete panel, not a build skill and not a verdict.

## Do not rebuild

| Skill | What it owns | What this panel does |
|---|---|---|
| `build-personas` | Persona files | Called when they are missing. |
| `analyze-competitors` | Competitive deep-dive | Called, or its artifact is read. |
| `benchmark-landing` | Visitor panel and the visual rubric | Perception check only. The landing seat does not rescore that rubric. |
| `counsel` | Legal issue spotting | x-legal consumes its decision artifact. |
| `privacy-dpo` | Privacy review | x-legal consumes it for personal data. |
| `growth-lead` | Growth experiments and stop conditions | x-growth consumes the approved experiment. |
| `analyze-marketing` | Positioning, audience, and voice | x-marketing consumes `docs/specs/marketing-context.md`. |
| `fin-analyst` | Financial analysis | x-pricing consumes its decision artifact. |
| `launch-knowledge` | Jurisdiction lookup | x-legal may read it. |
| `route-workflow` | Lane selection | L0 build tasks enter here. |
| `review-exec` | Owner-policy reviewer resolution | r1 and r2 use it, then `review-cross-model`. This panel is not a diff review. |
