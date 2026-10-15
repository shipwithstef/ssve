# Visitor panel

Protocol for `benchmark-landing` Step 1b. The panel ranks a rendered page and regresses it against an earlier run. It is not a conversion forecast, and it does not change rubric weights or the gate of 7.

Read this file before scoring. Write the report from the template at the bottom.

## When to run

The panel is optional. Recommend it for these changes: the hero, copy, or mascot changed; before any paid traffic; a predecessor-versus-candidate comparison; or two captured variants. Record any declined or unavailable run in the benchmark YAML.

A mechanical-only rescore (density, type ratio, viewport math) with no visitor-facing picture or sentence changed is not a recommendation. Record that the recommendation does not apply. A written waiver of paid traffic does not skip the panel.

Missing comparison captures skip only the comparison, not a first-pass panel. When regression testing is selected, Step 1 captures the predecessor at the same widths as the candidate, including 390. This panel reuses those files and does not open a second capture pass. If a matching phone capture is missing or unreadable, mark the phone comparison unavailable and do not state a regression conclusion. Do not invent pixels.

## Inputs

Reuse the captures Step 1 already wrote under `/tmp/benchmark-<ts>/`. Do not open a second capture pass. Do not score a mock, a design frame, or source code alone.

| Use | Capture |
|---|---|
| Five-second test, desktop | Above-the-fold image at 1600 |
| Five-second test, phone | Above-the-fold image at 390. Report phone evidence only when this image is readable and at least one phone visitor is scored |
| Other devices | 1280, 1024, and 768 when those files exist |
| Full-page scores | The rest of this run's bundle for that width. If the bundle is hero-only, say so and score what was captured |
| Story check | `1600-motion.webm`, plus any non-hover frames already in the bundle |
| Regression or variant comparison | `predecessor-<viewport>.png` for each width Step 1 captured, including `predecessor-390.png`. `predecessor.png` remains the 1600×900 image for dimension 9 |

The five-second pass sees only the above-the-fold image. Later sections, motion, and interaction frames stay hidden until their own pass.

If an image cannot be opened, label that visitor row `text-only`. Exclude text-only rows from every visual metric. A text-only row is not phone evidence. Require a readable phone capture and at least one scored phone visitor before reporting phone evidence. Otherwise mark the panel `incomplete`, write the phone metrics as `unavailable`, and never clear the holds that depend on them.

A metric with a zero denominator is `unavailable`. Do not write zero in its place, and never clear its hold.

Record the commit the captures came from. An unknown build is not scored.

## Panel

About 12 visitors per family. Each family draws its own sheet. Share the seat rules, not the people or the quotes.

Sample from the project's personas plus cold traffic. If no personas exist, fill every seat from cold traffic and name `build-personas` as the missing upstream. Do not write a persona file in this step.

| Seat | Minimum |
|---|---|
| Skeptic of the category, the picture, or the ask | 1 |
| Non-native reader of a shipped language | 1 |
| Phone-first | enough to report a phone rate; aim for 4 or more |
| Older visitor | 1 |
| Reduced motion, or low vision | 1 |
| Each target market | 1 |
| Cold traffic, not drawn from the persona files | 3 |

Each line names an arrival channel: an ad, a search, or a friend's link. An ad visitor and a friend's-link visitor do not grant the same benefit of the doubt.

## Two model families

Two model families score independently. Neither family sees the other's table before it finishes. Do not average the families into one percentage.

If only one family can run, mark the report `single-family` and omit the agreement section. Record that the second family was unavailable.

## Frozen correctness rule

Write this rule in the report before either family scores. Both families use it unchanged. The three answer slots are the first-encounter product, audience, and next-action questions in `skills/analyze-marketing/references/persona-validation.md` (Step 2). Do not add a class.

| Verdict | Rule |
|---|---|
| Right | All three answers are correct |
| Partial | At least one answer is correct, and every other answer is missing or ambiguous. None is incorrect |
| Wrong | Any answer is an incorrect claim, or no answer is correct |

"A website" is not a correct product answer. "Click something" is not a correct next action. A later right click does not upgrade a Wrong verdict.

## Protocol per visitor

Buyer interrogation and remediation already exist. Use `skills/analyze-marketing/references/persona-validation.md` (Step 2, the friend paraphrase in the persona profile, and Step 5). Do not restate that framework.

This panel only adds rendered captures, device comparisons, independent families, and the cultural and story checks below.

1. **Five-second pass.** Above-the-fold image only. Record the three answer slots and the frozen verdict. Do not rescore that verdict because a later section explains the hero.
2. **Full-page pass.** Show the rest of this run's capture bundle for that device. On rows that are not text-only, record clarity, likeability, and trust as integers from 0 to 10, a join probability from 0 to 100 (subjective odds this visitor would start the real next step, not a conversion rate), the first control they would use, one confusion sentence, and one quote labeled `synthetic`. Likeability is affection for the rendered page.
3. **Story check.** Only when the page has an interactive or mascot moment. Ask whether the intended story was understood: `yes`, `no`, or `unseen`. `unseen` when the visitor never reached it, or the phone bundle has no non-hover frames. A gag that assumes the visitor already set a rule fails when they have not. The fix pattern is to frame that behavior as an example, not as their own setting. Hover-only stories stay `unseen` on phone, and the report says so.

## Cultural and scam-pattern check

Ask once per target market, even when no visitor mentioned it:

1. Which local scam does a picture or verb on this page resemble?
2. Which word is also an idiom, a title, a government form, or a joke?
3. Which line is missing, stiff, or still in another language?
4. What would an older visitor or a non-native reader think the next step costs them?

A character that takes or hides a message can match a local delivery-scam story. A hit becomes a fix-list row even when the visitor table did not mention it. Keep the note generic to this page. Do not paste another product's strings into the report.

## Metrics, per family

Compute these separately. Exclude every `text-only` row from every visual metric. Then compare families.

| Metric | Definition |
|---|---|
| Five-second correct rate | Right / scored visitors, overall. Scored visitors exclude text-only rows. `unavailable` when that count is zero |
| Five-second correct rate by device | Same split. Phone evidence requires a readable 390 capture and at least one scored phone visitor. Otherwise the phone rate is `unavailable` and the panel status is `incomplete` |
| Mean clarity, likeability, trust | Arithmetic mean of the 0–10 scores on rows that are not text-only. `unavailable` when that count is zero |
| Mean join probability | Arithmetic mean of the 0–100 scores on those same rows. `unavailable` when that count is zero |
| Story-understood rate | Yes / (yes + no). Exclude unseen and text-only. `unavailable` when yes + no is zero. `not applicable` only when the page has no interactive or mascot moment |
| Top confusions | Grouped by the misread, ranked by visitor count, then by phone-fold or target-market hits. Text-only rows do not count |

`unavailable` never clears a hold. An incomplete panel does not supply dimension-7 phone evidence.

Agreement:

- Record each family's five-second correct rate and the absolute gap in percentage points. Absolute-rate gaps are descriptive. They do not pick a variant winner.
- A shared top-three confusion is descriptive. It does not replace direction agreement.
- Calculate each family's paired predecessor/candidate phone-rate delta (this run's phone five-second rate minus the predecessor's, or variant B minus variant A). Both rates must be scored. Use the same seats, channels, and answer slots on both captures.
- Require agreement on direction before ranking. Direction agrees when both deltas are positive, both are negative, or both are zero. Rank a winner only when both deltas share a non-zero direction.
- Report opposing directions (one positive and one negative) as disagreement. A zero delta beside a non-zero delta is not direction agreement. In either case, do not rank a winner.
- Both deltas zero means the families agree the phone rate did not move. Do not name a winner.
- If either phone delta cannot be computed, the comparison is unavailable. Do not rank a winner, and do not state a regression conclusion.

## Heuristics (not forecasts)

Print these lines in the report under `Heuristics (not forecasts)`.

| Hold | Use |
|---|---|
| Phone five-second correct rate ≥ 60% | Before paid traffic. Below it, fix the phone fold first. `unavailable` or an incomplete panel leaves the hold open |
| Direction agreement on the paired phone-rate delta | Required before ranking a variant. Opposing directions are disagreement. Absolute-rate gaps stay descriptive |
| Story-understood rate ≥ 50%, unseen excluded | Before treating an animation or mascot as the explanation of the product. `unavailable` leaves the hold open. Not applicable only when the page has no such moment |
| Likeability mean − trust mean < 1.5 | A larger gap means the picture is carrying the page. `unavailable` leaves the hold open |

None of these numbers is a return, a cost, or a signup lift. Waiving a hold is an explicit sentence in the report, with a date. Silence is not a waiver. `unavailable` is not `clear` and is not a waiver.

## Fix list

Order and remediation follow `skills/analyze-marketing/references/persona-validation.md` Step 5. Do not restate that framework.

On a regression, put the previous phone five-second rate next to the new one only when both phone captures were readable and both phone rates were scored. Direction is the result. The absolute level is not a forecast. If either matching phone capture is missing or unreadable, or either phone rate is `unavailable`, mark the phone comparison unavailable and do not state a regression conclusion.

## How this feeds dimension 7

When the report file exists, the dimension-7 rationale and the benchmark YAML cite that path. The reviewer still writes the 1–10. Do not convert a percentage into that score with a formula. Do not change the weight (1.0), add a dimension, or move the gate.

Copy scored rates through. Copy a zero-denominator metric as `unavailable`, not as 0. Set `dimension_7_evidence: true` only when the panel status is `complete`. An incomplete panel is still cited, with `dimension_7_evidence: false`.

```yaml
visitor_panel:
  report: docs/specs/benchmark/<date>-<candidate>-visitor-panel.md
  skipped: false
  status: complete
  dimension_7_evidence: true
  weights_changed: false
  comparison: recorded
  families:
    - { id: A, five_second_correct_overall: 0.00, five_second_correct_phone: 0.00, phone_rate_delta: 0.00 }
    - { id: B, five_second_correct_overall: 0.00, five_second_correct_phone: 0.00, phone_rate_delta: 0.00 }
  direction_agreement: agreement
```

A declined or unavailable run, or a mechanical-only rescore where the recommendation does not apply, records the reason and does not invent a report:

```yaml
visitor_panel:
  skipped: true
  reason: <owner declined, family unavailable, or mechanical-only rescore>
  dimension_7_evidence: false
  weights_changed: false
```

A missing comparison capture does not use the skip block. The first-pass panel still runs. Set `comparison: unavailable` and omit any regression conclusion.

Dimension 9 remains the visual delta against `predecessor.png`. This panel is the comprehension delta, and only for viewports captured on both sides.

## What this panel refuses

- A 1–10 craft score against the sector bank. That is the rest of `benchmark-landing`.
- Eye-tracking, a heatmap, or scroll analytics claimed as measurement.
- Expected revenue, cost-per-click, or signup lift as an output.
- Contacting participants, or spending on recruitment or compensation, without explicit human authorization.

## Report template

Write `docs/specs/benchmark/<date>-<candidate>-visitor-panel.md` beside the benchmark YAML. Replace every bracket. Delete unused variant sections rather than leaving them blank.

```markdown
# Visitor panel — <page name> — <YYYY-MM-DD>

**Build:** `<commit sha>` at `<url or local path>`
**Captures:** `/tmp/benchmark-<ts>/` (reused from this benchmark run)
**Families:** <family A harness and model> and <family B harness and model>
**Run type:** <first / regression / A/B>
**Panel status:** <complete / incomplete>
**Comparison:** <not a comparison / recorded / unavailable>
**Panel:** synthetic. Ranking and regression only. Not a forecast.

## Honesty

These visitors are a model. The percentages rank this page against its other variants and against its last run. They do not predict conversion or ad results. Likeability often exceeds trust; that gap is not demand. The owner-run test at the bottom is a proposal. This report does not authorize contacting people or spending.

## Heuristics (not forecasts)

| Hold | Result | Status |
|---|---|---|
| Phone five-second correct ≥ 60% before paid traffic | <n>% or unavailable | hold / clear / waived / unavailable |
| Paired phone-rate direction | <family A delta>, <family B delta> | agreement / disagreement / unavailable |
| Story-understood ≥ 50% before a gag explains the product | <n>% or unavailable | hold / clear / waived / unavailable / not applicable |
| Likeability − trust < 1.5 | <delta> or unavailable | hold / clear / waived / unavailable |

Waiver, if any: <sentence and date, or "none">

## Frozen correctness rule

- Product answer: <what a right answer must name>
- Audience answer: <who the page is actually for>
- Next-action answer: <the control or action that is true on this build>
- Verdicts: Right = all three correct; Partial = some correct, others missing or ambiguous, none incorrect; Wrong = an incorrect claim or no correct answer

## Family A

<one paragraph: what this family believes a cold visitor remembers>

| ID | Profile and channel | Device | Language | 5s product / audience / next | Verdict | Clarity | Like | Trust | Join % | Story | First control | Confusion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | <one line, including ad / search / friend> | phone or desktop | <code> | <three short answers> | right / partial / wrong | | | | | yes / no / unseen | <control> | <one sentence> |

Under the table, one bullet per visitor: the friend paraphrase from `skills/analyze-marketing/references/persona-validation.md`, plus one quote labeled `synthetic`.

### Family A summary

| Metric | Overall | Phone | Desktop |
|---|---|---|---|
| Five-second correct | | | |
| Mean clarity | | | |
| Mean likeability | | | |
| Mean trust | | | |
| Mean join probability | | | |
| Story-understood (exclude unseen) | | | |

Write `unavailable` for a zero denominator. Leave a text-only row out of every cell.

Top confusions:

1. <misread> — <count> visitors
2. <misread> — <count>
3. <misread> — <count>

## Family B

Same table and summary. Do not reuse Family A's people or quotes.

If this run is `single-family`, delete Family B and write: "Agreement omitted. Only one model family scored."

## Agreement

| Metric | Family A | Family B | Note |
|---|---|---|---|
| Five-second correct | | | absolute gap is descriptive |
| Phone five-second correct | | | unavailable if phone evidence is missing |
| Phone-rate delta (this − predecessor) | | | direction is the ranking input |
| Mean trust | | | descriptive |
| Story-understood | | | unavailable when yes + no is zero |

Shared top-three confusions: <list or "none"> (descriptive)
Direction: <agreement / disagreement / unavailable, and why>
Ranking: <winner, or "no winner">

## Cultural and scam-pattern risks

| Market | Risk | Change |
|---|---|---|
| <market or language> | <scam, idiom, or taboo the page brushes> | <copy or visual change> |

## Fix list

Priority and remediation: `skills/analyze-marketing/references/persona-validation.md` Step 5. The recheck column is this panel's phone, story, or first-control metric. No revenue estimates.

| # | Confusion | Visitors | Change | Recheck |
|---|---|---|---|---|
| 1 | <misread> | <ids> | <exact copy or visual change> | <phone five-second rate / story-understood / first-control> |

## Regression or variant

Omit this section on a first run. If either phone rate is unavailable, write `unavailable` and stop. Do not state a regression conclusion.

| | Previous or variant A | This run or variant B | Delta |
|---|---|---|---|
| Phone five-second correct | | | |
| Direction | | | <up / down / flat / opposing / unavailable> |

## Owner-run test proposal

This is a proposal for the owner to run. It does not contact participants, and it does not spend.

Use the same fold images. Ask only the first-encounter product, audience, and next-action questions in `skills/analyze-marketing/references/persona-validation.md` (Step 2). Cover the same mix of phone, language, skeptic, and cold traffic. Five to eight people is enough to challenge the heuristic holds. Do not brief them on the product first.

Contacting participants, or spending on recruitment or compensation, requires explicit human authorization before either action. Until that authorization is on the record, stop at this proposal.
```
