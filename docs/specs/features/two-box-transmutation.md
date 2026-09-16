---
status: VERIFIED
type: Enabler
mode: contract-change
wi: WI-FW-TWO-BOX-01
landscape_state: inapplicable
landscape_inapplicable_reason: internal framework planning, receipt, and host-capability contract with no customer-facing market flow or product UI
created: 2026-09-14
---

# Feature: Two-Box Planning and Deterministic Transmutation

**Status:** VERIFIED (PR 62 squash `e016e443ea95c20d151f1703e4a63584aa26c81d`; tree `a383ed61c34d9df45c1eb0fb85d87713d006040b`). Draft did not pass review; later reviewed source did.
**Consumers:** plan-changeset, review-plan, review-inputs, execute-changeset, emit-receipt, check-chain-receipts, compile-delivery-graph, validate-delivery-graph, stage-segment, svc-stage-plan, resolve-dispatch, host-capability validator, manage-learnings, nine-host setup/drift
**Source of truth:** docs/specs/work-items/WI-FW-TWO-BOX-01.md
**Approved solution:** docs/plans/two-box-transmutation/solution-plan.md (AC01–AC18, binding decisions 1–10, SR1–SR6)
**Root design review:** docs/plans/two-box-transmutation/root-design-review.md

## Delta contract

**Preserved:** mandatory delivery chain; owner reviewer topology; this WI's own receipts are the reviewed inline v4 bootstrap snapshot; historical v1 control-plan and v3/v4 plan-manifest readers on genuine notes; quick-fix-eligibility content-first classifier; repositoryIdentity and git-common-dir store; dispatch-policy as the only cognitive-role authority; evaluate-rule promotion for learnings.

**Changed:** new substantive plans run Two-Box once before conversion unless the classifier recomputes eligible on a real diff; Open Box uses Codex --ephemeral --sandbox read-only --ignore-user-config with a facts-only cwd and tool-free/canary proof; Dual-Pass scouts are two fresh processes on Contract only; assessor winner is open/contract/combination; conversion prepares complete v5 (inline and dispatch) before existing holistic review then seals from the actual review-plan receipt; research uses one shared predicate with resume; launch narrative is claim-audited.

**Non-goals:** new lane or duplicate holistic review; prompt-pretend isolation; mutating ~/.svc/dispatch-policy.json, HOME, CODEX_HOME, or global Codex config; fabricating historical receipts; paid multi-provider benchmark; product UI; fixing unrelated Cursor mutation hook scope-normalization.

## UX / UI disposition

No product graphical surface, screens, or design tokens. Operators are headless skill/CLI consumers. UX/UI design artifacts are not applicable. Operator-visible states are CLI/skill outcomes specified here and in J-FW-07.

## Headless consumer stories

### CS-1 Planning orchestrator
Invoke Two-Box once before P3 unless eligibility recomputes true, convert the selected solution into a complete v5 contract, obtain the existing review-plan verdict, seal envelope-only.

### CS-2 Open Box planner
Receive original requirements and frozen facts only, in a facts directory, without SSVE planning files, competing drafts, inherited chat, or the review-package builder.

### CS-3 Contract Box planner
Independently form a solution from SSVE specs in a fresh process. Initial original remains stored after scout-driven revision.

### CS-4 Dual-Pass scouts
Two distinct assigned processes inspect only the initial Contract original. Coverage is supplied/observed files, not citations.

### CS-5 Assessor
Consume originals, revised Contract, and scout reports. Winner is open_win, contract_win, or combination. reject_innovation is a disposition. Unresolved conflict blocks.

### CS-6 Executor
Receive original clauses. Local repair vs consequential amendment as AC09.

### CS-7 Reviewer
Review the complete selected contract prepared before the run. Seal binds this receipt; no review hash inside the pre-review plan.

### CS-8 Historical receipt consumer
Validate genuine public-root notes with original version rules. Other new legacy issuance fails. One bootstrap v4 body remains valid by content hash.

### CS-9 Installer
Install on nine hosts; isolated_plan_analysis declared; Codex candidate still fail-closed without preflight.

## Acceptance Criteria

| ID | Criterion | Verification |
|---|---|---|
| AC01 | Launch narrative correctly covers goal, phases, product specs, transmutation, receipts and bounded determinism; business remains aspirational/secondary. | README.md and DOCTRINE.md claim-audit: remove unsupported entropy/attention-reset/universal-superiority/unmeasured-savings claims; business language remains aspirational; living-spec and receipt-scope explanation present. |
| AC02 | New substantive plans invoke both boxes once, before conversion, with eligible lightweight exceptions only. | two-box-plan recomputes quick-fix-eligibility on the real consumer diff; caller eligible true is ignored; dual_track.off, files<=3, non-infra, and size below M never exempt. |
| AC03 | Open/Contract originals are immutable and isolated; supplied context/read evidence is captured and contamination diagnosed. | Open Box: facts-dir + Codex --ephemeral --sandbox read-only --ignore-user-config; never --read-only flag; never treat --ignore-rules or Landlock as AGENTS/read isolation; never buildReviewPackage; putObject originals; contamination enum with fail-closed on disallowed_methodology. |
| AC04 | Exactly two distinct assigned traversals challenge only Contract Box; coverage gaps remain explicit. | Two scout processes; coverage.complete only from supplied_files/observed_reads; citations cannot prove complete. |
| AC05 | Open win, Contract win, justified combination, unsupported innovation rejection and unresolved conflict are handled and tested. | Winner enum is open_win, contract_win, combination only; reject_innovation is a disposition; unresolved conflict blocks; contract original and revised are distinct objects. |
| AC06 | Accepted consequential changes reconcile specs/designs; original requirements survive handoff. | Conversion copies original AC text and accepted decisions; missing source_decision returns to solution analysis. |
| AC07 | Review sees the complete implementation contract; sealing after review adds no semantic choices; no duplicate holistic review. | Prepare v5 fields before review-plan; typed semantic allow-list hash; seal verifies actual review-plan receipt + candidate digest; envelope-only mutation. |
| AC08 | All execution modes retain complete appropriate handoff, AC/task/proof coverage, staleness checks and recovery. | v5 inline omits blueprints; v5 dispatch requires them; v3/v4 are readers except the frozen bootstrap v4 body; this WI issues that v4 body only. |
| AC09 | Local autonomy, justified disagreement, in-scope repair and consequential amendment follow one consistent evidence-backed rule. | Missing import of approved dep = local repair; new/upgraded dep, new config/env, changed API, broadened files/authority = amendment. |
| AC10 | Every model role/effort/host/fallback is configurable through existing authority; advisory recipes never override owner configuration. | Roles on resolve-dispatch; absent inherit PLAN or EXEC; recipes do not write dispatch-policy.json or Codex home. |
| AC11 | Confidence 6 triggers appropriate external research; 7 does not; local questions remain analysis; explicit/freshness requests work; missing assessment cannot fake sufficiency. | researchDecision table: sufficient current local evidence => resolved; missing score => analysis_required unless freshness/explicit; score 6 unresolved external => research; 7 sufficient current => no network; research task resumes requester. |
| AC12 | Compiler, validator and all activated skill/rule consumers share the conditional research decision; no example quotas/fabricated research receipts. | Census consumers call the predicate; no five-example or GitHub-first forced quotas. |
| AC13 | Planning/transmutation evidence is required at issuance and execution for new work, tampering/missing/stale evidence fails, authentic history remains readable. | emit and current check-chain require v5 plus control-plan v2 or recomputed lightweight; digest/object mismatch fails; public-root notes remain readable; bootstrap v4 is content-hash limited. |
| AC14 | Resume reuses only matching outputs; durable evidence survives isolated-worktree deletion and package/consumer roots stay distinct. | Objects under git-common-dir; package source_root != consumer checkout; resume requires matching object and digest bindings. |
| AC15 | Learning candidates can originate on either side; promotion requires outcome evidence/evaluation. | origin open_box or contract_box; elevate requires outcome plus evaluate-rule. |
| AC16 | Meaningful offline behavior fixtures and a bounded real host canary prove integration; simulated/static checks are not called live model proof. | Offline labeled OFFLINE; live canary explicit, not default tier-1. |
| AC17 | Baseline, Two-Box and full-flow evaluation reports omissions, unsupported choices, outcome, time and cost honestly; no paid broad benchmark expansion without a bounded scope. | Reports include omissions and unsupported isolation; no three-arm paid benchmark. |
| AC18 | Manifest/pipeline validators, full Tier-1 release checks, post-commit relevant checks and nine-host install/drift verification complete through the governed release chain. | validate-two-box-transmutation.sh in selector; setup/drift; land/verify unchanged. Pre-existing baseline failures stay baseline (RD12). |

## Operator-visible states

TWO_BOX_REQUIRED; LIGHTWEIGHT_ELIGIBLE (recomputed); ISOLATION_UNSUPPORTED; CONTAMINATION_DISALLOWED; SOURCE_EXPOSURE_DECLARED; SCOUT_COVERAGE_GAP; UNRESOLVED_CONFLICT; CONTRACT_PREPARED; SEALED; RESEARCH_ANALYSIS; RESEARCH_EXTERNAL; RESEARCH_RESUME; ISSUANCE_REFUSED.
