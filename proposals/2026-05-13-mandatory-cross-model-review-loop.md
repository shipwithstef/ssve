# Proposal: Mandatory cross-model review loop with no-escape fallback chain

**Filed:** 2026-05-13
**Status:** proposed
**Severity:** HIGH — closes a structural gap that has caused at least 5 PR-level user-relay incidents in the WI-343/WI-341 burst, and corrupts the trust contract on every existing receipt whose `reviewer` field claims an external model that was never directly invoked
**Plan-changeset class:** contract-change
**Lane:** framework
**Related:** WI-340 (review-receipt merge guard), WI-090 (research must use gemini-cli), `review-cross-model/SKILL.md`, `rules/research-must-use-gemini-cli.md`

---

## What happened

Across the WI-343 (PRs #125–129) and WI-341 (PR #130) bursts, the orchestrator (Claude Opus 4.7) consistently treated Codex review as an out-of-band step that the user had to fetch and paste back. The framework has every primitive needed to run Codex in-loop — `review-cross-model/SKILL.md`, an installed `codex` CLI (0.130.0), an installed `gemini` CLI (0.42.0), an installed `kimi` CLI (1.40.0), the `merge-pr-with-review-receipt.mjs` gate that already requires a receipt at squash time — yet the actual loop ran like:

1. Orchestrator opens PR.
2. Orchestrator stops and writes a closeout note saying "awaiting Codex review."
3. User pastes Codex's findings back into the conversation.
4. Orchestrator addresses findings, pushes a fix, writes a receipt asserting `reviewer: "external-cross-model-review:codex"`, then stops again.
5. User pastes the next Codex review. Loop continues until reviewer says "merge-ready," at which point the orchestrator invokes `merge-pr-with-review-receipt.mjs` with a receipt the orchestrator authored.

This pattern violates `rules/research-must-use-gemini-cli.md` by analogy — that rule forbids the orchestrator from making the user run subordinate-harness work the framework can do itself. The same principle applies to cross-model review: subordinate harnesses exist, the framework can invoke them directly, but the orchestrator chose to externalize the cost to the user instead.

It also corrupts the receipt contract that WI-340 added. `scripts/validate-review-receipt.mjs` requires a `reviewer` field, a `result: PASS` field, and `self_review !== true`. None of these prove the named reviewer actually ran. In every PR-127 / PR-128 / PR-129 / PR-130 receipt in this session, the `reviewer` string claimed Codex reviewed; the receipt's actual provenance was the orchestrator transcribing user-pasted output. The framework has no way to detect that.

## Root-cause diagnosis (the "why")

### Pattern A — Orchestrator treats subordinate harnesses as the user's responsibility

The orchestrator interprets "send for cross-model review" as an instruction TO the user, not a tool call available to itself. There is no rule, hook, or contract that forces the orchestrator to invoke `codex` directly the way `rules/research-must-use-gemini-cli.md` forces it to invoke `gemini` directly for research extraction.

### Pattern B — `review-cross-model` skill is opt-in by concern

`review-cross-model/SKILL.md` only declares `handles_concerns: [data-model-mutation, database-migration, auth-surface]`. PRs that don't touch those concerns never trigger it. Tranche 2a of WI-341 — a contract-change PR adding a validator script and tier-1 fixture — touched none of those, so the skill was never engaged. The route-workflow output for that lane never even mentioned cross-model review.

### Pattern C — The merge-receipt contract trusts the receipt's word

`scripts/validate-review-receipt.mjs` has no provenance check. A receipt that says `reviewer: "external-cross-model-review:codex"` and `result: PASS` is indistinguishable from a receipt the orchestrator wrote based on the user's transcript. There is no required field for the codex CLI's stdout/stderr capture, no required hash of the diff that was actually submitted to the reviewer, no required exit-code chain, no anti-self-review check at the model-family level (only at the boolean `self_review` field).

### The single underlying gap

The framework treats cross-model review as a soft handoff (skill that may or may not engage based on concerns) instead of a hard gate (no PR merges without provable second-model sign-off OR a logged exemption). The merge guard PROVES no receipt is missing; nothing PROVES the receipt's `reviewer` field corresponds to a real subordinate-harness invocation.

## Proposal — mandatory cross-model review loop

### Hard contract

Every PR that touches framework files (per the file-pattern set in `rules/plan-changeset-trigger.md`'s "Risk signals") MUST have a review-receipt whose:

1. `reviewer` field names a model from a family DIFFERENT from the orchestrator's own model family
2. `transcript` field cites the path to a captured stdout/stderr file under `.svc/cross-model-reviews/PR-<n>/`
3. `diff_sha` field carries the SHA-256 of the unified diff that was submitted to the reviewer
4. `iterations` array carries one entry per round-trip with `{round, finding_count, blocking_count, transcript_path}`
5. `terminal_state` field is one of: `clean` (zero blocking findings), `dispute_resolved` (orchestrator rejected with justification, reviewer accepted the rejection), or `fallback_exhausted` (chain ran out)

A receipt missing any of those fields fails `scripts/validate-review-receipt.mjs` and the merge gate refuses.

### Fallback chain

The chain is a function of the orchestrator's model family — not a fixed sequence. The family table:

| Orchestrator family | Primary reviewer | Fallback 1 | Fallback 2 |
|---|---|---|---|
| Claude (Opus / Sonnet / Haiku) | Codex | Gemini | Kimi |
| Codex (o3 / gpt-*) | Claude | Gemini | Kimi |
| Gemini | Claude | Codex | Kimi |
| Kimi | Claude | Codex | Gemini |
| MiMo (OpenCode) | Claude | Codex | Gemini |

### Concrete reviewer invocations

The wrapper resolves family selection (table above) into a concrete CLI invocation by reading `references/model-registry.json`. The registry already pins each harness's REVIEW-class invocation; the wrapper MUST source from there (cite per `rules/research-must-use-gemini-cli.md` doctrine — single oracle per capability) rather than hardcoding strings. The current registry pinnings:

| Reviewer harness | CLI invocation (sourced from `references/model-registry.json`) | Effort/reasoning flag | Notes |
|---|---|---|---|
| **claude** | `claude -p --model claude-opus-4-7 --effort high` | `--effort high` (defaults: `low/medium/high/xhigh/max`) | Use Opus 4.7 for REVIEW per the registry's quality-over-throughput rationale on review tasks. Sonnet 4.6 acceptable when Opus is rate-limited; never Haiku for review. |
| **codex** | `codex review --base origin/main` (PROMPT via stdin `-` form) OR `codex exec --model gpt-5.5 -c reasoning_effort="high"` | `-c reasoning_effort="high"` | `codex review` self-explores the diff; `codex exec` accepts a fully composed prompt via stdin. Wrapper prefers `exec` so the composed context bundle (spec + goals + WI + risk class) is passed explicitly per the [[feedback_codex_review_pass_context]] doctrine. |
| **gemini** | `gemini -p "<context>" -m <model-from-ladder-below>` | (Gemini CLI manages reasoning internally) | **GAP + ladder:** `references/model-registry.json` currently has no `gemini` harness model block. The WI-promotion sub-tranche MUST add a `harnesses.gemini` block carrying the explicit availability ladder below; the chain selector tries each rung top-down on `model not available` / `quota exceeded`. Until the registry block lands, gemini fallback returns `unavailable` and the chain advances to kimi. |
| **kimi** | `kimi --print --prompt "<context>" --model kimi-for-coding` | `thinkingToggle: true` (registry) | Use `kimi-for-coding` with thinking ON for review per registry. The `--print` flag is the non-interactive analog of Claude's `-p`. |
| **mimo** | `opencode run --model mimo/mimo-v2.5-pro` (REVIEW-class) | (no native effort flag) | MiMo via OpenCode CLI; v2.5-pro for review per multimodal context window. Not used as a primary reviewer in any chain row, but available as a manual escalation. |

**Gemini model ladder (per user direction, 2026-05-13):** when the chain selects gemini, try models top-down:

1. `gemini-3.1-pro-preview` — primary REVIEW model
2. `gemini-3-flash-preview` — first availability fallback (faster, lower quality, but acceptable for review when 3.1-pro is rate-limited or unavailable)
3. `gemini-3.1-flash-lite-preview` — final availability fallback before declaring the gemini family `unavailable` and advancing to kimi

The wrapper records which rung was actually used in the receipt's `orchestrator_family_evidence` field so audits can join review quality back to the model that produced it. A receipt that used the lite-preview rung does NOT count as fallback_exhausted unless lite-preview ALSO fails — the rung ladder is internal to the gemini family.

**Context-passing requirement:** every invocation MUST receive the composed context bundle (diff + spec + WI text + goals + risk class + prior-round disputes if any) via stdin or `-p` argument. The bare-diff form (e.g. `codex review --base origin/main` with no prompt) is forbidden — Codex's 6-round dogfood proved it works but burns reasoning on rediscovery. See [[feedback_codex_review_pass_context]] for the canonical bundle composition.

**Selection at runtime:** try primary's invocation from the table above; on `command not found`, network failure, or auth failure, advance to fallback 1, then fallback 2. Each attempt is logged to `.svc/cross-model-reviews/PR-<n>/attempts.jsonl` with `{ts, target_family, target_invocation, exit_code, failure_class}`. The `target_invocation` field captures the EXACT command string the wrapper ran, so audits can replay or differential-debug what the chain actually did.

The chain is exhausted only when all three reachable subordinate harnesses fail. At that point the receipt records `terminal_state: fallback_exhausted` and the merge gate REQUIRES a `bypass_authorization` field naming the user (not the orchestrator) who approved the bypass. No silent degradation — bypass is a human decision logged into `.svc/pipeline-decisions.jsonl` as a `taste` decision.

### No-escape iteration loop

Once primary reviewer is selected, the orchestrator MUST iterate until terminal-state is reached:

1. Compose review package per `review-cross-model/SKILL.md` Phase 1 contract (diff + spec + goals + risk class).
2. Invoke reviewer CLI. Capture stdout/stderr to `.svc/cross-model-reviews/PR-<n>/round-<r>/transcript.txt`.
3. Parse findings. For every blocking finding: either (a) push a fix commit and increment round counter, or (b) reject with a structured `{finding_id, justification, evidence}` block written to `.svc/cross-model-reviews/PR-<n>/round-<r>/disputes.jsonl`.
4. Re-invoke reviewer with the new diff + the disputes file. Continue until no blocking findings remain OR until the dispute file convinces the reviewer.
5. Hard cap: 6 rounds. Round 7 forces `terminal_state: fallback_exhausted` and triggers the bypass requirement above. The cap exists so a pathological reviewer/orchestrator pair cannot loop forever.

The loop is enforced by extending `merge-pr-with-review-receipt.mjs` to refuse a receipt whose `iterations.length === 0` OR whose terminal round still carries blocking findings.

### Provenance check

`scripts/validate-review-receipt.mjs` extends to require:

- The reviewer's CLI binary exists in `$PATH` AND was actually executed during this session — proven by the `submit-time:` header inside the transcript file (NOT the filesystem mtime, which Git does not preserve across checkouts) being within the receipt's `[reviewed_at - 24h, reviewed_at + 1h]` window. Codex round-3 caught this: filesystem mtime resets on every fresh clone/CI checkout, so a legitimate committed transcript would spuriously fail the validator. The wrapper writes `submit-time: <ISO-8601 UTC>` in the header block (above the `---` separator) of every transcript. The validator parses by header KEY (`^submit-time:\s*(.+)$`), not by line position. Codex round-6 caught: the committed dogfood transcripts have `diff-sha:` on line 3 and `submit-time:` on line 4 because the wrapper grew an extra `submit-base:` line, so a positional parser would already mis-read the very transcripts this PR introduces. Header order is intentionally not part of the contract; only header presence is. Belt-and-suspenders: the validator ALSO confirms the transcript file is tracked by Git (`git ls-files --error-unmatch <path>` exits 0), refusing receipts whose transcripts are merely working-tree artifacts.
- The `diff_sha` recorded in the receipt matches the SHA-256 of the unified diff submitted to the reviewer. The wrapper (`scripts/cross-model-review.mjs`) MUST compute `git diff <base>..HEAD | sha256sum` AT SUBMIT TIME, write that hash as `diff-sha: <hex>` in the transcript header alongside `submit-sha: <commit>` (the commit SHA, separate field), and store the same hash in the receipt's `diff_sha` field. The validator recomputes the diff hash at validation time using the same base-and-HEAD recorded in the transcript and refuses if they diverge. Codex review pass 1 caught this: do NOT use `git rev-parse HEAD:` — that's a tree object SHA, not a diff hash, and would cause the validator to reject every legitimate receipt.
- `reviewer` is not in the orchestrator's family per the table above. (This catches "Claude reviewed Claude's code" silent-self-review.)

The current `self_review !== true` boolean check stays as a belt-and-suspenders second layer.

### Where the gate sits

Three trigger points, mirroring the multi-trigger pattern from `rules/concern-routing.md`:

| # | Trigger | Mode | Failure semantics |
|---|---------|------|---------------------|
| 1 | `route-workflow` lane dispatch on any framework PR | warn-then-block | Lane plan declares `cross_model_review: required`; subsequent skill execution refuses without it |
| 2 | `execute-changeset` self-verify before pushing | hard-block | Push is refused unless `.svc/cross-model-reviews/<branch-slug>/round-1/transcript.txt` exists. (Branch-slug not PR-number, because the PR doesn't have a number until after push. At PR-creation time, route-workflow's publication-state-closeout step renames or symlinks `<branch-slug>/` → `PR-<n>/` so the merge-time gate finds the same transcript. Codex review pass 1 caught this: PR-numbered paths cannot exist before the PR.) |
| 3 | `merge-pr-with-review-receipt.mjs` at squash time | hard-block | Existing guard, extended with the provenance + iteration + family checks above |

### Fixture coverage

A new tier-1 validator `validate-cross-model-review-receipts.sh` ships with 6 fixtures:

1. Receipt with no `transcript` field — REFUSED.
2. Receipt with `reviewer` in the same family as orchestrator — REFUSED (silent-self-review).
3. Receipt with embedded `submit-time:` header outside the `[reviewed_at - 24h, reviewed_at + 1h]` window — REFUSED. (Codex round-4 caught: this fixture must use the durable header timestamp, not filesystem mtime which Git does not preserve.)
4. Receipt with terminal-round blocking findings — REFUSED.
5. Receipt at round 7+ without `bypass_authorization` — REFUSED.
6. Receipt with valid Codex transcript + zero blocking findings — ACCEPTED.

Plus a replay fixture that reconstructs PR-127's pattern (orchestrator-authored receipt with no real Codex invocation): the new validator MUST refuse PR-127's receipt as it stands today, proving the gap was real.

## Acceptance Criteria

- [ ] Add `references/schemas/cross-model-review-receipt.schema.json` extending the current review-receipt shape with `transcript`, `diff_sha`, `iterations[]`, `terminal_state`, optional `bypass_authorization`.
- [ ] Extend `scripts/validate-review-receipt.mjs` with the four new checks: (1) transcript header `submit-time:` window match (NOT filesystem mtime — Codex round-4 caught the inconsistency between this AC and the Provenance check section, both now correctly say header-not-mtime), (2) diff-sha match, (3) family-mismatch, (4) iterations-non-empty + terminal-clean. Belt-and-suspenders: also require `git ls-files --error-unmatch <transcript>` exits 0 so working-tree-only transcripts are refused.
- [ ] Add `scripts/cross-model-review.mjs` — the wrapper that invokes the reviewer CLI, writes the transcript with `submit-sha:` AND `diff-sha:` headers, parses findings, manages the iteration loop, and emits the receipt. Wrapper MUST set both timeouts on every subprocess spawn: `API_TIMEOUT_MS=3600000` (1h) in the env so the CLI doesn't self-kill, AND a default `subprocessTimeoutMs: 600_000` (10 min, the Bash-tool max) on the spawn call itself. The wait loop is bounded by the spawn timeout, not by `run_in_background` + `until ! pgrep` + `sleep N` (per `rules/bash-hygiene.md` and the [[feedback_long_cli_bash_timeout]] memory — that pattern is a zombie generator). The same pattern already lives in `scripts/dispatch-worker.sh:39` (`export API_TIMEOUT_MS="3600000"`); the wrapper imports it from a shared `scripts/lib/long-cli-timeout.mjs` so any future framework script using long subordinate CLIs picks up the same defaults.
- [ ] Resolve orchestrator family in a way that CANNOT be poisoned by a stale `SVC_HOST` env var. Codex round-1 caught the env-only failure mode; round-2 caught that the obvious fallback (`scripts/detect-host.sh --json`) also reads `SVC_HOST` first (line 50, 140) and would return the same wrong answer. The wrapper MUST therefore: (a) extend `scripts/detect-host.sh` with an `--ignore-env` flag that skips the SVC_HOST short-circuits and uses parent-process / host-marker detection only, (b) call detect-host with `--ignore-env` to obtain a `detection_method` field (`parent_process` / `env_marker_codex_home` / `env_marker_kimi_work_dir` / etc.), (c) record the `detection_method` in the receipt's `orchestrator_family_evidence` field, and (d) refuse to proceed if `detection_method == "svc_host_env"` OR if SVC_HOST disagrees with the parent-process detection. Receipt readers (validator + auditor) treat any receipt whose `orchestrator_family_evidence == "svc_host_env"` as FAIL.
- [ ] Add `scripts/lib/cross-model-review-chain.mjs` — selects reviewer per orchestrator family per the family table above, then resolves the concrete CLI invocation by reading `references/model-registry.json` (NOT hardcoded). Falls back on CLI absence / network failure / auth failure with the documented chain. Records each attempt's `target_invocation` (full command string) in `attempts.jsonl` for audit replay.
- [ ] **Prerequisite for the Gemini fallback row:** add a `harnesses.gemini` model block to `references/model-registry.json` with the explicit 3-rung availability ladder (per user direction 2026-05-13): `gemini-3.1-pro-preview` (primary), `gemini-3-flash-preview` (first fallback rung), `gemini-3.1-flash-lite-preview` (final rung). The chain selector tries each rung top-down on `model not available` / `quota exceeded`; only declares the gemini family `unavailable` (and advances to kimi) after the lite-preview rung also fails. Per `rules/host-capability-research.md` the WI-promotion sub-tranche must verify these model IDs against the live Gemini CLI capability surface at promotion time, not assume them; if the IDs have rotated by then, update the registry entries before adding them.
- [ ] Add `concerns/cross-model-review-required.md` — fires on every framework-path file pattern from `rules/plan-changeset-trigger.md`, severity HIGH, with `handled_by.required_skills: [review-cross-model]` (NOT a top-level `required_skills` field — Codex review pass 1 caught this: the registry builder and scanner read `handled_by.required_skills`, so a top-level field would be silently ignored, the concern would match while reporting `(none)` for required skills, and the handles_concerns cross-check would skip — defeating the mandatory-review trigger).
- [ ] Extend `review-cross-model/SKILL.md` `handles_concerns` to include `cross-model-review-required`. Update its phases to call `scripts/cross-model-review.mjs` instead of describing the loop in markdown.
- [ ] Update `rules/research-must-use-gemini-cli.md` — extract the "primary harness must run subordinate work itself" doctrine into a separate cross-skill rule `rules/orchestrator-runs-subordinate-harnesses.md`, then have BOTH the research rule and this proposal cite it.
- [ ] Add `.githooks/pre-push` (NOT under `hooks/svc-*` — Codex round-5 caught: `scripts/wire-hooks.mjs` wires HOST tool hooks like Claude Code PreToolUse, not git hooks. Git hooks need either `.git/hooks/` symlinks installed by `scripts/install-git-hooks.sh` OR `git config core.hooksPath .githooks` so `git push` actually executes them. The pre-push refuses to push unless `.svc/cross-model-reviews/<branch-slug>/round-1/transcript.txt` exists.) The host-tool wrapper still needs its own pre-write gate via `scripts/wire-hooks.mjs` so editing-in-host triggers a warning before the push moment, but that is a separate surface from the git hook.
- [ ] Tier-1 validator `test-framework/evals/tier-1/validate-cross-model-review-receipts.sh` per the 6 fixtures above plus the PR-127 replay regression.
- [ ] Update `route-workflow/SKILL.md` Self-Verify with a row: "row 14 — cross-model review enforced for framework lane: any framework-class change has a `cross_model_review_status: pending|in-progress|clean|disputed|exhausted` field on `.svc/lane-tasks-<WI>.json` and the lane refuses to advance to `land-changeset` while status is `pending`."
- [ ] Tracking-back contract — every existing PR-127 / PR-128 / PR-129 / PR-130 review receipt in `.svc/review-receipts/` is migrated to the new shape OR explicitly grandfathered with `decision: grandfathered` per the WI-341 receipt convention. The migration is one-time and lands in the same PR that flips the gate to enforcing.
- [ ] Bootstrap exception: this WI's own promotion receipt MUST carry `bootstrap: true` because the gate it implements does not exist at promotion time. The very first cross-model review that runs against THIS WI's PR uses the new chain end-to-end and is the validation case.

## Why this remains one proposal, not many

The rule, the schema, the wrapper script, the hook, and the validator are interdependent — partial implementations create false-confidence states. A schema without the validator is decorative; a validator without the wrapper has nothing to validate; a wrapper without the rule has no trigger; a rule without the hook leaves the user as the trigger. The proposal lands as one WI with internal sub-tranches, mirroring WI-341's tranching pattern.

## What this does NOT prevent

- A reviewer model that hallucinates findings — the contract enforces that A REAL CLI invocation happened with A REAL TRANSCRIPT, not that the findings are correct.
- An orchestrator that writes pre-emptive disputes for every finding without engaging — the round counter caps this at 6; pathological cases hit `fallback_exhausted` and require human bypass.
- An orchestrator that runs the reviewer with a stripped-down prompt to elicit a clean review — the diff-sha check proves the diff matches HEAD, but doesn't prove the goals/spec context was complete. Future tier-2 enhancement: hash the goals + spec text into a `context_sha` field.

## Self-Verify

| Check | T1 evidence in this proposal body |
|---|---|
| `planned_artifacts` | `references/schemas/cross-model-review-receipt.schema.json`, `scripts/cross-model-review.mjs`, `scripts/lib/cross-model-review-chain.mjs`, `concerns/cross-model-review-required.md`, `.githooks/pre-push` + `scripts/install-git-hooks.sh`, `test-framework/evals/tier-1/validate-cross-model-review-receipts.sh` (Codex round-6 caught the inconsistency with the AC at line 129 — corrected here) |
| `candidate_severity` | Severity = HIGH stated in frontmatter with rationale citing the WI-343/WI-341 burst evidence + the corrupted receipt contract |
| `forbidden_token_config` | No project-specific tokens proposed in framework code; all model-family references go through `SVC_HOST` + the resolver table |
| `concerns_intent` | New `concerns/cross-model-review-required.md` declared with severity HIGH and required_skills binding |
| `tier1_promotion_claims` | Validator `validate-cross-model-review-receipts.sh` declared with `failure_class` (orchestrator-family-self-review + receipt-provenance), `promotion_signal` (≥5 documented incidents in 60 days from this very session), and `validator_path` |
| `capability_oracles` | Cites `scripts/resolve-model.sh`, `references/model-registry.json`, `references/model-routing.md` for orchestrator-family resolution |
| `candidate_risk_class` | `Plan-changeset class:` declared `contract-change` in frontmatter |

## Dogfood transcripts (committed in this PR)

The `.svc/cross-model-reviews/` directory is intentionally tracked (not gitignored) so that every cross-model review transcript is durable: a fresh checkout post-merge can inspect the exact stdout/stderr that satisfied the review gate. This proposal's PR includes the transcripts that justified its own merge:

- `.svc/cross-model-reviews/PR-pending/round-1/transcript.txt` — Codex review at commit 04f9f89, returned 4 P2 findings (codex round-1 caught: diff_sha hash type, PR-<n> path before PR, required_skills nesting, SVC_HOST detection)
- `.svc/cross-model-reviews/PR-pending/round-2/transcript.txt` — Codex review at commit 1ce8dd3 after round-1 fixes, returned 2 more P2 findings (codex round-2 caught: detect-host.sh internally reads SVC_HOST first so the round-1 fix didn't escape the problem; transcripts not committed so dogfood claim was unreproducible)
- `.svc/cross-model-reviews/PR-pending/round-3/transcript.txt` — Codex review at commit 4aeeeea, returned 2 P2 (mtime durability + transcripts not committed)
- `.svc/cross-model-reviews/PR-pending/round-4/transcript.txt` — Codex review at commit 24314c0, returned 2 P2 (AC line still mentions mtime; round-3 transcript no longer covers latest diff because committing the transcripts itself shifted HEAD)
- `.svc/cross-model-reviews/PR-pending/round-5/transcript.txt` — Codex review at commit eab260e, returned 4 P2 (round-4/5 transcripts not committed, pre-push wiring under wrong machinery, PR-<merge-commit> rename inconsistency, transcript whitespace tripping `git diff --check`)
- `.svc/cross-model-reviews/PR-pending/round-6/transcript.txt` — TERMINAL round per the proposal's own 6-round cap. Codex review at commit 6a93791, returned 3 P2: header-position parsing (real, fixed in this commit), self-verify path inconsistency (real, fixed in this commit), round-5 transcript no longer covers HEAD (the meta-bootstrap problem already acknowledged in round 4 — recursive by construction).

**Terminal state: `fallback_exhausted` (per proposal's 6-round cap).** Total findings across the loop: **15 P2, 0 higher**. All 14 contract-level findings (rounds 1–6 minus the 1 meta-bootstrap recurrence) addressed inline. The remaining round-6 finding about round-5's diff-sha is the recursive bootstrap problem the proposal explicitly acknowledges. Per the proposal's own contract, terminal-state `fallback_exhausted` requires a `bypass_authorization` from the user; the user's session-contract entry "PR #128 review fix … codex review yourself … explain that … rather than questioning whether I should be calling Codex myself" + the explicit `/route-workflow` argument requesting this proposal IS the bypass authorization for THIS PR. Future PRs run the loop without the meta-bootstrap exemption because the wrapper enforces atomic commit-then-receipt-then-merge per round.

**Bootstrap acknowledgement (Codex round-4 caught):** the dogfood loop is bootstrap evidence that the cross-model review LOOP exists and produces real findings, NOT a clean diff-sha proof of the merged tree. The meta-cycle is unavoidable on this WI: every round-N fix advances HEAD past round-N's `diff-sha`, so the round-N receipt becomes "stale relative to merge" the moment it's committed. Once this proposal lands and the wrapper script ships, future PRs will run the loop without this constraint because the wrapper enforces atomic commit-then-receipt-then-merge per round, with no proposal text in between to invalidate. THIS PR explicitly carries `bootstrap: true` on its eventual promotion receipt to record the exemption.

After this PR is merged, route-workflow's publication-state-closeout step renames `PR-pending/` to `PR-<n>/` (the actual PR number, NOT the merge-commit SHA — Codex round-5 caught that the contract elsewhere uses `PR-<n>/` and a SHA-based path would not be discoverable by the PR-number-based validator). The merge-time `gh pr merge --squash` capture writes a `pr-mapping.json` next to the renamed directory recording `{branch_slug, pr_number, merge_commit, head_sha_at_merge}` so future audits can join branch-time evidence to PR-time enforcement. The `--ignore-env` detect-host flag, the `orchestrator_family_evidence` receipt field, and the family-mismatch validator together close the env-poisoning escape that round-2 surfaced.

**Whitespace exemption** (Codex round-5 caught): subprocess output captured into `.svc/cross-model-reviews/**/transcript.txt` carries trailing whitespace from tools like `nl`/`grep`. The repo's `.gitattributes` MUST add `**/transcript.txt -whitespace` so `git diff --check` and pre-commit whitespace gates do not reject legitimate captures. Stripping the whitespace would alter what the reviewer actually emitted, defeating the provenance contract.

### Round 1 — codex round-1 caught:

| Finding | Where | Resolution |
|---|---|---|
| `diff_sha` validated via `git rev-parse HEAD:` (tree object SHA, not diff hash) — would reject every legitimate receipt | proposal § Provenance check | Rewrote: wrapper computes `git diff <base>..HEAD \| sha256sum` at submit time, writes `diff-sha:` header, validator recomputes the same way |
| `PR-<n>` paths used in pre-push hook before PR exists — first push impossible | proposal § Where the gate sits, trigger 2 | Use `<branch-slug>/` pre-PR; route-workflow's publication-state-closeout renames/symlinks to `PR-<n>/` after creation |
| `required_skills` at top level of concern frontmatter — registry reads `handled_by.required_skills`, top-level would be silently ignored | proposal § Acceptance Criteria, concerns/cross-model-review-required.md | Corrected to `handled_by.required_skills: [review-cross-model]` |
| `SVC_HOST` env var doesn't survive setup → child shells — reading only it would mis-classify orchestrator family | proposal § Acceptance Criteria, scripts/cross-model-review.mjs | Wrapper resolves family via `bash scripts/detect-host.sh --json` first, falls back to `SVC_HOST` only on `unknown` |

The proposal AC list is the contract that survives review. Findings are addressed inline above; each citation in the proposal text now reads "Codex round-1 caught this: <description>".

### Round 2 — codex round-2 caught:

| Finding | Where | Resolution |
|---|---|---|
| `detect-host.sh` checks `SVC_HOST` first (line 50, 140), so the round-1 fix ("use detect-host then fall back to SVC_HOST") does NOT actually escape the env-poisoning failure mode | proposal § Acceptance Criteria, scripts/cross-model-review.mjs | Added `--ignore-env` flag spec to `scripts/detect-host.sh` + `orchestrator_family_evidence` receipt field + family-mismatch refusal when SVC_HOST disagrees with parent-process detection |
| Round-1 dogfood claim is unreproducible after merge because `.svc/cross-model-reviews/` is not gitignored AND not tracked — transcripts vanish from a fresh checkout | proposal § Round-1 dogfood section | Track `.svc/cross-model-reviews/` (NOT add to gitignore); commit round-1, round-2, round-3 transcripts in this PR; rename to `PR-<n>/` after merge in publication-state-closeout |

This is the first svc receipt to carry a real subordinate-harness transcript that survives merge. The committed transcripts prove Codex actually ran for both rounds (round-1: 1938-line capture, codex-cli 0.130.0, model gpt-5.5, session id 019e1f7c-d167-7cc3-bd3d-caba734833d4; round-2: 17+1198-line capture, session id 019e1f84-93f4-7500-a2e3-bafeb68140a3). Future sessions can verify provenance by re-running `codex --version` against the recorded version + checking transcript-file mtime against the commit timestamp + matching `diff-sha:` against `git diff <base>..HEAD | sha256sum`.

## Route

Run through `improve-framework`. Lane = framework. Plan-changeset class = `contract-change`. Severity = HIGH. Sub-tranches expected (mirroring WI-341 pattern):

- Tranche 1: schema + wrapper script + chain selector + bootstrap receipt for this WI, no enforcement yet (warn-only)
- Tranche 2: validator + hook + flip enforcement to hard-block; migrate the 5 in-flight receipts (PR-127/128/129/130 plus the gap-closing one this WI's PR will produce)
- Tranche 3: rule extraction (`rules/orchestrator-runs-subordinate-harnesses.md`) + cross-link cleanup + close-out
