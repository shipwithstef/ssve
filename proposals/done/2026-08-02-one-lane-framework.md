Scope-note: framework improvement proposal. Not a decision card, not a scope authority — it
proposes changes to `audit-feature`, `align-feature` and the svc chain around them.

# One lane — make the whole framework work the way these two skills already do

> **Repo-scope note (2026-08-03).** This was drafted in the **product** repo
> (`example-marketplace/proposals/`) because the three skills it argues about —
> `align-feature`, `audit-feature`, `decide` — live **only** at
> `example-marketplace/.claude/skills/`, project-local, and were never installed into this framework
> repo. That split is itself part of the problem: framework doctrine lives here, the newest
> doctrine lives in one product. Filed here because framework improvement belongs to
> `seriousvibecoding`; promoting those three skills out of the product repo is a prerequisite
> of adopting any of it.

**Date:** 2026-08-02 · **Author:** Claude Opus 5 (xhigh), from the founder's brief
**Status:** PROPOSED — nothing here is implemented

## The observation behind it

`audit-feature` and `align-feature` were built to recover truth about code that predates them.
In doing so they accumulated the rules the rest of the framework lacks: a freshness-guarded
enumeration, receipts per stage with tracked evidence, grounding scored by *how* a fact was
established, a decision card that cannot be skipped, and a review obliged to report **absence**
rather than only defects.

Those rules are not audit-specific. They are how any change should be made. Today the framework
has **two lanes** — the receipted chain, and everything else — and "everything else" is where
drift is manufactured.

**The proposal is to delete the second lane.**

---

## 1 · There is no quick fix — there are only cheap mutations

`quick-fix` exists because the chain feels expensive for a one-line change. That framing is
wrong: the chain is not expensive, **re-establishing context** is. A scope with a live branch
index has already paid that cost — a one-line change against a fresh index is minutes, because
the enumeration answers "what else touches this" without a search.

**Change:** retire `quick-fix` as a *lane*. Every change is a mutation through the same chain.
Speed comes from §2, not from a bypass.

**What this kills:** the class where a "one-line fix" silently invalidates a marketed claim, a
price, a journey or a counter — because nothing in the fast lane looks at those layers. Every
such incident in this repo's history came through a bypass, not through the chain.

**Test of the proposal:** if a one-line change against a fresh index cannot be finished in
minutes, then §2 is under-specified — that is the thing to fix, not the principle.

## 2 · Stages are CONDITIONAL, and the condition is machine-checkable

Today a stage is `done`, `pending`, or `na` with a written note. `na` is a judgement call, so it
is the pressure valve — and pressure valves get used.

**Change:** every stage declares an **activation condition**, evaluated against the diff and the
index:

| State | Meaning |
|---|---|
| `done` | ran, evidence tracked |
| `na` | the condition **evaluated false** — the condition and its evaluation are recorded, not a human sentence |
| `pending` | condition true, not yet run |

Conditions, deliberately mechanical:

```
perf          diff touches a query path, a loop over rows, or an index
translations  diff adds or changes a user-visible string
device-proof  diff touches src/**, android/**, ios/** or a native permission
visuals       diff touches a rendered component or a design token
pricing       diff touches plans.generated.js, a fee path, or a priced surface
marketing     diff touches a capability the marketing context claims
```

**The essential stages carry no condition and can never be `na`:** `plan`, `review-plan`,
`implement`, `review-exec`, `spec-sync`, and the index re-stamp. Those *are* the chain.

**Why this matters more than it looks:** a condition that evaluates false is **evidence the
stage was considered**. A human "n/a — not relevant" is evidence of nothing, and is
indistinguishable from "I didn't think about it".

## 3 · Genesis-first — new features must never need `align`

`align-feature` is a **recovery** tool. It exists because features were built before the rules
and their truth must be reconstructed. That is legacy work, and it should shrink toward zero.

**Change:** a feature's branch index is created **at genesis**, not reconstructed later. When a
feature is first specified it gets `docs/specs/relations/<scope>.branches.md` with `Scope-paths`
declared and its axes empty, and every stage that touches the scope **appends to it** instead of
to a separate document. The index grows with the feature.

Consequences, all intended:

- `audit-feature` becomes a tool for **external and legacy** code, plus periodic re-verification
- a feature born in the framework reaches "done" with a complete, fresh index already
- `INDEX.md`'s denominator stops being a confession and becomes a count
- "was this audited?" stops being a question anyone asks about new work

**Measurable target:** the number of scopes needing a first-time audit only ever decreases.

### 3b · Every `align` on framework-born code is a HARNESS defect

Genesis-first will not be perfect. Drift will still appear in scopes the framework itself
produced — and when it does, the important fact is not the drift. It is that **a gate let it
through**.

So `align-feature`, invoked on a scope that was born inside the chain, must produce **two**
outputs, not one:

| | Output | Goes to |
|---|---|---|
| 1 | the fix | the feature |
| 2 | **which stage or gate should have caught this and did not** | the harness |

Output 2 is the one that matters, and it is the one that will be skipped unless it is required,
because fixing the feature feels like finishing and filing a harness defect feels like extra
work. It is the opposite: without it, the same gap keeps manufacturing drift and the framework
keeps paying for alignment it already decided it should not need.

**This makes `align` a measurement instrument.** Counting align runs is noise; counting align
runs **on framework-born scopes** is the framework's own defect rate. It should trend to zero,
and any run that cannot name a responsible gate is itself a finding — it means the drift came
from somewhere nothing is watching.

*(This is the same shape as `audit-feature` §2e — a failing check is evidence about the check.
Here: a needed alignment is evidence about the harness.)*

### 3c · Output 2 goes STRAIGHT into the learning loop — do not build a second one

A harness defect that lands in a report is read once. The framework already has the mechanism
for making it stick, and it is not a new ledger:

```
references/framework-learnings.jsonl        the record
3+ fires, confidence >= 8  ->  rules/       deterministic elevation
evolve-framework / improve-framework        the change
```

**So output 2 is written as a framework learning at the moment it is found**, naming the gate
that failed — not summarised into a paragraph a human is expected to notice and act on later.
The existing three-strikes rule then does the narrowing automatically: one occurrence is a
record, a repeat is a pattern, the third makes the gate itself the thing that changes.

**Why this specifically, and not a new proposal each time:** a proposal is a decision waiting
for attention, and attention is the scarce thing. A learning is a fact that accumulates without
needing any. The framework improves when the *third* identical failure forces a rule — not when
someone remembers three separate reports were related.

**What narrows, concretely:** each elevated rule removes one way for drift to enter. The
possibility space shrinks by construction rather than by vigilance, which is the only kind of
shrinking that survives a tired session or a context reset.

⚠️ **The failure mode to avoid:** filing the learning and calling the align run finished. The
learning is about the *harness*; the feature still needs its fix. Two outputs means two, and
neither substitutes for the other.

## 3d · DERIVE the axes, do not walk them — the enumeration is still hand-made

**Observed 2026-08-02:** a branch index was corrected **eight times** inside a single
`plan-changeset`, each time because an independent reviewer found a missed caller, fallback,
test, or operational proof. The §2h mechanism worked — but reactively, eight times, at reviewer
cost each.

**Cause:** §2g says *"enumerate from a list the machine produces"*, and that is followed for
FILES. It is not followed for AXES. The agent still decides **what to grep for**, and what it
does not think to grep for is exactly what the reviewer later finds. Eight corrections is eight
instances of the same failure, not eight different problems.

**Change: the axes are DERIVED by a script; the agent REVIEWS the derivation.**

| Axis | Mechanically derivable from |
|---|---|
| entry points | route table + registry + exported handlers |
| **callers** | every reference to the symbol across `git ls-files`, minus its own definition |
| **fallbacks** | `catch` blocks, `\|\|` defaults, `?.` chains and `try` wrappers around a call in the set |
| **tests & journeys** | every spec/`.feature.md` referencing a symbol in the set |
| counters | writes and reads of each column named in the data axis |
| promises | user-visible strings in the scope's files, joined to the code beneath them |
| **operational proof** | does a live probe or receipt exist for each claim marked `measured` |

**The agent's job changes from producing the list to falsifying it** — which is a different and
much cheaper cognitive task, and one where being wrong is visible. Deriving is deterministic
and repeatable; walking is neither, which is why a re-walk of the same scope by the same agent
produces a different list.

**Expected effect:** the eight reactive corrections collapse into one deterministic pass plus a
review of it. The §2h reviewer stops being the mechanism that finds missing callers and goes
back to its real job — finding what the *derivation itself* cannot see.

### Derivation produces CANDIDATES. Analysis decides which are IN. Neither alone works.

Read alone, the table above says "run the script, done". That is wrong, and it is the failure
mode that produced the runaway:

| | Alone | Fails by |
|---|---|---|
| **mechanical** | grep everything that references the symbol | pulling in `Settings.jsx` because it shares `PhotoUpload` — **exhaustive and undiscriminating** |
| **analytical** | judge what belongs | missing what nobody thought to look for — **discriminating and incomplete** |

**The order is not optional.** Mechanical FIRST, so nothing is forgotten. Analytical SECOND, so
nothing irrelevant is absorbed. Reverse them and you are back to walking.

The analytical step is the impact question from `audit-feature` §2h0 — *would a change there
alter this scope's behaviour, counters or promises?* — and it is **not greppable**. No pattern
distinguishes "uses the same component" from "this scope depends on it".

### 🔴 And the exclusion must be WRITTEN DOWN — this is the convergence mechanism

A candidate that was considered and excluded, with no record, is **indistinguishable from one
that was never seen**. So the next reviewer finds it, argues it from zero, and the round count
climbs — which is exactly what happened: `Settings.jsx` was re-discovered and re-argued across
successive passes because nobody had written *"considered, excluded, the sample flow does not
route through it."*

So the derivation output has **three** buckets, all recorded:

| | |
|---|---|
| **IN** | with the dependency argument — what breaks here if it changes |
| **OUT** | with the exclusion reason — **this is the one that gets skipped, and skipping it is what costs the rounds** |
| **FILED** | out of scope but a real defect → `out-of-scope-findings.md`, with its owning scope |

**Convergence comes from the OUT list, not from the IN list.** A second pass over a scope whose
exclusions are written down can only find genuinely new things; a second pass without them
re-derives the same arguments forever.

⚠️ **What this still does not fix:** an axis nobody thought to derive. Derivation removes the
"forgot to grep" class entirely; it cannot invent an eleventh axis. That remains the reviewer's
job and is precisely why §2h stays.

## 4 · The review loop is inverted, and it is the single biggest waste

**Observed:** during AC alignment the same scope and diff went to the external reviewer roughly
**thirty times** — findings returned, corrections made, sent out again, for substantially the
same thing.

**Cause:** the executor's own review is not run *to exhaustion* first. `review-exec` P1
(self-review) is a single pass before P3 (external), and after an external round the corrections
go **straight back out** with no local pass in between.

**Change — TWO loops, both to exhaustion, in order, never interleaved:**

| | Loop | Runs until | Cost |
|---|---|---|---|
| 1 | the executor's **own** adversarial pass | **two consecutive passes surface nothing new** | cheap |
| 2 | the **external** reviewer | **it returns nothing new** | expensive — which is why it is second |

Loop 2 is the **final** phase. There is no third.

1. **Drain loop 1 before loop 2 begins.** Escalating first — or escalating after every single
   correction — is what produced ~30 external calls on one scope.
2. **After every external round, self-review the corrections before going out again.** An
   external reviewer must never be the one to discover that a fix introduced a new defect at
   the same level it just reported.
2b. **Both loops terminate because of the OUT list, not willpower.** A reviewer that cannot
   re-litigate settled exclusions runs out of genuinely new things fast; one that can re-argues
   the same candidates forever. That is the difference between converging in two rounds and the
   eight that produced §3d.
3. **Escalate on residual severity, not on iteration count.** Stop when the external pass
   returns nothing above the agreed threshold — not after N rounds.
4. **Record the round count.** A scope needing many external rounds is telling you the
   **self-review prompt is weak**, not that the code is hard. That is a framework signal and
   today nobody collects it.

**Expected effect:** most of those thirty calls collapse into one or two, and the ones left are
the ones a different vendor was genuinely needed for.

⚠️ **What this must not become:** self-review replacing external review. Self-review is checked
*by* the external pass and never substitutes for it (`align-feature` §4d). This changes **when**
the external pass is called, not **whether**.

## 4b · Verifications have a COST CLASS — measured, not guessed

*(Added 2026-08-02 from the session audit. Measured on this repo, not estimated.)*

| | Measured cost | Correct cadence |
|---|---:|---|
| the scope contracts | **~0.9 s combined** (408 + 458 + 69 ms) | **every stage** — free, catches drift instantly |
| e2e, scoped to the group's mapped specs | minutes | **once per landable group** |
| the full e2e suite (**250** specs) | long | **once at closure**, before STORY ALIGNED |

The chain today does not distinguish them, so an executor either re-runs everything (slow) or
runs nothing until the end (late). Both are wrong, and the framework offers no third option —
which is why the founder's instruction had to be *"run tests at the end, not a hundred times"*
instead of a table lookup.

**Change:** every verification carries a cost class — `cheap` / `scoped` / `full` — in the stage
table. Cadence becomes a lookup, not a judgement.

**Zero quality loss:** the full suite still runs before closure. What disappears is running 250
specs to validate a documentation stage.

## 4c · An authorisation ENVELOPE, declared once

Counted in `~/.codex/history.jsonl` for these runs: **35× "yes" · 24× "ok" · 11× "Implement the
plan." · 9× "continue" · 4× "so what is next"** — roughly **83 turns whose entire content is
"proceed"**, each a context switch for the founder and a full turn for the agent.

The cause is structural: authorisation is requested per **step**, and the framework has no way
to grant it per **envelope**. Every prompt in that session had to hand-write the envelope in
prose.

**Change:** a run declares its envelope up front and the executor stops only outside it:

```
staging: auto · prod: auto · live-payment: ask · landing-edit: ask · secrets: ask
```

**Zero quality loss:** the gates that matter still stop. What disappears is asking permission to
continue doing the thing already agreed.

## 4d · `lane-tasks` belongs to the repo, not the worktree

`.svc/lane-tasks-WI-SAMPLE-ECONOMY-01.json` exists **only** inside its worktree; the canonical
`.svc/` holds 48 other lane-task files and not that one. So stream progress is invisible from
the repo, and a worktree cleanup takes the task graph with it — which is what happened to the
Lightning stream.

**Change:** lane-tasks are written to the canonical repo path. They are **coordination state**,
not build output.

## 4e · The skills must LIVE in the framework, not in one product repo

`audit-feature`, `align-feature` and `decide` exist in exactly two places:
`example-marketplace/.claude/skills/` and `~/.codex/skills/`. Neither is the framework. **Open a new
repo tomorrow and none of this exists there.**

Worse than absent: the two copies are **byte-identical today and will not be tomorrow**, and
nothing will say which is correct. A skill duplicated across hosts is a skill that will silently
fork — the same class as the e2e pattern living in four places, which this repo already
documents as a bug source.

**Change:**

- promote all three into the framework repo as first-class skills
- `example-marketplace` and `~/.codex/skills/` **reference** them, never hold copies
- `scripts/lib/branch-index-freshness.mjs` is reachable install-relative — never vendored, never
  absolute-pathed (§4 Stage discipline already says this for validators; it applies here too)

*(Filed 2026-08-02 after being written only into a hand-authored prompt. That is the failure
mode this proposal exists to remove: a rule that lives in a chat message is a rule that does not
exist. It happened twice more the same day — the validator-location rule the founder had stated
twice in conversation, and the founder's own corrections to the review loop. All three are now
in files.)*

## 4f · DECOUPLE the plan from the index's numbers — do not phase-gate them

### The two territories

The two layers are not two kinds of work. They are **two territories**, and only one of them
costs anything:

| Territory | How it is handled | Cost |
|---|---|---|
| **already in the index** | **read it.** The relations already say what touches what — that is what the index is *for* | ~free |
| **not in the index** | **subagents sweep it in parallel** — grep plus analysis exploration, everything related | the real cost, paid once |

**This is the actual answer to the sixty-four hours.** The sample scope was re-walked eight
times *including the parts already enumerated in the index*. Every rewalk re-derived facts that
were already written down. The index existed and was not being used as memory — it was being
rebuilt.

**The rule: never re-walk what the index already answers.** Read the relations, take the answer,
and spend exploration only on the delta — the paths the index does not yet cover. A rewalk that
re-derives an indexed fact is not thoroughness; it is the index failing at its only job.

**And it is parallel where it should be.** The unindexed sweep fans out cleanly across
subagents — independent greps, independent analysis, no shared judgement. The indexed side needs
no agents at all, because it is a lookup.

### The change: decouple, do not gate

**The manifest pins the index's `Derived-at` SHA — not its counts.**

*(Corrected 2026-08-03 after the founder asked why the number was there in the first place. It
had a real purpose, and "just cite the index" threw it away.)*

**Why the number existed.** The manifest is a **frozen, reviewable artifact**. A reviewer must
be able to check that the plan covers the scope — and if the manifest only says "the paths in
the index", the index may have *moved* since the plan was reviewed. So `253` was an
**attestation**: *at the moment this plan was made, the scope was 253 paths and I checked they
all resolve.* That is the same job `Derived-at` does for the index, and it is legitimate.

**Why a count is the wrong way to do it.** A count says *how many*, never *which*. It goes
stale **silently** — wrong from the moment the index moves until a human notices — and the only
repair is a hand edit. Four such edits happened in one run (`221 → 236 → 240 → 253`), and they
are where the 543 alternations come from.

**A pinned SHA carries the same attestation and does not rot:**

| | count `253` | pinned `Derived-at` |
|---|---|---|
| tells the reviewer what was verified against | a number, not a version | **the exact version** |
| when the index moves | **silently wrong** until edited | still true — it pinned a past state on purpose |
| who repairs it | a human, every time | **a mechanical check**, only when it matters |

**The check that replaces the edit:** *did any file the plan MODIFIES change between the pinned
SHA and the current index?*

- **no** → the plan is still valid. Nothing is touched. This is the overwhelming majority.
- **yes** → the plan needs revalidation, **with a named reason** — not because a counter moved.

So the founder's question improves the fix rather than reversing it: **do not delete the
attestation, replace it with one that cannot go stale silently.** The purpose is served better,
because a SHA identifies *which* index was checked, and `253` never did. It was rewritten
`221 → 236 → 240 → 253 valid paths` as the index moved — which is *why* every index correction
forced a plan edit, and where the 543 alternations come from. Remove the restatement and they
collapse on their own.

**Do NOT gate the planning behind a finished census.** A two-phase gate requires phase A to be
*declared finished* before B starts — but an index is never finished; it carries a freshness
stamp precisely because it decays. Gating reintroduces exactly the behaviour that produced the
eight rewalks: *perfect the map before drawing the route.* And gating **without** decoupling
just moves the thrash across a file boundary.

**Parallelise the unindexed sweep as a TASK, not a PHASE.** It fans out cleanly across
subagents; route-drawing does not. The difference that matters is whether B waits for A to
finish, or simply does not care about A except where A touches a file B modifies (§4a3).

| | |
|---|---|
| two gated phases | ❌ reintroduces "the map must be perfect first" |
| **plan stops restating the index's numbers** | ✅ **this is the fix** |
| parallel sweep of the unindexed | ✅ but as a task, not a gate |

**Why this beats the author's three attempts at the same question.** Map/route sizing (§4a3) is
real but explains *volume*, not days. "Hanging agents" was refuted by the founder — the agent
was long-lived and re-messaged, not idle. "Memory asymmetry" was tested and refuted: 42% of
`send_message` fell within ten minutes after a compaction against a 28% base rate — a weak
slope on 108 observations, not causation. **Interleaving is the explanation that survives**,
because it predicts exactly the symptom that was observed: rewalks happening *inside* the
planning phase rather than before it.

**And A is where parallelism actually pays.** Greps and impact tests fan out cleanly; judgement
does not. Running B's sub-agents in parallel buys little and costs context; running A's in
parallel is the whole point.

Today the artifact set is effectively uniform: QA companion, marketing context, pricing model,
monetisation, compliance. A pre-revenue product with no customers is asked for the same evidence
as a live one — which produces ceremony early and, worse, **gaps late**, because a uniform list
stops being read.

**Change:** the required set is a function of two declared values.

| Phase | Adds |
|---|---|
| pre-revenue, no live users | QA companion · index · receipts |
| live users, no money | + marketing context · analytics · privacy/compliance |
| taking money | + pricing model · monetisation · fee/billing docs · finops |
| scaling | + perf budgets · capacity · incident runbook |

| Type | Adds |
|---|---|
| consumer mobile | device-proof · store metadata · push & permissions |
| marketplace | trust & safety · dispute path · payout compliance |
| B2B SaaS | tenancy isolation · data export · SLA |

Both declared once in the project's own state file; the chain derives the stage set from them. A
**phase transition** (first live user, first payment) **re-opens** the stages the new phase adds
— which is exactly when they are needed and exactly when they are forgotten.

---

## What this proposal does NOT claim

- It does not claim the chain is cheap today. §1 depends on §2 being implemented well; if
  conditional activation is vague, one lane becomes one **slow** lane and it will be bypassed.
- It does not claim self-review finds what a different vendor finds. §4 changes call timing;
  the cross-vendor pass stays mandatory.
- The "thirty calls" figure has **no measurement** behind it beyond the founder's direct
  observation of one session. The mechanism is sound; the magnitude is anecdotal — and §4.4's
  round-count recording is precisely what would make it measurable.

## Order of implementation, if adopted

| | | Why this order |
|---|---|---|
| 1 | **§4** review loop | pure win, no dependencies, largest immediate saving |
| 2 | **§2** conditional stages | prerequisite for §1 |
| 3 | **§1** retire the quick lane | only after §2 makes it survivable |
| 4 | **§3** genesis-first index | structural; changes how features start |
| 5 | **§5** phase/type artifact sets | broadest, most product-specific |

---

## Appendix · THE BASELINE — what these skills contain today

*Attached because the proposal references §2g, §4b, §8 and the rest, and in the framework repo
**those sections do not exist**. A reader there has no baseline, so every reference is a dead
link. Frozen at `example-marketplace` **main `fe16fd22`**, per the freeze rule in `align-feature` §8 —
if main has moved, re-read there and re-stamp this appendix rather than trusting it.*

### `audit-feature` — 377 lines · what IS

| | |
|---|---|
| §2b | two levels of grounding — drift, and the cross-feature finding that needs a written analysis |
| §2c | **C0–C5**, scored by *how* established. **No decision may rest below C3** |
| §2d | "I don't know" is a route — dispatch an expert, or record UNRESOLVED with its owner |
| §2e | a **failing** check is evidence the CHECK is wrong, until proven otherwise |
| §2f | re-run every contract before the report; earlier green proves nothing |
| §2g | **complete branch enumeration** over ten axes; sampling is a failed audit |
| §2g2 | wiring is not calibration — record the **value**, where it is set, deploy-or-not |
| §2h0 | **iterate until dry**, boundary is **impact** not co-occurrence; record IN/OUT/FILED |
| §2h | the reviewer gets the index and is asked what it MISSES — a claim, not a note |
| §2i | one place per scope; every other doc yields with a header |

### `align-feature` — 557 lines · what IS

| | |
|---|---|
| loop 0–3b | index-first hard gate · intent gate · receipts with tracked evidence · aspect sweep |
| §4a | stage order is a **dependency graph**; the load-bearing edges are named |
| §4a2 | **`deferred`** — proof blocked by absent infrastructure; attaches to the **platform** |
| §4b | `implement` is **four** steps; reasoning tier belongs to planning, not execution |
| §4c | an operational change needs a receipt — it leaves no diff |
| §4d | reviewer ladder; every declared rung **closes**; never the main loop |
| §7 | parallel streams — two-tier freshness · device lease · one republisher · shared-surface owner |
| §8 | every review is **two passes**; pass 2 bounded by **relations**; **freeze** the target; two remediation rounds |

### `decide` — 285 lines · what IS

| | |
|---|---|
| §0–2 | founder's language · **the defect filter** · priority by consequence |
| §3–4 | options as outcomes incl. the one not recommended · world practice, cited |
| §5 | grounding — fact score and recommendation score kept **separate** |
| §5b–5d | the analysis is **linked, not restated** · the decision carries `Grounded-at` + `Would-lower-this` · say what you did NOT check |
| §6–9 | the scene is a person · answerable in one word · walkable flow · **GRILL** after signing |
| §10 | record it — and **emit the pipeline receipt before writing the card** |

### What the proposal changes, against that baseline

| Proposal | Touches |
|---|---|
| §1 no quick lane · §2 conditional stages | the chain around both skills |
| §3 genesis-first · §3b harness defect · §3c learning loop · §3d derive the axes | `audit-feature` §2g/§2h0 |
| §4 review loop · §4b cost classes · §4c authorisation envelope · §4d lane-tasks location | `align-feature` §8 and the receipts chain |
| **§4e promote the skills into the framework** | all three — **and it is the prerequisite for every other item**, because a framework cannot adopt rules that live in one product repo |
| §5 phase/type artifact sets | the stage set itself |

---

## 4g · SINGLE-VENDOR WINDOWS — compensate with MECHANISM, not with more passes

A vendor will periodically be unavailable — quota, outage, cost. On 2026-08-03 one went out for
seven days, leaving one executor and no cross-family reviewer at all. That is not an incident;
it is a recurring operating mode and it needs a decided answer.

**What actually degrades.** §4d's rung 1 — the *other* vendor — simply does not exist. Rung 2,
the own-vendor subagent, is a real review but **shares the executor's priors**, which is exactly
what rung 1 was buying. The cost is concrete: the single most valuable catch of 2026-08-02 was
an **arithmetic error inside a signed decision card**, found by the other vendor and by nothing
else. Ten more same-family passes would not have found it — the error lived in an assumption
all of them shared.

**The wrong compensation is more passes.** Same-family review has a **floor** set by shared
priors; repeating it approaches that floor and stops. It feels like diligence and buys almost
nothing.

**The right compensation is weight on checks that hold no priors at all:**

| Substitute | Why it is genuinely independent |
|---|---|
| **mechanical derivation** (§3d) | a grep has no assumptions. It cannot share a blind spot, because it holds no beliefs |
| **a contract claim** (`audit-*-contract.mjs`) | re-derives a fact from source on every run; it does not remember agreeing with you |
| **the negative test** | break the check deliberately and require it to fail. **Three checks passed while broken** on 2026-07-31, and only the negative test exposed them |
| **the written OUT list** (§2h0) | an exclusion with a stated reason can be attacked later — even by its own author, who by then has forgotten the argument |

**The rule: in a single-vendor window, every claim that would have gone to cross-family review
must instead acquire a mechanical check, or be recorded as UNVERIFIED with the reason.** Never
silently downgraded to a same-family pass and marked reviewed.

**And it self-terminates.** `review_family: "same"` is already recorded per review (§4d), so
when the second vendor returns **that field is the queue** of what deserves a real cross-family
look — no separate ledger, nothing to remember. The window ends when the queue is drained, not
when the quota resets.

---

## 3e · COMPUTE the graph, store it, update it incrementally

*The founder's requirement: reduce burnt tokens and context rediscovery, manage/onboard relations
properly, and drop no quality. This is the mechanism that does all three, and the parts that are
certain are separated from the parts that are estimated.*

### The mistake, stated precisely

A branch index is a **transitive closure over a graph** — files as vertices, imports and calls as
edges — plus semantic annotations. We compute it by having an LLM grep and reason about each hit.

**That is approximating graph traversal with natural language.** It works, and it is the wrong
instrument for the structural half: non-deterministic (two walks of one scope produce different
lists — observed), priced per token, and re-run from scratch every time.

### The split

| Axes | Nature | Right instrument |
|---|---|---|
| entry points · callers · data · journeys & tests | **pure structure** | a parser (`ts-morph` / `tree-sitter`) — exact, milliseconds |
| auth · state · counters | structure + naming | parser finds them, LLM says what they mean |
| **promises · outcomes** | **pure semantics** | LLM — genuinely irreplaceable here |

### What is CERTAIN (properties, not hypotheses)

1. **Reachability is computable.** "Would a change here alter this scope?" is a question about a
   **path in a graph**. `Settings.jsx` had no path to any sample entry point — a graph answers that
   in milliseconds. It instead consumed **eight rounds of argument**.
2. **Incremental beats recomputation, by construction.** The index carries `Derived-at`. A diff
   touches N files; the correct update recomputes only the subgraph reachable from those N. Cost
   `O(changed × fanout)`, not `O(repo)`. Today we pay the second — hence eight full rewalks.
3. **A computed graph is immune to compaction.** This is the direct answer to **107 context
   compactions in 64 hours**: the graph is rediscovered because it lives in the conversation. On
   disk, a compaction cannot lose it — it is re-read, not re-derived.
4. **Determinism removes a whole defect class.** Same input, same graph, every time. The
   "different list on re-walk" problem disappears rather than being managed.

### What is ESTIMATED — labelled, not smuggled

- **"~70% of the volume becomes mechanical"** is a judgement from the axis split, not a
  measurement. The honest version: *four of ten axes are pure structure and three more are
  structure-plus-naming.*
- **Time and token savings** follow from that estimate and inherit its uncertainty.

### The known hole, named up front

**String-dispatch breaks a naive import graph.** This codebase routes through
`registry.gen.ts`, mapping string slugs to imports — so a pure import-graph misses every
caller edge that goes through slug lookup. The parser must ingest the registry as an **edge
source**, and any other dynamic-dispatch table with it. Miss this and the graph is confidently
incomplete, which is worse than an honest LLM walk.

### Why quality does not drop

The LLM keeps **every** semantic judgement — promises, what a counter means, whether a claim is
true, the impact call where reachability is ambiguous. What it stops doing is **traversing a
graph in prose**, which is the part it does worst, most expensively, and non-reproducibly.

### Onboarding a new scope becomes a build step

Today: an agent explores for hours. Then: parse → graph → the structural axes are **generated**,
and the LLM annotates the semantic residue. The index stops being something an agent *discovers*
and becomes something the repo *computes*, with the agent supplying meaning.

---

## 3f · §3e MEASURED — what the graph actually delivered, and what it did not

§3e above was written as an argument. On **2026-08-03** it was run. Two of its claims hold,
one is refuted, and the refuted one was the load-bearing one. Every number below came from a
command, not from reasoning.

### The tool question is settled, and not the way the market suggests

| Candidate | Verdict |
|---|---|
| **GitNexus** (44,978★) | ❌ **PolyForm Noncommercial 1.0.0.** Permitted purposes are noncommercial, personal-without-anticipated-commercial-application, and charity/education/government. A for-profit EOOD shipping a paid product is none of them. The best-tooled option is legally unavailable. |
| **codebase-memory-mcp** (37,272★, MIT) | ⚠️ created 2026-02-24, 403 open issues, `v0.9.1-rc.1`. |
| **`win4r/codebase-memory-mcp-pro`** (the fork that fixes the incremental-reindex CALLS-edge bug) | ❌ last push **2026-07-05** against a daily-moving upstream, **zero releases**, 8 contributors. Dead end. |
| **CodeGraphContext** (4,039★, MIT) | steady, weakest on impact/diff. |
| **`dependency-cruiser`** (7,018★, MIT, since 2016) | ✅ **used, worked, no adoption required.** |

Star inflation was suspected and **tested**: ★/fork ratios are 9.0 / 12.6 / 5.0 against
`facebook/react` at 4.8. The engagement is real; the churn is what looks alarming.

### CONFIRMED — the graph is computable and the Deno fear was overstated

```
dependency-cruiser 18.1.1, two runs, no adoption
  src/**                    447 modules,  0 resolve errors
  supabase/functions/**/*.ts 463 modules,  7 distinct unresolved imports
```

All seven unresolved are third-party Deno URLs (`esm.sh/@supabase/supabase-js`,
`deno.land/std/http/server`, testing asserts). **The internal graph resolves completely.** The
elaborate `deno_graph` architecture other analyses recommend solves a problem this repo does
not have: 1 `jsr:` import, 0 `npm:` imports.

⚠️ Two operational traps, both cost real time: `dependency-cruiser` cruises **0 modules when
given a bare directory** — pass a glob (`"supabase/functions/**/*.ts"`) or a file. And
`jsconfig.json` has `include: [src/components, src/pages, src/Layout.jsx]`, so passing it as
`tsConfig` silently scopes the whole run to the frontend.

### REFUTED — transitive closure is NOT a usable invalidation set

The §3e plan was: invalidate a claim when anything in its reachable set changes. Measured
against the sample index (115 cited names → 229 resolved roots):

| depth | reached | hidden (in closure, uncited) |
|---|---:|---:|
| 1 | 450 | **221** |
| 2 | 554 | 325 |
| 4 | 584 | 355 |

**It explodes on the first hop.** The cause is structural, not fixable by tuning: a React app
where every page pulls the shared UI kit. `SampleProgram.jsx` → `AuthModal` → `CookieConsentBanner`
and you are across half the codebase. A change to `AnimatedCounter.jsx` cannot falsify
*"`process-sample-activation` awards 50 points"*, yet the closure includes it.

Going 1045 scope-files → 355 closure-files is not a win. It is less noise of the same kind.

### The false-red problem was already solved — and the measurement proves it

`scripts/lib/branch-index-freshness.mjs` already implements two-tier freshness: **HARD fail**
when a *cited* file changes, **SOFT warn** when an in-scope uncited file changes. Live check on
the sample index:

```
scope (Scope-paths globs)        1045 files
cited by the index                115 names
changed since Derived-at           43
  of those, in scope                1   ← CLAUDE.md
  of those, cited                    0
contract                          26/26 GREEN — correctly
```

Without two-tier, editing `CLAUDE.md` would have triggered a full re-walk of a scope it cannot
affect. That is exactly the `supabase/config.toml` failure that reddened the owner index,
already closed. **No tool needed to be bought for this.**

### The real remaining hole is FALSE GREEN, and it is narrow

What nothing currently catches: a cited file **gains a new import** the claim never considered.
The claim silently becomes wrong while the check stays green — worse than a false red, because
it is silent.

The fix is not expansion, it is **shape comparison**: at stamp time, record the *direct* import
set of each cited file; at check time, compare. Small set (229 files), rare signal, and it is
precisely the case that currently passes unnoticed. Estimated cost: a day inside
`branch-index-freshness.mjs`. No graph database, no MCP server, no new dependency at runtime.

### Correction to §3e's estimate

§3e labelled *"~70% of volume becomes mechanical"* as an estimate. The measurement narrows it:
**three axes** (entry points · callers · dead branches) are genuinely computed, and
`dependency-cruiser` produced 49 candidate orphan modules in one run. But the raw output
**lies** — `ProtectedRoute.jsx` and `entities.js` appear dead because dynamic `import()` and
route registries are invisible to a static import graph. This is §3e's own "known hole",
confirmed empirically.

So the honest split is: **the graph produces candidates, never verdicts.** Adopt the
provenance discipline the code-intelligence literature already uses —
`exact` (compiler/LSP) · `inferred` (tree-sitter/heuristic) · `dynamic` (observed) ·
`llm-derived` (never authoritative) — which is our C5→C0 scale applied to *edges* instead of
*claims*. Those 49 orphans enter at `inferred`, and nothing at `inferred` may close a branch.

### What this section changes in the proposal

1. **Drop** "closure as the invalidation set." Measured, refuted, do not build it.
2. **Keep** the graph for three structural axes, as a **candidate generator** at `inferred`.
3. **Add** direct-import shape comparison to `branch-index-freshness.mjs` — the one real hole.
4. **Buy nothing.** `dependency-cruiser` (MIT, 2016) run on demand covers it; the MCP
   knowledge-graph servers are either license-blocked or too young to carry invalidation.
5. **Keep the seven semantic axes with the LLM.** No extractor emits the edge
   *"this promises the user 10 points"*, and that is where the hours actually went.

---

## 3g · FOUR DEFECTS THE SAME DAY FOUND, ALL OF THE SAME SHAPE

2026-08-03 produced four separate failures. Each was caught, each is real, and all four share
one root: **a check that reads the wrong thing and reports green.**

### 1 · A check whose denominator is the local worktree, for a GLOBAL namespace

The sample plan's §9 simulation stated:

> *"Migration targets — no planned `20260803xxxxxx` filenames exist; allocation is free **in this
> worktree**"* → **PASS**

Live query the same day: staging's `max(version)` was **already `20260803010000`**, and
`20260803010000` + `20260803020000` existed in three sibling worktrees. A migration version is
globally ordered; the check asked a local question and returned a global-sounding answer.

**Rule:** a check must state its denominator, and a check scoped to one worktree may never
ratify a claim about a namespace shared with live environments or sibling branches.

### 2 · An external-state walk that read the REPO instead of the external system

The same plan walked all 15 external-state entries and returned PASS. It missed that **staging
and prod had diverged** — staging `max(version) 20260803010000` (n=190) vs prod
`20260760000280` (n=189) — because the walk enumerated repo files rather than querying the two
databases. The divergence came from an **unmerged** branch, so no amount of repo reading could
have found it.

**Rule:** "external state" means state held by an external system. Its evidence is a response
from that system, not a file in this repository.

### 3 · A handover that asserted absence of actions that had already happened

A parallel session's handover stated *"No G1 implementation commit, push, PR, deployment,
migration, ADB action, or runtime proof has occurred."* Measured: `5bd0c7b1` is a 38-file
implementation commit on three branches, one of them pushed to `origin`, and its migration was
**live on staging** — function, trigger and unique index all present.

**Rule:** a handover may not assert the absence of an action it did not check for. "No
deployment occurred" is a claim about the deployed system and requires probing it. A handover
is read as ground truth by whoever resumes; an unchecked negative is the most expensive
sentence in it.

### 4 · A guard that reads FILE PRESENCE as evidence of work

The completion guard blocked on `lane-tasks-WI-SAMPLE-ECONOMY-01.json` being present in a
worktree that had touched no sample code. The file is present because it is **tracked in git**,
so all four worktrees carry a copy:

```
.                                       lane-tasks: 1
.worktrees/framework-proposal           lane-tasks: 1   ← touched no sample code
.worktrees/codex-sample-econ             lane-tasks: 1
.worktrees/lightning-migration-extract  lane-tasks: 1
```

**Rule:** presence of a tracked file is an artifact of version control, never a signal about
work. A guard keyed on it fires on every worktree and teaches the operator to dismiss it —
which is worse than not having the guard. Either the lane-tasks file becomes ignored and
single-homed, or the guard must key on commits touching the WI's scope.

### And one that is not a check at all — scope creep with a deploy in the middle

The sample-economy WI had grown to contain three unrelated programmes. Its first schema task,
`DB-01`, depended on `T0-LIVE-01` — **a production deploy**. No feature code could be written
until someone had deployed to prod.

**Rule:** if a task graph's first feature task transitively depends on a live deployment, the
graph is wrong. Deploying is not an executor task; it happens after merge, deliberately, by a
human. Add this to the plan-review mechanical checks — it is a one-line graph query, and it
would have caught this before the plan was ever reviewed.

### Why these belong together

None of the four was found by a passing check. All four were found by **reading the thing the
check was standing in for** — the live database, the deployed endpoint, the actual commit. That
is the same discipline §2e already states for a *failing* check ("a failing check is evidence
the CHECK is wrong until proven otherwise"), applied to the far more dangerous case:

> **A passing check is evidence about the check, not about the world.** Before a green result
> closes a claim, name what the check actually read — and whether that is the thing the claim
> is about.
