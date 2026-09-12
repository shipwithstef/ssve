# Frozen source excerpts

Baseline: e50a64431955cac787c39161f03a18021386086f. Line numbers refer to the baseline. Excerpts are evidence for the audit, not whole-file certification. Complete selected rules and all three pilot continuation tails are included to reveal controlling context. No private profile or global policy contents are included.

## AGENTS.md
SHA256: 493117c0a6ea6833ecd2083f58a2a8e749e33226304b6a5fca1ec5aaab158439

```text
215:    - `chain.lanes` — Lane position mapping (`greenfield`, `brownfield-feature`, `bugfix`, `framework`, etc.) with `position`, `prev`, `next`
216:    - `progressive` — Whether the skill auto-invokes the next skill in the lane
217:    - `self_verify` — Whether the skill runs a PASS/FAIL checklist before declaring done
218:    - `human_checkpoint` — Whether it stops for user confirmation in interactive mode
219: 
220: 2. **Markdown body** conventions:
221:    - Start with an "Announce at start" line.
222:    - Use **imperative, operational** language.
223:    - Use tables heavily for decision matrices, checklists, and anti-patterns.
224:    - Include a **Self-Verify** table with columns `# | Check | How | PASS/FAIL` and at least 3 data rows.
225:    - Include a **Pipeline Continuation** section describing how to update `.svc/lane-tasks-<WI>.json`.
226:    - Include **Rationalization Tables** and **Red Flags** in discipline-enforcing skills.
227:    - Keep `SKILL.md` under **500 lines** where possible. Larger content goes in `references/` or `scripts/`.
228: 
229: ### Shell Scripts
230: - Portable Bash with `set -euo pipefail` where appropriate.
231: - Node.js scripts use `.mjs` extension with inline `#!/usr/bin/env node` shebang.
232: 
```

```text
265: 
266: All feature work that produces code runs in a **git worktree** under `.worktrees/`.
267: 
268: | Phase | Runs on main | Runs in worktree |
269: |-------|-------------|------------------|
270: | Planning | write-vision, validate-feature, write-spec, design-ux, design-ui, design-tech, plan-changeset | — |
271: | Build + Validate | — | execute-changeset, review-gate, audit-implementation, E2E tests |
272: | Merge + Verify | land-changeset (squash-merge), verify-promotion | — |
273: 
274: ### Branch Naming
275: | Lane | Pattern | Example |
276: |------|---------|---------|
277: | Greenfield / Brownfield Feature | `feature-<name>` | `feature-notifications` |
278: | Bugfix | `bugfix-<name>` | `bugfix-auth-500` |
279: | Refactor | `refactor-<name>` | `refactor-api-layer` |
280: | Framework Test | `test-<name>` | `test-autopilot-s1` |
281: 
282: ### Rules
```

```text
439: 
440: - When framework behavior changes, keep `skills-manifest.json`, router logic, and any affected doctrine or state files in sync.
441: - Prefer updating the **smallest set of skills** needed, then prove the change with evals.
442: - Run `node scripts/lint-skills-manifest.mjs` after any manifest, README, or routing change.
443: - Require passing `bash test-framework/evals/run-all-evals.sh` evidence before committing skill changes. Reuse only when source/input hashes, validator set, command options, runtime, and relevant environment match the candidate; otherwise rerun. Focused iteration does not replace this release gate.
444: - **Post-commit verification:** After any commit, re-run at least the relevant tier-1 validators to confirm the committed state still passes. Do not assume pre-commit validation is sufficient — file state can shift between staging and commit.
445: - **File persistence verification:** After any batch of WriteFile/StrReplaceFile calls that creates or modifies 3+ files, run `bash scripts/verify-file-persistence.sh --from-git-status` before proceeding. If it reports MISSING files, re-create them using Shell-based writes (heredoc) instead of WriteFile/StrReplaceFile — this is the recovery pattern for post-compaction persistence failures.
446: - Keep edits small and local. Do not refactor multiple skills in one commit unless the change is a cross-cutting convention update.
447: - If you add a new skill, follow the `create-skill` SKILL.md process: validate frontmatter, add to manifest, update README, run `./setup --host <your-host>` (e.g., `claude` or `kimi`), run the manifest linter.
448: 
449: ---
450: 
451: ## 14. Key Reference Docs
452: 
453: | File | Purpose |
454: |------|---------|
455: | `DOCTRINE.md` | Complete methodology: progressive narrowing, review protocol, worktree model, token cost analysis |
456: | `FRAMEWORK-STATE.md` | Living framework self-knowledge (updated with every change) |
```

## CLAUDE.md
SHA256: 42b8728066f4ab2eb1ca257260b3ae3324ef0ac860f53435c4a6b0441625c4db

```text
72: Product: greenfield, brownfield-conversion, brownfield-feature, bugfix, drift, refactor. Framework: framework (self-improvement).
73: 
74: ### Commit Rules
75: 
76: - Author: `s7an-it <angelovsan@gmail.com>` (configured in repo `.git/config`)
77: - Co-author trailer: use the ACTIVE orchestrator model — currently `Co-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>`
78: - Branch protection is on — direct push bypasses with warning
79: 
80: ### Profile-Based Model Routing
81: 
82: This framework uses **profiles** to map cognitive labels to execution harnesses. The default profile for Claude Code is **`svc-default`** — the framework's proven multi-harness mixing.
83: 
84: ```bash
85: # What harness + model should I use for execution right now?
86: bash scripts/resolve-model.sh EXEC --json
87: # → harness: claude, model: claude-sonnet-5, effort: high (svc-default per WI-470)
88: ```
89: 
```

## FRAMEWORK-STATE.md
SHA256: c8747a1a90dcc6c6bdcefa2375f160c434d3d371c79297ff5e002f1685b7f1ed

```text
19: identity and candidate-bound correction proof remain required. The round-cap
20: checker recognizes fixed High log dispositions; execution certification vetoes
21: remain intact. Release evidence remains in the per-SHA chain receipts.
22: 
23: 
24: This file is the framework's self-knowledge. It mutates with every change.
25: Any skill that analyzes, evolves, or blends the framework MUST read this
26: first and update it after.
27: 
28: Skills that read this: `route-workflow`, `improve-framework`, `evolve-framework`, `blend-external`, `test-framework`, `create-skill`
29: Skills that update this: same list + any manual framework change
30: 
31: ## Receipt cleanup compatibility (WI-FW-RECEIPT-CLEANUP-01)
32: 
33: Compatible issued launcher 2.5.4 receipts retain current schema, provenance,
34: candidate and bounded-review checks. Bounded adjudication artifacts now resolve
35: from the existing hash-addressed archive, with corruption distinct from absence.
36: Actual PR36/PR37 note chains pass using the correction without changing signed
```

## _shared/before-starting.md
SHA256: 03d2f3a64974177cf10313816294ceba6f78bdb92ad89d2007b51827f099cbc4

```text
1: # Before Starting — relevance-closure context loading
2: 
3: Every svc skill SHOULD begin its work by checking what the project already knows. The goal is **complete relevant context**: read enough indexed and dependency-linked material to understand the affected surface, then stop. Do not read every project artifact by default, and do not stop at the minimum file list when the loaded artifact points to a dependency, spec, work item, validator, or decision that materially affects the task.
4: 
5: ## The context spine
6: 
7: | # | Source | What it answers |
8: |---|--------|-----------------|
9: | 1 | `.svc/session-contract.jsonl` | What is the current user intent, skill, WI binding, and execution mode? |
10: | 2 | `.svc/spec-index.json` | Which specs, work items, journeys, reviews, and sections mention the target surface? |
11: | 3 | `~/.svc/builder-profile.md` | Who is the builder? Their stack, role, time budget, prior decisions. |
12: | 4 | `docs/specs/project-state.md` or `FRAMEWORK-STATE.md` | Where in the pipeline are we? What is the active feature or framework surface? |
13: | 5 | `docs/specs/domain-profile.md` when present | What industry / framework / convention pack applies? What constraints does the domain impose? |
14: | 6 | Relevant specs, work items, journeys, reviews, validators, and decision logs | What behavior contract, dependencies, acceptance criteria, and known findings govern this change? |
15: 
16: ## Relevance-closure rule
17: 
18: A skill MUST resolve a bounded context plan before acting:
19: 
20: 1. Start from the session contract, user request, active WI, or explicit artifact path.
21: 2. Query `.svc/spec-index.json` via `scripts/query-spec-index.mjs --wi <WI>` or `--surface <term>` (bounded ≤2K tokens, WI-389 — never raw-load the 692KB index), plus `docs/specs/work-items/INDEX.md`, manifest metadata, or the relevant skill contract to find linked specs, dependencies, validators, and reviews.
22: 3. Read each artifact whose content can change the decision or implementation.
23: 4. Stop when the remaining links are unrelated, historical-only, or duplicate the already-loaded contract.
24: 5. If the needed dependency map or index is missing, create or update that mapping as part of the work instead of guessing.
25: 
26: This is neither "minimum context" nor "read everything." Token control comes from following the dependency graph, not from ignoring related context.
27: 
28: ## Expected reads by work type
29: 
30: | Work type | Usually read | Expand when |
31: |---|---|---|
32: | Routing | session contract, spec index, work-item index, routing rules | The WI references a proposal, review finding, or dependent WI. |
33: | Spec or planning | builder/profile context, domain context, current feature spec or WI | Existing journeys, decisions, or related WIs define constraints. |
34: | Execution | approved plan, active spec, worktree state, relevant validators | Code or tests point to a related contract not already loaded. |
35: | Validation or audit | artifact under review, source finding, validator, evidence paths | The finding depends on manifest, hook, host, or state-file wiring. |
36: | Framework work | `FRAMEWORK-STATE.md`, affected skill/hook/script, manifest, relevant validator | Host setup, installed state, or cross-host behavior is part of the claim. |
37: 
38: ## How a skill applies the rule
39: 
40: Each SKILL.md should declare a `## Before Starting` section near the top of its prose with one of these forms:
41: 
42: ```markdown
43: ## Before Starting
44: 
45: Build a bounded context plan:
46: - Start from `.svc/session-contract.jsonl`, the active WI, or the explicit user artifact.
47: - Use `.svc/spec-index.json` / work-item indexes / manifest metadata to find dependencies.
48: - Read all artifacts that can change this run's decision or implementation.
49: 
50: Skip if: <named condition under which the read is wasted>.
51: ```
52: 
53: If a skill has NO context dependencies (rare; mostly mechanical scripts), it MAY omit the section. Otherwise the section is mandatory for skills authored on or after **2026-04-28**.
54: 
55: ## Why this rule exists
56: 
57: Sessions repeatedly burn tokens re-asking questions already answered (builder name, stack, current feature, domain conventions). The 4-source chain is the floor of "things the agent should know before saying anything." Adopting it as a convention closes a token-waste loop that has fired across multiple sessions.
58: 
59: The opposite failure is also real: an agent can read only one obvious file, miss a related spec or dependency, and then skip a mandatory branch. Relevance closure prevents both failures.
60: 
61: The pattern was imported from coreyhaines/marketingskills v1.9.0 and adapted from a 1-file model to svc's 4-source layered model. See WI-135 for full context.
62: 
63: ## Validation
64: 
65: Skills authored on or after 2026-04-28 are validated by `test-framework/evals/tier-1/validate-skill-before-starting.sh`. Older skills are exempt (advisory mode) until they receive a substantive edit; at that point the validator becomes blocking for them as well.
```

## _shared/product-question-format.md
SHA256: 841589d99a3a1a0e981f13277e63695499ea3f0f48a4414445321fc692870bea

```text
1: # Product decisions (shared contract)
2: 
3: Use this contract when a skill encounters an unresolved consequential product decision. Depth follows the decision's consequences; question counts and decorative analysis are not evidence of quality.
4: 
5: ## Ground the decision before asking
6: 
7: Read current owner instructions and accepted decisions, the relevant current spec/AC/journeys and personas, and actual implementation evidence. Follow the dependencies that affect the requested behavior. Reuse evidence already loaded while checking its freshness. Code shows what happens; it does not approve what should happen. A stale spec is not automatically authoritative over a newer owner decision, and existing code is not automatically the desired design.
8: 
9: Expose conflicts between intended behavior, observed behavior and owner scope. Investigate missing relevant evidence before concluding there are no decisions. Mark unresolved facts as unknown; do not invent competitor behavior, numeric benchmarks or quota balances. Research only gaps that matter to the decision.
10: 
11: A **consequential decision** materially changes user outcomes, scope, acceptance criteria, compatibility or data handling, significant cost, or a hard-to-reverse commitment. An outcome request does not silently resolve a conflicting storage, compatibility or release policy. Resolve that conflict explicitly before dependent implementation.
12: 
13: ## Use judgment proportional to the consequence
14: 
15: For a real decision, present a plain-language choice and recommendation supported by:
16: 
17: - Relevant evidence and conflicts, including current spec and actual code.
18: - Meaningful alternatives and the reason for the recommendation.
19: - Persona/user fit and affected journeys, states and accessibility needs.
20: - Material risk, cost, reversibility and mitigation.
21: - A measurable success signal appropriate to the outcome.
22: - Useful innovation: consider a better approach when it improves this user task; explain why to adopt, defer or retain the established solution.
23: 
24: Combine these dimensions in concise prose or a table. Expand only where the decision needs it. There is no fixed heading, question, consideration or competitor count. Verified competitor examples are useful when they change the choice; internal policy conflicts do not require unrelated competitor research. Do not invent novelty to fill a template or replace product-specific UX with a generic pattern list.
25: 
26: ## Resolve only what remains unresolved
27: 
28: Carry forward explicit task authorization and clear accepted decisions. Existing AGREE/OVERRIDE history remains valid when its accepted meaning is clear; do not require those literal keywords again. The agent may resolve reversible implementation details within authorized scope, recording the rationale in the existing brief/plan. Consequential owner choices remain owner choices; silence and elapsed time are never approval.
29: 
30: Independent questions may be grouped outside the signed runtime flow. Within product-outcome runs, preserve `references/owner-decision-runtime-v2.md` and `skills/decide/SKILL.md`: use the configured signed decision/delegation boundary, deduplication and mode. This reference does not grant new signing or release authority.
31: 
32: When a consequential decision arises, record its question, evidence, alternatives/recommendation, real resolution and phase in the existing canonical decision artifact or `docs/specs/features/<feature>-questions.md` / `docs/specs/work-items/<WI>-questions.md`. Read that history on resume. Do not create an empty companion when no consequential decision arose. Do not convert an unresolved entry to resolved merely to advance.
33: 
34: ## Promotion predicate
35: 
36: Apply the same predicate at review-gate G1, design-ux UX-REVIEWED, write-spec/design-tech BASELINED, and plan-changeset SIMULATED:
37: 
38: 1. Relevant acceptance criteria and user/system states have supporting evidence or explicit scoped limitations that do not invalidate the proposed phase.
39: 2. No unresolved consequential decision blocks that phase's dependent work.
40: 3. Every required owner decision has a real resolution under the applicable authority contract.
41: 
42: Missing relevant evidence is not proof of zero decisions: investigate it and surface consequential uncertainty. An absent companion is acceptable only when no consequential decisions arose or their resolutions are preserved in the existing canonical decision artifact. A resolved, fully grounded feature can advance with zero new questions. There is no numeric question floor. Other applicable quality and release checks still apply.
43: 
44: ## Examples
45: 
46: An already-authorized local category filter with current ACs and established empty/loading/error/accessibility patterns needs no repeated persistence question. Preserve those states and verify the actual filter path.
47: 
48: A request for cross-device restoration conflicting with an accepted no-account-storage boundary needs a real persistence decision. Surface the conflict, explain storage/fallback/clear semantics and affected ACs, recommend an option, and block dependent implementation until resolved. Do not research unrelated competitors to fill a quota.
49: 
50: Retain a worthwhile deferred innovation in the existing project backlog when useful; do not create another mandatory ledger. Historical question logs remain historical evidence, not a minimum template for future work.
```

## agents/svc-stage-exec.md
SHA256: 3a5e39e585dddb74e9bacee679cc5c53338d41035b194899161710cd9ce63d1c

```text
1: ---
2: name: svc-stage-exec
3: description: Locked seg-2-exec stage executor for the WI-380 stage-isolated mandatory chain. Use ONLY when route-workflow dispatches the exec segment of an M+ WI (execute-changeset against an approved plan-manifest). Reads the hash-bound baton from seg-1-plan, works in the shared WI worktree, emits exec-record itself, returns a stage-summary ≤1K tokens. Never self-selects.
4: model: claude-sonnet-5
5: cognitive_label: "[EXEC]"
6: lock_class: executor
7: host_resolution: |
8:   Resolve dynamically via: bash scripts/resolve-model.sh EXEC
9:   On Claude Code → claude-sonnet-5
10: fallback: |
11:   Serial prose chain inline when stage dispatch is unavailable
12:   (SVC_STAGE_ISOLATION=off or agent missing). The chain never depends on this.
13: tools: [Read, Grep, Glob, Bash, Write, Edit]
14: harness: claude
15: ---
16: <!-- Locked stage executor (WI-380 transport, WI-399 B1). -->
17: 
18: You are the seg-2-exec stage executor of the svc mandatory chain.
19: 
20: ## Inputs (the baton is your ONLY upstream context — by design)
21: 1. Dispatch prompt gives: WI id, worktree path, plan-manifest receipt SHA.
22: 2. Read the plan-manifest RECEIPT (`.svc/receipts/<sha>/plan-manifest.json`
23:    or the git note) and the manifest file it points at. Its `ac_digests` and
24:    `changeset_blueprints` are your work order. Do NOT re-read the feature
25:    spec or upstream discovery prose — if the baton is insufficient, return
26:    `next_action:"re-plan"` instead of improvising (WI-381 invariant).
27: 
28: ## Your job
29: Execute the manifest task graph in dependency order (load
30: `execute-changeset/SKILL.md` and follow it): apply blueprints, run each
31: task's validation command, checkpoint commits with the required trailers,
32: keep `.svc/lane-tasks-<WI>.json` statuses + skill_receipts current via
33: `scripts/task-graph.mjs`.
34: 
35: ## Restated critical rules
36: - Absolute paths / `git -C` only; the shared worktree is the territory.
37: - Run the FULL tier-1 suite before declaring the segment done
38:   (g5-review-must-run-all-tier1 learning) — a green new-test alone hides
39:   regressions.
40: - Emit `exec-record` yourself via `scripts/emit-receipt.mjs` with the real
41:   diff_hash (sha256 of `git diff <base>..HEAD`).
42: - Atomic state writes (state-io); append-only ledgers; no lone quoted-space
43:   literals (NUL quirk).
44: - NEVER spawn subagents; NEVER push/merge/rebase; NEVER edit the plan
45:   manifest to fit the code — a blueprint/reality conflict is
46:   `next_action:"re-plan"` with the conflict named in `summary`.
47: - Hook edits under `hooks/svc-*` may hit config-protection: the sanctioned
48:   in-worktree path is a /tmp-staged file applied via Bash `cp` or a node
49:   patch script — never disable the guard.
50: 
51: ## Return contract (FINAL message, parsed)
52: `schemas/stage-summary.schema.json`, ≤1K tokens:
53: `{"stage":"seg-2-exec","wi":"<WI>","receipt_sha":"<sha>","receipts_emitted":
54: ["exec-record"],"next_action":"proceed|patch|re-plan|halt",
55: "summary":"<≤3 sentences>","baton":{"diff_hash":"...","files_touched":N,
56: "tier1":"PASS|FAIL"}}`
```

## references/chain-receipt-contract.md
SHA256: efd16f525671c6a88b239d54d6d641cf3f2d645ba3624b6a9cb2e36d0a4bd822

```text
55: per-AC navigation index) and `mocked_deps`. Distilled by `plan-changeset` from
56: the reviewed manifest after `review-plan` PASS, it lets the 5 downstream chain
57: skills (`execute-changeset`, `review-exec`, `audit-implementation`,
58: `land-changeset`, `verify-promotion`) read a one-page briefing FIRST instead of
59: re-reading the full spec + manifest at every stage start.
60: 
61: **Authority contract (load-bearing):** `ac_digests` is a NAVIGATION index, NOT
62: the authoritative AC source — the live spec at `ac_digests.spec_path` always is.
63: The baton routes attention; it never replaces a gate's evidence source
64: (`audit-implementation` keeps diffing against the actual spec).
65: 
66: **Staleness binding:** `ac_digests.spec_ac_table_sha256` is a sha256 over the
67: spec's normalized AC signatures (`scripts/lib/normalize-ac-table.mjs`), bound to
68: BOTH the manifest (the baton lives inside the tree-bound receipt) AND the spec AC
69: table. `check-chain-receipts.mjs` RECOMPUTES it against the spec **as it is in
70: that commit's tree** and fails on mismatch — so a mid-pipeline AC revision
71: invalidates the baton and forces a re-distill (it cannot silently carry stale
72: digests). The binding is insensitive to checkbox/progress flips and `*(...)*`
73: verification annotations, sensitive to real AC text revisions. v3+ plan-manifests
74: carry the baton; legacy (v1/v2) are grandfathered. Locked by
75: `test-framework/evals/tier-1/validate-baton-ac-binding.sh`.
76: 
77: ## Emit Pattern (Same for All Skills)
78: 
```

## references/context-budget.md
SHA256: f823f66d55fe629c198308e00e13bc817ad6ede6562e52a7675ad169dc356beb

```text
11: | Tier | Window Used | Behavior | Action |
12: |------|-------------|----------|--------|
13: | **PEAK** | 0-30% | Full attention, accurate recall, precise generation | Normal operation. Read what you need. |
14: | **GOOD** | 30-50% | Slightly reduced recall of early context, still reliable | Be selective about new reads. Summarize before loading more. |
15: | **DEGRADING** | 50-70% | Noticeable quality loss. Early context fades. Spec adherence drifts. | Stop loading new files. Checkpoint and hand off if possible. Restate critical constraints before generating. |
16: | **POOR** | 70%+ | Silent partial completion, hallucinated details, skipped steps. The agent does not know it is degrading. | **Checkpoint immediately.** Spawn a fresh session or subagent. Do NOT continue generating — output is unreliable. |
17: 
18: The danger of POOR is that the agent has no self-awareness of degradation.
19: It continues confidently producing increasingly wrong output. External
20: checkpoints are the only defense.
21: 
22: ## Read Depth Rules by Model
23: 
24: ### 200K Context Models (Sonnet, Haiku)
25: 
26: | Operation | Budget |
27: |-----------|--------|
28: | Subagent task (single file change) | 15-25K tokens of context |
```

```text
42: More context does NOT mean load more. A 1M window means you have more
43: runway before degradation, not permission to load everything.
44: 
45: ## Orchestrator vs Subagent Rules
46: 
47: ### Rule: Orchestrator routes, subagents execute
48: 
49: The orchestrator reads specs, manifests, and task graphs to make routing
50: decisions. It does NOT load implementation files, test files, or full
51: source trees. That is the subagent's job.
52: 
53: **Never load subagent-scope content into the orchestrator.** If the
54: orchestrator needs to know whether a task succeeded, it reads the subagent's
55: summary output — not the files the subagent modified.
56: 
57: ### Rule: Tell subagents to read from disk
58: 
59: When spawning a subagent, pass file paths, not file contents. A subagent
```

## references/runtime-continuation-v2.md
SHA256: 2e581d171a7b7d127665ca0993b80797d8d64733f4146668341d35d41d084dd6

```text
1: # Runtime Continuation v2
2: 
3: For a product-outcome run, emit each produced artifact through the contract in
4: `references/skill-runtime-contracts-v2.json`. The runtime records its producer, required consumers,
5: activation condition, invalidation rule, generation bindings and consumption acknowledgement.
6: 
7: The shared continuation spine is:
8: 
9: `plan-changeset -> review-plan -> execute-changeset -> review-exec -> audit-implementation -> land-changeset -> verify-promotion -> customer + owner + operations + metric`.
10: 
11: Skill-specific skip rules, gates, human checkpoints, unique evidence and downstream conditions remain
12: authoritative. This reference replaces only the act of writing the same task/projection continuation;
13: it does not delete or weaken any layer benefit. An output with no declared consumer is an orphan and
14: fails compilation. `ACCEPTED` is not terminal; downstream consumption and product lifecycle proof are
15: required.
```

## rules/common/question-fatigue.md
SHA256: b0def9e425961be70fcd6c3e2ba7ed2da0d4db499fd1eda96d32381575f84a7c

```text
16: | "build it" | Start building |
17: | "yes" / "sure" / "ok" (after a proposal) | Proceed with the proposed approach |
18: 
19: ## Rules
20: 
21: 1. **One question max.** If you have already asked the user a question in this
22:    conversation thread, you may not ask another. Make a reasonable default
23:    decision and execute.
24: 
25: 2. **No "what next?" trailers.** When presenting completed work, end with a
26:    statement of what was done, not a question. If the user wants something
27:    else, they will say so.
28: 
29: 3. **Imperative = action, not discussion.** When the user uses an imperative
30:    decision word, your next response must contain action (file edits, commands,
31:    concrete output), not questions.
32: 
33: 4. **Ambiguity is not an excuse.** If the user's imperative is ambiguous,
```

## rules/common/research-before-build.md
SHA256: ea830569ba1ad5b7da58ea23cd7e407d2157e6a3d2bdd34dee098af112d1266e

```text
1: ---
2: description: Research before implementation — search priority that prevents reinventing the wheel
3: scope: project
4: stack: universal
5: source: blended:ecc
6: source_sha: 125d5e619905d97b519a887d5bc7332dcc448a52
7: ---
8: 
9: # Research Before Building
10: 
11: Before writing any new implementation, search in this priority order:
12: 
13: 1. **GitHub code search first** — `gh search repos` and `gh search code` for
14:    existing implementations, templates, and patterns. Do this before writing anything.
15: 
16: 2. **Vendor/library docs second** — consult primary documentation to confirm API
17:    behavior, package usage, and version-specific details before implementing.
18: 
19: 3. **Broader web search only if needed** — use WebSearch for discovery after
20:    GitHub and primary docs have been checked.
21: 
22: 4. **Check package registries** — search npm/PyPI/crates.io/etc. before writing
23:    utility code. Prefer a battle-tested library over a hand-rolled solution.
24: 
25: **Goal:** adopt or port a proven approach whenever it covers 80%+ of the requirement.
26: Writing net-new code is the last resort, not the first instinct.
```

## rules/verify-state-before-context.md
SHA256: 1b181a93192001cea01472a33bf540420984f605a000f4f8e57e819b737b504b

```text
1: ---
2: id: svc-verify-state-before-context
3: type: correction
4: scope: universal
5: severity: high
6: ---
7: 
8: # Rule: Verify System State Before Acting on Stale Context
9: 
10: When the session context mentions branches, worktrees, file states, or commit hashes that may be stale (e.g., after context compaction, long sessions, task resumption, or subagent handoffs):
11: 
12: ## Required Verifications
13: 
14: 1. **Before any git operation**, run `git branch`, `git status --short`, and `pwd` to confirm the actual branch and working directory.
15: 2. **If a worktree is mentioned in context**, verify `pwd` is inside that worktree. If not, explicitly note the mismatch before acting.
16: 3. **Never assume branch or worktree state from context memory is current.** Compacted context can be minutes or hours old.
17: 
18: ## Read the deployed ref, not the local working tree
19: 
20: Local clones of multi-branch repos are routinely **parked on feature branches**, not the canonical deployed ref. The file you `Read`/`grep` is whatever branch happens to be checked out — **not** what is deployed or running.
21: 
22: 1. For ANY claim about what is **deployed / running / current**, read `git show origin/<canonical-ref>:<path>` — never the `Read`/`grep` tool against the local working tree.
23: 2. Before quoting file content as "what runs", run `git -C <repo> rev-parse --abbrev-ref HEAD` and compare to the canonical ref. If they differ, your working-tree read is stale and may be flatly wrong.
24: 3. Canonical refs (this program): `ezbob-services` → `main-pilot`; `ezbob-platform` → `main-pilot`; `gitops-ezbob` → `main`; `new-devops-platform` → `main`.
25: 
26: **Origin (2026-06-20):** a feat-env mongo-bootstrap bug was diagnosed **three times wrong** (ephemeral-storage wipe, initdb-not-mounted, "the author forgot rs.initiate") because the diagnosis `Read` `ezbob-platform`'s working tree while it was parked on a stale feature branch (`wi179/lms-init-port-fix`). The deployed `actions/dbank-bundle-bootstrap/action.yml` on `origin/main-pilot` actually contained `--replSet rs0` + `rs.initiate()` — the stale branch lacked them. `git show origin/main-pilot:<file>` gave the correct answer instantly. The real cause was unrelated (non-fatal bootstrap guards + a cold-start CAST node-provisioning timing race), and the wrong reads sent three corrections to the wrong place first.
27: 
28: ## Git Rename Detection
29: 
30: - **Do NOT use** `git show --name-only` to check for renames — it omits zero-line renames.
31: - **Use** `git show --stat` or `git show --name-status` instead.
32: - **Use** `git ls-files <path>` to verify if a file is currently tracked.
33: 
34: ## Rationale
35: 
36: Treating stale context as ground truth causes:
37: - Commits to the wrong branch
38: - Redundant or impossible git operations
39: - False conclusions about file state (e.g., "file not tracked" when it was renamed)
40: - Violation of the worktree isolation model
41: 
42: ## Example (correct)
43: 
44: ```bash
45: # Context says "Active worktree: feature-x" — verify before acting
46: git branch          # confirm actual branch
47: git status --short  # confirm actual state
48: pwd                 # confirm actual directory
49: ```
50: 
51: ## Stale lane-tasks files
52: 
53: Before reporting any WI as `pending`, `in_progress`, or `blocked`:
54: 
55: 1. Check git history: `git log --all --oneline --grep="$WI" | head -5`
56: 2. If the WI has merged commits (recognizable pattern: `(#NN)`, `feat(...)`, `merge`, `land`), the WI is **not pending** — the lane-tasks file is stale from a deleted worktree or a copy that survived a merge.
57: 3. **Do not report a stale lane-tasks file as actionable backlog.** Either rename it `<file>.completed-<PR>.json` or delete it.
58: 
59: The tier-1 validator `validate-stale-lane-tasks.sh` enforces this (Phase A: warn; Phase E: fail).
60: 
61: This was the failure mode on 2026-04-30: a status hook reported `WI-SPINE-001 tasks blocked pending approval` after PR #55 had already merged, because a copy of the lane-tasks file persisted in main's `.svc/`. Captured as WI-SPINE-006.
```

## skills/ad-video-script/SKILL.md
SHA256: 44c387741ca8c1228a7b6e8afc95e02a2494a6c92caf558dd3e1aee8baa26329

```text
3: version: "1.0"
4: description: >
5:   Performance ad-video script writer modeled on a Senior Direct-Response
6:   Creative Strategist. Reads the ACTUAL product first (landing page / spec),
7:   picks the right ICP + scenario + placement + awareness stage, then writes a
8:   modular script AND a render-ready BEAT SHEET (6 × ~10s beats with per-beat
9:   first-frame image-prompt, motion-prompt, persistent-character lock, and
10:   last-frame seeding) — because no video model renders a coherent 60s clip in
11:   one shot (Veo 8s; Runway/Kling/Pika ~10s). Emits one base script, or many
12:   variants when ≥2 placements or awareness stages qualify. Hands the beat
13:   sheet to `produce-ad-video` (WI-402) to render. Use when "ad video script",
14:   "video ad", "UGC script", "promo video script", "60 second ad", "make an ad
15:   for <product>", or any WI tagged ad-video / performance-creative. Do not use
16:   for remux/I2V/audio-fix of an existing cut — that is `produce-ad-video`.
17: inputs:
18:   required:
19:     - { path: "docs/specs/vision.md", artifact: product-source, note: "the REAL product — read the live landing-page URL via curl, or this spec / docs/specs/vision.md. Grounding is mandatory step 1." }
20:   optional:
```

## skills/align-feature/SKILL.md
SHA256: 049a1495ca04e3aac37542c91dc2caae82f41aa0b3d636dd9916097c2108f8e3

```text
18: description: >-
19:   Execute the story-receipts chain for one WI until the validator prints STORY ALIGNED —
20:   the fixing counterpart of /audit-feature. Walks every required stage in order (personas →
21:   validate/intent card → spec → skills/design-ux/ui/device → journeys → ac → implement → e2e →
22:   test-run → spec-sync → visuals → qa-companion → ledger → marketing → pricing), each through
23:   its owning skill, recording a tracked receipt per stage. Use when the founder says "align
24:   <feature>", "оправи <feature> по веригата", "continue the chain for WI-X", "fix it the
25:   receipted way", or after /audit-feature produced a receipts file.
```

## skills/analyze-domain/SKILL.md
SHA256: bb27c141bd0824ad5004f86544ea192c2b34da8a5984f4402c23b93d828e5b52

```text
1: ---
2: name: analyze-domain
3: version: "1.0"
4: description: >
5:   Identify and build domain expertise for the project. Reads vision to determine
6:   industry, tech stack, and domain. Loads or creates stack convention packs. In
7:   identify mode, produces docs/specs/domain-profile.md. In research mode, resolves
8:   domain questions for other skills. Use when: "what domain is this", "domain expertise",
9:   "what do I need to know about this space", "industry context", or automatically
10:   after write-vision in progressive mode. Also invoked by other skills when they need
11:   domain-specific knowledge beyond what training data provides.
12: phases:
13:   - id: P1-KnowledgeFirstCheck
14:     trigger: always
15:     reads: ["references/knowledge/INDEX.md", "references/knowledge/domains/<domain>/CAPABILITIES.md"]
16:     writes: []
17:     evidence_kind: command_output
18:     required_for_completion: true
19:   - id: P2-DomainSignalExtraction
20:     trigger: always
```

```text
294: 3. Check knowledge gaps: have any low-confidence areas been resolved by new code/research?
295: 4. Check stack convention packs: still match the current framework versions?
296: 5. Report: section-by-section CURRENT/STALE/OUTDATED
297: 
298: ## Pipeline Continuation
299: 
300: ### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
301: - Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
302: - Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
303: - In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
304: - Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
305: - Evaluate the next task's conditions from its description
306: - If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
307: - If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
308: - Per `route-workflow` Task-Graph Execution Protocol
309: 
310: ### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
311: - Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
312: - Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
313:   cross-session, cross-subagent source of truth.
314: - Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
315:   is ONLY performed when running in the parent/top-level session. Detect via:
316:   host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
317:   check fails, skip host mirroring — file state is the durable record; the
318:   orchestrator parent will re-read and re-mirror after the subagent returns.
319: - Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
320:   graceful; it's silent drift between the subagent's intent and the host UI.
321: - Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
322: - Evaluate the next task's conditions from its description
323: - If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
324: - If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
325: - Per `route-workflow` Task-Graph Execution Protocol
326: 
327: ### Chaining
328: 
329: **Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
330: - Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
331: - Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
332: - In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
333: - Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
334: - Evaluate the next task's conditions from its description
335: - If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
336: - If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
337: - Per `route-workflow` Task-Graph Execution Protocol
338: 
339: **Discovery wave (WI-387 — opt-in, faster):** analyze-domain, analyze-competitors, and build-personas each need only `vision.md` and write disjoint paths, so they can run as ONE concurrent wave via `dispatch-waves` (catalog-domain-capabilities as wave 2) instead of the serial chain — ~55% faster discovery. **Before dispatching, the disjoint-write fence is mandatory:** `node scripts/discovery-wave-fence.mjs` (fails closed on any write-scope overlap). `validate-feature` still gates the merged discovery. Serial-domain-context is a soft, stated cost. See `references/discovery-wave.md`. Permitted mutating transport per the S5 policy (recorded 2026-06-09).
340: 
341: **If `--progressive` and self-verify passed (serial default):**
342: - Chain to analyze-competitors: `analyze-competitors --progressive --lane greenfield`
343: 
344: **If standalone:**
345: - Report domain profile summary
346: - Suggest: "Next: run `analyze-competitors` if not already done, or `build-personas`"
347: 
348: ## Post-Compaction Recovery
349: 
350: If Kimi CLI compacted context and you lost track of framework state:
351: 
352: 1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
353: 2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
354: 3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
355: 4. **Re-read this SKILL.md** — Refresh context for the current step
356: 5. **Resume execution** — Continue from where the task left off
357: 6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete
358: 
359: If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
```

## skills/analyze-marketing/SKILL.md
SHA256: f3bd52b6ec7ee9e4e6ae1772b20d61d3af080884383ebd83bde59e96db073c9e

```text
3: version: "1.0"
4: handles_concerns:
5:   - paid-analytics-api
6:   - revenue-attribution
7: description: >-
8:   Mine feature specs for marketing value and maintain the product marketing context. Use when: "mine features", "marketing context", "positioning", "find our strongest marketing angles", "what should we market", "marketing ammunition". Second mode — marketing-message validation: "persona validation", "does our messaging work", "stress test the copy", "buyer perspective", "who are we actually talking to". Also: "feature mining", "extract marketing value", "update marketing context". Also: "what features should we highlight", "what's worth marketing", "marketing potential", "refresh marketing insights", "set up context", "feature value".
9: phases:
10:   - id: P1-RepositoryModeTrackerPreflight
11:     trigger: always
12:     reads: ["REPO_MODES.md", "docs/marketing/feature-mining-tracker.json", "docs/specs/marketing-context.md", ".agents/product-marketing-context.md"]
13:     writes: []
14:     evidence_kind: command_output
15:     required_for_completion: true
16:   - id: P2-WorkQueueBatchSelection
17:     trigger: always
18:     reads: ["docs/specs/features/*.md", "docs/marketing/feature-mining-tracker.json", "docs/specs/domain-profile.md", "docs/specs/analyze-competitors.md"]
19:     writes: []
20:     evidence_kind: command_output
```

## skills/audit-coverage/SKILL.md
SHA256: e3865f275681bf6ddbeca29de5f8a3fd5348137fe286f2227bcc33b5b2d442e3

```text
4: description: >-
5:   Audit a project against the svc canonical artifact catalog — classifies each artifact CANONICAL / FOREIGN / MISSING, produces docs/specs/coverage-audit.md plus ordered next-skill recommendations. Standalone or from onboard-repo Step 2.5. Use when: "audit coverage", "what artifacts are missing". Triggers: "audit-coverage", "what svc artifacts are missing", "check brownfield alignment". Contract: log then triage, do not fix as found. Also: "check svc artifact coverage", "coverage gap audit", "are all canonical artifacts in place", "what alignment is needed"; output includes a "Coverage Gaps" section.
```

## skills/blind-control-plan/SKILL.md
SHA256: 8b22a7d080aab81d62f76803d8bbd174fd889a9f4b804986482ec2342b73a899

```text
6: description: >
7:   Best-of-2 retention floor that proves the framework plan is never worse than a
8:   bare-model "blind" plan. Generates a context-starved blind plan B, deterministically
9:   diffs it against the framework plan F, and — when F silently removes or weakens a
10:   correct B-element without an independent cross-family judge certifying a strict
11:   improvement — ships B verbatim (floor_verdict=blind-adopted). Emits a control-plan
12:   ROI receipt. v1 is WARN/shadow, default OFF (armed via .svc/chain-policy.json
13:   dual_track:"measured"); it is a gate, not a pipeline step. Use between plan-changeset
14:   and review-plan on infra-path + M+ plans when dual-track is armed. WI-410.
```

## skills/comms/SKILL.md
SHA256: 9c71d8a7353f393623ea4da16cc8b3c66f8b85eebc1e45d39bb9d2f4341e2296

```text
28: 
29: Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.
30: 
31: ## Preflight
32: 
33: Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.
34: 
35: ## Procedure
36: 
37: 1. Verify facts and audience. 2. Draft concise message variants. 3. Flag claims needing specialist review. 4. Append an approval card with the draft path. 5. Run `preflight`.
38: 
39: ## Red Flags
40: 
41: Stop on missing approval owner, unsupported claim, personal data, legal promise, or request to send/publish.
42: 
43: Live evidence: not-applicable (no visible artifact).
44: 
45: ## Self-Verify
```

## skills/craft-prompt/SKILL.md
SHA256: 61ba6d06a91d0eb5ff1ec5aa261d7a06b352223e70eeb399524b2ffefa0f39ac

```text
7: description: >
8:   Craft a world-class, output-shaped prompt for a task AND prove it is never worse than a
9:   baseline/"sheep" prompt via a cheap best-of-2 floor. Use this whenever the user says
10:   "craft me a prompt", "make this prompt better", "write a prompt that...", "beat this viral
11:   prompt", or needs a high-leverage prompt for an arbitrary task — even if they don't say the
12:   word "prompt-engineer". It unlocks what the model already knows (persona, output-format,
13:   few-shot, constraints) via an authoring rubric, then runs a best-of-2 floor so the crafted
14:   prompt is never worse than the bare/viral baseline. WARN/shadow, default OFF — opt-in only.
15:   Does NOT route svc work (that is route-workflow's Prompt Composer); this CRAFTS a standalone output prompt.
```

## skills/decide/SKILL.md
SHA256: b78e5f8b50f4e6ac909d743c3359e508581b133ac5650646ea5d859f696ed2b5

```text
15:   human_checkpoint: true
16: description: >-
17:   Present a decision to the founder so it can actually be decided — story first, real options
18:   as outcomes, world practice, grounded confidence per option, and one recommendation. Use when
19:   the founder says "give me the decision", "какво решаваме", "дай ми опциите", "trqbva li da",
20:   "what should we do about X", "decision matrix", "подреди ги по важност", or whenever an audit,
21:   plan or review has produced something a human must choose. Also use before handing any scope
22:   to an executor — an unsigned decision is not an instruction. NEVER present a decision menu
23:   any other way.
24: ---
25: 
26: # Decide — put a choice in front of the founder that can be answered
27: 
28: ## Product-runtime v2 owner surface
29: 
30: When a `product-improvement-protocol-v2` run is active, this skill is the **only** owner-facing
31: decision surface. Read `references/owner-decision-runtime-v2.md`; preserve the run's language and
32: mode, reject repeated unresolved-decision digests, and emit the selected and all rejected options
```

## skills/design-logo/SKILL.md
SHA256: 145fee22a5cc13e0ba24f20d1184ce941040645ada7e5d00af3d11653d9b55e8

```text
11: description: >
12:   Produce a brand mark + lockup pack as scalable SVG with iterative refinement
13:   toward world-class quality (≥65/70 rubric, no designer-handoff exit). Use
14:   when creating, redesigning, or polishing a logo. Triggers on "design a
15:   logo", "make a logo", "redesign the logo", "logo is bad", "10/10 logo",
16:   "world-class logo", "favicon", "wordmark", or when downstream skills need
17:   a finalized identity. Outputs the full variant matrix + animation +
18:   brand-pattern set + icon-style sheet + app-context mockups. The skill
19:   terminates only at ≥65/70 with 5/5 love-test pass; plateaus trigger
20:   constraint escalation, never handoff.
```

## skills/evaluate-rule/SKILL.md
SHA256: 093977a7dc9d0755799820febf7d3500567acb3ad0afcb4bdcaa3061b2356b20

```text
1: ---
2: name: evaluate-rule
3: version: "1.0"
4: description: >
5:   Use when deciding whether a candidate rule file (for CLAUDE.md / AGENTS.md
6:   injection) earns its per-turn token cost, or whether it merely restates
7:   Claude's default behaviour. Triggers on "evaluate this rule", "should we
8:   adopt this rule", "is this rule worth it", "check if this rule beats the
9:   default", "rule evaluation", "evaluate a rule pack", "audit rules/",
10:   "prevent rule inflation", "does this rule change behaviour", "gate a
11:   blended rule pack before adoption", or whenever new rule files are being
12:   considered for `rules/` or `~/.claude/rules/`. Always use before
13:   registering a rule in `rulesRegistry`.
14: inputs:
15:   required:
16:     - { path: "rules/**/*.md", artifact: candidate-rule }
17:     - { path: "references/rules-policy.md", artifact: rules-policy }
18:   optional:
19:     - { path: "docs/specs/project-state.md", artifact: project-state }
20:     - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
```

```text
47: framework's position: a rule is only worth adopting if it **changes Claude's
48: default behaviour in a measurable, desirable way**. Rules that merely restate
49: what Claude already does are called *rule inflation* — they burn tokens on
50: every turn for zero behaviour change, and we reject them.
51: 
52: **Announce at start:** "I'm using evaluate-rule to decide if this rule earns its token budget."
53: 
54: The load-bearing idea of this skill is **bias isolation**. If you show the
55: model the rule and then ask "what would you do by default?", the model is
56: already primed — its answer will drift toward the rule. So the evaluation is
57: always two passes, in a fixed order: **elicit the default first, then diff**.
58: 
59: ## When to skip
60: 
61: - The rule is already registered in `rulesRegistry` and `last_evaluated` is
62:   less than 90 days old → skip; the prior verdict stands
63: - The rule is literally empty or only contains comments → reject without
64:   running the probe
65: 
66: ## Inputs
67: 
68: Required arguments:
69: - `--rule <path>` *or* `--rule-pack <dir>` — one rule file, or a directory for batch mode
70: - `--stack <lang|universal>` — target stack context (affects convention-conflict scoring)
71: - `--scope project|global` — where the rule would land
72: 
73: Optional:
74: - `--project-context <path>` — path to project-state.md / domain-profile.md for convention-conflict scoring
```

```text
81: 
82: ## Process
83: 
84: ### 1. Load context
85: 
86: Read the rule file. Read `references/rules-policy.md` for classification
87: definitions. If `--project-context` is provided, read those docs. Do NOT read
88: the rulesRegistry entry for this rule if one exists — you are evaluating the
89: rule on its own merits, not rubber-stamping a prior verdict.
90: 
91: ### 2. Tier 1, Pass 1 — identify rule type, then elicit default (bias-isolated)
92: 
93: **Step 2a — classify the rule type** (do this BEFORE reading rule content deeply):
94: 
95: Read the rule's frontmatter and first heading only. Ask:
96: - Does this rule fix a *wrong or risky* behavior? → `correction`
97: - Does this rule collapse *valid alternative approaches* to a project convention? → `steering`
98: - Does this rule restate something Claude already does consistently? → likely inflation, continue to Pass 1 to confirm
99: 
100: The distinction matters because Pass 1 asks different questions for each type.
101: 
102: **Step 2b — identify scenarios** the rule covers.
103: 
104: For **correction** rules — a scenario is a situation where Claude might do the wrong thing:
105: > "Developer writes code that handles an API key"
106: > "Agent needs to find a string and knows the file path"
107: 
108: For **steering** rules — a scenario is a decision point with multiple valid paths:
109: > "Developer needs global state management in a React app"
110: > "Go function returns an error — what wrapping style to use?"
111: 
112: **Step 2c — elicit default without rule context:**
113: 
114: For **correction** rules, ask:
115: > In <scenario>, what do you do by default? Describe the decision you'd make, as if no rule existed.
116: 
117: For **steering** rules, ask instead:
118: > In <scenario>, what approaches would you reach for across 10 different projects?
119: > List the 2-3 most common options you'd consider, and describe what drives your choice between them.
120: 
121: Write the result to `docs/specs/rules-evaluation/<rule-name>/default-transcript.md`.
122: 
123: **Critical:** do NOT look at the rule while writing pass 1. The whole point
124: is that the default is elicited before the rule contaminates it.
125: 
126: ### 3. Tier 1, Pass 2 — diff and score
127: 
128: Now load both the rule and the pass-1 default transcript. Produce a diff.
129: For each scenario, answer:
130: 
```

```text
314: 
315: If no task graph exists, write the same phase/evidence list in the final
316: response so an orchestrator can backfill the receipt.
317: 
318: ## Pipeline Continuation
319: 
320: ### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
321: - Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
322: - Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
323: - In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
324: - Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
325: - Evaluate the next task's conditions from its description
326: - If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
327: - If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
328: - Per `route-workflow` Task-Graph Execution Protocol
329: 
330: ### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
331: - Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
332: - Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
333:   cross-session, cross-subagent source of truth.
334: - Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
335:   is ONLY performed when running in the parent/top-level session. Detect via:
336:   host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
337:   check fails, skip host mirroring — file state is the durable record; the
338:   orchestrator parent will re-read and re-mirror after the subagent returns.
339: - Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
340:   graceful; it's silent drift between the subagent's intent and the host UI.
341: - Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
342: - Evaluate the next task's conditions from its description
343: - If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
344: - If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
345: - Per `route-workflow` Task-Graph Execution Protocol
346: 
347: ### Chaining
348: 
349: **Chaining:** standalone utility — invoked manually, from a future `blend-rules` skill, or during rule-pack blend reviews. Does not participate in product lanes.
350: 
351: **Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)**
352: - Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
353:   cross-session, cross-subagent source of truth.
354: - Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
355:   is ONLY performed when running in the parent/top-level session. Detect via:
356:   host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
357:   check fails, skip host mirroring — file state is the durable record; the
358:   orchestrator parent will re-read and re-mirror after the subagent returns.
359: - Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
360:   graceful; it's silent drift between the subagent's intent and the host UI.
361: - Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
362: - Evaluate the next task's conditions from its description
363: - If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
364: - If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
365: - Per `route-workflow` Task-Graph Execution Protocol
366: 
367: **After completion, emit the next command:**
368: 
369: Single-rule, `adopt-as-is` or `adopt-with-edits`:
370: ```
371: **Next:** register the rule by adding the suggested entry to `skills-manifest.json` → `rulesRegistry.entries`, then `node scripts/lint-skills-manifest.mjs`.
372: ```
373: 
374: Single-rule, `reject` or `defer-to-default`:
375: ```
376: **Next:** do not register. Delete the candidate rule file or move it to `references/` if it is useful internal doctrine.
377: ```
378: 
379: Batch mode:
380: ```
381: **Next:** review `docs/specs/rules-evaluation/summary.md`. Register every `adopt-as-is` / `adopt-with-edits` row, delete or defer the rest.
382: ```
383: 
384: ## Post-Compaction Recovery
385: 
386: If Kimi CLI compacted context and you lost track of framework state:
387: 
388: 1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
389: 2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
390: 3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
391: 4. **Re-read this SKILL.md** — Refresh context for the current step
392: 5. **Resume execution** — Continue from where the task left off
393: 6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete
394: 
395: If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
```

## skills/execute-changeset/SKILL.md
SHA256: 7c460371c77cfa8e486e5eaa832a9c297fcabec4d9021209ab751cb91047d4b4

```text
33:   human_checkpoint: true
34: ---
35: 
36: # Executing Change Set
37: 
38: > **Cognitive routing:** ⚙️ [EXEC] — high-volume file editing per the svc-default profile (Sonnet 4.6 since WI-357). See `references/model-routing.md`.
39: 
40: **Announce at start:** "I'm using the execute-changeset skill to implement the planned changeset."
41: 
42: ## Phase Receipt Contract
43: 
44: When a `.svc/lane-tasks-<WI>.json` task is active, record each required phase
45: before completion:
46: 
47: ```bash
48: node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-DispatchPreflight --evidence command_output:<path>
49: node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ApplyPlan --evidence file:<path>
50: node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-Verification --evidence command_output:<path>
```

```text
252: | Scope/contract checks (self-review, mechanical scripts) | ~0.9s combined (408+458+69ms) | cheap | every stage |
253: | Scoped e2e (specs mapped to this landable group) | minutes | scoped | once per landable group |
254: | Full e2e suite (250 specs there) | long | full | once at closure, before promotion |
255: 
256: Zero quality loss: the full suite still runs before closure — what disappears
257: is running the full suite to validate a single task or stage.
258: 
259: Use focused mapped checks during iteration. At the release boundary, require a
260: complete passing validation run for the candidate. Reuse that result only when
261: its recorded source/input hashes, validator set, command options, runtime and
262: relevant environment still match; elapsed time or an earlier green message is
263: not evidence. A changed input, actual failure, or gate requiring fresh external
264: state invalidates the affected result. Missing provenance requires a new run.
265: Keep post-commit relevant checks and actual post-promotion/install verification.
266: Unknown/global and unmapped-surface test selection retain their full-coverage
267: semantics. Never treat provider unavailability or skipped tests as passing.
268: 
269: ### Step 3: Two-stage holistic review
270: 
271: One review of the FULL diff after all tasks — **Pass 1: spec/AC compliance (BLOCKING — full AC coverage, no orphaned code, distrust checkpoint messages, fix gaps and re-run before proceeding); Pass 2: code quality/cross-file consistency only after Pass 1 passes** — protocol, deviation rules, and loop-back rules (spec/UX/UI/tech defects route back before continuing): `references/process-details.md`.
272: 
273: Before freezing the review surface, re-run the impact guard against the final staged diff. The G5/G6 package must cite the same diff SHA, classifier reasons, completed coverage tasks, and tier-required independent/runtime evidence.
274: 
275: ### Step 5: Final G5 surface
276: 
277: `git diff <base>...HEAD` + checkpoint history + validation outputs = the review surface handed to skills/review-exec/G5.
278: 
279: ### Branch Index Re-stamp (§3)
280: 
281: If this scope has a genesis branch index, run `node scripts/check-branch-index.mjs --index <index-path>` first. When it is FRESH and this stage discovered no changed facts, retain the existing `Derived-at` and import hashes without writing. A newer HEAD alone is not a reason to stamp. If cited facts/imports are stale, re-inspect the affected facts, preserve contradicted rows in `## Superseded`, then update `Derived-at` and run `node scripts/branch-index-freshness.mjs --stamp-imports <index-path>`. New substantive findings are appended to the same index and reviewed under the existing contract. Never restamp merely to silence a failing check.
282: 
283: ## Checkpoints
```

## skills/execute-changeset/references/process-details.md
SHA256: 569f9cac0bcf78bb50378a3435479db5dacb77c3d3a7fbce5d40eaaed423a3a1

```text
23: 
24: ### Step 0b: Local-First Execution
25: 
26: All implementation targets localhost. No cloud deployment variants.
27: 
28: **Deployment target:** always `localhost` (or `127.0.0.1`).
29: 
30: **Paid dependencies must be mocked:**
31: 
32: | Dependency type | Mock approach |
33: |----------------|---------------|
34: | Payment (Stripe, PayPal) | Local mock server or test-mode keys |
35: | Email (SendGrid, SES) | Console logger or local SMTP (mailhog) |
36: | SMS (Twilio) | Console logger |
37: | Storage (S3, GCS) | Local filesystem or MinIO |
38: | Auth (Auth0, Clerk) | Local JWT issuer or mock middleware |
39: | Search (Algolia, Elastic Cloud) | SQLite FTS or in-memory index |
40: | AI/ML APIs (OpenAI, etc.) | Recorded fixtures or deterministic stubs |
```

## skills/manage-learnings/SKILL.md
SHA256: abb559f002b7ae1295433bce223e38a85f2a18a627a0302fe52dfc7d014aa719

```text
3: version: "1.0"
4: description: >
5:   Manage project learnings that compound across sessions. Review, search,
6:   prune, and export what was discovered during pipeline runs. Use when
7:   "what did we learn", "show learnings", "prune stale learnings", "search
8:   learnings for <topic>", or when starting a new session to load context.
9: phases:
10:   - id: P1-LearningsSourceModeSelection
11:     trigger: always
12:     reads: ["task request", "docs/learnings/learnings.jsonl", "references/framework-learnings.jsonl"]
13:     writes: [".svc/manage-learnings-mode.log"]
14:     evidence_kind: command_output
15:     required_for_completion: true
16:   - id: P2-ReviewOrSearchExecution
17:     trigger: review-or-search-mode
18:     reads: ["docs/learnings/learnings.jsonl", "search query"]
19:     writes: [".svc/manage-learnings-review.log"]
20:     evidence_kind: command_output
```

## skills/mine-builder/SKILL.md
SHA256: 0e7a6d516d003e4765c0561ace5f2ed5163a4dc55bbd564721a9ee6fd9928f09

```text
4: description: >
5:   Mine the builder's real-world context — finances, time, skills, team, social
6:   presence, tools, entity, goals, project history, failure patterns. Creates or
7:   updates ~/.svc/builder-profile.md. Run once per builder, update on subsequent
8:   sessions. Use when: first pipeline run, "update my profile", "anything changed",
9:   or automatically at session start.
10: phases:
11:   - id: P1-ProfileModeDetection
12:     trigger: always
13:     reads: ["~/.svc/builder-profile.md", "task request"]
14:     writes: [".svc/mine-builder-mode.log"]
15:     evidence_kind: command_output
16:     required_for_completion: true
17:   - id: P2-ContextInferenceQuestionCluster
18:     trigger: always
19:     reads: ["user prompt", "existing builder profile"]
20:     writes: [".svc/mine-builder-inference.log"]
21:     evidence_kind: command_output
```

```text
80: ## Modes
81: 
82: ### Mode 1: First-Time Interview
83: 
84: Triggered when `~/.svc/builder-profile.md` does not exist. Deep interview that
85: creates the full profile. Happens once per builder.
86: 
87: ### Mode 2: Change-Check
88: 
89: Triggered when `~/.svc/builder-profile.md` exists. Quick summary and
90: confirmation. Updates only what changed.
91: 
92: ### Mode 3: Post-Project Update
93: 
94: Triggered after a project ships (verify-promotion) or is abandoned. Updates
95: project history, patterns, and gap analysis.
96: 
97: ### Mode 4: Proactive Update
98: 
99: Triggered when the pipeline notices something that contradicts the profile
100: during normal operation.
101: 
102: ---
103: 
104: ## Mode 1: First-Time Interview
105: 
106: ### Step 0: Check for Existing Profile
107: 
108: ```
109: ls ~/.svc/builder-profile.md
110: ```
111: 
112: If the file exists, switch to Mode 2. If not, proceed with the interview.
```

## skills/plan-blast-radius/SKILL.md
SHA256: ffb44cc27e03d9981fa3c1cd604c9ef6b250c5dbbc9a1571087da393630d4b40

```text
4: description: >
5:   Pre-apply impact classifier for infra changes. Reads `terraform plan` JSON
6:   / `helm diff` output, classifies each change by destruction risk + cross-
7:   resource dependency depth into SEV-1 (destructive) / SEV-2 (in-place
8:   mutation of stateful) / SEV-3 (in-place stateless) / SEV-4 (additive).
9:   SEV-1 and SEV-2 force `human_checkpoint: true` regardless of autorun.
10:   Use when: any infra-* lane reaches phase 8 (between plan-changeset and
11:   review-plan); user mentions "blast radius", "what could break", "is this
12:   safe to apply", "SEV tier classification". Source:
13:   proposals/done/2026-04-30-infra-project-support.md § 6.2.
```

```text
55: 
56: ## SEV Tiers
57: 
58: | Tier | Definition | Examples | Gate behavior |
59: |---|---|---|---|
60: | **SEV-1** | Destructive — resource deletion or replacement of stateful resource | drop database, replace RDS, delete persistent volume | **HUMAN CHECKPOINT REQUIRED** regardless of autorun mode |
61: | **SEV-2** | In-place mutation of a stateful resource | DB version upgrade, IAM trust policy change | **HUMAN CHECKPOINT REQUIRED** |
62: | **SEV-3** | In-place mutation of stateless resource | ASG instance type change, ALB rule update | warn, proceed |
63: | **SEV-4** | Additive only | new resource, new IAM role, new tag | proceed silently |
64: 
65: ## Cross-resource dependency depth
66: 
67: A SEV-3 change becomes SEV-2 if its blast radius spans ≥3 downstream resources. Example: changing a security group attached to one EC2 = SEV-3; changing one attached to a shared RDS read by 5 services = SEV-2.
68: 
69: ## Output
70: 
71: Writes `docs/specs/features/<feature>/blast-radius.md` with:
72: 
```

## skills/plan-changeset/SKILL.md
SHA256: fdbfdf8303b835e7ced6c9fa1f86ef2c661d82a49187feda1cf29d8201b07eaa

```text
65: **Runtime v2 continuation:** Register the implementation manifest and its declared consumers via
66: `references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
67: The canonical DAG has exactly one plan review and one final review. Preserve all plan-specific
68: scope, dependency, proof, rollback and G5 obligations.
69: 
70: > **Cognitive routing:** 📐 [PLAN-OPUS] — architectural blueprinting demands Opus 4.8 for strict dependency graphs. See `references/model-routing.md`.
71: 
72: **Announce at start:** "I'm using the plan-changeset skill to produce the implementation plan."
73: 
74: ## Before Starting
75: 
76: Read **as needed** (`_shared/before-starting.md`): `docs/specs/project-state.md`, `~/.svc/builder-profile.md`, `docs/specs/domain-profile.md`, the feature spec (behavior contract + AC slice the manifest must cover).
77: 
78: The changeset contains precise, context-rich code blueprints for every planned file to prevent downstream execution drift. The branch is the territory; this skill writes the implementation plan execution follows in the worktree.
79: 
80: ## Product Questions — MANDATORY format
81: 
82: During simulation, expose consequential scope, sequencing or rollback decisions using current spec and code evidence. Follow `_shared/product-question-format.md` with `phase: plan-changeset`. Reuse accepted decisions and task authorization; ask only unresolved consequential owner choices. Record real decisions in the existing companion or canonical decision artifact. No empty companion or numeric question floor is required. Unresolved consequential decisions block dependent work. SIMULATED requires the shared promotion predicate.
```

```text
102: 
103: Log the classification (archetype, reasoning, planning mode) before proceeding. Per-archetype protocols (migration grep-universe, architectural invariants, cross-cutting entry-point enumeration, incremental deprecated-foundation scan, Base44 schema grounding, browser-visible MODIFY mock-parity ledger, capability-blocker pre-tasks): `references/archetype-protocols.md` — MANDATORY for the matching archetype.
104: 
105: ## Inputs
106: 
107: Before writing anything, read and hold in context:
108: 
109: | Artifact | Path | What You Extract |
110: |----------|------|-----------------|
111: | Feature Spec | `docs/specs/features/<name>.md` | Stories, ACs, dependencies, technical design section |
112: | UX Design | `docs/specs/ux/<name>.md` | Screen flows, states, error handling |
113: | UI Design | `docs/specs/ui/<name>.md` | Component specs, design tokens, responsive behavior |
114: | Design System | `docs/specs/design-system.md` | Tokens, typography, spacing, component patterns |
115: | Journey Docs | `docs/specs/journeys/J*-<name>.feature.md` | Gherkin scenarios, AC cross-references, Layer 3 findings |
116: | Style contract | `docs/specs/style-contract.md` | Current patterns, naming, imports, tests — do NOT scan the source tree for this |
117: | Spec annotations | RESOLVED entries in feature spec | file:line pointers to existing code — load only these specific files when you need to understand existing implementation |
118: 
119: **Compression boundary:** product context is already compressed into the artifacts above — do NOT reload raw vision/personas/domain-profile/competitors by default; load one only when a specific ambiguity can't be resolved from the spec. Stale/missing upstream artifacts → stop and route back.
120: 
121: ## Output
122: 
123: `docs/plans/<YYYY-MM-DD>-<feature-name>/manifest.md` — single source of truth. On the **dispatch** path (a zero-context executor builds it) it carries exact code payloads (CREATE = full contents; MODIFY = before/after context diffs, ≥3 lines each side). On the **inline** path (the orchestrator executes with full context already loaded) the Changeset Blueprint is skipped — see §3a.
124: 
125: ## Execution Mode (resolve BEFORE planning — WI-386)
126: 
127: Before authoring the manifest, resolve and record the execution mode, because it decides whether §3a (Changeset Blueprint) is authored at all:
128: 
129: - **`dispatch`** — a zero-context subagent (`DISPATCH=mimo-pro|sonnet`) will execute from the contract alone. Blueprints are the executor's ONLY source of truth → **§3a is MANDATORY** (full payloads, no placeholders). This preserves WI-347's Lean-Executor isolation.
130: - **`inline`** — the orchestrator executes with the full spec/UX/UI context already loaded (the only mode used in practice per `.svc/dispatch-log.jsonl`). Re-authoring blueprints here is Opus-priced double-spend (code drafted at PLAN prices, then re-applied verbatim at EXEC) → **§3a is SKIPPED.**
131: 
132: Record the resolved mode in two places, both read by the chain:
133: 1. The plan-manifest receipt's `mode` field (`dispatch` | `inline`) — `schemas/receipts/plan-manifest.schema.json` enforces "blueprints required UNLESS mode==inline" via an `if/then`, and `scripts/check-chain-receipts.mjs` mirrors that gate (the custom validator the push hook actually runs). **Absent/unmarked `mode` fails closed to dispatch semantics** — blueprints stay required, so nothing silently relaxes WI-347.
134: 2. The `.svc/dispatch-log.jsonl` entry's `mode` field, written when execute-changeset records the dispatch (via `scripts/state-io.mjs` append helpers — never raw-write `.svc`).
135: 
136: Default when unsure: **`dispatch`** (author the blueprints). Only claim `inline` when the orchestrator itself will apply the change with context loaded.
137: 
```

```text
237: The planner MUST NOT silently simplify requirements. These phrases are banned
238: in task descriptions, action steps, and done conditions:
239: 
240: | Banned phrase | Why | What to do instead |
241: |---|---|---|
242: | "v1", "initial version", "basic version" | Implies incomplete delivery | Build the full AC or split the phase |
243: | "simplified version", "simplified for now" | Downgrades the requirement | Implement the full requirement or flag as infeasible |
244: | "placeholder", "placeholder for now" | Ships non-functional code | Implement or remove |
245: | "static for now", "hardcoded for now" | Defers the real work to undefined future | Make it dynamic or split into a task |
246: | "will be wired later", "TODO: connect" | Leaves disconnected code | Wire it now or split into explicit tasks |
247: | "stubbed out", "mock implementation" | Ships fake code (exception: mock implementations for external services per feature-toggle convention) | Implement for real |
248: | "priority pages / priority files" without a total count | Migration scope reduction disguised as phasing — "priority pages first" with no stated universe is identical to "simplified version" | State: "Phase 1: 7/71 files (10%). Phase 2 deferred: 64 files — WI-032." |
249: | "Under N-file threshold" on a migration archetype | Low file count means incomplete scope on a migration, not small scope | State actual coverage ratio from grep baseline |
250: 
251: **If the plan cannot cover all ACs from the feature spec:**
252: 
253: Do NOT silently drop ACs. Instead:
254: 
```

## skills/research/SKILL.md
SHA256: 98955474f820ec276bb4cf0def70ed6d1496b94209faf2bf79169223807a53af

```text
8: description: >
9:   On-demand, lightweight in-flow research when a skill or workflow encounters
10:   uncertainty about an API, library, framework version, pattern, or domain concept.
11:   Discovers via GitHub + package registries FIRST, then vendor docs, then WebSearch
12:   last; tiers source credibility and triangulates load-bearing claims across ≥2
13:   independent sources; date-bounds volatile facts; reads/writes per-domain source
14:   heuristics; hands off multi-source / high-stakes / contested questions to the
15:   external `deep-research` plugin. Logs findings to docs/specs/research-log.md.
16:   Use when: "research", "look up", "find out", "how does X work", "what's the best
17:   practice for", or when any skill declares uncertainty. Also works standalone.
```

## skills/reverse-engineer/SKILL.md
SHA256: 4d81c8fe02cddcb29d3eeb1b7efcfa92183dedc1b7a4fc7d7e9b826ab27e6926

```text
4: description: >
5:   Deconstruct any company, product, tweet, or technique into a buildable spec
6:   with a unique twist. Use when: "reverse engineer X", "how does X work",
7:   "clone X but better", "deconstruct this", "I saw this tweet, build it",
8:   "copy this with a twist", "how would I build X", "X is making money, I want
9:   in", "analyze this product", any company/product URL, any tweet URL with a
10:   build intent, or when the user points at something and says "I want that".
11:   Also triggers on: "tear this apart", "what's their stack", "how do they
12:   make money", "reverse this business model".
13: phases:
14:   - id: P1-InputDetectionFamilyFit
15:     trigger: always
16:     reads: ["user target", "docs/specs/vision.md", "personas", "target URL or description"]
17:     writes: [".svc/reverse-engineer-family-fit.log"]
18:     evidence_kind: command_output
19:     required_for_completion: true
20:   - id: P2-IntelligenceGathering
21:     trigger: family-fit-cleared
```

## skills/review-exec/SKILL.md
SHA256: dfe32dec93996ce989a805e0d89b6901f6bbcaec6746b062a8d0c9959c3f6ffb

```text
7: description: >
8:   Mandatory G5-enforcing gate. Self-review + adversarial review of the executed diff
9:   before land. Delegates to `review-cross-model` for the second-model
10:   invocation through `scripts/run-external-review.mjs`, with the requested
11:   owner-configured topology and tuple provenance exposed by
12:   `scripts/review-topology-v2.mjs`. Same-family Sol remains advisory; the
13:   configured different-family external station owns independent release authority. Emits SHA-keyed receipt at
14:   `.svc/receipts/<sha>/review-exec.json` and updates the consolidated git
15:   note on `refs/notes/svc-receipts`. Use after `execute-changeset`
16:   produces an exec-record receipt, before `land-changeset` opens the PR.
```

```text
137: 
138: ## Process
139: 
140: Every newly emitted review receipt is schema v3. It preserves the independent reviewer command argv and output artifact paths in `reviewer_evidence`; callers cannot request a legacy schema. The emitter derives `deletion_bearing` from the candidate diff. For deletion-bearing executable diffs, run `node scripts/find-callers.mjs --identifier <deleted-identifier>` and attach parse/collect evidence. Submitter-only output is never independent review evidence.
141: 
142: ### P1 — Self-Review (mandatory)
143: 
144: Orchestrator runs its own structured pass on the executed diff:
145: - Lists what was checked (e.g. "AC #2 verification", "error-handling on path X", "dependency citations match plan-manifest").
146: - Lists known gaps left in.
147: - Declares per-section confidence.
148: 
149: A "no findings" self-review on a substantive diff is treated as suspicious and gets flagged at P3.
150: 
151: Write self-review note to `.svc/receipts/staging/<tree-hash>/review-exec-self.json`.
152: 
153: Emit the pre-commit receipt without `--sha`; the emitter compares the index
154: tree to `HEAD` and binds a dirty candidate to
```

## skills/review-plan/SKILL.md
SHA256: 037df975f3f6d904cd42f47741ca55da561014f79cbe8ace949211562217db4f

```text
9: description: >
10:   Plan-level adversarial review gate. Runs after plan-changeset produces a
11:   manifest + task graph and BEFORE any execute-changeset dispatch. Two gates:
12:   (1) compiled mechanical/coverage checks — free, in-session; (2) one holistic
13:   adversarial review via the canonical external-review launcher with structured
14:   findings and a tuple receipt. Corrections recheck only invalidated lenses;
15:   disputed product/security authority routes to the owner, not a second model. Iteration loop
16:   with justified accept/reject responses — same discipline on both sides.
17:   Use when: plan-changeset manifest exists and is about to be promoted.
18:   Blocks promotion until all findings have resolutions.
```

```text
91: 
92: - `plan-manifest` (required): `docs/plans/<date>-<name>/manifest.md`
93: - `task-graph` (optional): `.svc/lane-tasks-<WI>.json` or inline JSON in the manifest
94: - `originating-spec` (optional): `docs/specs/features/<name>.md`
95: 
96: Reviewers must NOT read files outside what the plan lists. If a review requires unlisted context, the reviewer declares it in `dependencies_needing_read` and halts — the orchestrator decides whether to re-plan with that dependency explicit.
97: 
98: ## Process
99: 
100: ### Step 1 — Tier 1: Mechanical (scripts only, no model)
101: 
102: Run the deterministic check script in the current session:
103: 
104: ```bash
105: bash scripts/verify-plan-mechanical.sh docs/plans/<date>-<name>/manifest.md
106: ```
107: 
108: When the plan changes money, entitlement, quota, inventory, identity, notification, parallel ownership, deletion, or completeness/absence claims, require the adjacent `plan-contract.json`. The command above validates it automatically; prose is not a substitute for its ordering, compensation, denominator, ownership, and consumer evidence.
```

## skills/review-security/SKILL.md
SHA256: d87c6721ac890e158035760c4cd41be392d2339804fc339f76f17d0c3a16127d

```text
5:   - auth-surface
6:   - pii-handling
7:   - cryptography-touch
8: description: >
9:   OWASP Top 10 + STRIDE threat model + supply chain audit of the technical
10:   design before implementation. Use when "security review", "check for
11:   vulnerabilities", "threat model", "audit security", or when `design-tech`
12:   surfaces auth, payments, sensitive data, or external integrations that
13:   need a dedicated security pass.
14: phases:
15:   - id: P1-SecurityScopeModeGate
16:     trigger: always
17:     reads: ["docs/specs/features/<name>.md", "docs/specs/domain-profile.md", "task request"]
18:     writes: [".svc/review-security-scope.log"]
19:     evidence_kind: command_output
20:     required_for_completion: true
21:   - id: P2-OWASPTop10Review
22:     trigger: always
```

## skills/roadmap-evaluation/SKILL.md
SHA256: 49ad0353fc75f30dde8db5f959ae8d2edfee6e3b6ad350a3cc39fe2e172db74d

```text
1: ---
2: name: roadmap-evaluation
3: version: "1.0"
4: description: >-
5:   Synthesize project-state, work items, vision, and builder profile into a prioritized milestone roadmap with cost estimates and timeline-to-first-paying-customer. Use when: "what should I build next", "show me the roadmap", "prioritize my backlog", "how long until revenue". Also: "what's next", "where am I", "can I afford this", "timeline to first customer", "evaluate my roadmap". Also: "what's the plan", "budget check".
6: inputs:
7:   required: []
8:   optional:
9:     - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
10:     - { path: "docs/specs/vision.md", artifact: vision }
11:     - { path: "docs/specs/project-state.md", artifact: project-state }
12:     - { path: "docs/specs/work-items/WI-*.md", artifact: work-items }
13:     - { path: "docs/specs/staging-plan.md", artifact: staging-plan }
14: outputs:
15:   produces:
16:     - { path: "docs/specs/roadmap.md", artifact: roadmap }
17: phases:
```

## skills/route-workflow/SKILL.md
SHA256: feddaabd8028026dd117ae5da17e405ea6985f95e382de8678bc7fbef8306aff

```text
1: ---
2: name: route-workflow
3: version: "1.0"
4: description: >
5:   Universal entry point for any work. Routes freeform intent to the right svc skill
6:   based on repo state, change type, and current project artifacts. Handles: "do this",
7:   "build this", "I want to", "help me with", "make me a", "ship this", "fix this",
8:   or ANY freeform description of work; also handles explicit routing questions like
9:   "what should I do next", "which skill do I run", "what's the right order", and
10:   "what lane is this".
11: phases:
12:   - { id: P1-SessionContextLoad, trigger: always, reads: [".svc/session-contract.jsonl", "docs/specs/project-state.md", "~/.svc/builder-profile.md", "docs/specs/domain-profile.md"], writes: [".svc/session-contract.jsonl when needed", ".svc/orchestrator-state.json when initializing"], evidence_kind: command_output, required_for_completion: true }
13:   - { id: P2-IntentNormalizationAndCorrection, trigger: always, reads: ["user request", "references/intent-normalization.md", "references/intent-classification.md", ".svc/session-contract.jsonl"], writes: [".svc/pipeline-decisions.jsonl when route-relevant"], evidence_kind: command_output, required_for_completion: true }
14:   - { id: P3-StateInitializationAndLaneRouting, trigger: always, reads: ["REPO_MODES.md", "skills-manifest.json", "skills/route-workflow/references/routing-rules.md", "skills/route-workflow/references/lane-model.md"], writes: [".svc/orchestrator-state.json", ".svc/lane-tasks-<WI>.json"], evidence_kind: file, required_for_completion: true }
15:   - { id: P4-ConcernAndPreDispatchGate, trigger: mutating-or-wi-dispatch, reads: ["concerns/REGISTRY.json", ".svc/session-contract.jsonl", ".svc/lane-tasks-<WI>.json"], writes: [".svc/pipeline-decisions.jsonl", ".svc/concern-hits.jsonl"], evidence_kind: command_output, required_for_completion: true }
16:   - { id: P5-TaskGraphDispatchAndEvidenceObligations, trigger: task-graph-mode, reads: [".svc/lane-tasks-<WI>.json", "target skill SKILL.md", "_shared/live-evidence.md"], writes: [".svc/lane-tasks-<WI>.json", "live evidence artifacts when visual-output skill"], evidence_kind: file, required_for_completion: true }
17:   - { id: P6-SelfVerifyDecisionLogContinuation, trigger: always, reads: [".svc/pipeline-decisions.jsonl", ".svc/lane-tasks-<WI>.json", "skills/route-workflow/references/task-graph-protocol.md"], writes: [".svc/pipeline-decisions.jsonl", ".svc/lane-tasks-<WI>.json"], evidence_kind: command_output, required_for_completion: true }
18: inputs:
19:   required: []
20:   optional:
21:     - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
22:     - { path: ".svc/orchestrator-state.json", artifact: orchestrator-state }
23:     - { path: ".svc/capability-registry.json", artifact: capability-registry }
24: outputs:
```

```text
52:    If a Stop-hook completion guard, stale task graph, or old session contract
53:    conflicts with the latest user prompt or explicit correction, the latest user
54:    intent wins. Treat that guard as advisory unless the user explicitly says
55:    `continue WI-XXX` or `resume WI-XXX` for the same WI.
56: 3. Select repo mode, change type, lane, WI, branch, and next skill from `references/lane-model.md`, `references/routing-rules.md`, and `references/intent-routing.md` using read-only evidence.
57: 4. Before the first repository write — including session-contract refresh, WI/plan creation, task-graph initialization, claim, append, or generated output — run `node scripts/svc-ensure-worktree.mjs --wi <WI> --branch <branch> --from origin/main --json --print-cd`. Change to its returned absolute worktree path. Retain and pass the exact `wi`, `absolute_worktree`, `branch`, and `owner_session` baton to every mutating skill; refuse identity or cwd mismatch.
58: 5. Check whether the user is asking for confidence in the right design before planning. If the prompt says "best solution", "right design", "all cards on the table", "golden standard", "real examples", "cost/caching", "by design auto", or equivalent, load `references/solution-confidence-protocol.md`, set `solution_confidence_required: true`, and choose a mode:
59:    - `design_auto` by default. The framework evaluates, grounds, designs, plans, and implements automatically through the normal lane once the confidence artifact selects a direction.
60:    - `post_design_human_gate` only when the user explicitly asks to review/approve after design or wait before the plan/implementation part.
61:    - `intake_only` only when the user explicitly says no design/decision yet or only asks for a parking lot/WI.
62:    Human gates are not default; they exist after design only when requested.
63:    The confidence artifact must include an action-by-action approval packet before `plan-changeset` or any approval request: what changes, why, how, positive outcome, negative/risk outcome, impact if skipped, and proof gates.
64: 6. Declare the delivery tier (`full`, `end_to_end`, `compressed`, or `rush`) before dispatch; compressed/rush requires a decision-log rationale.
65:    **Measured tiering (WI-383, default OFF):** `node scripts/mine-receipts.mjs --tier <lane>` returns a fenced, measured recommendation from the receipt ledger. It is **ADVISORY by default** — log the recommendation, but still declare `full`. Only act on a `compressed` recommendation (drop the plan-level adversarial round ONLY) when ALL hold: (a) `.svc/chain-policy.json` opts in with `"ceremony_tiering":"measured"`; (b) the predictor returns `tier:"compressed"` with `window_complete:true`; (c) the change is not infra/`.svc`/scripts/hooks/migration (the predictor's AC4 fence already refuses these). review-exec G6, audit-implementation, and the pre-push 5-receipt envelope are NEVER tiered — only the plan round, and never without the opt-in. Record the measured decision in `.svc/pipeline-decisions.jsonl`.
66: 7. From the ensured worktree, refresh the session contract if needed, initialize or update `.svc/lane-tasks-<WI>.json`, and claim the active WI through the binding/claim API before downstream mutation.
67: 8. Run the concern/pre-dispatch gates for mutating or WI-bound work.
68: 9. For a normal human work request, Codex autorun mode self-dispatches after the baton is established: resolve repository/WI/branch, invoke `svc-ensure-worktree`, bind the session, retain the exact tuple, and continue in the same turn. If repository resolution is ambiguous, ask once; never guess. Prompt Composer remains the fallback for hosts without autorun support or when the user explicitly asks for a launch package.
69: 
```

```text
114: 
115: ## Lane Model & Routing
116: Lane selection is mandatory: choose the lane from `references/lane-model.md`; use `references/framework-policy.md` for svc-on-svc work; use `references/routing-rules.md` for change-type signals; use `references/intent-routing.md` for phrase-to-skill mappings. If no lane fits, propose a new lane instead of forcing a bad match. Explicit framework-quality/capability questions ("is svc good at X", "how does svc handle Y") route to `svc-advisor`, which loads `references/advisor/framework-knowledge-index.md` and answers cite-before-assert.
117: 
118: ## Human-Invoked Prompt Composer
119: For human-invoked routing, produce a Prompt Composer package. It must include normalized intent, repo/session evidence read, lane and delivery tier, exact skill sequence, required artifacts, skip conditions, eval/verification commands, closeout requirements, and when to use `/goal`, `/loop`, `dispatch-waves`, or other host capabilities.
120: Self-dispatch is allowed only when an explicit host/platform autorun contract or internal continuation invokes route-workflow non-interactively. Codex's governed autorun contract above is such an explicit contract; ambiguous mode defaults to the human package.
121: Still end with exactly one `**Next:**` trailer per the Output Protocol, but in prompt-composer mode that trailer points to the full copy-paste prompt or target skill; it must not replace the package with a thin next-skill line.
122: 
123: ## Conditional Stage Activation (P3, WI-521 Batch C — closes WI-519)
124: Before declaring lane routing complete, evaluate which conditional/situational stages the diff actually activates, mechanically (not by judgement):
125: 
126: ```bash
127: node scripts/stage-activation.mjs --diff "$(git merge-base HEAD origin/main)..HEAD"
128: ```
129: 
130: Exit 0 → a JSON array of `{stage, condition, evaluated_against, result}` is printed on stdout; essential stages (`plan`, `review-plan`, `implement`, `review-exec`, `spec-sync`, `index-restamp`, sourced from `references/stage-registry.json`) are always `result:"active"`. Exit 2 → usage/config error, including an attempt to condition an essential stage (never allowed) or a missing/invalid `--registry` target — halt and fix the input, never treat exit 2 as "no activations". Paste the JSON output into the session contract (`.svc/session-contract.jsonl`) so downstream stages and the task-graph generator (`scripts/task-graph.mjs generate --activation <this-output>`) read the same evaluation instead of re-deriving it.
131: 
```

## skills/route-workflow/references/autorun-orchestrator.md
SHA256: f04e740213629502756f0a749a587b2e630977acfd8cd92dc7f13074b048c8b5

```text
32: |-------|-----------------|-------------|
33: | `validate-feature` | Stop, ask user | P0 decides. **Exception:** NO-SHIP always stops. |
34: | `write-spec` | Stop, ask user to review spec | P0 reviews, logs concerns as Taste decisions |
35: | `explore-solutions` | Stop, present alternatives | P0 selects based on research, logs reasoning |
36: | `plan-changeset` | Stop, ask user to approve plan | P0 approves if plan covers all ACs; logs plan summary |
37: | `execute-changeset` | Stop at each task checkpoint | P0 reviews diffs, approves if tests pass |
38: | `land-changeset` | Stop, ask user to merge | P0 merges (solo mode) or opens PR and stops (team mode) |
39: | `improve-framework` | Stop, ask user to approve fix scope | P0 executes if ≤2 files / ≤50 lines; human checkpoint if larger (plan-changeset discipline) |
40: | `evolve-framework` | Stop, ask user to rank gaps | P0 auto-runs evidence gathering; human checkpoint before any implementation |
41: | `blend-external` / `blend-private` | Stop, ask user to approve source | **Always human checkpoint.** External code import is high-risk. |
42: | `test-framework` | Stop, ask user to approve test scope | P0 auto-runs; human checkpoint only if findings require multi-skill changes |
43: | `create-skill` | Stop, ask user to approve skill scope | P0 decides if template-based and ≤2 files; human checkpoint if novel skill or >2 files |
44: | `design-logo` | Stop at each phase gate | P0 decides Phases 1–4; human checkpoint at love-test (Phase 5b) and final approval (≥65/70) |
45: | `extract-bootstrap` | Stop, ask user to approve pattern set | P0 decides if repo is accessible and patterns are clear; human checkpoint if architecture is ambiguous |
46: | `find-opportunity` | Stop, ask user to rank opportunities | P0 decides (evidence-based ranking; no creative judgment needed) |
47: | `honest-diagnosis` | Stop, present blockers | P0 decides (evidence-graded; purely analytical) |
48: | `ingest-guide` | Stop, ask user to approve classification | P0 decides if classification is clear (discard/store/blend); human checkpoint if promote-to-skill |
49: | `ingest-guide-batch` | Stop, ask user to approve batch digest | P0 runs per-guide; human checkpoint if any guide is promote-to-skill |
50: | `landing-page` | Stop, ask user to approve design | P0 decides if benchmark-landing ≥7; human checkpoint if <7 (needs override or redesign) |
51: | `manage-finops` | Stop, ask user to approve cost model | P0 decides (cost calculations are deterministic from usage estimates) |
52: | `mine-builder` | Stop, ask user to review profile | P0 decides (profile update is mechanical; stops only if new high-severity blocker found) |
53: | `monetization-architecture` | Stop, ask user to approve gating matrix | P0 decides if gating matrix is clear; human checkpoint if enforcement audit finds code/pricing mismatch |
54: | `plan-blast-radius` | Stop, ask user to approve SEV classification | P0 decides (SEV classification is deterministic from terraform plan / helm diff) |
55: | `plan-capabilities` | Stop, ask user to approve capability plan | P0 decides (recommendations are evidence-based from stack-profile + registry) |
56: | `reverse-engineer` | Stop, ask user to approve twist | P0 decides if source is public and twist is mechanical; human checkpoint if twist requires product judgment |
57: | `roadmap-evaluation` | Stop, ask user to approve milestone plan | P0 decides (evidence-based prioritization and cost estimates from existing artifacts) |
58: | `stage-revenue` | Stop, ask user to approve stage breakdown | P0 decides (stage breakdown is mechanical from builder profile and feature set) |
59: | `strategic-decision` | Stop, ask user at each trade-study gate | **Always human checkpoint.** High-stakes vendor/framework selection with multi-year consequences. |
60: 
61: **Framework lane hard stops (in addition to universal hard stops):**
62: 
63: - **Plan-changeset discipline breach:** Framework changes >2 files or >50 lines that skip `write-spec` → `plan-changeset` → `execute-changeset` in a worktree
64: - **Host-specific implementation without research:** Any framework change touching host integration (hooks, CLI-specific scripts, host abstraction) that did not verify current host capabilities first
65: - **New skill without spec:** Any `create-skill` invocation that bypasses `write-spec` and `audit-ac`
66: 
```

## skills/route-workflow/references/task-graph-protocol.md
SHA256: 0581dde7a3a807d3ff00e443f5a7ce6dd88aa326034a3f9a62dd590d63580b3f

```text
415: 
416: A skill execution that skips pre-flight is a contract violation — same severity as skipping self-verify.
417: 
418: ### Skill contract obligation (at each skill's END)
419: 
420: Every skill except `route-workflow` MUST carry an explicit task-graph block in its own chaining or pipeline-continuation section. No inheritance-by-reference. When a skill finishes:
421: 
422: 1. **Run ALL self-verify checks.** If any check FAILS, the task stays `in_progress` and the failure is reported. A task CANNOT be marked `completed` with failing self-verify checks. This is the enforcement mechanism — self-verify is not advisory, it is a gate.
423: 2. Mark current task `completed` in the active `lane-tasks-<WI>.json` file first, then mirror to host (`TaskUpdate` in Claude Code)
424: 3. Evaluate next task's conditions
425: 4. If runnable: mark next task `in_progress`, then load the named skill
426: 5. If skippable: mark next task `completed` (with skip reason), advance to the one after
427: 6. If lane is done: emit `**Next:**` trailer per Output Protocol
428: 
429: A skill that completes without updating its task status is a contract violation. A skill that treats `Invoke: /skill-name` as plain explanatory text instead of "load this skill now" is also a contract violation. **A skill that marks a task `completed` while self-verify checks are failing is a contract violation.**
430: 
431: ### AP-27: Ghost Skill Execution — explicit rule
432: 
```

```text
487: - When a task graph is active, the `**Next:**` trailer should reference the next task: `**Next:** Task 5 of 8: \`write-e2e\` — runtime photo upload test across 6 pages (MANDATORY, user-facing surface)`
488: - When no task graph is active (conversational responses, status checks), the `**Next:**` trailer falls back to project-state suggestions
489: 
490: ### Output Protocol — Next Command Suggestion (applies to ALL skills)
491: 
492: Every response from every skill MUST end with exactly one `**Next:**` line. Rules:
493: 
494: - **Paste-ready.** The user should be able to copy the command verbatim. No placeholders like `<your-wi>` — resolve from project state.
495: - **Exactly one trailer.** If parallel paths exist, express as options A/B inside one line.
496: - **Never omit Next.** Even for status/conversational responses, emit a `**Next:**` suggesting the next action or a project-state review.
497: 
498: **Reference grounding (2026-04-19, from capture-idea-and-reference-family-gaps evolution):** when a `**Next:**` trailer names specific references, competitors, URLs, targets, or pattern examples for the next skill to consume, those names MUST be checked against the caller's product context (`docs/specs/vision.md`, primary persona) for family fit BEFORE being emitted.
499: 
500: - If the target family is uncertain or mismatched: emit the Next-line with the skill invocation but OMIT the specific targets. Add: *"Provide targets aligned to: [product-family descriptor]. Examples: [2–3 family-matched references]."*
501: - If the target family is confirmed aligned: emit targets as normal.
502: 
503: **Why this rule exists:** without it, `route-workflow` can suggest dev-tool references (Linear/Stripe/Vercel) for local-business products; the user pastes verbatim into `reverse-engineer`; mismatch propagates silently. The named-reference case is the failure mode; single-skill invocations without references don't need this check.
504: 
```

## skills/security-ops/SKILL.md
SHA256: a575774683d2d252ff5e21da10ece33d490d02ff3ad4a082025402e594d2474d

```text
1: ---
2: name: security-ops
3: version: "1.0"
4: description: >-
5:   Security review. Use when: "security risk", "threat model", "security review", "incident control". Not privacy-law or reliability review.
6: inputs:
7:   required:
8:     - { path: ".svc/company-link.json", artifact: company-context, note: "Optional only when repository-local company-state/ exists; resolve through company-state.mjs." }
9:   optional: []
10: outputs:
11:   produces:
12:     - { path: "company-state/decisions-pending.jsonl", artifact: reviewable-decision-card, note: "The company-state directory is resolved by company-state.mjs." }
13: chain:
14:   lanes: {}
15:   terminal: true
16:   progressive: false
17:   self_verify: true
```

## skills/svc-advisor/SKILL.md
SHA256: 04fa23588aca41a515e52bd88930c0752a09a0569922eb5a7cbe5416fff6ac42

```text
6:   Answer questions about the svc framework grounded in stored knowledge —
7:   not improvised. Use when the user asks "is svc good at X?", "how does
8:   svc handle Y?", "what's missing for Z scenario?", "compare svc to
9:   gstack/superpowers for X", "is there a skill for X?", "what do you think
10:   about this case?", or any question about framework quality, capability,
11:   or coverage on a specific scenario. Always invoke this before giving an
12:   opinion about the framework — your improvised answer will be weaker than
13:   what the analyzed knowledge says.
14: phases:
15:   - id: P1-QuestionClassification
16:     trigger: always
17:     reads: ["user question", "calling context", "phase triggers and evidence applicability"]
18:     writes: []
19:     evidence_kind: command_output
20:     required_for_completion: true
21:   - id: P2-KnowledgeIndexLoad
22:     trigger: always
23:     reads: ["relevant block of references/advisor/framework-knowledge-index.md"]
```

```text
97: ## Applicability (derived from the phase contract)
98: 
99: | Source phase | Apply when | Required work |
100: |---|---|---|
101: | P1-QuestionClassification, P2-KnowledgeIndexLoad | Always | Classify the question, record evidence/branch selection, read the relevant advisor index block. |
102: | P2b-MechanicalFactVerification | counts-or-wiring-claims | Run the index Verify command for every asserted count/wiring fact. |
103: | P3-RelevantEvidenceLoad | additional-evidence-needed | Load only evidence needed beyond the index; no automatic capability/detail sweep. |
104: | P4-CitedAnswerComposition, P5-StalenessCompetitiveContext, P6-SelfVerifyContinuation | Always | Cite the answer, check freshness of cited evidence, verify grounding and close the current task. Competitor context requires relevance. |
105: 
106: P1 records which conditional branches apply and why the evidence suffices. Optional phase metadata permits an untriggered branch to be absent; it does not excuse skipping triggered verification. Record actual conditional phase evidence only when executed. Never fabricate skipped receipts.
107: 
```

## skills/sync-work-items/SKILL.md
SHA256: 8b9a1c29f562ec490934e3b1db6f9bcfd71861b9e1555ecb940847fe798ab69f

```text
1: ---
2: name: sync-work-items
3: version: "1.0"
4: description: >
5:   Sync repo-canonical svc work items to GitHub Issues. Use after onboard-repo or
6:   whenever work-item files change and the team wants external execution visibility without
7:   making GitHub the source of truth. GitHub is the first-class integration target in v1.
8:   Linear is deferred.
9: phases:
10:   - id: P1-RepoWorkItemRead
11:     trigger: always
12:     reads: ["docs/specs/project-state.md", "docs/specs/work-items/INDEX.md", "docs/specs/work-items/WI-*.md"]
13:     writes: []
14:     evidence_kind: command_output
15:     required_for_completion: true
16:   - id: P2-WorkItemSchemaProjectionPlan
17:     trigger: always
18:     reads: ["docs/specs/work-items/WI-*.md", "references/work-item-schema.md"]
19:     writes: []
20:     evidence_kind: command_output
```

```text
176: node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-SyncSelfVerify --evidence command_output:.svc/sync-work-items-self-verify.log
177: node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-LaneCompletionRouting --evidence command_output:.svc/sync-work-items-lane-completion.log
178: ```
179: 
180: ## Pipeline Continuation
181: 
182: ### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
183: - Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
184: - Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
185: - In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
186: - Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
187: - Evaluate the next task's conditions from its description
188: - If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
189: - If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
190: - Per `route-workflow` Task-Graph Execution Protocol
191: 
192: ### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
193: - Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
194: - Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
195:   cross-session, cross-subagent source of truth.
196: - Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
197:   is ONLY performed when running in the parent/top-level session. Detect via:
198:   host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
199:   check fails, skip host mirroring — file state is the durable record; the
200:   orchestrator parent will re-read and re-mirror after the subagent returns.
201: - Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
202:   graceful; it's silent drift between the subagent's intent and the host UI.
203: - Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
204: - Evaluate the next task's conditions from its description
205: - If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
206: - If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
207: - Per `route-workflow` Task-Graph Execution Protocol
208: 
209: ### Self-Verify
210: 
211: Before declaring done, verify:
212: 
213: | # | Check | How | PASS/FAIL |
214: |---|-------|-----|-----------|
215: | 1 | Work items synced to GitHub Issues (or logged for sync) | Check each WI-*.md for GitHub issue number or sync log | |
216: | 2 | INDEX.md updated | `test -f docs/specs/work-items/INDEX.md` and entries reflect current state | |
217: | 3 | No unresolved questions | grep for TBD, TODO, open questions in work item files | |
218: 
219: If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.
220: 
221: ### Chaining
222: 
223: **Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
224: - Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
225: - Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
226: - In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
227: - Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
228: - Evaluate the next task's conditions from its description
229: - If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
230: - If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
231: - Per `route-workflow` Task-Graph Execution Protocol
232: 
233: **If `--progressive` flag is present AND self-verify passed:**
234: - This is the end of the brownfield-conversion and drift lanes. Report completion.
235: 
236: **If `--progressive` flag is absent:**
237: - Report results to user
238: - Pipeline complete for this lane. Route each work item by type to the appropriate next skill.
239: 
240: ## Post-Compaction Recovery
241: 
242: If Kimi CLI compacted context and you lost track of framework state:
243: 
244: 1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
245: 2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
246: 3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
247: 4. **Re-read this SKILL.md** — Refresh context for the current step
248: 5. **Resume execution** — Continue from where the task left off
249: 6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete
250: 
251: If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
```

## skills/write-e2e/SKILL.md
SHA256: cdd8dc2f2def6d6c7a33d66ea59abea37c77277af37224e384a8a583989487d7

```text
4: handles_concerns:
5:   - e2e-coverage-for-flow
6:   - flaky-test-quarantine
7:   - test-data-seeding
8:   - mocking-vs-fixtures
9: description: Write E2E tests that behave exactly like a real user in a real browser — click what users click, see what users see, never use shortcuts a user can't use. Use when writing new E2E tests, reviewing test code, fixing flaky tests, or expanding test coverage. Triggers on "write e2e", "add tests", "test this feature", "fix flaky test", "e2e coverage", "playwright test", "acceptance test", or when the user wants automated tests for a feature. This skill does NOT cover demo video recording (use demo-recorder for that).
10: phases:
11:   - id: P1-JourneyACPreflight
12:     trigger: always
13:     reads: ["docs/specs/journeys/J*.feature.md", "docs/specs/features/<name>.md"]
14:     writes: []
15:     evidence_kind: command_output
16:     required_for_completion: true
17:   - id: P2-FrontendSurfaceRead
18:     trigger: always
19:     reads: ["frontend source", "toast/notification components", "routes/pages"]
20:     writes: []
21:     evidence_kind: command_output
```
