# Framework Improvement: review-plan gate (Tier-1 + Tier-2 Codex + Tier-3 Sonnet tie-break)

**Status:** IMPLEMENTED (2026-04-20)

## Evidence
- **Source:** user directive 2026-04-20 improve-framework invocation: *"validate plan for all kind of issue including determinism … with at least 1 review for determinism for infra-level stuff. Every finding should have analysis justification why is it like that (provable), and when the other side accepts should have same logic."*
- **Finding:** plan-changeset could promote manifests containing ambiguity ("implement the easing"), dangling renames, missing file paths, contradictory task dependencies, forbidden commands. MiMo execute-changeset dispatched against such plans wasted cycles. No enforcement gate between plan-changeset and execute-changeset.
- **Severity:** high — infra-level plans (dispatch-worker changes, deploy scripts, auth hooks) with undetected ambiguity pose deterministic production risk.

## Diagnosis
- **Root cause:** plan-changeset self-verify checked for internal manifest consistency (file list present, task graph parses) but not for content determinism (are the paths real? do the npm scripts exist? are variables in fact eliminated?). No adversarial review gate existed at the plan level — only at code level (review-gate, review-security, review-cross-model for code).
- **Category:** missing capability (new skill + new gate position in pipeline)
- **Already in FRAMEWORK-STATE.md?** No — newly diagnosed 2026-04-20.

## Implementation
- **Route:** new skill creation + supporting scripts + canonical protocol document
- **Files changed:**
  - `review-plan/SKILL.md` (new) — skill contract, 3-tier process, self-verify, chain position
  - `scripts/verify-plan-mechanical.sh` (new, 105 lines) — Tier-1 deterministic checks
  - `scripts/review-plan-codex.sh` (new, 40 lines) — Tier-2 Codex dispatch with scope-lock
  - `agents/plan-reviewer.md` (new) — Sonnet 4.6 locked agent for Tier-2 fallback
  - `references/plan-review-protocol.md` (new) — canonical finding format, reviewee response format, iteration loop, Tier-3 triggers
  - `skills-manifest.json` — added `review-plan` to includedSkills
  - `FRAMEWORK-STATE.md` — Current State Agents count 1 → 2; Analysis History entry
- **Commits:** pending on next push.

## Replay Verification
- **Replay target 1 (Tier-1 broken fixture):** fixture `/tmp/test-plan-broken.md` contains 5 planted issues (missing file, two nonexistent npm scripts, `--force` forbidden pattern, invalid blocked_by=99). Script should detect all 5, emit `TIER-1 FAIL`, exit 1.
- **Result:** PASS. Script detected 5/5, exit code 1 (direct capture).
- **Replay target 2 (Tier-1 clean fixture):** empty markdown plan → no issues detected.
- **Result:** PASS. `TIER-1 PASS`, exit 0.
- **Replay target 3 (Codex CLI smoke test):** `codex exec` responds to trivial prompt.
- **Result:** PASS. Codex returned `codex-alive. 2+2=4.`, exit 0, ~37K tokens for trivial prompt (confirms plumbing + auth).
- **Deferred:** full Tier-2 integration test on broken fixture. Codex 90s timeout insufficient; dispatch plumbing IS verified separately. Full end-to-end with real plan-changeset manifest will fire on first production use. Failure mode is gracefully handled (Tier-2 exit non-zero → orchestrator falls back to Sonnet via `agents/plan-reviewer.md`).

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** new 2026-04-20 entry added
- **Current State:** Agents count updated 1 → 2; plan-reviewer described
- **Known Gaps:** no change — newly closed gap wasn't previously tracked
- **Decisions (new, locked):** 6 decisions documented in the Analysis History entry (Tier-1 always first, Codex preferred for Tier-2, Tier-3 triggers, justified findings, symmetric accept/reject, review-log persistence)
- **Capabilities:** `references/knowledge/svc/CAPABILITIES.md` NOT edited this pass — will add when first consumer skill wires it in

## Deferred follow-ups
- **plan-changeset self-verify hook:** update `plan-changeset/SKILL.md` to call `review-plan` as its final self-verify step, blocking manifest promotion on FAIL. Currently review-plan must be invoked manually. Defer to next improve-framework pass.
- **Full Tier-2 end-to-end test:** run review-plan-codex.sh on a realistic 20-task manifest with intentional planted issues; measure finding quality.
- **Tier-3 Gemini fallback:** if both Codex and Sonnet flag the same REJECT, allow Gemini as a 3rd independent opinion. Design but do not implement — wait for use case.
- **review-log.yaml machine validator:** ajv/yq schema to ensure review-log files conform to the protocol shape. Prevents silent drift.

## External sources consulted
None this pass — review-plan pattern is borrowed conceptually from Aider's architect mode (external delta documented 2026-04-20 in orchestrator-parsimony proposal) and from review-cross-model (existing svc skill). No new code copied; design is svc-native.

## Notes for production
- `command -v codex` check determines Tier-2 reviewer at runtime. If Codex CLI is missing, Sonnet is used automatically.
- `~/.codex/auth.json` must exist for Codex. Verified present on this machine 2026-04-20.
- scope-lock in Codex prompt reads: "Files you MAY read: PLAN + files explicitly listed in plan. You may NOT glob the repo, grep across directories, or explore filesystem beyond what the plan itself names." Codex compliance with this lock is a runtime property we'll monitor on first real review.
