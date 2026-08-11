---
name: audit-feature
version: "1.0"
inputs:
  required: []
  optional:
    - { path: "docs/specs/relations/<scope>.relation.md", artifact: existing-relation-ledger }
outputs:
  produces:
    - { path: "docs/specs/relations/<scope>.branches.md", artifact: branch-index }
    - { path: "docs/specs/relations/<scope>.relation.md", artifact: relation-ledger }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
description: >-
  Run the full drift audit on one feature or journey — the complete machinery built for
  quiet hours: Pass A (19-layer census, 13 detectors, grounding script) + Pass B (independent
  verification agents), producing the relation ledger, seeded story-receipts chain, WI drafts
  and the matrix-first report. Use when the founder says "audit <feature>", "провери
  <feature/journey>", "drift audit X", "is J07 aligned", "verify journey", or names any
  feature/journey they want checked before go-live. Findings only — never fixes.
---

# Audit Feature — one-command drift audit

**Announce at start:** "Running the drift audit on <SCOPE> — Pass A now, Pass B verification
before any verdict becomes truth."

## What this skill is

The founder-calibrated audit machinery from WI-QUIET-FOLLOW-01, packaged as one invocation.
The METHOD lives in `docs/qa/DRIFT-AUDIT-PROMPT.md` (v2.1+; project-supplied artifact — path
varies per repo) — this skill executes it; never
duplicate its content here. If the two ever disagree, the prompt file wins.

## Execution

1. **Scope** — take the argument as `<SCOPE>` (feature name or journey id, e.g. "J07
   flash offers"). Run Phase 0 exactly as the prompt file says. If
   `docs/specs/relations/<scope>.relation.md` exists, start from it and re-verify rows.
2. **Pass A** — Phases 1–6 of the prompt file: 19+1-layer census (all layers incl.
   screen/design, device, marketing, pricing), relation map, mechanical grounding script
   (pattern: `scripts/audit-quiet-hours-contract.mjs`), all detectors D-CITE…D-BEHIND,
   Phase 3B world best practice, Phase 5 product/UX judgment.

2b. **THE TWO LEVELS OF GROUNDING — both required, and they are not the same job.**

   | | **Level 1 — drift** | **Level 2 — the general finding** |
   |---|---|---|
   | Catches | this feature's spec ≠ this feature's product | "this is broadly not ok" — a defect crossing features: a meter, a price, a legal exposure, a schema key |
   | Instrument | `scripts/audit-<scope>-contract.mjs` | that script **plus a written, defended analysis** |
   | Output | PASS/FAIL per claim | PASS/FAIL per claim **+ analysis + confidence + what would have to be true for it to be wrong** |

   Level 2 is where decisions get taken, so level 2 needs the analysis — not just the check.
   **A level-2 finding with no written analysis is a rumour; a level-2 analysis with no
   mechanical claim behind it is an opinion.** Ship both or ship neither.

2c. **CONFIDENCE — scored by HOW it was established, never by how sure you feel.**

   | Score | Name | Established by |
   |---|---|---|
   | **C5** | derived | a `claim()` in an `audit-*-contract.mjs` that PASSES on this run |
   | **C4** | cited primary | a primary source states it — vendor doc, regulation text, court filing, platform help. URL **and** the quoted sentence |
   | **C3** | measured | we measured it here — probe output, live query, screenshot, benchmark. Record the command |
   | **C2** | secondary | a credible third party asserts it; named and dated |
   | **C1** | inferred | reasoning over C3–C5 facts. **Must name every fact it stands on** |
   | **C0** | asserted | none of the above — **not a finding.** Research it or delete it |

   **The decision gate: no decision may rest on anything below C3.** C2 and C1 may *inform* a
   decision only with the C3+ facts they stand on listed beside them. A C0 claim inside a
   decision document is a defect of the same class as a broken citation.

2d. **"I don't know" is a route, not an answer.** When a load-bearing claim lands at C2 or
   below, do NOT soften the wording and move on — that is exactly how an opinion acquires the
   shape of a fact. **Dispatch an expert sub-agent** (§Expert sub-agent contract), take back
   primary sources, and **re-state the claim grounded in what came back, at its new score.**
   If the expert also cannot establish it, record it as **UNRESOLVED with its owner** —
   counsel, the vendor, or a measurement we must run — and it **blocks** any decision needing
   it. An unresolved claim is a better deliverable than a confident wrong one.

2e. **⚠️ A FAILING mechanical check is evidence the CHECK is wrong, until proven otherwise.**
   Read the source before believing your own script. *(2026-07-31: a single-line regex for
   `billing_owner_id … REFERENCES auth.users` returned zero hits and would have "confirmed"
   the author's own false claim that the column referenced nothing — the FK was declared
   across two lines.)* Never let a red check ratify a conclusion you already wrote.

2f. **Re-run every `audit-*-contract.mjs` before the report and paste the tail.** Green from
   an earlier run is not evidence about this one.

2g. 🔴 **COMPLETE BRANCH ENUMERATION — mandatory, and sampling is a FAILED audit.**

   *Origin (2026-07-31): an audit of the sample economy reported findings, took a Codex review
   and produced ranked recommendations — and then the founder asked one question ("what is an
   award, who pays") which surfaced that **three of six rewards debit the user and grant
   nothing**, a **whole currency is displayed but unearnable**, and the founder's own
   submission rule **did not exist in the UI**. None of it was hidden. It had simply never
   been enumerated. His verdict — "you can't give me a solution if you don't have a complete
   audit" — is now this rule.*

   **Produce `docs/specs/relations/<scope>.branches.md` BEFORE any finding, recommendation or
   review.** It enumerates — never samples — every one of:

   | Axis | Enumerate every… |
   |---|---|
   | **Entry points** | function, route, screen, job, trigger, webhook that can begin the flow |
   | **Callers** | for each unit: who invokes it — UI, server, cron, nothing. *"Nothing calls it" is a finding, not a gap in the search* |
   | **Auth** | per entry point: what a caller must present, and what happens with the public anon key |
   | **State** | every status/enum value a record can hold, and every transition, with the writer of each |
   | **Currencies & counters** | every balance, point, credit, XP or tier: **who increments it, who decrements it, who reads it.** A counter that is read but never written is a defect, not a feature. **AND its calibration — the literal value, where it is set, and whether changing it needs a deploy** (§2g2) |
   | **Promises** | every user-visible string that asserts an outcome — reward copy, badges, emails — mapped to the code that delivers it, **or marked UNDELIVERED** |
   | **Outcomes** | for each terminal action: what the user is told vs what the code actually does |
   | **Data** | every table the scope writes, and what else reads it |
   | **Journeys & tests** | every journey/`.feature.md` scenario, e2e spec and unit test that claims to cover this scope — and **what each actually asserts**. A spec that accepts five destinations, or returns early on a setup state, or stops before the submit, covers nothing. Name those |
   | **Time, retry & concurrency** | every mutation flow walked at **each durable boundary** under failure, retry and interleaving: commit boundaries and partial success · idempotency · read-before-write races · two callers at once · delayed jobs, expiry and crash recovery |

   *The last two were added 2026-07-31 after a §2h review. **Journeys & tests** because a scope
   can be fully enumerated in code and still be guarded by specs that cannot fail — two were
   found here. **Time/retry/concurrency** because "Outcomes" has a natural unit of ONE
   invocation, so it structurally cannot see a flow that commits, fails halfway and is retried;
   the reviewer proved it by finding two such holes the other eight axes had passed over
   (a wizard that creates a SECOND location on retry, and a failed referral that leaves a
   public row behind).*

2g2. **⚠️ WIRING IS NOT CALIBRATION — record the VALUE, not just the plumbing.**

   An index that says *"`sample_points` is incremented here, decremented there, read nowhere"*
   is a complete wiring map and still cannot answer *"is 200 the right reward?"* — because the
   number is not in it. Every counter, cap, quota, price, threshold, window and multiplier in
   the scope gets three more columns:

   | Column | Why |
   |---|---|
   | **Value** | the literal — `30`, `50/50/200/100/150/300`, `5 km`, `90 days`. Not "a cap exists" |
   | **Set where** | hard-coded constant · env var · `launch_configs` row · DB default · migration literal |
   | **Changeable without a deploy?** | yes/no. A number in a `const` is a *code change*; a number in `launch_configs` is an *operation*. **Decisions about numbers must know which they are buying** |

   *(2026-07-31: the sample index mapped all eleven counters — increments, decrements, readers,
   split tables, the debit-only balance — and a decision session about daily caps and payout
   sizes still had to go read `sample-photo-upload/index.ts:18` for `DAILY_QUOTA = 30`,
   `process-sample-activation:39-42` for the reward table, and the migration for
   `bump_sample_capture_quota`. The axis had been walked for wiring and not for calibration.
   Four of seven load-bearing facts came from the index; three did not — and the three were
   exactly the ones the decision was about.)*

   Same rule for the **promises** axis: a promise that states a number ("100-300 SP per
   milestone", "2× XP for premium") is checked against the **delivering** number, not merely
   against the existence of a delivering writer. `isPremium ? p : Math.floor(p * 0.5)` does not
   deliver "2×" — it halves everyone else, which is the same arithmetic and a different promise.

   **Method rules:**
   - **Enumerate from a list the machine produces**, not from what you remembered to check —
     `readdirSync`, `git ls-files`, a grep over ALL files, then walk the list. If your report
     covers fewer units than the enumeration, say which and why.
   - **Follow each branch to its END.** "The function is called" is not the end; what it
     writes, what the user is then told, and whether that is true, is the end.
   - **Name the empty branches.** Unreached code, unearnable currencies, unfulfilled rewards
     and never-fired events are the highest-value findings and they are invisible to sampling.

   **Freshness is mechanical, not a promise.** The file carries a header:

   ```
   Derived-at: <full SHA>
   Scope-paths: <one glob per line>
   ```

   and the scope's contract script MUST carry a claim that re-derives it:

   ```js
   claim('X-00', 'The branch index is fresh for HEAD', () => {
     const idx = read('docs/specs/relations/<scope>.branches.md') ?? '';
     const sha = /Derived-at:\s*([0-9a-f]{7,40})/.exec(idx)?.[1];
     const globs = [...idx.matchAll(/^\s*-\s+(\S+)$/gm)].map(m => m[1]);   // under Scope-paths
     const changed = sh('git', ['diff', '--name-only', `${sha}..HEAD`, '--', ...globs])
       .split('\n').filter(Boolean);
     return { ok: changed.length === 0,
       evidence: changed.length ? `STALE — ${changed.length} scope file(s) changed since ${sha}: ${changed.slice(0,5).join(', ')}` : `fresh at ${sha}` };
   });
   ```

   **A stale index fails the contract, which fails the audit.** That is the point: the index
   cannot silently rot, and any commit touching the scope forces a re-walk.

   ⚠️ **The instrument is not the system.** `scripts/audit-<scope>-contract.mjs` must NOT be
   one of its own index's `Scope-paths`. Including it makes every edit to the audit tooling
   invalidate the enumeration of the thing being audited — circular, and it trains people to
   re-stamp `Derived-at` without re-walking anything. **Only paths whose change could alter a
   BRANCH belong there.** *(2026-07-31: the first index failed its own freshness check on a
   tooling-only commit.)*

2h0. 🔴 **ITERATE UNTIL DRY — but the boundary is IMPACT, not co-occurrence.**

   Two rules, and each fixes the other's failure mode.

   **A · TWO loops, both run until dry — in this order, never interleaved.**

   | | Loop | Runs until | Cost |
   |---|---|---|---|
   | 1 | **your own** self-review | **two consecutive passes return nothing new** | cheap — your own pass |
   | 2 | **the external** reviewer | **it returns nothing new** | expensive — this is why it goes second |

   Loop 2 is the **final** phase. There is no third.

   **What makes both terminate is the OUT list (rule C), not willpower.** A reviewer that
   cannot re-litigate settled exclusions runs out of genuinely new things quickly; one that can
   re-argues the same candidates forever. That is the whole difference between converging in
   two rounds and the eight that produced this rule.

   **And the order is the efficiency.** Escalating first, or escalating after every single
   correction, is what produced ~30 external calls on one scope. Draining the cheap loop first
   means the expensive loop starts from a far better artifact and finishes in one or two.

   **B · The boundary is IMPACT.** For every candidate the question is exactly one thing:

   > **Would a change there alter THIS scope's behaviour, its counters, or its promises?**

   | | |
   |---|---|
   | ✅ **in** | a real dependency — the scope's behaviour rides on it. It belongs even if it sits outside the current `Scope-paths`, and finding one **extends the paths, deliberately and once** |
   | ❌ **out** | shares a component, a table or a word, but this scope's behaviour does not depend on it. **Co-occurrence is not dependency** |

   **C · The exclusion is WRITTEN DOWN — this is what makes both loops terminate.** A candidate
   considered and excluded with no record is **indistinguishable from one never seen**, so the
   next pass finds it and argues it from zero. Record three buckets: **IN** with its dependency
   argument · **OUT** with its exclusion reason · **FILED** for real defects owned elsewhere.
   The OUT list is the one that gets skipped, and skipping it is what costs the rounds.

   Out-of-scope findings are **filed, not discarded** —
   `docs/specs/audit/out-of-scope-findings.md` with `path:line` and the scope they belong to.
   They are often real defects and must reach the scope that owns them.

   **The alarm is growth WITHOUT a dependency argument.** Growth by dependency is the
   enumeration working. Growth by co-occurrence is the scope dissolving — and the tell is that
   nobody can say what would break in *this* scope if the new path changed.

   *(2026-08-02: a sample-economy index was re-walked eight times inside one `plan-changeset`,
   270 → 322 paths, absorbing `Settings.jsx`, `Profile`, every generic `PhotoUpload` consumer,
   hosted-preview scripts, deploy prefixes and coverage reporters. `Settings.jsx` uses
   `PhotoUpload`; the sample capture flow does not route through Settings, so nothing in the
   sample economy changes if Settings changes — shared component, not dependency. The findings
   were real and belonged elsewhere. It consumed a large share of a weekly model budget and
   never converged, because the rule had no boundary and no stopping condition.)*

2h. **The reviewer gets the index too — and this is a CLAIM, not a note.** Every
   external/cross-family review for this scope must (a) be handed `<scope>.branches.md`, and
   (b) be asked explicitly: *"which branches does this index MISS?"* A reviewer handed only
   findings can only check the findings; a reviewer handed the enumeration can find the hole
   in it. Treat a reviewer-found missing branch as a defect in the audit, and add a claim so
   it cannot recur.

   **Mechanically enforced.** The scope's contract carries a second claim beside the freshness
   one, using `branchIndexReviewed()` from `scripts/branch-index-freshness.mjs`:

   ```js
   claim('X-00b', 'An external reviewer was handed the index and asked what it MISSES (§2h)',
     () => branchIndexReviewed('docs/specs/relations/<scope>.branches.md',
                               'docs/specs/reviews/<scope>-branch-index-review.md'));
   ```

   The review file must carry `Reviewed-index-at: <sha>` matching the index's `Derived-at`, so
   **re-walking the index re-opens the review obligation**, and it must record the miss-question
   verbatim.

   ⚠️ *Why this is mechanical: §2g had a guard and was honoured; §2h was prose and was skipped
   on its very first outing — the exact failure class this skill exists to prevent. A rule that
   depends on the author remembering it is a note, not a mechanism. (2026-07-31.)*
2i. 🔴 **ONE PLACE PER SCOPE. The index is AUTHORITATIVE, not a snapshot.**

   *Founder ruling 2026-07-31: "I don't want you to discover something — I want it completely
   discovered based on the last known index. Read that thing and know everything, grounded."*

   The counter-argument — "the code is the source of truth" — **is wrong for this purpose and
   was retracted.** Code tells you what runs. It does not tell you what was decided, what was
   tried and refuted, what is dead on purpose versus dead by accident, or what is still open
   and who owns it. A system that re-derives everything each iteration loses that every time.

   **`docs/specs/relations/<scope>.branches.md` is therefore the single entry point for its
   scope.** It carries, in one file: the eight enumeration axes · the confirmed findings ·
   the decisions taken and their grounding · the open questions with their owners · what is
   deliberately not built and why · and what an executor must not touch.

   It is authoritative **because** it self-invalidates: `Derived-at` + `Scope-paths` +
   `branchIndexFresh()` mean a stale index **fails the contract**, which fails the audit. An
   authority that cannot go quietly stale is safe to read as truth.

   **Every other document in the scope must yield to it.** A scope document that is not the
   index must carry one of:

   | Header | Meaning |
   |---|---|
   | `Derived-at: <sha>` | it is itself freshness-guarded |
   | `Superseded-by: <path>` | historical; the index now owns this knowledge |
   | `Scope-note: <reason>` | narrow artifact (a review receipt, an expert report) that never claimed scope authority |

   Enforce with a claim beside the other two:

   ```js
   claim('X-00c', 'No unstamped document claims authority over this scope (§2i)',
     () => scopeDocsYield('docs/specs/relations/<scope>.branches.md',
                          ['docs/specs/relations/<scope>.relation.md', /* … */]));
   ```

   ⚠️ **Why this rule exists, measured:** at the moment it was written this repo held **1,392**
   markdown files under `docs/specs`, of which **6** carried any freshness stamp; 178 touched
   account onboarding and 52 touched the sample economy; and `docs/specs/INDEX.md` did not exist.
   In one session that produced **five** confidently-wrong claims — a column said not to exist,
   a page said not to be routed, a function said not to be registered, a cap said to need a new
   table, a writer said to award nothing. **Every one of those facts already existed in the
   repo.** None was hidden. Each was simply not in a document anyone thought to read.

3. **Pass B (mandatory)** — Phase 7: launch 2–3 independent read-only agents in parallel
   (wider synonym nets + other locations + verbatim citation checks). Verdicts are
   *candidate* until Pass B confirms.
4. **Outputs** (all committed on a branch, never to main directly):
   - `docs/specs/relations/<scope>.relation.md` — created or updated, every row cited
   - `docs/specs/receipts/<WI>.receipts.json` — seeded from TEMPLATE, stages pinned per
     findings (`node scripts/audit-story-receipts.mjs <file> --wip` — must print the matrix)
   - **ONE triage artifact — `docs/specs/audit/<scope>-triage.md` — not a WI per finding.**
     One row per finding: **id · group · state · blocking dependency**. Groups are the unit of
     work, sized to land **independently** (the T0 pattern): live user harm first, then legal,
     then dead branches, then untrue claims, then the rest. WI drafts are written only for
     groups that will actually be built.
     *Why the change: "a WI draft per confirmed defect" does not survive a real audit. The
     Lightning walk produced **21** findings; twenty-one WI files is not triage, it is filing,
     and the rule was silently skipped — the grouping was invented in chat and never landed,
     so the next session would have started from nothing. A rule that gets ignored at scale is
     a rule that was written for the small case only.*
   - report to the founder: **matrix first, ALL chain stages, never abridged**
5. **Aspect sweep on every finding** (STORY-RECEIPTS Mechanics 10). A census that lists
   layers still leaks at the seams — four 2026-07-31 misses each fell BETWEEN stages that
   all did their own job. For each finding, state **Money · Avoidance · Promise · Existing ·
   Neighbours**, each as a citation, a number, or an N/A **with its reason**. *Avoidance*
   deliberately, not *abuse*: the customer routing around a limit is not an attacker, and
   naming it "abuse" is why that class keeps being skipped. And answer every aspect **at the
   SOURCE** — the primary page, the rendered pixel, the live database, never a summary or a
   score or the page adjacent to the one that answers.

6. **Fragmentation tripwire** — if the audit finds ≥2 implementations of one concept or a
   spec-vs-spec contradiction: STOP before recommending fixes; the receipts `validate` stage
   pins an **intent card** (`docs/specs/decisions/<scope>/DECISION.md`, founder-signed)
   as prerequisite — per `proposals/2026-07-29-intent-recovery-branch-for-validate-feature.md`
   (project-supplied artifact — path varies per repo).
7. **Never fix in the audit session.** Findings, ledgers, receipts, WIs only.

8. **HAND OFF — the audit does not end with a report.** The loop is fixed and each skill owns
   exactly one job:

   | | Skill | Owns | Ends when |
   |---|---|---|---|
   | 1 | **`/audit-feature`** | *what IS* — enumerate every branch, ground it, name the dead ones | the index is written, the contract is green (§2g/§2h/§2i) |
   | 2 | **`/decide`** | *what SHOULD BE* — filter the defects out, put the real choices to the founder one at a time | every decision carries a signature |
   | 3 | **`/align-feature`** | *making it so* — build against the signed card, re-stamp the index | the validator prints STORY ALIGNED |

   **Close step 1 by naming the split, never by handing over a list:** *"N of these are
   defects — they are not choices and I am filing them as fixes. M are genuinely yours."* Then
   invoke `decide` for the M. An audit that ends in a menu has skipped the filter, and the
   founder pays for it in attention. *(2026-07-31: six "decisions" were presented; four were
   defects.)*

   **Never skip straight from audit to align.** An unsigned decision is not an instruction —
   `align-feature`'s intent gate refuses it anyway, and arriving there without a card wastes
   the executor's run.

## Expert sub-agent contract

Used by §2d whenever a load-bearing claim cannot be got above C2 from the repo.

- **Name the role, do not say "research this".** "You are a KYB / business-verification expert
  advising a pre-revenue international marketplace" produces primary sources; "look into
  verification" produces a listicle summary. One role per agent; run them in parallel.
- **Demand the shape back:** a table of `claim | answer | source URL | confidence`, then a
  mandatory **"What I could NOT establish"** section. State in the prompt that
  **partial-but-honest beats complete-but-guessed**, and that "unknown" is a correct answer.
- **Forbid category reasoning.** Require the concrete thing — the rendered pixel, the live
  row, the vendor's own availability page, the statute text — not the adjacent page that
  merely implies it. *(This failure repeated four times on 2026-07-31: a benchmark score
  instead of the image; legal categories instead of phone data; one market instead of ten; a
  pricing page instead of an availability page.)*
- **Sales-gated pricing must be reported as sales-gated,** never estimated. *(A vendor was
  once recommended on a $2-per-thousand costing for a product behind a $1,000/month
  minimum.)*
- **Never take an expert's answer as final either.** Its findings enter at C4 only with the
  URL and the quoted sentence; otherwise C2. Cross-check anything that reverses a prior
  conclusion — on 2026-07-31 an expert's own CRITICAL was itself half-wrong.
- Record every expert report as its own artifact next to the findings, so the report can be
  audited later rather than remembered.

## Guards to leave green

`node scripts/audit-qa-companion.mjs` (project-supplied artifact — path varies per repo) and
any `scripts/audit-*-contract.mjs` for the scope — **both the level-1 and the level-2 contract
for that scope** (§2b). Re-run them in the session that writes the report; a green from an
earlier run proves nothing about this one.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume; on Codex, mirror only the active step in `update_plan`.
- On-demand audit tool — usually invoked standalone by name ("audit <feature>") rather than as
  a lane task; when a task graph IS active, treat this stage like any other: read
  `.svc/lane-tasks-<WI>.json`, mark the audit-feature task `in_progress` on entry, and mark it
  `completed` with evidence (the branch index + relation ledger paths) before leaving.
- Subagents MUST NOT attempt TaskUpdate calls — file state is the durable record; the
  orchestrator parent re-mirrors after a subagent returns.

### Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Branch index written before any finding | `test -f docs/specs/relations/<scope>.branches.md` | |
| 2 | Index freshness claim passes | `node scripts/check-branch-index.mjs --index docs/specs/relations/<scope>.branches.md` exits 0 (WI-521 gave `branchIndexFresh()` a real caller; the old per-scope `audit-*-contract.mjs` never existed in svc) | |
| 3 | Index reviewed by an external/cross-family reviewer | `branchIndexReviewed()` via the scope's contract | |
| 4 | Relation ledger has every row cited | grep `docs/specs/relations/<scope>.relation.md` for an uncited row | |
| 5 | Aspect sweep run on every finding | grep the report for "Aspect sweep" / Mechanics 10 evidence | |

### Chaining

- `/decide` — when the audit surfaces defects that need a founder choice, hand off through
  `decide` (never present a raw findings menu).
- `/align-feature` — once the founder signs a decision, `align-feature` executes the fix chain
  against the receipts this audit seeded.
