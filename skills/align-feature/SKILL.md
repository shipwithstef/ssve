---
name: align-feature
version: "1.0"
inputs:
  required:
    - { path: "docs/specs/receipts/<WI>.receipts.json", artifact: story-receipts }
  optional:
    - { path: "docs/specs/relations/<scope>.branches.md", artifact: branch-index }
outputs:
  produces:
    - { path: "docs/specs/receipts/<WI>.receipts.json", artifact: story-receipts }
    - { path: "docs/specs/design-conformance/<WI>.md", artifact: design-conformance-report }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
description: >-
  Execute the story-receipts chain for one WI until the validator prints STORY ALIGNED —
  the fixing counterpart of /audit-feature. Walks every required stage in order (personas →
  validate/intent card → spec → skills/design-ux/ui/device → journeys → ac → implement → e2e →
  test-run → spec-sync → visuals → qa-companion → ledger → marketing → pricing), each through
  its owning skill, recording a tracked receipt per stage. Use when the founder says "align
  <feature>", "оправи <feature> по веригата", "continue the chain for WI-X", "fix it the
  receipted way", or after /audit-feature produced a receipts file.
---

# Align Feature — execute the chain until STORY ALIGNED

**Announce at start:** "Aligning <WI> through the receipts chain — resuming at the first
unreceipted required stage."

## What this skill is

The conductor for `references/story-receipts.md` (the svc-canonical stage contract, backed by
`references/stage-registry.json`). It does NOT re-implement any
stage's logic — each stage runs through its owning skill (the table in story-receipts.md is
authoritative). This skill only: orders, gates, records receipts, and refuses shortcuts.
If this file and story-receipts.md disagree, story-receipts.md wins.

## Execution loop

0. 🔴 **READ THE BRANCH INDEX FIRST — it is the scope's authority (audit-feature §2g/2i).**
   `docs/specs/relations/<scope>.branches.md` is the single entry point: every entry point,
   caller, auth path, state, counter, promise, outcome, data table, journey/test and
   retry/concurrency boundary, plus every **dead** branch. **Do not start from a WI, a plan or
   a brief** — those are actionable selections, and each carries a `Scope-note` saying the
   index wins on disagreement.

   **Hard gate — the same three claims the audit answers to:**

   | Check | Meaning if it fails |
   |---|---|
   | index missing | the scope was never enumerated → **stop, run `/audit-feature`** |
   | `branchIndexFresh()` FAIL | in-scope code moved since `Derived-at` → the index is stale, **re-walk before building** |
   | `branchIndexReviewed()` FAIL | nobody was asked what the index MISSES → **the enumeration is unverified** |

   Run the scope's `audit-*-contract.mjs` before the first edit and paste the tail. Building on
   a stale or unreviewed index is the failure this whole mechanism exists to prevent: at the
   time of writing this repo held 1,392 docs under `docs/specs` of which **six** carried any
   freshness stamp, and one session produced five confidently-wrong claims about facts that
   were already in the repo.

   **And when the story changes in-scope code, the index goes stale — by design.** Re-walk the
   affected axes and re-stamp `Derived-at` **before** the closing PR, or the contract fails and
   the story cannot print STORY ALIGNED.

1. **Resolve** the story: `docs/specs/receipts/<WI>.receipts.json` (create from TEMPLATE if
   the WI exists but has no receipts). Read the WI doc + **the branch index** + any DECISION card.
2. **The intent gate (hard):** the DECISION card must follow
   `docs/specs/process/DECISION-CARD-FORMAT.md` — decisions walked ONE AT A TIME,
   story-first, outcomes-as-options, per-decision signatures; and stages AFTER `validate` may not start unless
   `docs/specs/decisions/<scope>/DECISION.md` exists with an explicit founder-signed status
   line (e.g. `Status: SIGNED <date>`). Missing/unsigned → stop and **present it through the `decide` skill** (one at a
   time, defects filtered out first, confidence per recommendation), then wait. (Fragmented features may never skip this — the quiet-hours
   rule.)
3. **Loop** until done: find the FIRST required stage with status `pending` →
   announce the stage and its owning skill → produce the artifact through that skill's
   process → commit it → **evidence-tracked preflight: `git ls-files --error-unmatch`
   every repo-local evidence path BEFORE writing the receipt** (a green commit proves
   nothing when a blanket gitignore skipped the file — three instances on 2026-07-29;
   `https://` and `commit:` evidence ride the validator's own checks instead) → **run the
   ASPECT SWEEP over the item just produced (story-receipts.md Mechanics 10)** → set the receipt
   `done` with evidence paths → run
   `node scripts/audit-story-receipts.mjs <file> --wip` → **show the FULL matrix (all
   stages, never abridged)** → continue.
3b. **The aspect sweep (every stage, no exceptions).** The chain is NOT a relay of narrow
   lenses — four separate misses in one 2026-07-31 session each fell BETWEEN stages that all
   did their own job correctly. Whatever the stage just produced, examine THAT item across:
   **Money** (does it change what anyone pays or what it costs us) · **Avoidance** (what does
   a rational person do to route around it, and what does that cost them versus complying —
   deliberately *not* "abuse": STRIDE models attackers, and the customer opening fifteen
   accounts to duck a plan limit is not attacking anything) · **Promise** (what does it claim
   publicly, and is that true) · **Existing** (what happens to rows/customers/state already
   there) · **Neighbours** (what else touches it and now disagrees).
   **Above all five: answer at the SOURCE** — the primary page, the rendered pixel, the live
   database; never a summary, a score, or the page adjacent to the one that answers. Each
   aspect gets a citation, a number, or an N/A **carrying its reason**; all-prose aspects mean
   the sweep was not run. Scope it to the item, not the universe.

3c. **Framework-born scope: two mandatory outputs.** When the scope being aligned is the svc
   framework itself (not a downstream product) — a skill, hook, validator or script under this
   repo — every align run emits TWO outputs, not one: **(1) the fix** (the normal stage
   artifact) and **(2) the failed-gate finding** — which existing gate should have caught this
   defect before align had to fix it, and why it didn't. A run that cannot name a responsible
   gate is itself a finding: an unowned miss is worse than a named gate that under-caught.

   Mechanically: append one row to `references/framework-learnings.jsonl` for the fix and one
   row for the failed-gate finding, matching the file's existing per-row field shape exactly
   (`key`/`type`/`confidence`/`insight`/`files`/`wi`/`ts`), e.g.:

   ```json
   {"key":"<gate-name>-miss","type":"harness-defect","confidence":7,"insight":"<what the gate should have caught and did not>","files":["<gate-source-file>"],"wi":"<WI-id>","ts":"<YYYY-MM-DD>"}
   ```

   **Confidence must be ≥7, never lower.** `rules/learning-preload.md` only surfaces rows via
   `select(.confidence >= 7)` — a failed-gate finding logged below that floor is invisible to
   the very preload step that is supposed to read it back and elevate it, so it can never
   become a rule no matter how many times it fires. `files` names the gate's own source (the
   hook, validator, or script that should have caught the defect) — 91 of the file's 97 real
   rows carry it, and without it the finding cannot be traced back to what should be fixed.

   No new ledger, no new script — the existing 3-strikes elevation (a learning that fires 3+
   times at confidence ≥8 is a candidate for promotion to a `rules/` correction rule) does the
   rest.

4. **Stage discipline:**
   - expectations come from the docs/DECISION card — never reground them to code;
   - **when this story makes a limit, quota, price or gate BECOME ENFORCEABLE** (something
     decorative starts binding), run the situational `evasion` stage — compute what a
     non-complying customer does and what it costs them versus complying. Making a rule real
     creates the incentive to route around it, at exactly the moment everyone treats the work
     as finished (STORY-RECEIPTS §Situational stages);
   - **landing / public marketing surfaces are handback territory** — flag untruths, do not
     edit the page; if the founder orders the edit, `benchmark-landing` ≥7 at every production
     viewport AND baselines under `visuals/baseline/landing/` (mobile 390×844 light+dark
     first) are required before merge (Mechanics 8 + 8b);
   - **canonical-vs-twin** (Mechanics 9): where the REPO file is canonical (QA companion,
     marketing context) you edit it — the `audited <date>` stamp included, but only if the
     walks it names happened; PUBLISHING the twin is Claude-only. Where the ARTIFACT is
     canonical (pricing) make no judgment while the mirror may lag — stop and request;
   - `implement` is **FOUR steps, not one** — see §4b. Collapsing it is the documented
     Surface ③ failure;
   - `implement` must leave D-BOOL / D-TZ / D-FIELD / D-DUPE / D-DEAD clean on the diff;
   - `e2e` must include the written can-fail statement;
   - **framework validators are INVOKED, never vendored.** They live in the framework repo,
     not in the product repo — `node scripts/verify-journey-e2e-bridge.mjs` from a product
     worktree fails MODULE_NOT_FOUND and that is **not a product defect**. Invoke them
     install-relative from their canonical path; never copy them into the repo and never
     hard-code an absolute path into anything committed. *(2026-08-02: an executor burned four
     attempts rediscovering this. The founder had corrected it twice — but only ever in
     conversation, so the rule existed nowhere a second session could read it.)*;
   - `spec-sync` runs the sync-spec-code skill on every touched spec;
   - `marketing`/`pricing` re-certify claims with live citations or record "not affected".
   - 🔴 **`device-proof` as written below is ANDROID-ONLY — `adb` does not exist for iOS.** A
     story promising anything iOS-specific (VoiceOver, Dynamic Type, App Attest, iOS safe-area,
     Apple push) **cannot be proven by it** and the stage must say so rather than pass on an
     Android screenshot. iOS proof is a physical device plus Xcode/Simulator capture. Where the
     infrastructure does not exist, use **`deferred`** — see §4a2. *(2026-08-03: a plan review
     found `DEVICE-01` describing only Android/wireless adb while the story carried an explicit
     iOS VoiceOver promise. The gap was in this text.)*
   - `device-proof` runs on REAL hardware over wireless adb (recipe + traps:
     `docs/qa/DEVICE-VALIDATION.md` — pair once, `adb mdns services` finds the port,
     always `-s <ip:port>`): device screenshots with the app build in the filename +
     adb-quoted native probes (channels/DND, deep links, safe-area). The bundled APK
     lags the web deploy — never pass an old bundle's screen off as the new UI. **No
     device reachable → the stage stays `pending` and the story stays open**; `na`
     only for stories with provably no mobile surface and no native path.
   - `qa-companion` ends with republishing the canonical artifact twin (fixed URL in
     CLAUDE.md §Relation-matrix process) — never leave the published page stale.
5. **Human gates:** the DECISION signature; anything the receipts file marks human-gated;
   commit/push/deploy rules per CLAUDE.md (deploys never from this skill without explicit
   founder ask).
6. **Done — three walks, then the validator (order matters):**
   a. **Design-conformance walk** (when the WI has a screen spec in `docs/specs/ui/`):
      grade EVERY §UX/§UI/§Device row of the screen spec against the shipped code into
      `docs/specs/design-conformance/<WI>.md` — grade column exactly `MET` /
      `PARTIAL — WI-xxx` / `FILED — WI-xxx` / `MISSING`, each with a `path:line` citation.
      `MISSING` = blocker: implement or re-sign, never silently file. (The pilot lesson:
      design stages certify the spec BEFORE the code; without this walk nothing re-checks
      the code against the spec — 5 mismatches, 2 on a SIGNED clause, survived 26 green
      stages until one founder question.)
   a2. **Reconcile the DOCS against the card, not only the code.** Before `journeys` is walked
      and again at closure, check every journey, `.feature.md` scenario and spec in scope
      against the **signed** decision card. A document that still encodes a superseded decision
      is a live contradiction: it will be read as the contract, and the next executor will
      build to it. **The card wins; the document is amended.** Never the reverse — an
      expectation is never rewritten to match what shipped.
      *(2026-08-02: `J38` still promised that an accepted discovery pays zero, months after the
      signed value became 20 base SP. Nothing in this chain looked for it — §6b maps signed
      clauses to CODE and never asks which DOCUMENTS still contradict them. The gap was found
      by an executor reading a journey by chance.)*

   b. **DECISION-card exit-walk:** the intent gate is bidirectional. Map every signed
      sub-clause (D1-7-style, ALL its parts) to a code citation in the report's
      `## Signed clauses` section, or mark `RE-SIGN` and stop for the founder. A clause
      with three parts and one shipped is a broken promise, not a receipt.
   c. **Paste the conformance report's verdict table in the reply** (stdout ≠ user-visible).
   c2. **Re-stamp the branch index.** If the story touched any path in the scope's
      `Scope-paths`, re-walk the affected axes and update `Derived-at` — the freshness claim
      fails otherwise, and a story that leaves its scope's authority stale has not finished.
   d. Then: validator exit 0 → report "✅ STORY ALIGNED", paste the final matrix in the
      closing PR body, update the relation ledger rows the story touched, and re-run every
      `scripts/audit-*-contract.mjs` for the scope so stale-behaviour checks are consciously
      re-read, not silently green. The validator enforces (a)+(b) mechanically — a screen-spec
      story without a clean conformance report does NOT print STORY ALIGNED.

## 4a · STAGE ORDER IS A DEPENDENCY GRAPH — some orderings are load-bearing

The chain reads as a list, so a plan is free to schedule it differently and nothing catches the
reorder. But several orderings are **not** stylistic: a proof stage cannot precede the thing it
proves.

| Must run before | Because |
|---|---|
| `live-proof` → `analytics` | you cannot measure what is not live; analytics run first measures nothing and reports green |
| `implement` → `e2e` → `test-run` | a suite written against unshipped code proves the fixture, not the feature |
| `compliance` → any **production activation** | clearing compliance for staging is not clearing it for real users |
| `spec-sync` → closure | a spec still describing the old behaviour makes the closing matrix a claim about the wrong system |

**Everything else may be scheduled freely.** The point is not a rigid sequence — it is that the
load-bearing edges are *named*, so a plan that inverts one is a finding rather than a
preference. *(2026-08-03: a plan review found `test-run` scheduled before staging `e2e`, and
`analytics` before `live-proof`. Neither is caught by the validator, because the chain never
said which order was structural.)*

## 4a2 · `deferred` — proof blocked by ABSENT INFRASTRUCTURE, not by choice

Some proof cannot be produced because the hardware or account does not exist. Today there is no
Mac and no iPhone, so nothing iOS-specific can be built, launched or captured — the code is
real (`ios/App`, the OneSignal extension, `@capacitor/ios`), it simply cannot be run.

Two wrong answers, and both have been taken before by someone in this position: block the story
forever, so nothing iOS ever ships; or mark it `na` and let it read as *considered and not
applicable*, which is a lie about a capability the product genuinely has.

**The fourth state:**

| State | Meaning |
|---|---|
| `done` | ran, evidence tracked |
| `na` | the activation condition evaluated **false** — the stage does not apply |
| `pending` | applies, not yet run, **and runnable** |
| **`deferred`** | applies, work is **written**, proof is **impossible here** — with the unblock condition named |

**Three rules, and the third is what stops this being a loophole:**

1. **It does not block STORY ALIGNED.** Otherwise the platform never ships at all.
2. **It is registered**, not just noted — `docs/specs/deferred-proof.md`, one row: what is
   unproven · which stage · **exactly what unblocks it** (*"a Mac with Xcode and one iPhone"*) ·
   the story it came from. When the infrastructure arrives, that file **is** the work queue.
3. 🔴 **The PROMISE must match the proof.** Nothing user-visible — landing, store listing,
   marketing, in-app copy — may claim the deferred capability *works*. Shipping unverified iOS
   code is a legitimate engineering choice; **telling customers it is verified is not.** This is
   the same rule as the scout badge: the claim may only assert what was actually established.

**🔴 `deferred` attaches to the PLATFORM, never to the whole stage.** A stage that proved
Android on real hardware is **`done`** — it produced real evidence, and `deferred` explicitly
does not block, so there is no reason the proven half should lose its status because of the
unproven one.

| | |
|---|---|
| Android, real device, screenshots carrying the build id | stage **`done`**, evidence tracked |
| iOS-specific behaviour | **one row in `deferred-proof.md`** |

Marking the whole stage `deferred` because one platform is unreachable **erases proof that
exists** — the opposite failure to marking it `done` and pretending iOS was covered. Both are
dishonest; they just lie in different directions.

**And with Capacitor, say which LAYER is proven too.** The shared web layer runs on both
platforms and is provable on Android and in a browser; only native-specific behaviour is
deferred. "iOS is unproven" is too coarse and hides the part that genuinely was tested.

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

## 4c · AN OPERATIONAL CHANGE NEEDS A RECEIPT — it leaves no diff

This whole chain is **code-shaped**: stages produce artifacts, artifacts get committed, the
commit is the record. A **config change to a live environment** — a feature flag, a Vault
secret, a dispatcher switch, a cron schedule — changes behaviour faster than any deploy and
produces **no diff at all**. Nothing in the receipts chain notices it happened.

So it gets its own record, `docs/specs/ops/<date>-<what>.md`, committed like any artifact:

| Field | Why |
|---|---|
| **What changed**, environment named | staging and prod are not interchangeable |
| **Before and after**, from the *same* read-only probe | one probe, run twice — not a claim about the before |
| **Who authorised it** | live mutations are founder-authorised unless already durably granted |
| **The exact revert** | the command, not "flip it back" |
| **What it does NOT do** | a flag turned off is not the underlying defect fixed |

*(2026-08-02: staging Lightning fee dispatch was `configured:true, enabled:true` while the
priced publisher was held — a financial operation running ahead of its dependency. It was
correctly switched off within the hour. It left **zero trace in the repo**: the only commits
that day were the audit docs and a skill fix. A month later nobody could learn from the
repository that it had happened, who did it, or how to undo it.)*

This is not paperwork. An operational change is the **fastest** way to alter live behaviour and
the **only** one with no artifact — which makes it the one most in need of a written one.

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

## Never

Never mark a stage done without tracked evidence; never skip a required stage (na needs a
written note); never fix outside the story's scope; never end a session claiming completion
while the validator still exits 1.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume; on Codex, mirror only the active step in `update_plan`.
- Read `.svc/lane-tasks-<WI>.json` first if a task graph is active for this WI; mark the
  align-feature task `in_progress` on entry and `completed` (with the STORY ALIGNED evidence
  path) on exit.
- Subagents MUST NOT attempt TaskUpdate calls — file state is the durable record; the
  orchestrator parent re-mirrors after a subagent returns.

### Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Branch index read and fresh before the first edit | `node scripts/check-branch-index.mjs --index docs/specs/relations/<scope>.branches.md` exits 0 (WI-521 gave `branchIndexFresh()` a real caller; the old per-scope `audit-*-contract.mjs` never existed in svc) | |
| 2 | Intent gate satisfied | `docs/specs/decisions/<scope>/DECISION.md` exists with a `Status: SIGNED <date>` line | |
| 3 | Every required stage receipted so far has no unresolved failure | `node scripts/audit-story-receipts.mjs <file> --wip` prints the matrix with **zero `❌` verdicts** (pending/optional rows are expected mid-story under `--wip`; any `❌` — done-without-evidence, na-without-note, evidence-not-found, MISSING — is a real failure `--wip` must not mask) | |
| 4 | Framework-born scope emits both mandatory outputs | for framework-scope runs, 2 new rows appended to `references/framework-learnings.jsonl` (§3c) | |
| 5 | Validator prints STORY ALIGNED | `node scripts/audit-story-receipts.mjs <file>` exits 0 | |

### Chaining

- `/decide` — the intent gate hands unsigned decisions to `decide`, one at a time, then waits
  for a signature.
- `/audit-feature` — if the branch index is missing or stale, stop and re-run `audit-feature`
  before continuing.
