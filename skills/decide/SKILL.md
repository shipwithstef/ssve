---
name: decide
version: "1.0"
inputs:
  required: []
  optional:
    - { path: "docs/specs/decisions/<scope>/GRILL-D<n>.md", artifact: decision-grill }
outputs:
  produces:
    - { path: "docs/specs/decisions/<scope>/DECISION.md", artifact: decision-card }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
description: >-
  Present a decision to the founder so it can actually be decided — story first, real options
  as outcomes, world practice, grounded confidence per option, and one recommendation. Use when
  the founder says "give me the decision", "какво решаваме", "дай ми опциите", "trqbva li da",
  "what should we do about X", "decision matrix", "подреди ги по важност", or whenever an audit,
  plan or review has produced something a human must choose. Also use before handing any scope
  to an executor — an unsigned decision is not an instruction. NEVER present a decision menu
  any other way.
---

# Decide — put a choice in front of the founder that can be answered

## Product-runtime v2 owner surface

When a `product-improvement-protocol-v2` run is active, this skill is the **only** owner-facing
decision surface. Read `references/owner-decision-runtime-v2.md`; preserve the run's language and
mode, reject repeated unresolved-decision digests, and emit the selected and all rejected options
as a digest-bound owner-decision object. Autonomous selections must remain inside the exact signed
delegation. Strategic selections require the owner's explicit signature. Never convert a missing
answer into a hidden product default.

## Where this sits — the middle of a fixed three-step loop

| | Skill | Owns |
|---|---|---|
| ← before | **`/audit-feature`** | *what IS* — the branch index, grounded, dead branches named |
| **this** | **`/decide`** | *what SHOULD BE* — defects filtered out, real choices signed |
| → after | **`/align-feature`** | *making it so* — builds only against a SIGNED card |

**Read the scope's branch index before writing any card.** It is the authority for every fact
a decision rests on (`docs/specs/relations/<scope>.branches.md`); if its contract is red, the
facts are stale and no decision may be taken on them. **If there is no index, stop and run
`/audit-feature` — you are about to ask the founder to choose between things nobody has
enumerated.**

**Nothing leaves here unsigned.** `align-feature`'s intent gate refuses an unsigned card, so a
decision left hanging silently blocks the whole build.


**Announce at start:** "Presenting <N> decisions for <scope>, one at a time, most consequential
first." Then present **one**.

The format is `docs/specs/process/DECISION-CARD-FORMAT.md` (project-supplied artifact — path
varies per repo) — its seven rules are binding and
are not repeated here. This skill adds what that format assumes and does not enforce, each
rule earned from a real failure.

## 0 · Language — the founder's, not yours

- **Default English.** If the founder is writing in Bulgarian, or has asked for Bulgarian,
  **present in Bulgarian** — the scene, the options, the costs, the recommendation, all of it.
- **Never translate the technical identifiers.** File paths, column names, function names,
  error codes and SQL stay verbatim in any language; a translated `owner_verification_status`
  is unsearchable.
- **Explain in the language, do not merely translate into it.** "Фунията е аналитично сляпа"
  beats a word-for-word rendering of "the funnel lacks instrumentation".
- Ban jargon in the question itself, in both languages. If a sentence needs a glossary, the
  decision is not ready to be asked.

## 1 · The filter — MOST OF WHAT YOU ARE ABOUT TO ASK IS NOT A DECISION

Before writing a single card, split the list in two:

| | |
|---|---|
| **Not a decision** | it is broken, it contradicts itself, it charges someone and delivers nothing, it promises what the code cannot do, or the law/vendor already answers it. **Fix it. Do not put it on the founder's plate.** |
| **A decision** | two or more defensible futures exist and someone must choose which one we build |

*(2026-07-31: six "decisions" were presented; four were defects — three rewards that debit and
grant nothing, a role picker promising a change the code refuses, endpoints open to the
internet, a "Save Progress" button that saves nothing. The founder's time was spent choosing
between things that simply had to be repaired.)*

Say the split out loud: **"N of these are not decisions — they are broken and I am fixing them.
Here are the M that are actually yours."**

## 2 · Priority — order by consequence, and say what each blocks

Sort by, in this order:

1. **What is bleeding now** — money leaving, data exposed, a promise being broken to real users
2. **What blocks the most other work** — name it: *"this blocks the entire S4 build"*
3. **What is cheapest to reverse later** — put the one-way doors first while attention is fresh
4. **Everything else**

Every card states **what it unlocks or blocks** (format rule 5) and its **reversibility**
(rule 6). A decision with neither is not ready.

## 3 · Options must include the one you are not recommending

- **At least two real options**, each written as *what happens in the scene* (format rule 3).
- **"Do nothing" is an option whenever it is genuinely survivable** — and it often is. Say what
  the world looks like in six months if we never touch it.
- **Never present one option and call it a decision.** If only one path is defensible, it is a
  fix, not a decision — see §1.
- If an option was **eliminated**, say so in one line with the reason, so the founder can see
  it was considered rather than missed.

## 4 · World practice — what comparable products actually do

Every card carries one row: **what do the incumbents do here, and what did it cost them.**
Cited, primary source, with the company named. Not "industry best practice" — *"Yelp calls the
number on the listing; Google's own video step asks for till access; both escalate to a human
and both publish a 5-business-day SLA."*

If nobody comparable does it, **say that too** — it is a real signal, and it changes the
answer. *(2026-07-31: "no place-data program pays a contributor when a business subscribes" was
the single most decision-relevant fact found, and it was an absence.)*

**⚠️ Precedent INFORMS the decision. It does not make it.** *(Founder, 2026-07-31: "it is not
always necessary to copy if we make an innovation that logically beats them — experimentation
is not that bad if there is no compliance or other drawback.")*

Having found what the world does, ask three more questions before recommending it:

| | |
|---|---|
| **Does their reason apply to us?** | Incumbents solved *their* problem at *their* scale. A rule written for 13M fake profiles a year is not automatically right at zero listings |
| **Do we have something they did not?** | A mechanic they never had — a receipt, an on-site camera, a scout with a device in hand — can beat the precedent honestly. Say what the new capability is and why it dominates |
| **What does being wrong cost?** | This is the real gate. Cheap to reverse + no compliance exposure + no promise made publicly ⇒ **run the experiment, do not copy**. Expensive to reverse or legally loaded ⇒ follow precedent and say so |

So the row is not "the incumbents do X, therefore X". It is **"the incumbents do X for reason
R; R does / does not hold for us; here is the cost of being wrong"** — and where the cost is
low, a reasoned novel mechanic is the better recommendation. Mark it as an **experiment** with
what would tell us it failed, not as a settled design.

## 5 · Grounding — every claim in the card carries its confidence

Use the `audit-feature` §2c scale (**C5** derived · **C4** cited primary · **C3** measured ·
**C2** secondary · **C1** inferred · **C0** asserted).

| Rule | |
|---|---|
| **Separate the FACT's score from the RECOMMENDATION's score** | they are usually different, and the gap is the honest part |
| **Nothing below C3 may carry a decision** | C2/C1 may inform it only with the C3+ facts they stand on named beside them |
| **A C0 recommendation must be labelled as taste**, not smuggled in as analysis | |
| **Invented numbers must say so** | "5 distinct people — the number is mine and has nothing behind it" |

*(2026-07-31: six recommendations were presented; scored afterwards, exactly ONE cleared C3.
The founder was being asked to decide on judgement dressed as evidence.)*

### 5b · The ANALYSIS must exist, and the card must link it — not contain it

A card is one screen. The reasoning behind it is not. Both must exist, and they are different
artifacts (`audit-feature` §2b: *an analysis with no mechanical claim behind it is an opinion;
a finding with no written analysis is a rumour*).

| | Where | Holds |
|---|---|---|
| **The card** | `docs/specs/decisions/<scope>/DECISION.md` | the scene, the options, the recommendation, the signature — one screen |
| **The analysis** | linked from the card | why each option is defensible, the tension between them, what was eliminated and why, and every fact's citation |
| **The facts** | `docs/specs/relations/<scope>.branches.md` | the authority. **Cite it; never restate it** — a restated fact goes stale silently |

**A card whose analysis does not exist is not ready to sign.** If writing the analysis is hard,
that is the signal that the decision is not understood well enough to ask.

### 5c · Score the DECISION, not just its claims — and record what would lower it

Every signed decision carries a line:

```
Grounded-at: C<n> — rests on: <fact> (C<n>), <fact> (C<n>)
Would-lower-this: <the specific thing that, if refuted, makes this decision wrong>
```

This is the same self-invalidation the branch index uses, applied to a choice: **a decision
that cannot say what would make it wrong is a preference, not a decision.**

**And it is re-checkable.** When a later audit refutes a fact a signed decision rests on, that
decision is **flagged for re-signature** — it does not silently keep its authority. Treat a
signed decision standing on a refuted fact exactly like a stale branch index: loud, not quiet.

*(2026-07-31: five confidently-stated facts were reversed inside one session — a column said
not to exist, a page said not to be routed, a function said not to be registered, a cap said
to need a new table, a writer said to award nothing. Any decision resting on those would have
kept its signature and its authority with nothing to catch it.)*

### 5d · Say what you did NOT check

Every card ends with what was not verified and who owns it — vendor, counsel, accountant, or a
measurement we must run. **An honest gap is worth more than a confident guess**, and it is the
difference between "decided" and "decided in the dark".

## 6 · The scene must be a person, not a system

Format rule 2 says story first. Concretely: **a named person, a real screen, a real clock
time, and something they can lose.** "Мария снима входа, качва бележката, отнело ѝ е 3 минути"
— not "the scout submits a capture".

Then, immediately: **what happens to that person under each option.** If you cannot write what
Maria experiences, you do not understand the decision well enough to ask it.

## 7 · Answer format — make it answerable in one word

End with the choices as bare labels the founder can reply with: **`A1 / A2 / A3`**. No "let me
know what you think", no "happy to discuss". One question, one screen, one word back.

If the founder answers with an imperative ("go", "do it", "приемам") — **act, do not ask a
follow-up.** Remaining decisions sign as recommended and are recorded as such
(`DECISION-CARD-FORMAT` §Delivery).

## 8 · The flow — walkable, and every branch answered

When a decision set changes how something works end to end, show the flow. Two hard rules,
both earned:

**8a · Compressed is not simplified.** *(Founder, 2026-07-31: "three words does not mean
clarity.")* An arrow diagram of short labels is unreadable to anyone who does not already know
the system — which is everyone the flow is for. Every step must carry, in the founder's
language:

| | |
|---|---|
| **Who** | the person or the system acting — by name |
| **What they see or do** | the actual screen, message or action |
| **What the system does** | the real mechanism, cited |
| **How long** | seconds, minutes, days |
| **If it fails** | where that person lands — never a dead end |

**8b · Enumerate the what-ifs. Every one.** The happy path is the least interesting row. Walk
the flow once per real-world starting condition and say what happens in each — *no Google
listing · listing with no phone and no website · a landline in a language the provider cannot
speak · someone already claimed it · the person is not the owner at all*. A flow that shows
only the good case hides exactly the cases that decide the design.

**Rule: if a branch has no answer, write "no answer today" and name who owns it.** A missing
branch in a flow is the same defect class as a missing branch in the index.

**8c · Before and after, side by side.** Show today's flow and the proposed one over the *same*
scene, so the difference is visible rather than asserted.

## 9 · GRILL — attack the decision after it is signed, before it is built

*(Founder instruction 2026-07-31: "make a counter-decision — grilling that works against the
all-around feature and attacks it to make this better.")*

A signature closes the choice. It does **not** make the choice good. Before the card reaches an
executor, run one adversarial pass whose only job is to **damage it**. Findings-only; the
signature stands unless the grill produces something the founder then chooses to act on.

**The seven angles.** Each must be answered or explicitly waived with a reason:

| Angle | The question |
|---|---|
| **Avoidance** | What does a rational person do to get the benefit without doing the work? Cost to them vs complying. *Not* "abuse" — the ordinary user routing around a rule is the case that actually happens |
| **Cold start** | Does it work when the number is zero — no customers, no listings, no history? Many mechanics are silently self-blocking on day one |
| **The unlucky user** | Who does this make WORSE off, honestly? Name them: the rural business, the one-language owner, the person without a smartphone, the shop with no receipt printer |
| **Second order** | If it works, what does it cause? A reward that works attracts the people who optimise it |
| **Reversal** | If it turns out wrong in three months, what does it cost to undo? Data written, promises made publicly, money paid out |
| **Load** | Who does the human work, and what happens at 10× the volume? A queue that costs one founder-minute at 10 costs a day at 500 |
| **The unmeasured number** | Which number in this decision was invented? Say it, and say what would settle it |

**Rules of the grill:**
- **Attack the decision, not the alternatives.** The point is to improve what was chosen, not to reopen the vote.
- **Separate FATAL from FIXABLE.** Fatal = it cannot work as signed; fixable = it works with a named guard. Most findings are fixable, and saying so is the useful part.
- **Every attack carries its confidence** (§5). An invented objection is worse than none.
- **A counter-decision is allowed** — if the grill finds something fatal, present it as a new card under §1–§7, not as prose.
- **Zero findings is a legitimate outcome** and must be stated as such, with what was tried.

Record the grill beside the card: `docs/specs/decisions/<scope>/GRILL-D<n>.md`.

## 10 · Record it

Signed decisions go to `docs/specs/decisions/<scope>/DECISION.md` in the card format, one
signature line per decision. The scope's branch index
(`docs/specs/relations/<scope>.branches.md`) is the authority for the FACTS the decision rests
on — cite it rather than restating it, and if the index and the card disagree, **the index
wins and the card is stale**.

**🔴 Emit the receipt BEFORE writing the card, or the write is refused.**
`docs/specs/decisions/` is a protected path: the `svc-skill-artifact-authenticity` hook (G-4)
demands a matching entry in `.svc/pipeline-decisions.jsonl` inside a 90-minute window, so that
a file with the *shape* of a signed decision cannot exist without the gate that produced it.

```bash
node scripts/pipeline-log.mjs append --path .svc/pipeline-decisions.jsonl \
  --run-id "<scope>-decisions-<YYYY-MM-DD>" --skill decide --phase sign --type taste \
  --decision "<one line per signed decision>" \
  --reasoning "<what was rejected and why · the C-scores · path to the card>" \
  --decided-by P0 --overrideable true
```

Do **not** reach for `SVC_SKILL_ARTIFACT_ALLOW=1`. The block is not friction to route around —
it is the mechanism that makes a signature mean something. *(2026-07-31: this skill mandated
the path and omitted the receipt, so its very first real card was refused by the hook. The
skill was wrong, not the hook.)*

## Never

Never present a menu of more than one decision at a time. Never mix a defect in with the
choices. Never give a recommendation without its confidence. Never ask a question whose answer
you could have looked up. Never end a decision card with a question about the process instead
of the product.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume; on Codex, mirror only the active step in `update_plan`.
- Usually invoked mid-chain by `align-feature`'s intent gate rather than as its own lane task;
  when a task graph IS active, mark the calling task `in_progress` while the decision is
  pending and do not mark it `completed` until the card is SIGNED.
- Subagents MUST NOT attempt TaskUpdate calls — file state is the durable record.

### Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Exactly one decision presented at a time | re-read the card — no second unresolved decision bundled in | |
| 2 | Every option carries a grounded confidence score | grep the card for a confidence value per option | |
| 3 | Defects are filtered out of the options, not offered as choices | re-read the card for any option that is itself a known defect | |
| 4 | Card follows `docs/specs/process/DECISION-CARD-FORMAT.md`'s seven rules | diff the card's sections against the format's rule list | |
| 5 | Receipt emitted before the card is written | `.svc/pipeline-decisions.jsonl` has a matching entry inside the 90-minute window | |

### Chaining

- `/align-feature` — once the card carries a `Status: SIGNED <date>` line, control returns to
  the calling skill's next stage.
