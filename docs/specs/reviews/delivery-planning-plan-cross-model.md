# Delivery planning — formal cross-model review

Round 1: both reviewers returned fail. The following are author resolutions, not altered external verdicts. Raw findings/transport receipts remain in the ignored launcher artifacts; frozen plan digest: 4183125a49a04383b0e53941e1a8719192a7c235a44df86f48d86b4ee4b864c8.

## sol-high

**F-001 — PARTIAL (high)**
The v4 migration is fail-open in both directions: new inline plans can continue using v3 to evade the new contract, while current old consumers can accept an unknown v4 receipt.

New v4 issuance checks same-source consumer support and new consumers reject unknown versions. Decline compulsory historical cutoff: complete v3 remains an expressly supported stricter contract and is not a safety bypass. Old binaries cannot retroactively reject v4.

Evidence/action: Exact interfaces: Plan body and projection.

**F-002 — ACCEPT (high)**
The authored SVC_PLAN_BODY and derived plan-manifest receipt do not have a complete, single producer contract.

Exactly one delimited JSON block contains the full receipt body, including fixed authoring timestamp and identity. parsePlanManifest is the shared constructor; projection does not invent fields or timestamps.

Evidence/action: Exact interfaces: canonical authored mapping.

**F-003 — ACCEPT (high)**
Producer/verifier command steps cannot currently block or unblock task dispatch because the plan defines no mapping between command-sequence steps and task-graph prerequisites or result receipts.

Use ordinary predeclared producer_task/verifier_task and static blocked_by relations. Consumer action task_id must transitively depend on verifier. Existing process/phase evidence records real outcomes; no new result ledger.

Evidence/action: Exact interfaces: execution_command_sequence.

**F-004 — ACCEPT (high)**
The proposed executor context can silently drift after plan review because context_refs bind only paths and line numbers, not source bytes or revisions.

Every immutable context excerpt stores excerpt_sha256. Re-read and compare exact slice bytes; future code is explicitly fresh local context after prerequisite completion, never labeled reviewed bytes.

Evidence/action: Exact interfaces: task_graph/context_refs.

**F-005 — ACCEPT (high)**
The tier-1 verifier has no authoritative definition of a full validator set, so a reduced caller-supplied set could be labeled and reused as full evidence.

Remove speculative cache and verifier. Existing full inventory, runner, selection and gates remain unchanged.

Evidence/action: Existing release evidence — T2.

**F-006 — ACCEPT (medium)**
The proposed evidence cache is not connected to a real same-identity first-delivery reuse opportunity, making T2 potentially new machinery with no finalization benefit.

No measured first-delivery reuse edge survives HEAD/index changes; therefore do not add machinery or claim savings. Improve existing finalizer use only.

Evidence/action: Existing release evidence — T2.

**F-007 — ACCEPT (high)**
The required documentation checkpoint makes the declared base_sha and ownership census stale before implementation begins.

Remove separate documentation checkpoint. Own planning provenance under T4 relative to the single immutable baseline. No predicted SHA or hidden scope.

Evidence/action: Files Planned and Checkpoint Plan.

**F-008 — ACCEPT (high)**
AC-DP-10 is mapped to T4 even though T4 explicitly cannot perform the live install and promotion evidence required by that AC.

AC-DP-10 belongs to real lane tasks 9 land and 10 verify. Canonical install/drift gates task 10 completion; source T4 only packages. Include actual graph in review input.

Evidence/action: AC-to-Task Mapping; .svc/lane-tasks-WI-FW-DELIVERY-TRADEOFFS-01.json.

**F-009 — ACCEPT (medium)**
The paired same-input pilot required by AC-DP-09 has no owned execution step, command or output artifact.

T1 owns deterministic paired fixture arms with identical source requirements and assertions. Test contract retention, not LLM quality or cycle speed. Record actual command outcome in pilot.md.

Evidence/action: Task Graph; AC-DP-09.

**F-010 — ACCEPT (high)**
Delivery-cycle accounting lacks a stable event schema and idempotent producer rules, so cumulative 30/120/10 reporting can double-count or invent intervals.

Versioned payload in existing mechanical envelope; stable root/task/attempt/transition ID, UTC observed timestamps, idempotent repeated activation, unknown lost events. No competing session writer.

Evidence/action: Timing and index behavior — T3.

**F-011 — ACCEPT (high)**
The changed-executable and receipt-consumer census is incomplete and largely proves references to a new test wrapper instead of actual runtime consumers.

Replace wrapper-only census with source executable references and prospective shared-helper consumers. Add omitted in-session plan-reviewer and selector. Preserve existing receipt promotion/reconcile tests.

Evidence/action: plan-contract.json executables; Files Planned.

**F-012 — ACCEPT (medium)**
The planned skills-manifest.json mutation has no specified key or synchronization consequence and may be unnecessary scope.

Remove skills-manifest edit. Installer already links scripts directory; no registry change has a purpose.

Evidence/action: Files Planned; installer census.

## grok-high

**F1 — ACCEPT (high)**
T1's nullable inline rubric_score never reaches the canonical launcher or the in-session plan-reviewer agent, so the leftover integer grader remains in force.

Retain integer score throughout launcher and durable review schema; change its inline meaning consistently in protocol, Codex/Kimi prompts and in-session agent. No nullable-score transport change.

Evidence/action: Contract transition matrix; agents/plan-reviewer.md owned by T1.

**F2 — PARTIAL (high)**
Declared config_schema_migration and cross_runtime_integration make design-tech mandatory and non-skippable, but the plan has no design-tech task and uses the denied skip phrasing.

Real graph already contains non-skippable design-tech task 2, in_progress with actual loaded receipt. It was omitted from package, now included. Complete after real review; do not fabricate the requested completed status.

Evidence/action: Actual lane graph and delivery-planning-lane-validation.log.

**F3 — ACCEPT (high)**
AC-DP-06 targets design-ux/ui/tech, which do not restamp branch indexes; the unconditional restamp lives in plan-changeset and execute-changeset, which T3 does not own.

Remove unrelated design-ux/ui/tech edits. T1 owns actual plan/execute restamp producers; T3 owns audit/align wording and write-spec subsequent-stage guidance. Genesis creation remains.

Evidence/action: Files Planned; T3 scope.

**F4 — ACCEPT (high)**
The v4 producer form cannot be represented in the current task graph: blocked_actions must be a non-empty later-step list, and set-status cannot record producer outcomes as blocked_by.

Predeclare ordinary producer/verifier tasks with static dependencies; no blocked_by mutation. Allow terminal producer empty blocked_actions and existing final skill pre-use verification.

Evidence/action: Exact interfaces: execution_command_sequence.

**F5 — ACCEPT (high)**
Mechanical C7 still requires a fenced bash Execution Command Sequence in both modes; T1 does not specify the replacement that accepts producer/verifier entries.

C7 branches only on validated explicit v4 inline body; keep bash fence for legacy/dispatch/absent. Schema conditional sequence alternatives and new fixtures cover both. C9 remains.

Evidence/action: Exact interfaces: C7 version/mode matrix.

**F6 — ACCEPT (high)**
T2 has no exact interface for supplying a matching tier-1 summary to pre-push or land, so the current focused gate cannot reuse evidence.

Remove new evidence cache rather than invent a handoff with no measured benefit. Existing gates and exact-input reuse rules remain; T2 improves actual producer/finalizer references only.

Evidence/action: Existing release evidence — T2.

**F7 — ACCEPT (medium)**
T3 delivery-cycle events have no writable record shape: pipeline-log.mjs and the decision schema cannot carry the new fields, and session-contract freshness is unlisted.

Use existing kind=mechanical payload and dual-write legacy fields. Timing metadata lives in lane graph, no session-contract freshness modification. Stable ID and actual-transition producer rule are explicit.

Evidence/action: Timing and index behavior — T3; existing pipeline-decision schema payload.

**F8 — ACCEPT (medium)**
The documentation checkpoint is a real implementation prerequisite but is not a current-contract command with an expected outcome.

Remove special documentation checkpoint completely and include all provenance in T4 ownership against one base_sha. No missing checkpoint command remains.

Evidence/action: Files Planned; plan-contract.json.

**F9 — ACCEPT (medium)**
T4 adds an always-on tier-1 validator without the required promotion note, so a hot-path check can land without a failure-class budget.

Promotion note fixes failure class, historical signal and <5s local budget. Own selector registration. Wrapper invokes only two local test files, not the large existing regression corpus again.

Evidence/action: Review resolution and validator budget; T4 selector ownership.

**F10 — ACCEPT (low)**
This plan forbids per-task checkpoint commits while the current execute-changeset skill still requires them, and T1 does not say the self-verify row is being removed globally.

Keep current checkpoint requirements for this WI; remove contradictory no-intermediate-commit instruction. No global checkpoint-policy change is smuggled into T1.

Evidence/action: Execution Command Sequence; task checkpoints.

## Round 2 resolutions

Sol F-013: ACCEPT. Added write-spec task 11 before design-tech; loaded and executed its six phases against the existing WI, retained actual receipts and explicit framework-enabler persona applicability. Design-tech/plan/review completion still waits on actual final review evidence.

Sol F-001 and Grok F3: ACCEPT. Final interface clarification defines exact --capabilities argv, JSON, source identity, file digests, version/mode support and failure behavior. The helper and emitter enforce same-source support before v4 issuance.

Sol F-003 and Grok F1: ACCEPT the missing bridge; remove the unsupported generalized scheduling design. v4 producer entries now ONLY describe land-changeset/verify-promotion through existing adapter pre-use checks. No producer task IDs, blocked actions or process-graph mapping. Implementation DAG remains unchanged. This meets future release identity use cases without adding another engine.

Sol F-004: PARTIAL. Hash-bind every context_ref, with no exceptions. Future code context is intentionally outside context_refs and taskContext; the existing executor reads current code after prerequisites. Therefore no binding discriminator or new result store is necessary. Counter-evidence: Exact interfaces explicitly limits context_refs to immutable reviewed slices.

Sol F-008: ACCEPT. Setup and all-host drift commands run INSIDE in-progress verify-promotion before task 10 can complete; failure/restoration leaves it incomplete.

Grok F2: ACCEPT. Removed the stale pre-push census row; runner and pre-push behavior remain unchanged.

## Final result

Both requested stations returned pass, rubric_score 10, findings []. Final reviewed manifest SHA256: 412b8f90bcbd0d5dae71be3aa39f9cc95c6a62e36827848b0357255ee40030cc. Sol is required advisory; Grok is the independent cross-family reviewer. The launcher receipts contain exact model/effort and actual run outputs.

This report retains the canonical review log and dispositions in one tracked location instead of duplicating them into review-log.yaml. That path-only adaptation follows the owner's explicit requirement to remove valueless duplication; receipt evidence points here. No review or finding is omitted.

```yaml
review_log:
  rounds_run: 3
  hard_cap: 3
  unresolved_critical: 0
  remaining_high: 0
  self_review_passes: 1
  terminal_verdict: pass
  plan_sha256: 412b8f90bcbd0d5dae71be3aa39f9cc95c6a62e36827848b0357255ee40030cc
  tier1_exit_code: 0
```

## Execution adaptation

The first full corpus ran 367 validators in 281.846 seconds: 361 passed and six failed. Failures identify generated routing/agent synchronization, scratch-artifact classification, and missing historical route phase entries; no functional v4 regression was reported. Those failures are being repaired before release.

A task-by-task full-corpus commit cycle adds repeated whole-repository work to one compatible package change. Under the owner's explicit request to eliminate work without product value, this WI keeps reversible diff checkpoints and a single final branch commit after full validation and normal review. This is a documented execution adaptation, not a global checkpoint-policy change or hook bypass.

## Execution review round 1 and author dispositions

Frozen candidate fce7e0ab6afb516948cfc1e5241d549521c90c2374734651ab3928a83cf2dd49 received actual Sol High (advisory) and Grok High (independent) execution reviews under .svc/external-review-artifacts/delivery-planning-exec-round1/. Both returned FAIL; no execution approval is claimed for that candidate. Sol's first station-name resolution failed before a provider call; the explicit owner-policy retry is the actual Sol review. Grok used the effective dispatch policy's exact Grok High station. Final review uses the explicitly requested two-station owner topology.

| Finding | Disposition and actual correction |
|---|---|
| Sol EXEC-001 | ACCEPT: emitter validates a frozen Git index tree, including unstaged-good/staged-bad and inverse cases; mirror placement retains the same identity and refuses an index race. |
| Sol EXEC-002 | PARTIAL: restrict producer.field to one literal identifier; clarify the existing adapter's preparation/pre-use/action ordering. A new generic shell classifier/adapter registry is rejected: v4 data creates no command runner or mutation authority; arbitrary command strings already existed in legacy plans. Existing owner/controller/promotion checks remain authoritative. The approved third plan review explicitly chose existing release consumers over another runtime engine. No claim that schema validation proves arbitrary shell code read-only. |
| Sol EXEC-003 | ACCEPT: every scope entry is exact repo-relative and included writes equal the task-write union; reject unused supersets, traversal, absolute paths and globs. |
| Sol EXEC-004 | ACCEPT: output publication follows the locked manifest compare/update; deterministic concurrent-author fixture proves a failed comparison preserves the prior output and intervening edit. |
| Sol EXEC-005; Grok E-004 | ACCEPT: atomic idempotent bind-delivery-cycle initialization/inheritance, conflict/reset rejection, explicit wait/amendment/reopened-decision recording, decision counts and implementation classification for QA/test skills. Actual activation observes phases on old graphs too; unobserved historical intake stays null. This reuses the existing graph and mechanical log, not a new ledger or gate. |
| Sol EXEC-006 | ACCEPT as release evidence obligation: final corpus and both final execution receipts must pass before commit. Source review must not certify future host installation or the other station's result. |
| Grok E-001 | ACCEPT: replace the exact dispatch template's contradictory strip/no-read clauses with original-requirement slots and targeted in-repo reads. Dispatch retains its complete packet and isolated write authority; v4-only helper is not misrepresented as a legacy dispatch parser. |
| Grok E-002 | ACCEPT: compact existing timing instructions to 219 lines without weakening the 220-line gate. |
| Grok E-003 | ACCEPT: update the existing selector's sorted exact closure expectation; add its test file to T4's mechanical consumer census. |
| Grok E-005 | ACCEPT: schema and shared validator restrict producer.field to one literal top-level identifier; dotted/query/shell forms fail. |

The second full local corpus was 366/368 passing in 282.080 seconds; the two failures above were corrected with their actual validators. The expanded focused corpus is 14/14 passing in 859.510 ms. Final full validation is still required for the revised candidate. The runtime graph is a delivery snapshot; per-SHA receipts retain subsequent execution/audit/promotion evidence without a new source commit solely to restamp volatile lifecycle fields.

The revised pre-integration corpus passed 368/368 in 276.844 seconds. Origin then supplied independently landed PR #43 (22a78dd, cached-review source provenance); its five files do not overlap this changeset and were fast-forwarded before final execution review. The execution census now uses that base, while the original plan-review receipt retains its real 9381291/412b8f90 provenance. Final integrated validation remains required. A self-check also preserves observed phase intervals when historical intake is unknown, instead of hiding those known observations behind a null total clock.

## Execution round 2 disposition

Sol returned FAIL with EXEC-R2-001 (High) and EXEC-R2-002 (Medium). Grok's real invocation ended cancelled with no structured terminal output; launcher classification schema_invalid is a protocol failure, not a passing review. Its partial text still identified the real mechanical census failure.

- EXEC-R2-001 — REJECT with a concrete product fixture: framework tools are installed outside an onboarded application's Git tree. The existing integration test intentionally creates a product candidate containing only spec.md, then invokes the separately installed/current package's emitter and checker. Requiring that product SHA to contain framework helpers would break every such project. --capabilities binds the five framework package files to its explicit source_root; original AC/context bind to the separate product candidate. Clarify this distinction in the template and assert the exact product tree in the fixture. Historical receipt compatibility remains unchanged; no claim that an old framework release installed new code.
- EXEC-R2-002 — ACCEPT: record actual graph terminal time atomically, including a final skipped task and all-skipped graphs. Completed legacy graphs without that timestamp report an unknown endpoint; never substitute an earlier task or today's time.
- Grok partial C10 observation — ACCEPT: the existing selector test was owned but the staged executable census still needed its own consumer entry and denominator 14. Full corpus 368/368 is real, but the separate mechanical command failed; that failure was supplied in the package and now requires its own passing result.
- Self-check — ACCEPT: replace the unignored example .svc/plan-body.json with the real ignored projection directory and state the index-staging prerequisite explicitly. Exercise that actual ignore pattern in the CLI fixture.

Grok's partial suggestions about an ever-growing deliveryEvents array are inapplicable: task-graph is a one-command CLI which exits after the single flush, not a persistent imported event server. The 219-line router passes its real 220-line gate. Neither observation justifies another runtime mechanism.

## Execution round 3 targeted remediation
Sol EXEC-R3-001 is accepted: the pre-commit command example incorrectly supplied --sha. It now explicitly omits that flag, stages original candidate inputs, and reserves exact SHA emission for post-commit use. The actual external-framework CLI fixture stages a changed spec, immutable UX context and manifest, verifies staging-tree receipt placement, and rejects those candidate inputs against the prior HEAD. All 15 focused tests pass. Land preflight separately found the historical WI-541 navigation index stale; T4 revalidated only its cited changed contracts. Final release evidence remains in the current candidate receipt chain.

### Permanent recovery amendment: execution findings (2026-09-08)

The owner authorized automatic recovery of the mechanical release blocker. Review of candidate `6f47bd27633d9896bf5bb4bf5e287cbca1ac35206db6701e75a4758b763d2666` produced the following concrete corrections. Raw Sol High and Grok High results remain in `.svc/external-review-artifacts/delivery-planning-recovery-verified/` and their immutable issuer store. Their failing verdicts are preserved, not relabeled.

| Finding | Disposition and evidence |
|---|---|
| Sol RRA-001: placeholder completion can erase a negative signal | Fixed: parsed findings, false certifications, rubric failures, unread dependencies or a non-passing verdict prevent automatic completion, including the schema-invalid route. Negative-signal regression covers each class. |
| Sol RRA-002: dollar-budget promise exceeds non-Claude transport support | Corrected contract and implementation: Claude requires known spend and passes the remaining dollar ceiling. Other transports explicitly report no enforced dollar ceiling; an explicit requested dollar cap prevents automatic retry. With no such cap, one correction is bounded by the original timeout. No new billing wrapper or invented zero-cost claim. Unit cases cover all supported transports and missing/partial spend; actual Cursor fixture proves an explicit unsupported ceiling allows no second invocation. |
| Sol RRA-003 and Grok exec-f1: repaired results cannot replay from cache | Fixed: cache accepts the validated two-attempt same-tuple repair shape and verifies the existing signed issuance against cached receipt/findings and the exact current package. The issuer already checked judgment preservation; no temporary artifact reads or duplicate cache-proof format are required. Ordinary schema/tuple checks remain. |
| Grok exec-f2: missing repaired-cache-at-cap regression | Fixed with actual governed launcher: seed two substantive rounds, repair the third with two provider calls, then replay the repaired result at capacity with zero additional calls and unchanged original receipt bytes. |

Astra also fixed a duplicated `cycle_sequence` key before this review: the regression first reproduced six null ordinals, then passed with contiguous raw ordinals and independent substantive flags. The original concurrent-slot test now accepts the zero-call replay while proving paid-call success and unchanged provider-call count. The previous full corpus passed368/368; final changed-source validation and reviewer verdict remain required before delivery.

Follow-up dispositions: Sol RRA-001-REMAINING is fixed by treating wrong-shaped negative-bearing fields conservatively, with singleton-object and scalar regressions. Sol RRA-003-DURABILITY / Grok exec-f4 is fixed by verifying the existing immutable issuer proof, so removing or overwriting the invocation directory cannot invalidate a valid cache object; the actual at-cap regression deletes that directory before replay and rejects a modified cached receipt. Grok exec-f3 is rejected with direct consumer evidence: `validateFindings` calls `reportRepairKind` and rejects an unrepaired placeholder. The focused CLI fixture now proves both placeholder and certification-scope reports fail after an explicit unsupported dollar cap prevents repair, with exactly one call. The missing `validateFindings` excerpt is included in the follow-up package.

Final producer/consumer corrections: Sol RRA-003-PROOF-DOWNGRADE is fixed by checking the existing issuer proof for every production cache shape, so truncating two attempts to one cannot bypass verification. Sol RRA-003-AUTHORITY-ROOT is fixed by selecting the durable store directly, without a cache-controlled artifact-path hint. Actual CLI regressions cover truncated attempts and an incidental repository-local fixture-authority directory. Astra reproduced a separate negative-placeholder path: refusing automatic completion must not remove the report's incomplete status. Detection now separates incomplete status from repair eligibility; the prior failing CLI case with unread proof now stays schema_invalid after one call.

Grok's last raw source verdict was PASS9 with no findings, but the launcher rejected its summary because the explanatory phrase “an unrepaired placeholder” matched an overbroad status regex. Both raw attempts are preserved under recovery-round3/grok-high. Detection now matches explicit incomplete status at the start of the report, not a discussion of placeholder handling inside a completed review. A regression uses that actual observed response pattern. This is protocol correction, not a changed reviewer judgment or a fabricated pass receipt.
