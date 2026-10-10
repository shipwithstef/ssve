## 4a3 · 🔴 THE INDEX IS THE MAP. THE PLAN IS THE ROUTE. Do not size one by the other.

**Measured on a real run, 2026-08-03:**

| | |
|---|---:|
| scope paths enumerated | **254** |
| UI rows specified | **140** |
| acceptance criteria | **373** |
| **files the plan actually modifies** | **37** |
| changed so far | 18 files, 371 lines |

**A 7:1 map-to-route ratio, and ~21 hours before the first product line.** Nothing was wrong
with any individual step. The plan inherited the **audit's denominator**.

§2g demands complete enumeration — correct for an *audit*, because you cannot know what is
broken without looking at everything. Nothing said the **plan** is sized to the **change**. So
254 paths became the working set, 140 UI rows became 140 spec rows, and 373 ACs became 373
things needing evidence — to modify 37 files.

**The rule:**

| | Sized by | Used for |
|---|---|---|
| **the index** | the whole scope | checking **impact** — what else does this touch |
| **the plan** | what **changes** | the work — one task per modified surface |
| **the ACs** | the **changed** surfaces | not one per row that merely exists |

**And the corollary that saves the most time: an index correction does NOT invalidate the
plan** unless it touches a file the plan modifies. Coupling them is why eight index rewalks
happened *inside* `plan-changeset` — the plan was waiting for the map to become perfect before
drawing the route, so every reviewer finding forced a re-plan. Decoupled, a new path is checked
for impact in seconds and the plan moves on.

**Symptom to watch for:** a task count that tracks the scope size rather than the diff size. If
the plan has a task for something the change does not touch, the plan is describing the
territory instead of the journey.

## 4b · 🔴 `implement` IS FOUR STEPS — and nothing mechanical catches you skipping two

| | Step | Owning skill | Produces |
|---|---|---|---|
| 1 | **plan** | `plan-changeset` | manifest + task graph. **Every** screen-spec `UI-<WI>-NN` row maps to a task carrying DONE-conditions generated from that row. When plan-changeset runs INLINE (no §3a blueprints), that checklist **is** the completeness artifact — there is no other |
| 2 | **review the plan** | `review-plan` | adversarial findings **before a line of code**. A wrong plan caught here costs an edit; caught in the diff it costs a rebuild |
| 3 | **execute** | `execute-changeset` | the code |
| 4 | **review the diff** | `review-exec` (G5-enforcing gate) | the §8 pair — exact + full |

### Model tier belongs to the PLANNING, not the execution

The four steps do not need the same reasoning tier, and paying for one tier across all four is
the largest avoidable cost in the chain.

| Step | Tier | Why |
|---|---|---|
| 1 · plan | **high** | judgement: what changes, in what order, with which DONE-conditions |
| 2 · review-plan | **high** | adversarial — must find what the plan omits |
| 3 · **execute** | **cheap model, MAX effort** | mechanical transcription of a plan that already decided everything |
| 4 · review-exec | **high** | adversarial, and the §8 pair |

Concretely, when Codex is the executor: `gpt-5.6-luna` at max effort for step 3,
`gpt-5.6-sol high` for 1, 2 and 4. Declare it, do not inherit it.

**This is why the full plan exists.** A plan that is complete enough to hand to a cheaper model
is a plan that specified the work; a plan that requires the expensive model to *interpret* it
at execution time did not.

**So it is also a free quality signal, and the more valuable half:** if execution keeps needing
judgement — the cheap model stalls, guesses, or asks — **the plan was under-specified**. Do not
respond by raising the execution tier; that hides the defect and pays for it forever. Fix the
plan, and record it, because a plan that cannot be executed mechanically will also be a plan
nobody can verify was executed completely.

**Steps 1 and 2 are the ones that get dropped**, because a plan feels like overhead next to
code and because — stated plainly so nobody discovers it the hard way — **the validator does
not check plans.** Skip them and the chain still runs, the receipts still go green, and the
UI-row → task → DONE-condition mapping simply never exists. That is not hypothetical: the
Surface ③ omission began at plan time and **no reviewer owned it**.

**So the receipt carries the proof.** The `implement` stage's evidence MUST include:

- the **plan manifest** path, and
- the **`review-plan`** artifact path

Both are repo-local, so they ride the existing evidence preflight
(`git ls-files --error-unmatch` before the receipt is written, §3). An `implement` receipt
citing only code has not done step 1 or 2, and says so by omission.

*(2026-08-02: an executor's 7-item plan for a 126-UI-row story listed "implementation and
migrations" as one line, with neither plan-changeset nor review-plan anywhere. The founder
caught it by reading the plan. This section exists so the next one is caught by the skill.)*

## 4d · REVIEWER LADDER — a declared list, and every rung on it CLOSES

`resolve-adversarial-reviewer.sh` **performs no availability probe** — the invocation is the
only probe — and `fallback` is null for the Claude and scheduled-Opus profiles. So an exhausted
quota surfaces mid-review with nothing configured to take over.

**Declare the list up front, in priority order.** Two vendors are available in practice; which
one executes and which reviews **flips** depending on whose quota is healthy. That is a normal
operating mode, not a degradation, so the list is a setting — not an emergency.

```
# Executor is Claude:
REVIEWERS=codex-sol-high, claude-opus-5-xhigh@subagent
# Executor is Codex — flipped:
REVIEWERS=claude-opus-5-xhigh, codex-sol-high@subagent

REVIEW_UNAVAILABLE=codex-sol-high:2026-08-02T18:00:00Z   # skip it, no retry, until then
```

**Read the list as "who gets asked, in order".** Entry 1 is always the *other* vendor. Entry 2
is always the **own vendor with `@subagent`** — a separate agent with fresh context, which has
never seen the reasoning that produced the diff and is prompted to break it.

**Every entry is a full tuple — `vendor-model-effort` — and `@subagent` is the execution mode,
not a substitute for naming the model.** "A Claude subagent" is not a specification: Opus at
xhigh and Haiku are both Claude subagents and they are not the same review. The fallback is the
**last line of defence**, so it names the strongest model available, not whatever is cheapest —
and it is **declared, never inherited** from the executor. The receipt records the **resolved
tuple**, not the label.

**`-SUBAGENT` is not self-review, and self-review is not on the list at all.** Self-review is
the *executing session* grading its own work; that is P1, it is checked by P3, and it can never
substitute for P3. The suffix exists because writing the fallback as a bare model name made it
look identical to the executor — which is exactly how a reader concludes "it reviews itself"
and stops trusting the ladder.


| Rung | What it is | Closes the story? |
|---|---|---|
| 1..n | the next **available** entry in `REVIEWERS` | ✅ **yes** |
| last resort | a **same-vendor subagent** — separate agent, fresh context, adversarial prompt | ✅ **yes** |
| none left | stage stays `pending`, reason `reviewer_unavailable` | ❌ no |

**Every rung on the declared list closes the story.** No provisional flag, no debt, no coming
back in three days. A rule that produces unclosable stories is a rule that gets ignored — this
skill has learned that once already, from "a WI draft per confirmed defect" surviving exactly
one real audit.

**`REVIEW_UNAVAILABLE` means skip, not retry.** Before the timestamp: no attempt, no error, no
burnt call. After it: that entry is eligible again, in its declared position.

### The one rule that does not bend

**Never the main loop.** The fallback is always a *separate agent with fresh context and an
adversarial prompt* — never the executing session reviewing its own diff. Self-review is P1 and
is **checked by** P3; a main loop doing both has checked nothing, and `review-exec` already
treats a no-findings self-review on a substantive diff as suspicious.

A same-vendor subagent is a real review: fresh context finds real defects. It shares the
executor's priors, which is what a different vendor would have caught — so **record which ran**,
and let a later audit see the distribution rather than block on it today:

```
review_family: "cross" | "same"
model_attestation.observed_models: [ ... ]   ← the model that actually ran
```

If `observed_models` names no real model, the review did not happen, whatever the prose says.
**Silent substitution is the only unacceptable outcome** — a weaker reviewer, recorded, is a
trade-off; an unrecorded one is a lie in the receipt.

*(2026-08-02: an earlier version of this section made same-vendor review provisional and
non-closing. The founder rejected it, correctly: with two vendors and no intention of waiting
days for a quota, that design produces permanently open stories. Honesty belongs in the record,
not in the blocker.)*

## 7 · PARALLEL STREAMS — what is shared, and what must never be

Two stories running at once is the normal case, not the exception. Most of the chain
parallelises cleanly; **four things do not**, and each has bitten.

### 7a · Freshness is two-tier, so neighbours do not invalidate each other

`branchIndexFresh()` splits changed files by whether the index **cites** them:

| | Meaning | Effect |
|---|---|---|
| **HARD FAIL** | a file the index cites moved | a stated fact may be wrong → re-walk, re-stamp |
| **SOFT WARN** | an in-scope file the index never cites moved | nothing asserted is threatened; re-walk the entry-point axis before claiming completeness. **Never blocking** |

*(2026-07-31: both of this repo's scopes declare `supabase/migrations` and
`supabase/functions` as whole directories. Under the old single-tier check, the moment one
stream landed ANY migration every other scope went STALE — two streams mutually invalidated
each other on every commit and neither could ever print STORY ALIGNED. The mechanism blocked
exactly the parallelism it was built to survive. Measured after the split: at 90 commits of
drift, 54 in-scope changes classify as 8 hard / 46 soft, the soft ones being flash offers,
billing and `MainActivity.java` — genuinely unrelated to the scope.)*

### 7b · The phone is an exclusive lease, and `device-proof` is DEFERRABLE

There is one device. Two agents running `adb` at it concurrently interleave and produce
screenshots attributed to the wrong build — which is worse than no evidence, because it looks
like evidence.

- Take a lease before any `adb` command: `.svc/device-lease.json` — `{holder, wi, expires_at}`,
  30-minute TTL, refreshed while working. **Held by someone else → do not queue and do not
  wait.**
- **`device-proof` is the one stage a stream may pass OVER and return to.** Leave it `pending`,
  continue with every other stage, come back when the lease frees. It still blocks
  STORY ALIGNED at the end — it just does not block the middle.
- The APK output path collides too. Build to a per-stream path, and keep the build id in the
  screenshot filename (the bundle lags the web deploy — an old bundle's screen passed off as
  the new UI is the recurring failure here).

### 7c · One republisher for every canonical twin

The QA companion has one artifact URL and its republish is Claude-only. Two streams editing
`docs/qa/founder-qa-companion.html` produce a merge conflict and a twin reflecting one of them.

- Streams **edit the repo file** (it is canonical) and record the `qa-companion` receipt.
- **Republishing is a handback**: one session publishes the twin once, after both land. A
  stream that republishes mid-flight leaves the page describing a half-shipped product.
- Same rule for any `.sync-requests/` target.

### 7d · Append-only ledgers and migration ranges

- `.svc/*.jsonl` (session contract, pipeline decisions) are append-only and **will** conflict
  on every commit. Give them `merge=union` in `.gitattributes`, or accept a trivial conflict
  and keep both sides — never resolve by taking one.
- **Assign each stream a migration timestamp range up front** (e.g. `20260801xxxxxx` /
  `20260802xxxxxx`). This prevents filename collisions; it does **not** prevent two streams
  writing the same policy on the same table. For that:
- **Declare an owner per shared surface** before starting. A file in both scopes' paths is
  edited by exactly one stream; the other cites the dependency and builds around it. Two
  streams replacing one RLS policy means the later migration silently wins.

### 7e · The handoff prompt must state all of it

A parallel handoff that omits the shared-surface owner, the migration range and the device
rule is not a handoff — it is two agents discovering each other through conflicts.

## 8 · EVERY REVIEW IS TWO PASSES, PAIRED — never the diff alone

`review-exec` and `review-cross-model` both scope to `git diff main..HEAD`, and `review-exec`
says outright that *"reading outside that set is wasted context."* For finding defects in
changed lines that is correct and efficient. It is also **structurally unable** to see:

- what should have changed and did not
- an **unchanged** caller the change just broke
- something already broken before the diff
- how the feature now reads **as a whole**

So a diff-scoped round fixes what is visible in the diff, the fix produces a new diff, the new
diff exposes new surface, and the next round finds that. You are not shrinking a fixed set of
defects — you are **moving a window across one**. Convergence is not guaranteed by
construction, which is why review counts climb into double digits without the feature becoming
demonstrably safer.

**Therefore every review is a pair, run back to back — not diff rounds now and a whole-feature
pass someday:**

| | Pass | Input | The question it answers |
|---|---|---|---|
| **1 · EXACT** | the diff | `git diff main..HEAD` + spec + ACs | *Is what changed correct?* |
| **2 · FULL** | the scope | **`docs/specs/relations/<scope>.branches.md`** + the DECISION card | *Given this change, what in the scope is now wrong, missing, or contradicting?* |

### Pass 2 is bounded by RELATIONS, not by the scope — this is what stops 300 rounds

Handing pass 2 "the whole scope" every round is how review counts explode: each round re-reads
everything, re-finds settled things, and the executor learns to skim. Handing it only the diff
is pass 1 again.

**The surface is the diff plus its relation-neighbours, derived from the index:**

for every changed file, follow the index's edges —

| Edge | The question it forces |
|---|---|
| **callers** | who invokes this, and does the change break them |
| **counters** | which balance/quota/price this touches, and who else reads it |
| **promises** | which user-visible string cites this behaviour, and is it still true |
| **journeys & tests** | which scenario claims to cover this, and does it still |
| **data** | which table/column, and who else writes or reads it |
| **auth** | which gate protects this, and is it still the right one |

That set — and nothing beyond it — is the review surface for the round.

**Bounded** because it is the neighbours, not the universe. **Complete** because the
neighbours come from an enumeration rather than from what the reviewer thought to look at, so
absence is still detectable inside it. Both properties come from the same place, which is why
the index is the input and a file list is not.

**The same scoping applies to the SELF-review** — every pass, not only the external one. A
self-review that reads only the diff is blind to exactly what pass 2 exists to find, so it
escalates things it should have caught, and the external reviewer spends its round on them.
That is the other half of why counts reach thirty: not only *when* the external pass is called,
but that it is called on work the local pass could not see.

Pass 2 is **not** pass 1 with a bigger diff. It is handed the **enumeration**, and its job is
absence: walk the ten axes and name the branches the change should have touched and did not,
the promises it has just made untrue, the counters it desynchronised, the journeys that no
longer cover it.

**🔴 FREEZE THE TARGET BEFORE ANY EXTERNAL PASS.** The reviewer reviews a **named SHA**, and
that SHA does not move while the review runs. An artifact that changes between reviews makes
every reviewer see something different, so each one "finds" things that are merely *new* — and
the round count climbs with no defect behind it. That is precisely what turned a scout index
into eight rewalks: it was corrected between passes, so no two reviewers ever looked at the
same object.

Remediation therefore has a shape: **freeze → review → remediate → re-freeze → review.** Never
remediate *during* a review, and never send a reviewer an artifact whose hash you are still
changing.

**And bound it: two remediation rounds.** If a third would be needed, stop and report — a
candidate that cannot survive two rounds is telling you the *plan* was wrong, not that the code
needs another pass, and grinding it out hides that.

**Both passes loop until dry, in order — pass 1 fully, then pass 2 fully.** Pass 1 is your own
and cheap: repeat it until two consecutive runs surface nothing new. Only then pass 2, and it
too runs until it returns nothing new — that is the final phase, there is no third. Escalating
before pass 1 is drained, or re-escalating after every correction, is what turns a review into
thirty calls. **Record what you considered and rejected**, or the next round re-argues it.

**Pair them immediately.** A full pass deferred to the end delivers its findings after every
diff round is already spent — the most expensive possible moment to learn a whole branch was
missed. Paired, absence surfaces in round one.

**Recording** — the artifact carries both, with both stamps, so a pass-1-only review cannot be
mistaken for a review:

```
Reviewed-diff-at:  <sha of the diff reviewed>
Reviewed-index-at: <Derived-at sha of the branch index>
## Pass 1 — exact (diff)
## Pass 2 — full (scope): what the change did NOT touch and should have
```

A review artifact with no `## Pass 2` section has not reviewed the feature. It has reviewed an
edit.
