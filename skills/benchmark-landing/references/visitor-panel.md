# Visitor panel

Protocol for `benchmark-landing` Step 1b. The panel ranks a rendered page and regresses it against an earlier run. It is not a conversion forecast, and it does not change rubric weights or the gate of 7.

Read this file before scoring. Write the report from the template at the bottom.

## When to run

Recommend the panel whenever the hero, copy, or mascot changed, and before any paid traffic. On a shipped-page iteration, run the same panel on the predecessor captures and the candidate. Two captured variants use the same seats, channels, and questions.

Skip only when the rescore is mechanical (density, type ratio, viewport math) and no visitor-facing picture or sentence changed. Record the skip in the benchmark YAML. A missing second capture is a recorded gap, not a reason to invent pixels.

## Inputs

Reuse the captures Step 1 already wrote under `/tmp/benchmark-<ts>/`. Do not open a second capture pass. Do not score a mock, a design frame, or source code alone.

| Use | Capture |
|---|---|
| Five-second test, desktop | Above-the-fold image at 1600 |
| Five-second test, phone | Above-the-fold image at 390, always reported on its own |
| Other devices | 1280, 1024, and 768 when those files exist |
| Full-page scores | The rest of this run's bundle for that width. If the bundle is hero-only, say so and score what was captured |
| Story check | `1600-motion.webm`, plus any non-hover frames already in the bundle |
| Iteration | `predecessor.png` and the same widths when Step 1 captured them |

The five-second pass sees only the above-the-fold image. Later sections, motion, and interaction frames stay hidden until their own pass. If an image cannot be opened, label that row `text-only` and drop it from device rates.

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

If only one family can run, mark the report `single-family` and omit the agreement section.

## Frozen correctness rule

Write this rule in the report before either family scores. Both families use it unchanged.

| Verdict | Rule |
|---|---|
| Right | Names the product category, a plausible audience, and the real next step |
| Partial | Audience and next step, category noun missing |
| Wrong | A different product than the one this page sells |

"A website" is not a category. "Click something" is not a next step. A right click does not upgrade a wrong five-second verdict.

## Protocol per visitor

1. **Five-second pass.** Above-the-fold image only. In that visitor's voice: what is this, who is it for, what would I do next. Record the verdict against the frozen rule.
2. **Full-page pass.** Show the rest of the capture bundle. Score clarity, likeability, and trust as integers from 0 to 10. Likeability is affection. Trust is willingness to take the next step with this operator. Record a join probability from 0 to 100 (subjective odds this visitor would start the real next step, not a conversion rate), the first control they would use, one confusion sentence, what they would tell a friend, and one quote labeled `synthetic`.
3. **Story check.** Only when the page has an interactive or mascot moment. Ask whether the intended story was understood: `yes`, `no`, or `unseen`. `unseen` when the visitor never reached it, or the phone bundle has no non-hover frames. A gag that assumes the visitor already set a rule fails when they have not. The fix pattern is to frame that behavior as an example, not as their own setting. Hover-only stories stay `unseen` on phone, and the report says so.

Do not rescore the five-second verdict because a later section explains the hero.

## Cultural and scam-pattern check

Ask once per target market, even when no visitor mentioned it:

1. Which local scam does a picture or verb on this page resemble?
2. Which word is also an idiom, a title, a government form, or a joke?
3. Which line is missing, stiff, or still in another language?
4. What would an older visitor or a non-native reader think the next step costs them?

A character that takes or hides a message can match a local delivery-scam story. A hit becomes a fix-list row even when the visitor table did not mention it. Keep the note generic to this page. Do not paste another product's strings into the report.

## Metrics, per family

Compute these separately. Then compare families.

| Metric | Definition |
|---|---|
| Five-second correct rate | Right / scored visitors, overall |
| Five-second correct rate by device | Same split. Phone is mandatory. Text-only rows are excluded |
| Mean clarity, likeability, trust | Arithmetic mean of the 0–10 scores |
| Mean join probability | Arithmetic mean of the 0–100 scores |
| Story-understood rate | Yes / (yes + no). Exclude unseen |
| Top confusions | Grouped by the misread, ranked by visitor count, then by phone-fold or target-market hits |

Agreement:

- Record each family's five-second correct rate and the absolute gap in percentage points.
- A confusion agrees when both families place the same misread in their top three.
- Stable enough to rank a variant: gap of 15 points or less, and at least one shared top-three confusion.
- Otherwise the percentage is unstable. Do not pick a winner from it. Rerun, or go to the human test.

## Heuristics (not forecasts)

Print these lines in the report under `Heuristics (not forecasts)`.

| Hold | Use |
|---|---|
| Phone five-second correct rate ≥ 60% | Before paid traffic. Below it, fix the phone fold first |
| Family gap ≤ 15 points and one shared top-three confusion | Otherwise the percentage is not stable enough to rank variants |
| Story-understood rate ≥ 50%, unseen excluded | Before treating an animation or mascot as the explanation of the product |
| Likeability mean − trust mean < 1.5 | A larger gap means the picture is carrying the page |

None of these numbers is a return, a cost, or a signup lift. Waiving a hold is an explicit sentence in the report, with a date. Silence is not a waiver.

## Fix list

Rank confusions by how many visitors hit them, then by whether the hit is on the phone fold or in a target market. Map every ranked confusion to one concrete copy or visual change and to the metric the next panel should move. "Improve clarity" is not a change.

On a regression, put the previous phone five-second rate next to the new one. Direction is the result. The absolute level is not a forecast.

## How this feeds dimension 7

Copy each family's overall rate and phone rate into the benchmark YAML as evidence on `first_5_sec_comprehension`. The reviewer still writes the 1–10. Do not convert the percentage into that score with a formula. Do not change the weight (1.0), add a dimension, or move the gate.

```yaml
visitor_panel:
  report: docs/specs/benchmark/<date>-<candidate>-visitor-panel.md
  skipped: false
  dimension_7_evidence: true
  weights_changed: false
  families:
    - { id: A, five_second_correct_overall: 0.00, five_second_correct_phone: 0.00 }
    - { id: B, five_second_correct_overall: 0.00, five_second_correct_phone: 0.00 }
```

A skip replaces the rates:

```yaml
visitor_panel:
  skipped: true
  reason: <mechanical-only rescore, or the gap you recorded>
  dimension_7_evidence: false
  weights_changed: false
```

Dimension 9 remains the visual delta against the predecessor. This panel is the comprehension delta. Same seats, same channels, same questions, both captures.

## What this panel refuses

- A 1–10 craft score against the sector bank. That is the rest of `benchmark-landing`.
- Eye-tracking, a heatmap, or scroll analytics claimed as measurement.
- Expected revenue, cost-per-click, or signup lift as an output.

## Report template

Write `docs/specs/benchmark/<date>-<candidate>-visitor-panel.md` beside the benchmark YAML. Replace every bracket. Delete unused variant sections rather than leaving them blank.

```markdown
# Visitor panel — <page name> — <YYYY-MM-DD>

**Build:** `<commit sha>` at `<url or local path>`
**Captures:** `/tmp/benchmark-<ts>/` (reused from this benchmark run)
**Families:** <family A harness and model> and <family B harness and model>
**Run type:** <first / regression / A/B>
**Panel:** synthetic. Ranking and regression only. Not a forecast.

## Honesty

These visitors are a model. The percentages rank this page against its other variants and against its last run. They do not predict conversion or ad results. Likeability often exceeds trust; that gap is not demand. A human five-second test, using the same fold images and the same three questions, comes before spending money.

## Heuristics (not forecasts)

| Hold | Result | Status |
|---|---|---|
| Phone five-second correct ≥ 60% before paid traffic | <n>% | hold / clear / waived |
| Family gap ≤ 15 points and one shared top-three confusion | <gap> points; shared: <misread or none> | stable / unstable |
| Story-understood ≥ 50% before a gag explains the product | <n>% | hold / clear / not applicable |
| Likeability − trust < 1.5 | <delta> | hold / clear |

Waiver, if any: <sentence and date, or "none">

## Frozen correctness rule

- Category noun: <what a right answer must name>
- Audience: <who the page is actually for>
- Real next step: <the control or action that is true on this build>

## Family A

<one paragraph: what this family believes a cold visitor remembers>

| ID | Profile and channel | Device | Language | 5s what / who / next | Verdict | Clarity | Like | Trust | Join % | Story | First control | Confusion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | <one line, including ad / search / friend> | phone or desktop | <code> | <three short answers> | right / partial / wrong | | | | | yes / no / unseen | <control> | <one sentence> |

Friend lines and quotes sit under the table, one bullet per visitor. Tag each quote `synthetic`.

### Family A summary

| Metric | Overall | Phone | Desktop |
|---|---|---|---|
| Five-second correct | | | |
| Mean clarity | | | |
| Mean likeability | | | |
| Mean trust | | | |
| Mean join probability | | | |
| Story-understood (exclude unseen) | | | |

Top confusions:

1. <misread> — <count> visitors
2. <misread> — <count>
3. <misread> — <count>

## Family B

Same table and summary. Do not reuse Family A's people or quotes.

If this run is `single-family`, delete Family B and write: "Agreement omitted. Only one model family scored."

## Agreement

| Metric | Family A | Family B | Gap |
|---|---|---|---|
| Five-second correct | | | |
| Phone five-second correct | | | |
| Mean trust | | | |
| Story-understood | | | |

Shared top-three confusions: <list or "none">
Stability: <stable / unstable, and why>

## Cultural and scam-pattern risks

| Market | Risk | Change |
|---|---|---|
| <market or language> | <scam, idiom, or taboo the page brushes> | <copy or visual change> |

## Fix list

Rank by frequency, then by phone-fold or target-market hits. No revenue estimates.

| # | Confusion | Visitors | Change | Recheck |
|---|---|---|---|---|
| 1 | <misread> | <ids> | <exact copy or visual change> | <phone five-second rate / story-understood / first-control> |

## Regression or variant

Omit this section on a first run. Same panel on both sides.

| | Previous or variant A | This run or variant B |
|---|---|---|
| Phone five-second correct | | |
| Shared confusion that moved | | |

## Human test before spend

Use the same fold images. Ask only: what is this, who is it for, what would you do next. Recruit the same mix of phone, language, skeptic, and cold traffic. Five to eight people is enough to challenge the heuristic holds. Do not brief them on the product first.
```
