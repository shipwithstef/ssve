# WI-489 independent plan review

**Verdict:** REVISED_AND_REVIEWED
**Primary request:** Fable 5 at high
**Fallback:** none
**Implementation started:** no

The promoted WI-488 launcher could not be used before its own corrective
implementation without reproducing the known one-turn schema failure. The
review package was therefore sent through stdin to one bootstrap-safe isolated
Claude process with exact Fable/high request, safe mode, tools/MCP disabled,
plan permission, no persistence, schema constraint, budget bound, and
`--max-turns 4`. No availability probe or second Opus process was run.

The first pass scored 6/10 and returned ten findings: two high, five medium,
and three low. All were accepted and applied. The mandatory infra-path
convergence pass used the same Fable/high request, scored 9/10, certified all
ten original findings materially resolved, and returned only three low command
mismatches plus one informational wording issue. Those four literal fixes were
also applied and mechanically revalidated.

Notable proof from convergence:

- process exit 0; duration 173162 ms; provider-reported `num_turns=2`;
- model usage contained exact `claude-fable-5` plus allowed auxiliary Haiku,
  with no Opus safety route;
- reported cost was $1.191302;
- revised plan passes mechanical, external-state, framework-lane, Markdown,
  and diff checks.

The earlier pass reported `num_turns=11` despite the configured four-agentic-
turn CLI ceiling. WI-489 therefore treats the CLI ceiling and provider-reported
turn metric as separate receipt fields; it does not claim they are the same
counter.

No executable launcher, schema, registry, resolver, test, or consumer-contract
file was edited before this review closed.

## Owner-correction review — direct Fable 5/high

After live hello-world calls proved exact `gpt-5.6-sol/high`, Fable 5/high,
Opus 4.8/high, and AGY authentication, the owner expanded the correction to
cover truthful Codex attestation, reviewed-worktree doctrine packaging, and
the removal of active Gemini/direct-AGY research calls. A fresh direct
Fable 5/high plan review ran with tools/MCP disabled, plan permission,
non-persistence, schema output, four-turn ceiling, and no fallback.

- Exit 0; provider-reported `num_turns=2`; no Opus usage.
- Fable verdict: `revise`.
- Accepted blockers: exact sol-id inventory, Codex requested-accepted versus
  server-observed semantics, hashed worktree rules/skills, canonical safe AGY
  migration, and an opt-in four-route live canary.
- Rejected as already satisfied: Claude Haiku auxiliary filtering and exact
  1200-second production-timeout fixture. Both existed in the candidate and
  were retained rather than duplicated.
- The structured Fable verdict and every accepted/rejected disposition are
  summarized above; the session-local raw artifact remains outside git.

The manifest and EXTREV coverage were revised through EXTREV-135 before the
expanded implementation was treated as review-ready.

## Canonical-launcher plan review after owner correction

The repaired canonical launcher then sent the concrete plan to exact
`claude-fable-5` at high with no launcher fallback. The receipt records Claude
Code `2.1.211`, one process, server-observed Fable plus allowed Haiku, no Opus,
`explicit_profile_primary`, and a 1200-second production bound. Fable completed
in roughly five minutes with verdict `pass-with-findings`, score 7/10, and eight
findings.

Dispositions:

- F-001 and F-008 were package-construction defects in this review attempt,
  not missing-plan defects: the shell package stopped the manifest/spec at
  fixed line counts, hiding the already-present External State, Rollback, and
  route-state sections. The next submission includes the complete files and
  mechanical-pass evidence.
- F-002 was accepted. `checkpoint_task` now records `HEAD` on a clean tree,
  and the existing pre/post-merge rollback text remains explicit.
- F-003 was accepted. Reviewer runtime is task-3a; AGY migration is independent
  task-3b; both converge before consumer synchronization.
- F-004 was accepted to the observable boundary. The live canary now records
  Claude CLI version, exercises `switchModelsOnFlag`, scrubs inherited model
  controls, and server-observes exact Fable. Structured max-turn classification
  remains a deterministic fixture because a safe no-tools happy-path canary
  cannot reliably force the provider's internal retry branch.
- F-005 was accepted as lifecycle honesty, not as a reset request. The owner
  explicitly authorized immediate repair and real provider proof before more
  ceremony; the manifest now records this retro-planning authority. Frozen-diff
  review/gate/audit/land/promotion remain blocking.
- F-006 was accepted. Provider safety causation is now explicitly
  `provider_model_usage_envelope_inferred`, never provider-attested.
- F-007 was accepted. Selection reads validate the parent directory and use
  `O_NOFOLLOW` plus opened-descriptor checks; AGY cleanup is asserted after
  provider failure as well as success.

After these revisions: mechanical plan validation passes; the full reviewer
suite passes 128/128; AGY passes 12/12; graph/lane, contract-map, and work-item
validators pass. A fresh live Fable settings canary server-observed exact
Fable/high on Claude Code 2.1.211 with `switchModelsOnFlag` accepted and no
Opus usage. The complete-package convergence review follows this disposition.

The first complete-package convergence attempt returned a substantive 9/10
assessment but authored `review_kind: plan-convergence` instead of the required
literal `plan`. The launcher correctly rejected it as `schema_invalid`, made no
fallback call, and did not treat the findings as an accepted review receipt.
Its four low/info observations were nevertheless independently checked and
fixed before retry: EXTREV-76 no longer equates separate turn counters;
evidence counts now pin 129 passed and 0 failed; an active Fable selection is fixture-proven
inert for Claude orchestration; and the EXTREV-122 inline gate branch-checks
exact-primary versus envelope-inferred safety-route postconditions.

The first schema-valid complete-package review then ran through the canonical
launcher with exact Fable/high, one process, no Opus, and score 7/10. It found
one high plan-inventory mismatch and one low receipt-gate mismatch. Both were
accepted: the three modified adapters are now explicit task-3a file rows with
syntax/package-context validation and AC trace, and the safety-route gate now
accepts either null/provider-managed effort or non-null/runtime-proven effort.
Mechanical validation and `git diff --check` pass after these changes. A narrow
Fable convergence pass is required before this plan review closes.

The narrow convergence pass completed through the canonical launcher with
verdict `pass`, score 9/10, and both findings certified resolved. The receipt
records exact requested/invoked/effective Fable 5/high, server-observed Fable
plus allowed Haiku, one process, two reported turns, no Opus, no fallback, and
`$1.56667` reported cost. Its only informational note was the intentional
chronological growth from 128 to 129 fixtures; task-5 evidence pins the final
count. Plan review is closed and the candidate may proceed to frozen-diff
implementation gates.
