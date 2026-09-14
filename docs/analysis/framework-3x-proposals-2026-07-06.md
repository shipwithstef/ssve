# Framework 3× Review — Three Verified Proposals (2026-07-06)

**Ask:** review the entire framework and propose 3 things that make it 3× better with zero quality loss.
**Method:** ultracode read-only fan-out (run `wf_84754c7f-f51`, 43 agents, 0 errors): 10 dimension reviewers → cross-dimension dedup (30 → 10 candidates) → 3 adversarial lenses per candidate (quality-loss refuter with "ceremony IS the value" as hard constraint, impact skeptic re-deriving realistic multipliers, prior-art vs WI INDEX + skills + ecosystem) → top-3 synthesis → final adversarial judge.
**Verdict:** judge **APPROVED**, 0 blocking objections, 0 substitutions. 9/10 candidates survived verification; 1 killed.
**Headline math (impact-lens realistic numbers, not reviewer optimism):** 1.4 × 1.35 × 1.25 = **2.36× floor product**, ~**2.5×** with cross-terms; **~2.0× floor** if the two user-sign-off children of Proposal 2 are declined. Zero quality loss is not asserted — it is **gated** (WI-463 golden-output floors, mutation-red-tested tier-1 additions, evaluate-rule refusal gate).

Filed as **epic WI-471** with children **WI-472 / WI-473 / WI-474** (see `docs/specs/work-items/WI-471.md`). Proposals stop here for the owner's pick (`post_design_human_gate`).

---

## The three proposals (ranked)

### P1 · WI-472 — Deterministic bounded reconcile (realistic 1.4×, effort M, net-new)

**What:** rework `scripts/svc-reconcile.mjs` at byte-identical gate semantics: (1) explicit ~15s timeouts on every `execSync`/`spawnSync` gh+git call (verified: **zero** timeouts exist today, including unbounded `gh auth status` and `gh pr list`); (2) Responsibility A switches from N per-sha spawns of `check-chain-receipts.mjs` to ONE `--range base..head` call (flag already implemented at ~`:365`, unused by both consumers; per-sha retained for the first-run last-5 case); pre-push `10-receipts-complete` rewired to the same batch mode; (3) `autoDrive` (currently the FULL tier-1 suite inline in preflight — the root of the documented 9-min hang) becomes a detached, lock-filed background job writing a drive-outcome receipt surfaced at next preflight; (4) **strictness recovery:** `last_pr_watcher_run` may advance ONLY when a drive-outcome receipt exists AND `gh_available:true` — fixing the pre-existing always-advance hole so a dying background drive or gh timeout can never drop a merged-unverified PR from the window. The blocking decision (unaccounted commits, refuse mode, exit 1) is unchanged.

**Why:** the single worst documented stall on the every-session entry path AND a dead gate — memory records the 9-min silent hang killed at ~60s with a weaker manual git-log fallback; `.svc/reconcile-checkpoint.json` is stale since **2026-06-07** (~85 commits behind), proving the gate hasn't completed a run in a month. An L3 refuse-mode gate that users routinely kill is a strictness hole, not just latency. Impact lens: ~30–50× on hang sessions, ~2× clean sessions; batching measured 7.1s → 4.0s over the live window.

**Risk (judge-corrected):** backgrounding auto-drive delays remediation to next-preflight — note `svc-auto-drive.mjs` exits **1** on verify-fail (not 0), but enforcement equivalence holds because `svc-reconcile.mjs` ignores the child status for its own exit code; a gh timeout maps to the existing `gh_available:false` degraded path and never advances the watcher cutoff; first bounded run still blocks honestly on the real 85-commit backlog.

**Proof gates:** p95 < 10s over 5 live preflights on the current backlog; WI-463 golden-output OLD-vs-NEW byte-identical verdicts across a 5-state fixture matrix; batch-vs-per-sha empty diff over the live window; degraded-path red tests (gh hang → <20s + watcher NOT advanced); 2 new mutation-red-tested tier-1 validators (call-timeouts, watcher-advance).

**Sequencing:** lands FIRST — P2's mechanism 0 adds a notes re-push step into the same file.

### P2 · WI-473 — Chain-throughput dead-time program (realistic 1.35×, effort M, extends WI-461)

**What:** four mechanisms, every gate at its normal position, EXEC strictly serial. **(0) Concurrency fence first:** replace the force notes refspec `+refs/notes/svc-receipts:…` (`install-git-hooks.mjs` ~`:126`; last-writer clobbers, production-observed loss) with `sync-receipt-notes.mjs` (fetch → `git notes merge --strategy cat_sort_uniq` → non-force push, bounded backoff; port git-appraise's pattern) wired into pre-push + land-changeset + P1's bounded reconcile; tier-1 validator asserts the force refspec is gone. **(1) Closeout-tail collapse:** after G7 passes, emit the verify-promotion receipt on the promoted SHA, then land the docs/specs-only status flip via the WI-360/376 exempt path `quick-fix-eligibility.mjs` already mechanically classifies — instead of a third PR round-trip — plus a fail-closed flip validator. **(2) Cross-WI plan pipelining:** speculative seg-1-plan for WI-N+1 in a fresh WI-380 worktree while WI-N is in exec/review/land; seg-2-exec hard-blocks on WI-N's verify-promotion receipt; at land, `disjoint-scopes.mjs` intersects landed vs planned file-sets (non-empty → plan redrawn through the FULL adversarial review-plan gate); append-only INDEX/ledger carve-out. **(3) Review-wait dovetail:** during the blocking Codex round, a prep subagent creates the exec worktree + records the WI-462 OLD-baseline tier-1 run, **keyed to the merge-base tree SHA and re-recorded if the base moved** (closes the stale-green hole — adopted as hard AC). Mechanisms (1) and (2) each require an explicit user sign-off WI; **(2)'s sign-off must surface the WI-459/C2 precedent** (semantic coupling was the stated rejection ground there — judge directive).

**Why:** the hot/cold gap is dead time, not gate compute — WI-470 took 129 min with a **58-min closeout tail (45%)** for an already-exempt docs flip, while the 2026-06-28 hot session shipped 6 WIs at 26–29 min each. Tail collapse ≈1.55–1.7× on cold cycles; dovetail ~3–6 min/WI; blended realistic 1.35×. Mechanism 0 is a gate **sharpening** (receipt durability under contention) and the prerequisite that makes any overlap honest.

**Risk:** file-disjoint speculative plans with semantically stale premises are not re-reviewed unless scopes overlap — in-class with accepted S5/WI-387/388 policy, and exec/review/audit still run on the real tree; `cat_sort_uniq` same-SHA concat fails CLOSED (parse error blocks); declining the sign-off WIs caps this at mechanisms 0+3 (~1.15× floor).

**Proof gates:** two-writer race test 20/20 receipts survive (baseline: demonstrable loss) + same-SHA corruption fails closed; next 3 cold WIs show tail < 10 min (baseline 58); mutation-red-tested validators (no-force-refspec, exempt-flip integrity, seg-2 interlock); 5-WI 100% envelope-completeness audit; baseline-staleness red test; sign-off provenance rows asserted in the decisions ledger.

### P3 · WI-474 — Close the severed learning loop end-to-end (realistic 1.25×, effort M, extends WI-384/WI-343)

**What:** four wiring steps on existing verified mechanisms, no gate touched. **(1) Schema unification:** key-slug all 23 project-ledger entries (verified 0/23 keyed → the injector's `learning-index.mjs:34` silently drops the ENTIRE project ledger), normalize 6 string confidences ("high" vacuously passes the documented `>= 7` jq filter — a live false-green); new tier-1 `validate-learning-schema.sh`. **(2) Promotion cadence:** land-changeset closeout triages that run's auto-captured candidates (cap ~5/landing; WI-343's "NEVER auto-promotes" stays intact); pending-count in session-start healthcheck (72 candidates stranded today, ledger frozen ~26 days). **(3) Elevation executor:** `elevate-learnings.mjs` consuming the verified-orphaned `elevationCandidates()` (zero consumers; 13 learnings qualify today, 0 ever elevated) joined with the fires ledger; every rule ships through the EXISTING mandatory evaluate-rule gate. **(4) Federation last:** read-only sweep of the 15 roots in `~/.svc/projects.json` → `~/.svc/knowledge/stack-learnings.jsonl` as an L3 source for recall-stack-knowledge (≤3-match cap unchanged); **per-root ledger existence validated at plan time** (judge directive — several roots may have no ledgers).

**Why:** the orthogonal capability lever — capture works, conversion is dead at every post-capture segment (72 unpromoted candidates including the two highest-value classes; 0% elevation conversion; project ledger structurally invisible; scars project-captive). Pure trigger wiring on existing machinery = highest impact-to-net-new-code ratio in the survivor set; compounds with P1/P2 (more cycles → more triage points → fewer repeat failures).

**Risk:** rule inflation on the worst-scored dimension (context economy 3/10) — bounded by the 5/landing cap, evaluate-rule refusal gate, the injector's hard 10K cap, and the 90-day decay valve; worst case degrades advice quality, never verification integrity.

**Proof gates:** 72 → <20 pending within 4 landings with per-entry triage records; injectability 0/23 → 23/23 keyed + 6 → 0 vacuous confidence passes (mutation-red-tested validator); zero rules ship without a passing evaluate-rule receipt (refusal count reported honestly); 10-session injection-precision non-regression; federation provenance validator; ≥1 logged fire on a newly promoted/federated entry within 14 days.

---

## Compounding argument

The three multiply rather than overlap because each attacks a different factor of throughput × capability on disjoint surfaces: P1 revives the dead session-START gate, P2 removes cycle-STRUCTURE dead time (tails, idle review waits, serialized plan heads — none of which reconcile touches), P3 converts cycles into compounding CAPABILITY. No second is double-counted (preflight vs tail/wait vs avoided-rework). Cross-terms push 2.36× toward ~2.5×: the bounded reconcile hosts the notes re-push that fences P2's pipelining; faster cycles create more triage points for P3; P3's prevented repeats buy back cycles P1/P2 made cheaper. Rejected pairing confirmed: eval-suite economics (1.2×) overlaps P2's dovetail on the same 163s window.

## Judge verdict

**Approved.** Non-blocking notes, all incorporated above: (a) auto-drive exit-code correction (P1); (b) quote the ~2.0× floor alongside the 2.5× headline (done); (c) cosmetic line-number drift (`--range` parse at `check-chain-receipts.mjs:365-367`, `shasFromRange` at `:348`); (d) P2 mechanism-2 sign-off must surface the WI-459/C2 semantic-coupling rejection precedent (adopted as AC); (e) P3 federation payoff must be validated against actual per-root ledger existence at plan time (adopted as AC).

## Survivors not selected (ranked by realistic multiplier)

| Candidate | Realistic× | Overlap | Why not top-3 |
|---|---|---|---|
| Eval-suite economics: green-tree cache + impacted-validator shift-left + timing telemetry | 1.2 | extends WI-461 | overlaps P2's dovetail (same 163s window) — double-counted seconds |
| Behavioral-regression revival: diff-triggered tier-2 subset + model-migration eval gate | 1.2 | extends WI-192 | strong candidate; tier-2 stale 2.5 months, Sonnet-5 switch un-evaled — file next |
| Prove-red mutation harness for all tier-1 validators (~136 grep-sentinels, no red evidence) | 1.2 | net-new | partially pulled into P1/P2/P3 proof gates; standalone sweep is follow-up |
| Knowledge/injection channel activation (action-time Layer-2 + plan-grounding receipts) | 1.2 | extends WI-454/432; absorbs WI-316 | must sequence after WI-454 per WI-440 one-per-run hot-path rule |
| Mechanized routing: deterministic first-pass intent router + golden routing corpus | 1.15 | extends WI-338 | lower ceiling; catalog budget already 258% — needs the diet first |
| Hot-read context diet: compiled ~12KB route-pack + wave-2 progressive disclosure | 1.15 | extends WI-455/364 | real but smaller; route read-set is ~138KB/entry today |

**Killed (1/10):** "Operate lane: journey-anchored production-pulse" — impact lens ran a live PostHog query: CoVibeFusion has 0 visitors/0 sessions in 30 days and ZERO custom product events, so the AC-level telemetry-diff engine (the differentiating 80% of an L-effort design) would run on an empty stream (≈1.1×, below the 1.15 bar). Re-propose as an S-effort coarse pulse once any project has engaged users and instrumented journeys.

## Dimension state (10-reviewer grounding, condensed)

- **context-economy:** static floor gated post WI-361/365/366, but per-tool-call injection unmetered/imprecise (learning-injector 4 fires in 5 tool calls, majority false-positive; no `fires_off` in rulesRegistry); zero runtime context telemetry; largest hot reads unfiled (validate-feature 69KB, diagnose-bug 59KB).
- **hook-latency:** 14 sync spawns/Edit (~361ms, WI-370); pre-push runs the full 238-validator suite (~163s) uncached; reconcile unbounded (→ P1); WI-454/456 already own the trio consolidations.
- **chain-throughput:** WI-470 = 129 min, 45% closeout tail; hot sessions prove 26–35 min/WI floor → tails/waits, not gate compute (→ P2).
- **routing/catalog:** works, prose-heavy; description budget at 258% of native (25.8K/10K tokens, regressed from 220% as external packs landed); ~138KB read-set per routing entry; trigger matrix has zero validator coverage.
- **verification/evals:** 236 hermetic validators in ~163s gating every push, but only 16 use fixtures, ~136 grep-sentinels with no prove-red evidence, 1 confirmed broken-validator incident; tier-2 stale since 04-22; EXEC/REVIEW switched to Sonnet 5 with **no behavioral eval since**.
- **learning-system:** capture+injection live (71 fires/26 days) but conversion dead at both ends (→ P3).
- **model-economics:** effort:high declared with **0 consumers** (none of 27 agent files carry effort; high is the API default → WI-470's effort intent delivers zero delta); receipts carry no token fields yet WI-399 makes token-delta acceptance-blocking; claude-native pins stale Sonnet 4.6; mimo-code-native REVIEW references a nonexistent model key.
- **orchestration:** strong fences (claims, disjoint-scopes, WI-398 merge driver, WI-380/382/387/388), thin utilization — the WI queue itself is serial and the notes ref is force-push lossy (→ P2 mechanism 0); WI-469 owns intra-epic parallelism.
- **knowledge/SME:** write side strong (74 banks, 6.5MB, SME spine WI-430..436 fully merged — memory saying 432/433/435/436 remain is stale); read side near write-only (no injector, freshness rotted 64–127d, INDEX.md itself drifted).
- **project-leverage:** heavy build-time consumption (example-marketplace ~90 spec artifacts; 15 registered roots) but leverage stops at merge; no lane consumes production reality; learnings never cross projects (→ P3 federation); `references/bootstraps/` empty despite extract-bootstrap + 30+ workspaces.

## Provenance

Run `wf_84754c7f-f51` (2026-07-06): 10 reviewers → dedup 30→10 → 30 lens verdicts (9 survived, 1 killed) → synthesis → judge. Full per-agent returns: workflow journal (session transcript dir). Guard note: this session's WI-411 completion guard was stale (merged PR #76) — reconciled and archived; janitor swept 19 more stale lane-tasks files + 1 stale claim.
