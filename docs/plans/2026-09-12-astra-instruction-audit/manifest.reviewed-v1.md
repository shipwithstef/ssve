# Astra planning and review instruction cleanup

WI: WI-FW-ASTRA-INSTRUCTION-AUDIT-01
Status: PROPOSED — audit self-reviewed; Grok xhigh review pending
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

### P1 — Frontload existing applicability in twelve long descriptions

For the twelve descriptions over 600 characters in the frozen inventory, make the first sentence identify the existing task and preserve its invocation prerequisites and exclusions. Keep existing trigger meaning. Move provider/receipt detail, history and procedural narration into the corresponding existing body section; do not introduce new mandatory steps or remove a conditional invocation. These are routing metadata edits, so compare the actual parsed description and routing behavior, not just character length.

Exact skill targets: ad-video-script, align-feature, analyze-marketing, audit-coverage, blind-control-plan, craft-prompt, design-logo, evaluate-rule, plan-blast-radius, research, review-exec, review-plan. Verify this explicit set against inventory.json before implementation; a mismatch is a plan correction, not implicit scope expansion.

Deliver a before/after applicability map for each description: explicit requests, automatic lane conditions, exclusions, required owner/safety conditions, and moved procedural sentences. No arbitrary character target is a completion gate. Do not change generic triggers yet: the router/security/research behavior changes are D1/D11 below.

### P2 — Deduplicate continuation in three pilot skills

Exact targets: skills/analyze-domain/SKILL.md, skills/evaluate-rule/SKILL.md, skills/sync-work-items/SKILL.md. Compare all task-graph blocks. Keep one complete local block containing the union of non-conflicting required obligations and the existing applicable reference. In particular retain: canonical JSON source of truth; actual skill loading/receipt; only the parent mirrors host UI; no subagent TaskUpdate; completion via the helper; next-task condition evaluation; actual skip reasons; standalone behavior; existing terminal/chaining restrictions.

Do not delete the global 'No inheritance-by-reference' rule in this pilot. Do not impose product-runtime-v2 continuation on standalone tools. Do not remove repeated critical instructions from isolated agent prompts just because the parent also has them. Record an obligation map; if two blocks conflict materially, leave the disputed lines for D2/D3 rather than inventing a new policy.

### P3 — Correct stale model prose without changing dispatch

Exact targets: CLAUDE.md, skills/plan-changeset/SKILL.md, skills/execute-changeset/SKILL.md, references/model-routing.md, rules/common/model-selection.md. Replace unsupported unconditional family/version requirements with the existing cognitive role and effective-policy resolution instruction. Distinguish registry defaults from owner dispatch policy and per-work/session overrides. Replace the hardcoded 'currently' co-author with active-model derivation.

Do not change references/model-registry.json model defaults, generated agent pins, ~/.svc/dispatch-policy.json, ~/.svc/reviewer-policy-v2.json, external review station lists, or release_authority. Do not overwrite generated mirror blocks manually: use the existing generator for an applicable source correction or leave a correctly labelled registry-default table intact. The requested Astra operating split is a separate configuration decision D12, not hidden in documentation edits.

### P4 — Validate the pilot, then use the existing release chain

Check complete clause preservation and affected source-derived routing. Reuse existing frozen skill-judgment fixtures where applicable. Add only counterexamples that distinguish correct preserved behavior from a false pass: explicit skill invocation still works; negative non-target request does not gain a new workflow; protected-owner/SEV exclusions survive description frontloading; standalone tools do not create a graph merely to complete; task-graph execution still preserves current required state/receipts; fresh isolated executor retains original AC/proof guidance.

Run baseline/candidate behavioral comparisons on Astra High and the chosen cheaper executor before claiming model-specific improvement. Use the same task, source snapshot and tool availability; measure actual loaded bytes/tokens when available, redundant questions, required-step coverage, false route selections and time. Missing telemetry stays unknown. No paid behavioral runs are authorized by the current planning request beyond the requested Grok review. A later implementation authorization must include the selected evaluation route; do not invent an available transport.

Keep review-plan, execute-changeset, review-exec, audit-implementation, land-changeset and verify-promotion under the existing applicable contracts. The requested Grok review of this proposal is not an implementation receipt and does not replace owner topology. No all-host installation happens until a reviewed implementation is landed on canonical source through the normal release path.

## Files Planned

The pilot's source modification envelope is the union of P1's twelve SKILL.md files, P2's three SKILL.md files, and P3's five files. evaluate-rule is shared by P1 and P2. Supporting changes are limited to existing source-derived references/skill-routing-index.json, FRAMEWORK-STATE.md's scoped progress entry, the existing test-framework/evals/tier-1/validate-skill-judgment.mjs and its test-framework/fixtures/skill-judgment/behavior.json only when applicable counterexamples are needed, and this plan's evidence directory. No skill/host counts change. No hooks, authority helpers, review launcher, receipt schemas or live policy files are in the pilot envelope.

Before a later execution handoff, freeze exact CREATE/MODIFY entries, source hashes, task scopes and original AC/context links using the selected executor's supported plan-manifest contract. For legacy dispatch, retain its required blueprints. This document is a reviewable proposed scope; it is not yet a generated, schema-certified inline-v4 or legacy-dispatch receipt.

## Task Graph and acceptance mapping

| Task | blocked_by | Acceptance criteria | Proof |
|---|---|---|---|
| P1 description frontloading | [] | AC1, AC2, AC3 | Before/after clause map; parsed frontmatter; positive/negative routing scenarios |
| P2 three-skill continuation pilot | [P1] | AC1, AC3, AC4 | Obligation map and graph/standalone scenarios; relevant contract validators |
| P3 stale model prose | [P2] | AC1, AC5 | Effective resolver/default distinction; current attribution and unchanged policy hashes |
| P4 evidence/review/release | [P3] | AC1–AC7 | Source/behavior checks, exact reviewed candidate, existing release/install evidence |

- **AC1 — Scope:** only the approved pilot envelope changes; D1–D12 remain proposals unless separately authorized. Historical audit/review evidence remains immutable.
- **AC2 — Applicability:** frontloading preserves every existing positive condition, automatic lane condition, exclusion and approval boundary. It does not silently narrow security/review/router eligibility.
- **AC3 — Contract preservation:** skill names/counts, phase IDs, outputs, canonical state/receipt obligations, runtime proof and authority requirements remain unchanged.
- **AC4 — Continuation:** each pilot skill has one unambiguous local continuation contract; standalone and graph modes retain their existing boundaries; isolated executors retain enough guidance without inheriting parent context.
- **AC5 — Models:** prose identifies cognitive roles and effective policy accurately, without changing actual model routes, independent reviewer topology, authority or global config.
- **AC6 — Measurement:** distinguish static source reductions from measured loading, latency and quality. Both Astra and the selected cheaper executor satisfy the same acceptance/authority invariants. A quality regression prevents promotion of the affected edit.
- **AC7 — Release:** full required candidate validation and the existing review/audit/land/verify chain pass. Install all provisioned hosts only from the durable canonical source and verify drift; preserve active sessions and historical compatibility.

## Owner decisions kept outside the pilot

All entries remain UNAPPROVED. Their purpose is to make later decisions concrete; none is an instruction to the executor.

| Decision | Related findings | Proposed outcome and protected boundary |
|---|---|---|
| D1 routing/specialist scope | R1–R3 | Narrow generic keyword and any-URL triggers with an artifact/action-based routing contract; retain governed mutation and required security review. Freeze positive and negative cases before changing behavior. |
| D2 task completion versus approval | R4; S1–S3, S13 | Reuse accepted authorization; support report-only/draft outputs without unrelated writes; ask unresolved consequential choices only. Keep explicit signatures, publication and destructive/spend boundaries. |
| D3 relevant reads | R6–R9 | Align conditional body/frontmatter reads with actual artifact dependencies. Keep required AC, source and evidence; do not treat 'shorter' as proof of safety. |
| D4 output/composer | R11 | Respect requested output; next-action trailers only when actionable; preserve existing Codex autorun exception and unsupported-host fallback. |
| D5 rule evaluation | R12–R13 | Isolate baseline context and bind reuse to rule/model/effort/host/scenario identity. Do not pretend self-report proves behavior improvement. |
| D6 scope language | R14 | Reject unauthorized requirement reduction instead of version vocabulary; preserve explicit staged scope and complete ACs. |
| D7 stronger canonical safety wording | S4, S10–S12 | Reconcile stale planning/worktree, SEV, mock/live, and stale-task-cleanup prose to current stronger authority and live-evidence requirements. No new mutation permission. |
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
Grok xhigh: pending actual launcher result. Do not infer PASS, effective effort, independent approval or a release receipt from this placeholder.
Terminal condition for the current request: original audit preserved, self-review corrections documented, the requested Grok result and dispositions saved, and this proposed plan available in the isolated worktree. Stop at that explicit user boundary; no framework implementation starts.
