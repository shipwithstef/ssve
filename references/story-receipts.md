# Story Receipts — the forward alignment contract (v1)

Ported into svc for WI-521 Batch A from example-marketplace (main,
`docs/specs/process/STORY-RECEIPTS.md`), genericized to drop project-specific naming, and
re-pointed at the svc-canonical stage registry (`references/stage-registry.json`) instead of
an embedded 28-stage table — the registry is now the single source of the stage vocabulary;
this document is the conductor's prose, not a second copy of the list.

The drift audit (a project's own `docs/qa/DRIFT-AUDIT-PROMPT.md`, where one exists) looks
BACKWARD: it finds existing misalignment. This contract looks FORWARD: **no story (feature /
bug / any change) is done until every stage of the chain has a receipt** — proof, not
intention.

## The chain — every story walks it in order

| # | Stage | Skill | The receipt proves |
|---|---|---|---|
| 1 | `vision` | write-vision | the story serves the product direction (citation into `VISION.md`), or N/A why |
| 2 | `personas` | build-personas | a persona encodes BOTH the need AND its boundary (e.g. "don't wake me") — persona file § cited |
| 3 | `validate` | validate-feature | ship decision + **fragmentation check**: is this concept already implemented elsewhere? (the quiet-hours failure) |
| 4 | `spec` | write-spec | feature spec where **every Overview promise maps to a behavioural AC** (D-PROSE clean) |
| 5a | `design-ux` | design-ux | screen spec in `docs/specs/ui/WI-*.md`: what is on the screen, where, and the flow between screens |
| 5b | `design-ui` | design-ui / web-design-guidelines | conforms to `docs/specs/design-system.md` (tokens, type, colour, states) **+ accessibility: aria labels on every toggle, keyboard-reachable popovers, contrast via tokens**. **Every §UX/§UI/§Device requirement is emitted as a checkable row with an ID (`UI-<WI>-NN`)** — *what is not promoted into a row with an ID does not exist for the chain* (the WI-QUIET-FOLLOW-01 lesson: 5 spec rows shipped unimplemented through 26 green stages because nothing ticked them) |
| 5c | `device` | ionic-design / capacitor-testing / track-visuals | cross-device decision: breakpoints, mobile web, **Capacitor native** (safe-area, touch targets), which viewports the visuals stage must baseline (1600×900 + 390×844 minimum); **native a11y via capacitor-accessibility when Capacitor-affected** |
| 6 | `journeys` | write-journeys | journey created/updated; **no unconditional promises contradicting spec carve-outs** (D-UNCOND clean) |
| 6b | `impact` | route-workflow **change-impact triad** (staged diff authoritative) + D-UNCOND-style sweep | CROSS-FEATURE BLAST RADIUS: enumerate every OTHER feature / journey / QA flow / e2e / capability row **/ live experiment, feature flag or A/B variant** whose BEHAVIOUR this story alters — ⚠️ retiring or re-pinning an experiment arm **truncates its data**, so the record must name the arm, the truncation date and why, and mark the owning WI (missed once: WI-LSLOT-01 retired WI-152's live `landing_headline_v2` arm with the arm's claim correctly judged false, but no ledger row anywhere); per item one disposition — **updated-here** (in this story) or **filed** (scoped follow-up story) — and the affected scopes' relation ledgers gain rows. Re-verified at implement against the real diff. |
| 7 | `ac` | audit-ac | AC coverage table current; behavioural ACs present, not UI-only |
| 7b | `security` | **review-security** (+ review-cross-model gate on the diff) | pre-implementation threat model: OWASP Top 10 + STRIDE over spec+design → `docs/specs/security/<name>-review.md`; **DB section mandatory**: RLS policies for every new/touched table (entity-rls-audit practice), grants, service-role boundaries, authz on new endpoints, secrets; implement's diff then passes the cross-family security gate |
| 7c | `compliance` | **privacy-dpo** (repo skill) + capacitor-apple-review-preflight / store policy when native-affected | GDPR data-mapping for every NEW personal-data field (what, why, retention/TTL, lawful basis); user-rights surfaces (export + DataDeletion) INCLUDE the new data; consent records where consent gates behaviour; store notification policies checked (Play/App Store require user-controllable notifications); marketing claims legally safe |
| 7d | `plan` | plan-changeset | the diff has a manifest + task graph (file set, validation plan, AC/test mapping) BEFORE any code is written — **essential: always active in every story type, never `na`** |
| 7e | `review-plan` | review-plan | the manifest passed adversarial plan-level review (mechanical checks + the cross-model gate) before execution began — **essential**; distinct from `plan` (produces the manifest) and from `review-exec` below (reviews the executed diff, not the plan) |
| 8 | `implement` | plan- + execute-changeset **+ review-exec (G6) + audit-implementation** | diff merged THROUGH the framework gates (G6 review, implementation audit); **D-BOOL / D-TZ / D-FIELD / D-DUPE / D-DEAD clean on the diff** |
| 8a | `review-exec` | review-exec (G6) | the EXECUTED diff (not the plan) passed the mandatory adversarial G6 review before land — **essential**; `implement` (row 8) is the execution + its own audit-implementation pass, this row is the separate G6 gate over that diff |
| 8c | `perf` | capacitor-performance / repo perf practice | performance budget for the touched paths: indexes on new/queried tables, batch limits on fan-out/flush jobs, no N+1, cron load bounded, mobile paths via capacitor-performance when UI-heavy — receipt = the budget + how each item is met |
| 9 | `e2e` | write-e2e | test exists **with a written can-fail statement**: "this test fails if X breaks" (D-CANTFAIL) |
| 10 | `test-run` | test-journeys | green run receipt (run id / output), per env |
| 10b | `spec-sync` | **sync-spec-code — STORY-SCOPED ONLY, FLAG-FIRST** | runs ONLY over the specs this story touches (single-feature mode, named in the receipt); findings are FLAGGED in the report first; the only writes allowed are to the story's own spec files, inside the story PR where they are reviewable. Checks: no PLANNED-but-implemented (P2), no dead refs (P3), narrative matches code (P4), journey-gap (P5) |
| 11b | `live-proof` | route-workflow **Post-Deployment Evidence Lock** | the named proof runs against the DEPLOYED environment(s) after deploy — live probes, not local/mock/bundle-grep ("proven live, not inferred"); receipt = probe outputs per env |
| 11c | `analytics` | analytics (the product's analytics provider) | the feature EMITS measurable events for its core behaviours + a named query/dashboard proving them live — without this, production behaviour is unverifiable and product impact unmeasurable |
| 11 | `visuals` | track-visuals | committed light+dark, desktop+mobile baselines, paths cited; **each baseline names which `UI-<WI>-NN` rows it evidences** (a `MANIFEST.md` beside the PNGs) — a baseline that shows no spec row proves nothing |
| 11d | `device-proof` | wireless adb + capacitor-testing | the story's touched surfaces validated **ON REAL HARDWARE** (browser-emulated viewports are NOT device proof): device screenshots via `adb screencap` under `docs/specs/visuals/device/<scope>/` with a `MANIFEST.md` naming the `UI-<WI>-NN` rows evidenced AND the app build probed; native side-effects probed with adb and quoted verbatim (notification channels/DND via dumpsys, deep links, permissions, resume, safe-area on notched hardware) in `docs/specs/audit/<WI>-device-proof.md`. ⚠️ the bundled Capacitor APK lags the web deploy — never present an old bundle's screen as the new UI; in-app proof of new UI needs a dev build installed (dev builds are never release evidence). **No device reachable = stage BLOCKS (`pending`)**; `na` only with a note proving the story has no mobile-visible surface and no native path |
| 12 | `qa-companion` | (manual QA layer) | THE CENTRAL TESTING INSTRUMENT: flows rebuilt from the journey's FULL user scenarios (not summaries), stamped `backed by J-xx, audited <date>`, steps verified followable against the REAL implemented UI in a **browser walk done BEFORE writing the steps** (D-REACH — strings quoted from the live DOM, never from memory); **mobile-marked flows are additionally pre-walked ON DEVICE via stage 11d — nothing the companion asks the owner to test may be untested when they open it**; then the published twin at the canonical artifact URL is REPUBLISHED (same URL) — repo file and published artifact may never diverge |
| 13 | `ledger` | (relation ledger) | `docs/specs/relations/<scope>.relation.md` rows updated |
| 14 | `marketing` | analyze-marketing | `marketing-context.md` + launch-offer claims re-checked with **live citations** (D-CITE), grounded on the CURRENT Marketing Context artifact, or "not affected" |
| 15 | `pricing` | (pricing/capability) | evaluated against the CURRENT unified Pricing Model ARTIFACT (WebFetch at evaluation, cite version read; repo copies may lag) + capability-inventory rows re-certified, or "not affected" |
| 15b | `landing-impact` | landing-page / marketing strategy | ONE verdict per change: does it impact the LANDING PAGE and the MARKETING STRATEGY **positively / negatively / neutral**, and is a change needed there (yes → what, filed; no → why) — grounded on the live landing source + the marketing/pricing artifacts |
| 15c | `finops` | **manage-finops** | COST side (distinct from 15 pricing = revenue side): every new/changed cost surface is METERED (the "was uncharged" class), caps/floors hold (wallet floor!), provider spend bounded (push volume, cron frequency, queue growth/TTL) |
| 16 | `translations` (l10n) | — | new user-facing strings have keys + full-locale fallback safe; **no hardcoded locale assumptions**: time formats (24h pickers), dates, currency (single-currency policy cited, never per-locale prices unless the project explicitly supports that), worldwide-not-country-specific rule honoured; professional translation follow-ups filed, never machine-guessed |
| 17 | `index-restamp` | check-branch-index.mjs / land-changeset | the scope's branch index (`docs/specs/relations/<scope>.branches.md`) was re-stamped fresh against the landed diff at close, and `check-branch-index.mjs` exits 0 against it — **essential**; the last stage every story walks, closing the loop this contract opened at `impact` (row 6b) |

## Required stages by story type

Any required stage may be `na` **only with a written justification**. `pending` = story is
NOT closable. The authoritative required-stage lists per story type live in
`references/stage-registry.json` `story_type_profiles` — the table below is illustrative,
not a second copy; if the two disagree, the registry wins.

| Story type | Required stages |
|---|---|
| `feature` | all stages (incl. 5a/5b/5c, 6b, 7b, 7c, 8c, 10b, 11b, 11c, 11d, 15b, 15c) |
| `bug` | 6b impact, 7 ac (does the AC now hold?), 8, 9 (regression test), 10, 10b spec-sync, 11b live-proof, 12, 13, 14, 15 |
| `ui` | 5a, 5b, 5c, 8, 11, 11d, 12, 13, 14, 15b |
| `copy` | 6 (wording), 12, 14, 15b, 16 |
| `pricing` | 4 (gating ACs), 7, 7b, 9, 12, 13, 14, 15, 15b, 15c |
| `migration` | 4 (defaults), 7b security (RLS/grants), 8 (D-FIELD/D-BOOL under new defaults), 10b spec-sync, 13 |
| `test` | 6 (mapping), 9 (can-fail statement), 13 |
| `framework` | spec, plan/review-plan/implement/review-exec (essential), test-run, spec-sync, index-restamp, ledger — svc-repo work receipts what applies instead of `na`-noting the ~20 product-only stages above |

**⛔ All-features WRITE mode is FORBIDDEN.** `sync-spec-code` mass-editing specs outside a
story is the same hazard class as an unsupervised bulk-doc revert — unsupervised writes at
scale. If a repo-wide drift census is ever wanted, it runs **FLAG-ONLY** (read-only report,
zero writes), and every finding becomes its own scoped story through the chain. 10b is always
story-scoped.

## Situational stages (invoke when the trigger fires — not part of every story)

| Trigger | Skill |
|---|---|
| **a limit, quota, price or gate BECOMES ENFORCEABLE** (something that was decorative starts binding) | **`evasion` — see below. This is the highest-yield situational stage in the contract.** |
| pricing/landing experiment wanted | ab-testing |
| public content / store listing changed | seo-audit / ai-seo / aso |
| marketing demo asset needed | demo-recorder |
| test-debt suspected | audit-coverage |
| architecture shape changed | track-topology-diff, design-tech |
| destructive migration | project backup practice + migration security sweep |
| WHOLE-PRODUCT go-live verdict (once, not per story) | **assess-market-readiness** — the product-level gate above all stories |
| capability inventory maintenance (standing, feeds marketing/pricing stages) | capability-registry / capability-concierge |
| native release shipped | version-ledger practice (docs/ops/releases) |

## The `evasion` stage — what does an honest customer do to avoid paying?

**Trigger:** any change that makes a limit, quota, price or gate **actually bind** where it
previously did not. Making a rule real is the moment the incentive to route around it is
created — and it is precisely the moment everyone considers the work finished.

**Why it exists as its own stage.** The chain already carries three adversarial lenses and
none of them asks this question:

| Stage | Asks | Misses this because |
|---|---|---|
| 7b `security` | OWASP + STRIDE — can an attacker break in? | this is not an attack. A customer opening a second account is doing something entirely permitted |
| 15 `pricing` | are we consistent with the pricing canon? | it checks **consistency**, never **evadability** |
| 6b `impact` | what other features change behaviour? | feature behaviour, not economics |
| G6 cross-family | is the diff correct? | catches it only by luck |

A lens that only works when someone happens to look is not a gate.

**The receipt must answer three questions, with arithmetic:**

1. **What does a user who does not want to comply actually do?** Not an attacker — a rational
   customer. Enumerate the routes: a second account, a downgrade before the meter reads, a
   different entity, splitting one thing into several.
2. **What does evasion cost versus compliance?** Compute both sides. A finding here is a
   number, never an opinion.
3. **If evasion is cheaper, what enforces compliance?** If the answer is "nothing", the
   change ships a rule that only honest customers obey — say so in the receipt rather than
   discovering it later.

**Worked example (the finding that produced this stage).** A shipped change made a plan
ladder enforceable. Nobody re-ran the arithmetic afterwards. Three days later:

> Fifteen Starter accounts cost \$74.85 + 1.5% against one top-tier account at \$99.99 +
> 0.25% — so splitting is cheaper below \$2,011 of aggregate claimed value. **And
> fragmentation multiplies every monthly quota**: fifteen accounts carry fifteen times every
> per-account limit. Nothing enforces one-account-one-business.

The pricing canon had even flagged the *pre-enforcement* form of this — *"a ten-location
chain can run on the entry tier today"* — and the fix closed that form while opening a new
one that nobody re-checked. **Fixing it created it.** That is the shape this stage exists
to catch.

## Mechanics

1. Each story gets `docs/specs/receipts/<WI>.receipts.json` (template:
   `references/receipts-TEMPLATE.json`, generated from `references/stage-registry.json`).
2. Every stage entry: `{ stage, status: done|na|pending, evidence: [paths/citations], note }`.
   `done` needs ≥1 evidence that EXISTS in the repo (the validator checks); `na` needs a note.
2b. **Provenance (`grounded_on`)** — every `done` stage ALSO lists the INPUT truths it was
   derived from, kind-prefixed: `code:` (a measured line/behaviour), `artifact:` (a repo
   document read), `external:` (world practice consulted), `ruling:` (an owner decision),
   `sweep:` (an independent verification report), `measurement:` (a computed check).
   `evidence` answers "what did this stage produce"; `grounded_on` answers "**how was this
   calculated**" — the validator refuses done-without-grounding. A later auditor must be able
   to re-derive any receipt from its grounding alone.
   **Why:** the recurring agent failure modes are hallucination, using PART of the data, or
   using a STALE version of it. Grounding makes all three auditable: a claim with no source
   is naked; line-precise `code:` citations should carry `@<short-sha>` so staleness is
   mechanically detectable (the cited line can be re-read at that commit and diffed
   against HEAD).
3. `node scripts/audit-story-receipts.mjs docs/specs/receipts/<WI>.receipts.json` — prints the
   matrix; **exit 1 while any required stage is pending or unevidenced**. Run it in the PR
   that claims the story done; paste its output in the PR body.
4. The story's final PR updates the relation ledger and the QA companion in the SAME PR
   (stages 12–13 are receipts like any other, not afterthoughts).
5. **Progress reports render ALL required stages, every time**, with per-stage status —
   never an abridged chain. Abridging is how stages silently drop.
6. **Design-conformance close gate.** The design stages (5a/5b/5c) certify the *spec before
   the code*; nothing above re-checks the *code against the spec* (feature specs get that
   closure via 10b; screen specs had none — 5 mismatches, 2 on a SIGNED decision clause,
   walked through 26 green stages on WI-QUIET-FOLLOW-01). Therefore: **if the story has a
   screen spec (`docs/specs/ui/<WI>*.md`), closing requires
   `docs/specs/design-conformance/<WI>.md`** — every §UX/§UI/§Device row graded with a
   `path:line` citation, grade column exactly one of `MET` / `PARTIAL — WI-xxx` /
   `FILED — WI-xxx` / `MISSING`. **`MISSING` = blocker** (implement or re-sign, never
   silently file). If a signed DECISION card covers the WI, the report MUST also carry a
   `## Signed clauses` exit-walk: every signed sub-clause → `MET` + code citation, or
   `RE-SIGN` (which blocks until the owner signs) — the intent gate is bidirectional, entry
   signature AND exit walk.
   **Enforcement boundary (honest):** `scripts/audit-story-receipts.mjs` mechanically
   enforces — report presence, coverage of the spec's declared `UI-<WI>-NN` IDs **1:1 in
   BOTH directions** (an uncovered spec row fails; so does a report row the spec never
   declared), the exact grade enum (the WI pointer accepts `—` or `-` as the dash), zero
   MISSING, a tracked `path:line` citation on every MET, and the signed-walk section with
   only MET/RE-SIGN grade cells (bounded at the next heading; fenced/indented-code rows
   don't count). Regression suite: `scripts/audit-story-receipts.test.mjs` (node --test).
   What it CANNOT check: the TRUTH of a grade (does the cited line really implement the
   row) and the COMPLETENESS of the signed-clause enumeration (DECISION cards are prose —
   no denominator to parse). Both stay review judgments, which is why the conformance
   report goes through the cross-family seam like any implement diff.
7. **Evidence-tracked preflight (the gitignore class).** Before writing any `done` receipt,
   run `git ls-files --error-unmatch <path>` on every **repo-local** evidence path — a clean
   `git add` + green commit proves nothing when a blanket ignore silently skips the file.
   `https://` and `commit:` evidence are NOT preflighted this way — the validator has its own
   checks for those kinds (URL: trusted-but-visible; commit: object must exist). The
   validator rejects untracked evidence at close; the preflight catches it at the stage
   where the fix is one `.gitignore` negation, not an archaeology dig.
8. **Landing/marketing surfaces are gated, whoever holds the keyboard.** Any diff to
   landing pages, landing components, or public marketing copy must pass the
   `benchmark-landing` gate (score ≥7 at every production viewport) BEFORE merge, and in
   a cross-family split those surfaces are **handback territory**: the execution half may
   flag a landing untruth (that IS in-scope for spec-sync) but files it as a
   `.sync-requests/` note or a FINDING — it does not edit the page. An ungated
   marketing-surface edit is exactly the class the gate exists for; the G6 reviewer treats
   an ungated landing diff as a blocking finding.
8b. **The landing gets the SAME visual evidence as any feature surface — plus native.**
   A `benchmark-landing` score is a judgment, not a picture; stages 11 and 11d still
   apply to the landing as a touched surface. Required with any landing/marketing-surface
   diff:
   - **Mobile web light+dark (390×844) is MANDATORY and ranks first** — paid campaign
     clicks land there, on a phone, before anything else in the funnel.
   - Desktop light+dark (1600×900).
   - **Native (Capacitor) is NOT automatically N/A** if the project's own routing config
     makes the landing the app's first screen for a logged-out open. Either capture it on
     real hardware per stage 11d, or write the disposition with the redirect/route
     evidence that makes it unreachable — an unstated assumption is not a disposition.
   - Baselines live under `docs/specs/visuals/baseline/landing/` with a `MANIFEST.md`
     mapping each capture to what it evidences, and are `git ls-files`-verified.
   A WebGL or animated hero can stall headless — capture with reduced motion, and never
   present a stalled hero as the page.
9. **Canonical-vs-twin: the boundary is PUBLISHING, not editing.** Which side owns an
   artifact depends on which copy is canonical:
   - **Repo file canonical, artifact mirrors it** (QA companion, marketing context):
     the executor **MAY and MUST** edit the repo file — including the
     `backed by J-xx, audited <date>` stamp, which stage 12 *requires*. The stamp is
     an **evidence claim, not a signature of authority**: writing it is permitted
     exactly when the browser walk happened before the steps were written AND every
     mobile-marked flow was pre-walked on device, with tracked evidence. G6 verifies
     the claim; a stamp whose walks cannot be produced is a blocking finding.
     Republishing the twin at the canonical artifact URL is a separate, owner-gated step
     → leave a `.sync-requests/<domain>` file.
   - **Artifact canonical, repo copy mirrors it** (pricing model): the executor makes
     **no judgment at all** when the mirror may lag — it stops, leaves
     `.sync-requests/pricing-mirror`, and records the stage `na` with the freshness
     reason.
   When a prompt and this contract disagree, the contract wins and the prompt gets fixed —
   do not punish an executor for obeying the contract.
10. **Every receipt sweeps its OWN item across all aspects — the chain is not a relay of
   narrow lenses.** The chain was built as a pipeline: each stage owns one specialty and
   hands on. That is exactly how things fall **between** stages, each of which did its own
   job correctly:

   | What was missed | Stages that each did their narrow job | The aspect nobody owned |
   |---|---|---|
   | Plan limits became evadable by account-splitting | 7b security ✓ · 15 pricing ✓ · 6b impact ✓ | the economics of avoidance |
   | A landing section rendered dark-on-dark | benchmark scored ✓ · baselines existed ✓ | anyone actually looking at the image |
   | The chosen provider was unbuyable in a target market | its pricing page was read ✓ | its **availability**, **billing** and **localization** pages |
   | Coverage sampled one market only | the measurement was real ✓ | that the product is international |

   Adding an eleventh narrow stage (as Mechanics-adjacent `evasion` does) treats the
   symptom. The rule is the cure: **whatever a stage is working on, it examines that item
   from every aspect below, not only its own.**

   **The aspect sweep — five questions asked of the item in hand, at every stage:**

   | Aspect | The question, asked of THIS item |
   |---|---|
   | **Money** | does this change what anyone pays, or what it costs us to serve? |
   | **Avoidance** | what does a rational person do to route around it, and what does that cost them versus complying? |
   | **Promise** | what does this claim publicly, and is the claim true? |
   | **Existing** | what happens to the rows, the customers and the state that are ALREADY there when this lands? |
   | **Neighbours** | what else touches this item, and does it now disagree with it? |

   **The rule above all five — answer at the SOURCE.** The primary page, the rendered pixel,
   the live database. Not a summary, not a score, not the page adjacent to the one that
   actually answers. This is not a sixth aspect: it is how every aspect is answered.

   ⚠️ **"Avoidance", deliberately not "abuse".** The word matters: *abuse* implies a bad
   actor, and that framing is precisely why 7b/STRIDE missed the account-splitting hole — a
   customer opening fifteen accounts is not abusing anything, they are legitimately avoiding
   a cost. Name the aspect for the honest customer, or the aspect will keep being skipped.

   **Grounding rule, which is what makes this a gate and not a ceremony:** each aspect is
   answered with a **citation, a number, or an explicit N/A carrying its reason**. "Not
   applicable" without a reason is not an answer. A receipt whose aspects are all prose has
   not run the sweep.

   **Scope discipline:** the sweep is about the item, not the universe. If the item is one
   copy string, `Money` is N/A in one line. The cost is small precisely because it is scoped
   to what the stage already has in its hands.

## Cross-link to chain receipts (WI-521 Batch C, C4 — one field, no merge)

The per-commit chain-receipt envelope (`references/chain-receipt-contract.md`) and this
per-WI story-receipts file are two distinct granularities with explicit, unmerged roles.
The one link between them: a `done` stage entry's `evidence` array **SHOULD** carry a
`commit:<sha>` item (already a supported evidence kind — see `evidenceOk()` in
`scripts/audit-story-receipts.mjs`) naming the commit that produced it, and
`land-changeset` folds `story_receipt_sha256` (a hash of this file) into the chain-receipt
envelope it contributes at land time. Neither side alone can be forged into a false
"done": the envelope names a hash this file must actually produce, and this file's stages
point back at commits the envelope covers.

## Why this exists (one paragraph)

Quiet hours shipped with: a spec promise with zero behavioural ACs, two implementations of
one concept, a gate that never fires under default data, an e2e that stays green because the
feature is inert, a capability row certifying "WORKS" against dead code, and a QA step
pointing at a screen that doesn't hold the control. Every one of those had a stage in the
table above where it would have been caught — the stages just weren't obligatory. Now they
are: **a story ends when the chain is receipted, not when the code merges.**
