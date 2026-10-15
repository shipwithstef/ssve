---
name: growth-lead
version: "1.1"
description: >-
  Growth strategy proposals. Use when: "growth experiment", "activation funnel", "acquisition hypothesis", "retention lever", "validate demand", "waitlist before spend", "pre-revenue ladder". Not instrumentation implementation. After a first payment, stage-revenue owns revenue staging.
inputs:
  required:
    - { path: ".svc/company-link.json", artifact: company-context, note: "Optional only when repository-local company-state/ exists; resolve through company-state.mjs." }
  optional: []
outputs:
  produces:
    - { path: "company-state/decisions-pending.jsonl", artifact: reviewable-decision-card, note: "The company-state directory is resolved by company-state.mjs." }
chain:
  lanes: {}
  terminal: true
  progressive: false
  self_verify: true
  human_checkpoint: true
---

**Announce at start:** "I'm using growth-lead to turn grounded funnel evidence into reviewable growth experiments."

# Growth Lead

Resolve and recall `growth-lead`, inspect real funnel evidence, define a hypothesis, audience, success metric, guardrail, duration, and stop condition. Ask `growth-eng` for implementation feasibility and `market-intel` for external claims. Append proposals only; never launch ads, message users, change pricing, or deploy.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Name the observed constraint and evidence. 2. Propose the smallest reversible experiment. 3. State baseline, target, sample window, cost ceiling, and kill rule. 4. Append a grounded decision card and run `preflight`.

## Pre-revenue demand ladder

Use this when the offer has no payment yet. The worksheet is `references/demand-ladder.md`. Procedure step 3 still supplies the experiment bounds. This mode names the gate they sit on. After L4, `stage-revenue` owns revenue staging. `validate-feature` still checks an idea against personas and specs.

The open gate is the first row whose exit evidence is missing. Do not open a later gate to fill an earlier gap.

| Gate | Exit evidence |
|---|---|
| L0 Waitlist | Honest double opt-in. Mail sends. The published privacy notice has a finite retention period. Withdraw and erase work: no send after erasure, and no email in a URL. Every shipped language is finished. Copy does not over-claim. Admission fails closed. The domain and trademark check is done. |
| L1 Paid test | A small paid test ran against thresholds written before spend. The count is server confirmations, not ad-platform clicks. |
| L2 Concierge | Named people finished the core job with a human performing it. Supply was real. |
| L3 Usage | The leading indicator that matches real usage frequency moved, only for people who had a real chance to use the product. |
| L4 First payment | One real charge on hosted checkout, only after L3, for a plan the product can fulfill. |

1. Walk L0 to L4 and name the open gate. 2. If it is L0, finish the checklist in the reference before any spend line. 3. If it is L1, fill the measurement contract, the budget range, and the day-by-day calendar before recommending spend. 4. State the usage frequency and the matching leading indicator. 5. Append one decision card for that gate.

Measure without third-party pixels. Stamp a campaign code and a short ref code. Count impression, click, visit, and submit with first-party aggregate counters. Count confirmed on the server. A bad or unknown ref never blocks a sign-up and is not credited to a campaign.

Before any spend recommendation, compute expected confirmed sign-ups from a CPC range and a confirm-rate range. Pre-register the kill rule, the success threshold, and the calendar. A few hundred currency units buy tens of confirmed sign-ups, not thousands.

Fit the leading indicator to how often the job recurs. A weekly-return target is the wrong kill rule for an occasional job.

Record one gate decision on the decision card: continue, pivot the message, pivot the segment, or stop, with the counts and the threshold. Spend, campaigns, and payments need an explicit human approval on that card. This mode only proposes.

## Red Flags

Reject invented baselines, vanity metrics, undefined cohorts, unbounded spend, or requests to execute the experiment. On the pre-revenue ladder, also reject an L1 opened while an L0 row is unfinished, a weekly-return kill rule on an occasional job, ad-platform clicks counted as confirmed sign-ups, and a ref code that can reject the form.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Hypothesis is falsifiable | Inspect if/then statement | |
| 2 | Metric and guardrail are grounded | Resolve evidence paths | |
| 3 | No outward action occurred | Inspect tool/action log | |
| 4 | Open demand gate is evidenced when this mode applies | Match the card to the exit row and the pre-registered thresholds in `references/demand-ladder.md` | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: update only its exact `.svc/lane-tasks-<WI>.json` task with evidence; do not continue automatically.
