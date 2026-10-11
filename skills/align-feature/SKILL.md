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
description: >
  Runs the story-receipts chain for one WI, stage by stage through owning skills, until
  the validator prints STORY ALIGNED. The fixing counterpart of audit-feature. Use for
  "align <feature>", "continue the chain for WI-X", "fix it the receipted way".
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

0. **Read the branch index first — it is the scope's authority (audit-feature §2g/2i).**
   `docs/specs/relations/<scope>.branches.md` is the single entry point: every entry point,
   caller, auth path, state, counter, promise, outcome, data table, journey/test and
   retry/concurrency boundary, plus every **dead** branch. Start from the index, not a WI, plan or
   brief — those are actionable selections, and each carries a `Scope-note` saying the
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

   **Use the existing freshness check after the story changes code.** When it remains FRESH and there are no new facts, keep the index byte-identical. If cited facts/imports are stale, re-walk affected axes and re-stamp `Derived-at` before the closing PR. Never stamp only because HEAD changed or to silence a failing contract.

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
   `node scripts/audit-story-receipts.mjs <file> --wip` → **show the full matrix (all
   stages, unabridged)** → continue.
3b. **The aspect sweep (every stage, no exceptions).** The chain is not a relay of narrow
   lenses — four separate misses in one 2026-07-31 session each fell between stages that all
   did their own job correctly. Whatever the stage just produced, examine that item across:
   **Money** (does it change what anyone pays or what it costs us) · **Avoidance** (what does
   a rational person do to route around it, and what does that cost them versus complying —
   deliberately *not* "abuse": STRIDE models attackers, and the customer opening fifteen
   accounts to duck a plan limit is not attacking anything) · **Promise** (what does it claim
   publicly, and is that true) · **Existing** (what happens to rows/customers/state already
   there) · **Neighbours** (what else touches it and now disagrees).
   **Above all five: answer at the source** — the primary page, the rendered pixel, the live
   database; never a summary, a score, or the page adjacent to the one that answers. Each
   aspect gets a citation, a number, or an N/A **carrying its reason**; all-prose aspects mean
   the sweep was not run. Scope it to the item, not the universe.

3c. **Framework-born scope: two required outputs.** When the scope being aligned is the svc
   framework itself (not a downstream product) — a skill, hook, validator or script under this
   repo — every align run emits two outputs, not one: **(1) the fix** (the normal stage
   artifact) and **(2) the failed-gate finding** — which existing gate should have caught this
   defect before align had to fix it, and why it didn't. A run that cannot name a responsible
   gate is itself a finding: an unowned miss is worse than a named gate that under-caught.

   Mechanically: append one row to `references/framework-learnings.jsonl` for the fix and one
   row for the failed-gate finding, matching the file's existing per-row field shape exactly
   (`key`/`type`/`confidence`/`insight`/`files`/`wi`/`ts`), e.g.:

   ```json
   {"key":"<gate-name>-miss","type":"harness-defect","confidence":7,"insight":"<what the gate should have caught and did not>","files":["<gate-source-file>"],"wi":"<WI-id>","ts":"<YYYY-MM-DD>"}
   ```

   **Confidence must be ≥7.** `rules/learning-preload.md` only surfaces rows via
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
   - `implement` is **four steps, not one** — see §4b. Collapsing it is the documented
     Surface ③ failure;
   - `implement` must leave D-BOOL / D-TZ / D-FIELD / D-DUPE / D-DEAD clean on the diff;
   - `e2e` must include the written can-fail statement;
   - **framework validators are invoked, never vendored.** They live in the framework repo,
     not in the product repo — `node scripts/verify-journey-e2e-bridge.mjs` from a product
     worktree fails MODULE_NOT_FOUND and that is **not a product defect**. Invoke them
     install-relative from their canonical path; never copy them into the repo and never
     hard-code an absolute path into anything committed. *(2026-08-02: an executor burned four
     attempts rediscovering this. The founder had corrected it twice — but only ever in
     conversation, so the rule existed nowhere a second session could read it.)*;
   - `spec-sync` runs the sync-spec-code skill on every touched spec;
   - `marketing`/`pricing` re-certify claims with live citations or record "not affected".
   - **`device-proof` as written below is Android-only — `adb` does not exist for iOS.** A
     story promising anything iOS-specific (VoiceOver, Dynamic Type, App Attest, iOS safe-area,
     Apple push) cannot be proven by it, and the stage must say so rather than pass on an
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

## 4a · Stage order is a dependency graph — some orderings are load-bearing

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
3. **The promise must match the proof.** Nothing user-visible — landing, store listing,
   marketing, in-app copy — may claim the deferred capability *works*. Shipping unverified iOS
   code is a legitimate engineering choice; **telling customers it is verified is not.** This is
   the same rule as the scout badge: the claim may only assert what was actually established.

**`deferred` attaches to the platform, never to the whole stage.** A stage that proved
Android on real hardware is **`done`** — it produced real evidence, and `deferred` explicitly
does not block, so there is no reason the proven half should lose its status because of the
unproven one.

| | |
|---|---|
| Android, real device, screenshots carrying the build id | stage **`done`**, evidence tracked |
| iOS-specific behaviour | **one row in `deferred-proof.md`** |

Marking the whole stage `deferred` because one platform is unreachable erases proof that
exists — the opposite failure to marking it `done` and pretending iOS was covered. Both are
dishonest; they just lie in different directions.

**And with Capacitor, say which LAYER is proven too.** The shared web layer runs on both
platforms and is provable on Android and in a browser; only native-specific behaviour is
deferred. "iOS is unproven" is too coarse and hides the part that genuinely was tested.

## 4a3 · The index is the map, the plan is the route — do not size one by the other

**Index is the map, plan is the route** — Size the index by the whole scope (used to check impact) and the plan and ACs by what changes (one task per modified surface, not one per row that merely exists). Do not let the plan inherit the audit's enumeration denominator. An index correction does not invalidate the plan unless it touches a file the plan modifies, so check a new path for impact and move on rather than re-planning. If the task count tracks scope size instead of diff size, the plan is describing the territory, not the journey. Details: `references/stage-rules-detail.md`.

## 4b · `implement` is four steps — and nothing mechanical catches you skipping two

**`implement` is four steps** — plan (`plan-changeset`, every screen-spec `UI-<WI>-NN` row maps to a task with DONE-conditions), review the plan (`review-plan`, before any code), execute (`execute-changeset`), review the diff (`review-exec`, the section-8 pair). The validator does not check plans, so steps 1 and 2 are the ones that get dropped: the `implement` receipt evidence includes the plan manifest path and the `review-plan` artifact path (repo-local, checked with `git ls-files --error-unmatch` before the receipt is written); a receipt citing only code has not done them. Tier the model by step: high for plan, review-plan and review-exec, a cheap model at MAX effort for execute (declared, not inherited; with Codex, `gpt-5.6-luna` max for step 3 and `gpt-5.6-sol high` for 1, 2, 4). If execution needs judgement, the plan was under-specified: fix and record the plan, never raise the execution tier. Details: `references/stage-rules-detail.md`.

## 4c · An operational change needs a receipt — it leaves no diff

This whole chain is code-shaped: stages produce artifacts, artifacts get committed, the
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

## 4d · Reviewer ladder — a declared list, and every rung on it closes

**Reviewer ladder** — Declare `REVIEWERS` up front in priority order (the other vendor first, then the own vendor as `@subagent`; flipped when the executor is Codex), since `resolve-adversarial-reviewer.sh` does no availability probe and has no fallback. Every entry is a full `vendor-model-effort` tuple, declared never inherited, and the fallback names the strongest model available; the receipt records the resolved tuple. Every rung on the list closes the story (no provisional flag or debt); if none is left the stage stays `pending` with reason `reviewer_unavailable`. `REVIEW_UNAVAILABLE=<entry>:<timestamp>` means skip with no retry until then. Do not use the main loop as the reviewer, because it cannot be adversarial to its own work: the fallback is a separate fresh-context adversarial agent, and self-review is not on the list. Record `review_family: cross|same` and `model_attestation.observed_models`; silent substitution of a weaker reviewer is the only unacceptable outcome. Details: `references/stage-rules-detail.md`.

## 7 · Parallel streams — what is shared, and what must never be

**Parallel streams** — When two stories run at once: (a) index freshness is two-tier, so a moved file the index cites is a HARD FAIL (re-walk, re-stamp) while an in-scope file it never cites is a SOFT WARN that never blocks; (b) the phone is an exclusive lease via `.svc/device-lease.json` (`{holder, wi, expires_at}`, 30 min TTL), so if someone else holds it, do not queue or wait; leave `device-proof` `pending` and continue, but it still blocks STORY ALIGNED at the end, and build the APK to a per-stream path with the build id in screenshot names; (c) one session republishes each canonical twin (e.g. the QA companion) once after both streams land, streams only edit the repo file and record the receipt; (d) `.svc/*.jsonl` ledgers are append-only (use `merge=union`, never resolve by taking one side), assign each stream a migration timestamp range, and declare one owner per shared surface; (e) the handoff prompt states the shared-surface owner, migration range and device rule. Details: `references/stage-rules-detail.md`.

## 8 · Every review is two passes, paired — never the diff alone

**Every review is two passes, paired** — Run back to back: Pass 1 EXACT reviews `git diff main..HEAD` plus spec and ACs; Pass 2 FULL reviews `docs/specs/relations/<scope>.branches.md` plus the DECISION card, bounded by the diff's relation-neighbours (callers, counters, promises, journeys and tests, data, auth) and hunting for absence: what the change should have touched and did not. The same scoping applies to self-review. Freeze the target before any external pass: the reviewer reviews a named SHA that does not move during the review (freeze, review, remediate, re-freeze, review), with at most two remediation rounds before you stop and report that the plan was wrong. Loop pass 1 until two runs find nothing new, then pass 2 until dry, record what you considered and rejected, and stamp the artifact with `Reviewed-diff-at`, `Reviewed-index-at` and both `## Pass 1` and `## Pass 2` sections; an artifact with no Pass 2 has not reviewed the feature. Details: `references/stage-rules-detail.md`.

## Never

Never mark a stage done without tracked evidence; never skip a required stage (na needs a
written note); never fix outside the story's scope; never end a session claiming completion
while the validator still exits 1.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume; on Codex, mirror only the active step in `update_plan`.
- When a task graph is active for this WI, mark the align-feature task `in_progress` on entry
  and `completed` (with the STORY ALIGNED evidence path) on exit.
- Subagents leave TaskUpdate to the parent — file state is the durable record, and the
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
