# svc Framework — Open Proposals & Improvement Backlog

**Purpose:** Single home for framework-level improvement ideas across all svc skills and shared references. Any project using svc can surface a framework gap here; any agent in any project can see the backlog without scrolling session history.

**Scope:** Framework-level only. Project-specific improvements (product decisions, feature WIs, integration choices) stay in the using project's own backlog (e.g., `docs/framework/OPEN-PROPOSALS.md` in the project repo).

**Format:** Each entry is atomic. ID + title + 1-line why + status + source.

**Rule:** When any skill surfaces a framework improvement idea in conversation, it MUST write it here before the response ends. "Filed in memory" is not enough — memory is invisible by default.

---

## Framework Skills — known gaps & improvement proposals

| ID | Title | Why | Status | Source session |
|---|---|---|---|---|
| FP-026 | Codex execution integrity: prompt authority + real skill loading | Codex currently derives Stop continuation and skill authenticity from shared/fallback state instead of exact `session_id` + `turn_id` + task authority. Live proof: this session's read-only proposal lookup received hard continuation pressure for WI-479, freshly claimed by another Claude Fable session. Separate proof: the Codex wirer installs a Kimi-only skill-load script that exits on non-Kimi hosts. Proposes a Codex-only prompt/Stop scope firewall, exact skill-load mutation receipts, canonical `apply_patch` normalization, runtime replay, and byte-identical non-Codex behavior. Detail: `proposals/2026-07-14-codex-execution-integrity.md` | PLANNING → WI-485 (Pillar 5 in WI-481 program) | Codex foreign Stop + ghost skill-load audit, 2026-07-14 |
| FP-025 | Universal "Change Impact Triad" preflight for every mutating lane (incl. quick-fix) | No lane-independent gate guarantees the triad — "does this break what works? / how is it supposed to work? / is the product affected?" — for EVERY change. `quick-fix/SKILL.md` explicitly skips the affected-artifacts/expected-behavior/regression audit (verified this session); `diagnose-bug` has it; `plan-blast-radius` is infra-only. Proposes a mandatory full assurance standard: triad preflight (F-001) + auto-escalation (F-002), generalize blast-radius beyond infra (F-003), independent verification not self-attestation (F-004), runtime/behavioral proof (F-005), mechanical risk-class never-fast-lane (F-006), coverage-creation-not-note (F-007), hook-level enforcement (F-008), risk-proportional tiering (F-009). Detail: `proposals/2026-07-14-change-impact-triad-universal-gate.md` | PLANNING → WI-481 (worktree) | Example Marketplace WI-ADMIN-ACCESS-01 session 2026-07-14 |
| FP-024 | Gate-vocabulary reconciliation: `G6` is dual-meaning (review-exec vs land/promotion) | Cleanup-plan §4.3 (WI-CLN-7) asked to relabel `review-exec`'s self-label `G6`→`G5b` in `review-exec/SKILL.md` only. Full blast-radius grep (2026-06-14) proves this DEGRADES: review-exec is called "G6" in ~25+ live files — REPO_MODES/EXTERNAL_ADDONS/AGENTS/WORKTREES/README/execute-changeset/route-workflow, the **tested journey J-FW-02**, **8 `docs/specs/reviews/wi-*-exec-cross-model.md` records**, and ~13 WI closeout records (frozen audit trail) — while `land`/promotion is ALSO called "G6" in DOCTRINE/review-gate/`reviewGates.G6`/gate-checklists. Two gate-numbering SCHEMES collided (the mandatory-chain "review-exec=G6" vs the original 7-gate "land=G6"). Relabeling one file orphans 25+; relabeling the audit/journey records FALSIFIES history. Needs a deliberate canonical-scheme decision (explore-solutions) + a dedicated WI, NOT a mechanical quick-fix. Option A as written is rejected with evidence. | OPEN — needs explore-solutions + canonical-scheme decision; do NOT execute plan §4.3 Option A | mimo-plan /goal session 2026-06-14 (WI-CLN-7 deferral, fully investigated) |
| FP-023 | Add Claude Legal Skills as External Addon | Integrate new legal playbooks into launch-knowledge/launch to assist with NDAs and corporate compliance during launch | DRAFT | Current Session 2026-05-13 |
| FP-022 | Feature validation closeout ledger | Prevents user-facing features from closing without a persona → AC → journey → runtime/E2E → saved-state evidence matrix | PROMOTED to WI-305 | Example Marketplace WI-233 feature-validation correction 2026-05-11 |
| FP-021 | Provider/source fidelity for AI visual deliverables | Prevents fallback/placeholder/generated-by-wrong-provider assets from being accepted when the user asked for a named primary integration such as Base44 main AI image/content generation | PROMOTED to WI-306 | Example Marketplace WI-233 saved-outcome correction 2026-05-11 |
| FP-001 | `plan-changeset` ground-truth gate: Base44/backend schema round-trip per entity | 3 production bugs shipped in one session because no skill diffs spec-claims vs. live backend schema | PROMOTED to WI-308 | Example Marketplace WI-093 session 2026-04-21 |
| FP-002 | `write-spec` brownfield mode: must re-verify entity schema, not trust upstream code | WI-093 inherited `is_active` drift from in-prod code that silently drops unknown fields | PROMOTED to WI-308 | Example Marketplace WI-093 session |
| FP-003 | `_shared/backend-query-gotchas.md` — enumerate known-bad operators per backend (Base44 `$gte/$lte/$in` silently-empty, etc.) | No skill knew to check for operator-drift behaviors | PROMOTED to WI-308 | Example Marketplace WI-097 |
| FP-004 | `audit-coverage` — tier-differentiator features must have dedicated management UI | Skill missed that a Growth-tier differentiator feature had only a Quick Actions button, no mgmt page | PROMOTED to WI-305 | Example Marketplace WI-093 escalation |
| FP-005 | `sync-spec-code` — check PRICING_SPEC/BUSINESS_SPEC page-level feature claims against route table | Same root cause as FP-004 from different skill | PROMOTED to WI-305 | Example Marketplace WI-093 escalation |
| FP-006 | `write-journeys` — producer-scenario completeness: "create" does NOT satisfy coverage; require list+edit+deactivate+quota+history | J03 claimed to ground a producer-side flow; only covered create | PROMOTED to WI-307 | Example Marketplace WI-093 escalation |
| FP-007 | Product-questions 12-section format — see `_shared/product-question-format.md` | Prevents surface-level yes/no that misses structural issues | **LANDED 2026-04-21** — `_shared/product-question-format.md` + 12 skills patched | Example Marketplace WI-099 session |
| FP-008 | `review-gate` Step 6: ground-truth convergence — cannot PASS if schema round-trip wasn't run | Enforcement for FP-001 | PROMOTED to WI-308 | Example Marketplace WI-098 postmortem |
| FP-009 | `route-workflow` pipeline-tier declaration upfront (full / compressed / rush) — not silent default to fastest | Memory `feedback_never_execute_what_you_wouldnt_recommend.md` archetype | PROMOTED to WI-320 | Example Marketplace WI-093 session |
| FP-010 | Per-project persistent improvement backlog — every surfaced framework-adjacent idea lands in project's OPEN-PROPOSALS.md before response ends | User feedback 2026-04-21: "you surface too many things and bury them" | **LANDED 2026-04-21** — pattern established | Example Marketplace WI-099 session |
| FP-011 | ≥40 product questions per feature before BASELINED (≥20 customer + ≥20 system) | Prevents thin specs that pass G1 with incomplete coverage | **LANDED 2026-04-21** — `_shared/product-question-format.md` + write-spec/review-gate gate rules | Example Marketplace WI-099 session |
| FP-012 | 12-section product-question format (plain translation + 5 considerations + 5 competitors + justification + risk + success + cost + persona + reversibility + innovation + decision-synthesis + phase tag) | Prevents surface-level Q&A | **LANDED 2026-04-21** — `_shared/product-question-format.md` | Example Marketplace WI-099 session |
| FP-013 | Agent-recommends-first rule | User feedback: "provide your own recommendation NOT BASED ON PRESSURE" | **LANDED 2026-04-21** — `_shared/product-question-format.md` § Process rules | Example Marketplace WI-099 session |
| FP-014 | Convergence-before-advance rule | Prevents premature spec lock-in | **LANDED 2026-04-21** — `_shared/product-question-format.md` § Process rules | Example Marketplace WI-099 session |
| FP-015 | Innovation-layer pipeline — every Q's ADOPT-IN-V2/V3 judgment becomes a candidate follow-up WI in the USING project | Prevents innovation rot | **LANDED 2026-04-21** — `_shared/product-question-format.md` § Process rule 5 | Example Marketplace WI-099 session |
| FP-017 | Framework-proposal discipline: framework proposals live in SVC repo, project proposals in project repo | User feedback 2026-04-21: "that should be unique per framework within framework repo not in example-marketplace as it's generic handler" | **LANDED 2026-04-21** — this file is the framework backlog; project repos keep their own | Example Marketplace WI-099 session |
| FP-018 | `list-work-items` should cross-reference builder-profile and flag under-prioritized WIs that directly address the builder's stated gap — and offer to auto-route them to `/validate-feature` | Today's discovery: WI-089 + WI-090 (user-sampleed onboarding) were captured at `severity: low` + buried in backlog. They are THE mechanism that addresses the builder's documented `zero-to-revenue-gap`. No skill surfaced that misalignment. Builder had to eyeball the list and notice "wait, this is actually the most important thing." User feedback 2026-04-21: "when list features is run this should trigger and prioritize and stuff, log as side proposal." | PROMOTED to WI-321 | Example Marketplace WI-089/090 re-prioritization session |
| FP-019 | WI archival rules — `VERIFIED` items older than N days should auto-rotate to `DONE.md` or `INDEX-ARCHIVE.md` to keep open backlog scannable | User question 2026-04-21: "is VERIFIED the final status of a work item?" → revealed there's no cleanup mechanism; INDEX grows forever. | PROMOTED to WI-322 | Example Marketplace list-work-items session |
| FP-020 | Bidirectional builder-profile weighting on K1 — features that DIRECTLY address the builder's documented distribution/revenue gap should HALVE or INVERT K1 (not double it). Doubling is for vanity features; inversion is for the answer-to-the-gap features. | Example Marketplace WI-089+090 session 2026-04-21: builder-profile `[zero-to-revenue-gap]` would normally double K1 on "no demand evidence." But THIS feature IS the distribution mechanism — refusing it on K1 grounds is circular (proof-of-demand requires distribution channel to exist first). Framework needs to distinguish features-that-cause-the-gap from features-that-solve-the-gap. | PROMOTED to WI-321 | Example Marketplace WI-089+090 validate-feature session |

---

## Stale (>30 days, no activity)

A visible holding area for proposals with no activity in >30 days, so the
never-delete backlog stays scannable without losing the audit trail. Move a row
here from the main table only after confirming it is genuinely abandoned; an
in-session or recently-discussed proposal stays in the main table.

| ID | Title | Last activity | Action needed |
|---|---|---|---|
| (none yet) | | | |

---

## Rules for this file

- New entries added at the top of the table
- When a proposal LANDs (code merged), update Status with `**LANDED <date>** — <what-shipped>` and keep the row (audit trail)
- Never delete; move obsolete rows to `## Closed (YYYY-MM)` section for reference
- When a framework gap is surfaced during a session in any project, file here IN THE SAME RESPONSE
- Project-specific improvements (product decisions, feature WIs, integration choices) stay in the project's own OPEN-PROPOSALS.md — this file is framework-only

---

## Upstream / contribution

This is the canonical svc framework backlog. Skills installed locally at `~/.claude/skills/` symlink into `~/app-workspaces/seriousvibecoding/`. Framework PRs edit files under this repo + commit + push here.
