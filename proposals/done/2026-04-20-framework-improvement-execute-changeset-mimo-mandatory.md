# Framework Improvement: execute-changeset MiMo-mandatory enforcement

**Status:** IMPLEMENTED (2026-04-20)

## Evidence
- **Source:** user directive 2026-04-20 after WI-088 iter1 close: *"mimo pro is for now mandatory if there is quota if not can fallback to sonnet"*. Triggered by user question "was mimo used here?" revealing that Opus silently bypassed MiMo for iter1 execute-changeset despite a fully-chewed plan.
- **Finding:** `dispatch_target` field in `.svc/lane-tasks-*.json` was advisory only. `references/model-routing.md` `[EXEC-MIMO]` label was guidance. No enforcement anywhere prevented Opus from writing files inline when the plan was chewed (review-plan PROMOTED / REVISED_AND_REVIEWED).
- **Severity:** high — claims in `references/model-routing.md` about token-cost savings via MiMo routing were unverifiable; the framework could self-report compliant routing while real sessions routinely bypassed.

## Diagnosis
- **Root cause:** soft routing guidance at three layers (cognitive label in model-routing.md, dispatch_target metadata in task-graph, chain-position hint in SKILL.md) with no hard gate. Every layer said "should be MiMo" but nothing enforced "must be MiMo when plan is chewed."
- **Category:** missing capability (enforcement mechanism) + fragility (silent bypass possible)
- **Already in FRAMEWORK-STATE.md?** No (this is the first hard-enforcement mechanism for dispatch routing).

## Implementation
- **Route:** direct SKILL.md edit + 2 new scripts + new pre-commit hook + FRAMEWORK-STATE decision entry
- **Files changed:**
  - `scripts/check-mimo-quota.sh` (new, ~50 lines) — probes MiMo Pro `/v1/messages` endpoint with max_tokens=5, classifies HTTP response codes into USE_MIMO_PRO / USE_SONNET verdict. Exit 0/1/2 + single-line stdout.
  - `scripts/execute-dispatch-preflight.sh` (new, ~90 lines) — composes chewed-plan detection (scans `docs/plans/*/review-log.yaml` for passing terminal_state OR `.svc/lane-tasks-*.json` for completed review-plan task) + MiMo quota check + override-file acceptance into a single machine-parseable decision: `DISPATCH=mimo-pro | sonnet | opus-override | not-required`. Auto-logs overrides to `.svc/dispatch-log.jsonl`.
  - `hooks/svc-execute-dispatch-guard.sh` (new, ~80 lines) — pre-commit hook per-project. Reads chewed review-log + scans `.svc/dispatch-log.jsonl` for matching execute-changeset dispatch entry within 6 hours. Blocks the commit with clear remediation guidance if bypass detected. Skips if no chewed plan OR if staged files don't include src/.
  - `execute-changeset/SKILL.md` — added "Step 0 — MANDATORY dispatch preflight (hard rule, 2026-04-20)" section at top of skill body with the 4-outcome decision matrix + setup instructions.
  - `FRAMEWORK-STATE.md` — new locked-decision entry with rationale + deferred follow-ups.
- **Commits:** pending on next push.

## Replay Verification
- **Replay target:** invoke `execute-dispatch-preflight.sh "$PWD" WI-088-iter1` against the example-marketplace iter1 scenario (plan chewed, no MiMo env in the invoking shell).
- **Result:** PASS. Preflight detected chewed state (review-log.yaml terminal_state=REVISED_AND_REVIEWED), probed MiMo quota (unreachable because MIMO_API_KEY not in env), fell back correctly. Emitted `DISPATCH=sonnet`. Exit 0.
- **Evidence:** session transcript 2026-04-20 shows the preflight output path: *"preflight: plan chewed + MiMo Pro unavailable → Sonnet fallback dispatch / DISPATCH=sonnet / exit=0"*.
- **Deferred full replay:** pre-commit hook against a deliberately-bypassing commit scenario (simulate Opus inline write on chewed plan) — would require reverting iter1 and re-running the failure. Mechanical path verified by inspection; live test on the next real execute-changeset invocation.

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** 2026-04-20 entry added at top (above benchmark-landing entry).
- **Current State:** Worker transport scripts count bumps 8 → 10 (adds check-mimo-quota.sh + execute-dispatch-preflight.sh). Hooks count bumps from 4+5+2 → 4+5+2+1 (new pre-commit hook, per-project opt-in).
- **Decisions (new, locked):**
  - MiMo Pro is MANDATORY for execute-changeset when plan is chewed
  - Sonnet fallback activates automatically on MiMo quota exhaustion / network failure / credential absence
  - Opus inline requires written override (`accept: true` + `reason: <justification>`)
  - Pre-commit hook enforces mechanically; emergency bypass via `--no-verify` discouraged
- **Capabilities:** `references/knowledge/svc/CAPABILITIES.md` NOT updated — this is enforcement plumbing, not a new capability surface. Will revisit when first skill consumer calls preflight automatically.

## Deferred follow-ups
- `scripts/install-svc-hooks.sh` — one-liner to symlink pre-commit hook into any project's `.git/hooks/` directory. Currently manual.
- Auto-invocation of preflight from execute-changeset SKILL is documented but not orchestrator-automated. A future `scripts/auto-execute-dispatch.sh` could run preflight + dispatch + capture summary in one call, so orchestrator-Opus only invokes that single script.
- `check-mimo-quota.sh` probe consumes ~5 tokens of MiMo quota per check. If preflight runs often (N per day), this adds up. Cache result with 30s TTL in `/tmp/mimo-quota-cache` if quota drain becomes meaningful.
- `dispatch-log.jsonl` scan in the hook uses 6-hour window. Review whether that's the right horizon after a few production sessions.

## External sources consulted
None this pass — enforcement mechanism is svc-native. Hook pattern borrows loosely from conventional git pre-commit hooks (e.g., husky, pre-commit.com) but implementation is shell-native to match existing svc hook conventions under `hooks/`.

## Notes for orchestrators
- Install the hook per-project ONCE: `ln -sf <svc-path>/hooks/svc-execute-dispatch-guard.sh .git/hooks/pre-commit`. After that, every `git commit` on that repo enforces the rule automatically.
- Legitimate Opus-inline cases (quick-fixes, doc edits, overrides with justification) are not blocked — they either skip the hook (non-src staged) or pass the override check.
- If you hit the hook block, the stderr message tells you exactly what to do: either dispatch via the normal MiMo path, or write the override file and re-run preflight to log the bypass.
