# Astra planning and review instruction cleanup

WI: WI-FW-ASTRA-INSTRUCTION-AUDIT-01
Status: PROPOSED — self-reviewed; Grok xhigh round 1 dispositioned; focused follow-up pending
Created: 2026-09-12
Base SHA: e50a64431955cac787c39161f03a18021386086f
Branch: feature-astra-instruction-audit
Worktree: .worktrees/feature-astra-instruction-audit
Current authorization: self-review the audit, obtain Grok xhigh advisory review, create the worktree, and save the plan. Framework implementation, release, installation, global policy updates, and the owner-decision proposals below are not authorized by this planning request.

## Outcome and constraints

Make SSVE's instructions easier to select and consume without weakening the original acceptance criteria, cheaper executor guidance, or enforced safety/review contracts. The intended operating split is Astra High for reasoning and planning through plan-changeset and for the orchestrator's review of execution; a separately selected cheaper model implements. The current default resolver routes PLAN to Sol High and EXEC to Grok High; these observations do not describe all possible WI/session overrides. The cognitive REVIEW label is distinct from the external station lists.

Use the existing skills, references, stage metadata, task graph, owner policy and validator infrastructure. Do not add model-specific copies of the skill pack, a new scheduler, a new receipt type, a new always-on checklist, or a new global context quota. Treat the OpenAI article as prompting guidance, not local proof of cost savings or permission to remove a gate.

The exact original audit is initial-audit.md. self-review.md supersedes its overstatements, preserves all R1–R14/S1–S13 dispositions, and adds the previously omitted universal research rule as R15. inventory.json contains the base-bound census. Independent findings and their dispositions will be retained next to these files.

## First implementation changeset proposed after owner approval

This is a bounded documentation/metadata pilot, not approval to implement every audit suggestion. P1–P4 run serially. The implementer must preserve every positive trigger, exclusion, conditional lane invocation, role boundary, skill output, phase ID, receipt obligation and verification requirement unless a separately approved decision explicitly changes it. An unexpected requirement to change runtime/schema behavior reopens only that affected scope; it is not grounds to silently widen this pilot.

### P1 — One-skill, clause-preserving description pilot

Exact source target: skills/ad-video-script/SKILL.md, description scalar only. The complete proposed value is frozen in ad-video-description.proposed.txt: move the existing `Use when` and `Do not use` sentences to the front; retain every other word in the description. No sentence moves into the body, no clause is shortened, and the body stays byte-identical. This proves frontloading without assuming a cheaper executor can safely classify a safety-bearing sentence as disposable narration. It makes no claim of source-size or token savings.

The complete twelve-description census is frozen in description-baseline.json, with original source/description hashes and Before Starting presence. Description-level protected clauses include SEV/human approval, default-OFF/opt-in, specialist exclusions, rule-registration prerequisites and independent reviewer authority. All remain visible in descriptions. The other eleven descriptions are outside this pilot, including mandatory review/security/research routing text. A later wave requires a per-clause map before edits, not a rationalized map after them.

The ad-video description keeps every explicit phrase, tagged-WI invocation and existing-cut exclusion verbatim. Compare the proposed value against the frozen original and use the existing compiler's parsed description. Do not change generic triggers, aliases, invocation policy or risk. Any inability to make this exact reorder within the current contract stops that edit; it does not authorize a policy change.

### P2 — Three-skill continuation obligation map; source edits deferred

Read-only targets: skills/analyze-domain/SKILL.md, skills/evaluate-rule/SKILL.md, skills/sync-work-items/SKILL.md. Record each unique state/loading/receipt/mirroring/completion/skip/standalone obligation and exact locations. Preserve the stronger existing parent-only mirroring and no-subagent-TaskUpdate requirements in the map. The broad earlier mirroring instruction must not be presented to an isolated executor without its parent-only condition. Authority conflicts belong to D7, not D2/D3.

All three lack a Before Starting heading. The current validator passes because it checks creation metadata/family coverage, not substantive-edit history, whereas _shared/before-starting.md says an older skill becomes blocking after a substantive edit. Passing that validator does not reconcile the textual requirement. Accordingly, no P2 SKILL.md body edit is in the first implementation envelope. D3 must resolve the applicable context contract before a later deduplication changeset. The map must enumerate remaining conflicts; this phase does not claim that source is already unambiguous.

Do not remove the global 'No inheritance-by-reference' rule, impose product-runtime-v2 on standalone utilities, or remove repeated critical instructions from isolated agent prompts. evaluate-rule is read-only in this pilot, including its description, When to skip, Process steps, last_evaluated reuse rule and continuation; D5 methodology remains unapproved.

### P3 — Correct stale model prose without changing dispatch

Exact targets: CLAUDE.md, skills/plan-changeset/SKILL.md, skills/execute-changeset/SKILL.md, references/model-routing.md, rules/common/model-selection.md. Replace unsupported unconditional family/version requirements with the existing cognitive role and effective-policy resolution instruction. Distinguish registry defaults from owner dispatch policy and per-work/session overrides. Replace the hardcoded 'currently' co-author with active-model derivation.

Do not change references/model-registry.json model defaults, generated agent pins, ~/.svc/dispatch-policy.json, ~/.svc/reviewer-policy-v2.json, external review station lists, or release_authority. All svc:generated blocks and their enclosed bytes are frozen. Do not run scripts/generate-manifest-mirrors.mjs in this pilot. Correct only non-generated prose; add a surrounding registry-default label where needed without modifying a table. The manually mirrored profile/model-ID tables and machine-parsed KIMI_DETACHED_CAPS block are also frozen; the stale non-generated Host-Specific Resolutions table in rules/common/model-selection.md may be replaced with role/resolver instructions, without inventing current model pins. A required generated-output correction is outside this pilot. The requested Astra operating split is a separate configuration decision D12, not hidden in documentation edits.

### P4 — Validate the pilot, then use the existing release chain

Check exact description text preservation and affected source-derived routing. Existing skill-judgment fixtures and validator logic stay byte-identical: the validator explicitly freezes scenario IDs A–D, so simply adding fixture rows is not supported. Its passing static checks do not prove routing quality. Store task-local behavioral cases in this plan evidence directory and use the subsequently selected existing model-evaluation transport without changing matcher/compiler/validator code. Required distinguishing cases are: explicit skill invocation still works; negative non-target request does not gain a new workflow; protected-owner/SEV exclusions survive description frontloading; the ad-video tagged-WI invocation still routes; existing-cut remux/I2V/audio-fix remains excluded. The read-only P2 obligation map retains graph/standalone conditions and original AC/proof guidance. No newly required procedure is added to any skill.

Run baseline/candidate behavioral comparisons on Astra High and the chosen cheaper executor before claiming model-specific improvement. Use the same task, source snapshot and tool availability; measure actual loaded bytes/tokens when available, redundant questions, required-step coverage, false route selections and time. Missing telemetry stays unknown. No paid behavioral runs are authorized by the current planning request beyond the requested Grok review. A later implementation authorization must include the selected evaluation route; do not invent an available transport.

Keep review-plan, execute-changeset, review-exec, audit-implementation, land-changeset and verify-promotion under the existing applicable contracts. The requested Grok review of this proposal is not an implementation receipt and does not replace owner topology. Installation follows the existing applicable commit/release policy and durable canonical-source requirements; this proposal creates no exception to a required pre-commit install check. Resolve any conflicting install-source/timing requirement before the execution handoff. No installation is authorized in this current planning request.

## Files Planned

The source modification envelope is exactly six files: skills/ad-video-script/SKILL.md (description only), CLAUDE.md (non-generated attribution/model prose), skills/plan-changeset/SKILL.md and skills/execute-changeset/SKILL.md (non-generated model prose only), references/model-routing.md (non-generated explanatory prose only), and rules/common/model-selection.md (non-generated role/model prose only, preserving context-window guidance for D10). Supporting changes are limited to existing source-derived references/skill-routing-index.json, FRAMEWORK-STATE.md's scoped progress entry, and this plan's evidence directory. All validators, fixtures, compilers, alias/trigger overrides and three P2 skills are read-only. Generate only the routing index with the unchanged scripts/compile-skill-router-index.mjs; the model-mirror generator is not in this pilot. No skill/host counts change. No hooks, authority helpers, review launcher, receipt schemas or live policy files are in the pilot envelope.

Before a later execution handoff, freeze exact CREATE/MODIFY entries, source hashes, task scopes and original AC/context links using the selected executor's supported plan-manifest contract. For this intended separate cheaper implementer, mode=dispatch is mandatory and its existing CREATE/MODIFY/blueprint contract must be complete before execute-changeset. Do not label a different executor inline because the Astra planner has context. Inline is only applicable if the same context-bearing orchestrator actually performs implementation; that is not the intended model split here. D8 remains unapproved, so no new cross-model handoff is presumed. This document is a reviewable proposed scope; it is not yet a generated, schema-certified inline-v4 or legacy-dispatch receipt.

## Task Graph and acceptance mapping

| Task | blocked_by | Acceptance criteria | Proof |
|---|---|---|---|
| P1 exact ad-video description reorder | [] | AC1, AC2, AC3 | Frozen original/proposed text; parsed frontmatter; positive/tagged-WI/negative routing scenarios |
| P2 three-skill read-only obligation map | [P1] | AC1, AC3, AC4 | Unique obligations/conflicts recorded; all three source hashes unchanged |
| P3 stale model prose | [P2] | AC1, AC5 | Effective resolver/default distinction; current attribution and unchanged policy hashes |
| P4 evidence/review/release | [P3] | AC1–AC7 | Source/behavior checks, exact reviewed candidate, existing release/install evidence |

- **AC1 — Scope:** only the approved pilot envelope changes; D1–D12 remain proposals unless separately authorized. Historical audit/review evidence remains immutable.
- **AC2 — Applicability:** the exact reorder preserves every word of the existing description and its positive condition, automatic lane condition, exclusion and approval boundary. It does not silently narrow security/review/router eligibility.
- **AC3 — Contract preservation:** skill names/counts, phase IDs, outputs, canonical state/receipt obligations, runtime proof and authority requirements remain unchanged.
- **AC4 — Continuation:** the P2 map identifies all unique obligations and unresolved conflicts with exact source locations; all three SKILL.md files remain unchanged. No claim of source deduplication or resolved ambiguity is made. Any later consolidation must keep the parent-only/no-subagent-TaskUpdate condition explicit and satisfy the applicable Before Starting contract.
- **AC5 — Models:** prose identifies cognitive roles and effective policy accurately, without changing actual model routes, independent reviewer topology, authority or global config.
- **AC6 — Measurement:** distinguish static source reductions from measured loading, latency and quality. Both Astra and the selected cheaper executor satisfy the same acceptance/authority invariants. A quality regression prevents promotion of the affected edit.
- **AC7 — Release:** full required candidate validation and the existing review/audit/land/verify chain pass. Install all provisioned hosts only from the durable canonical source and verify drift; preserve active sessions and historical compatibility.

## Owner decisions kept outside the pilot

All entries remain UNAPPROVED. Their purpose is to make later decisions concrete; none is an instruction to the executor.

| Decision | Related findings | Proposed outcome and protected boundary |
|---|---|---|
| D1 routing/specialist scope | R1–R3 | Narrow generic keyword and any-URL triggers with an artifact/action-based routing contract; retain governed mutation and required security review. Freeze positive and negative cases before changing behavior. |
| D2 task completion versus approval | R4; S1–S3, S13 | Reuse accepted authorization; support report-only/draft outputs without unrelated writes; ask unresolved consequential choices only. Keep explicit signatures, publication and destructive/spend boundaries. |
| D3 relevant reads and older-skill edit eligibility | R6–R9; F-004 | Reconcile the textual substantive-edit requirement with creation-date/family-based validator behavior before editing the deferred skills; align conditional body/frontmatter reads with actual artifact dependencies. Keep required AC, source and evidence; do not treat 'shorter' as proof of safety. |
| D4 output/composer | R11 | Respect requested output; next-action trailers only when actionable; preserve existing Codex autorun exception and unsupported-host fallback. |
| D5 rule evaluation | R12–R13 | Isolate baseline context and bind reuse to rule/model/effort/host/scenario identity. Do not pretend self-report proves behavior improvement. |
| D6 scope language | R14 | Reject unauthorized requirement reduction instead of version vocabulary; preserve explicit staged scope and complete ACs. |
| D7 stronger canonical safety wording | S4, S10–S12; F-002 | Reconcile stale planning/worktree, SEV, mock/live, and stale-task-cleanup prose to current stronger authority and live-evidence requirements. Retain parent-only mirroring and no subagent TaskUpdate. P0 is explicitly a virtual founder in DOCTRINE.md:1037, so S10 remains a real textual conflict; preserve SEV-1/2 human approval. No new mutation permission. |
| D8 cheaper-executor handoff/read boundary | S5–S6 | Evaluate a contract-complete cross-model handoff without Astra writing every implementation line. Keep legacy blueprints until full consumer/schema compatibility and behavior tests pass. Relevant read expansion remains bounded and represented in reviewer context. |
| D9 review/test cadence | S7–S8 | Measure a real trace first; remove only verified duplication. Keep full release tests, post-commit relevant checks, independent review, audit and post-deploy proof. |
| D10 context/tools | S9 | Use measured host/model recovery behavior; no automatic connector disablement, universal Astra threshold or permission bypass. |
| D11 research prerequisite | new R15 | Make external discovery depend on uncertainty/reuse opportunity while preserving exact provider/API verification and learned failure prevention. Keep useful executor-specific research guidance until tested. |
| D12 requested model split | R10; default-policy observation | Configure Astra High for the intended strategic/planning and self-review roles through existing task/global policy mechanisms, retain the chosen cheaper implementor, and decide external stations separately. REVIEW label is not the review station list; no silent policy migration. |

## Validation plan

During planning, verify exact source citations, census counts, all original finding dispositions, path existence, candidate hashes and actual Grok invocation tuple. No implementation tests or release claims are needed for merely saving a proposal.

During a later approved implementation:

```bash
node scripts/lint-skills-manifest.mjs
bash test-framework/evals/tier-1/validate-skill-structure.sh
bash test-framework/evals/tier-1/validate-chain-references.sh
bash test-framework/evals/tier-1/validate-self-verify-sections.sh
bash test-framework/evals/tier-1/validate-skill-before-starting.sh
node test-framework/evals/tier-1/validate-skill-judgment.mjs
node test-framework/evals/tier-1/validate-skill-runtime-contracts-v2.mjs
```

Use the existing router-index compiler only after source edits, then validate the derived index. Require the full tier-1 corpus at the release/commit boundary; reuse only evidence with matching input/source hashes, validator set, command options, runtime and relevant environment. Preserve relevant post-commit checks and all-host installed-state checks. If baseline fails, record and compare the actual baseline; never label skipped or inherited failures as passing. Behavioral evaluation route and actual executor must be bound before its run.

## External State and rollback

Current planning touches only this isolated worktree's documents and task-local review/state artifacts, plus the canonical review launcher's local cache/provenance store and the explicitly authorized Grok call. It does not install skills, change host settings, contact other people, publish, merge or deploy. The source package supplied to Grok excludes unrelated private profiles, credentials, and global policy contents; only necessary non-secret route observations are summarized.

The future pilot affects installed skill text and its derived routing index. Coupling is the existing canonical-source setup and all-host drift check. Roll back a failed pilot through the normal reviewed revert, regenerate the existing index, and reinstall that durable source. Preserve prior model/host guidance until its replacement proves compatible. Do not remove receipt, authority or runtime-evidence requirements as a rollback shortcut.

## Review and handoff status

Self-review: self-review.md; original response: initial-audit.md; static source inventory: inventory.json.
Grok round 1: pass-with-findings, 6/10, five high, three medium and one low. Actual requested/invoked tuple is grok-4.6/xhigh with no fallback; model observed as grok-4.6-build, effort provenance is requested. Raw findings and receipt are preserved. review-disposition.md explains each acceptance/correction/rejection. The revised proposal awaits a focused follow-up; neither round is an implementation or release receipt.
Terminal condition for the current request: original audit preserved, self-review corrections documented, the requested Grok result and dispositions saved, and this proposed plan available in the isolated worktree. Stop at that explicit user boundary; no framework implementation starts.
