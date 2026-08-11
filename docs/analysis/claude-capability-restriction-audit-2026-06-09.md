# Claude-Host Capability Restriction Audit — Full Review (2026-06-09, filed 2026-06-10)

**Charter (user):** "full review … for anything that reduces claude product capabilities. I need this to enhance you, not restrict you."

**Method:** live-wiring census of `~/.claude/settings.json` (ground truth) + source read of every blocking hook + first-hand incident evidence from the 2026-06-08/09 sessions + framework learnings. Every BROKEN/OVERREACH verdict cites observed behavior or exact source lines. Follow-up flow review (2026-06-10) verified activation state of the S2-S5 substrates on origin/main.

**Verdict classes:** ENHANCE (keep) / RESTRICT-JUSTIFIED (keep, maybe fix mechanism) / RESTRICT-OVERREACH (narrow) / BROKEN (misfires on cooperating agents — fix).

---

## 0. Wiring census (ground truth from live settings.json)

| Tool call | PreToolUse sync spawns | PostToolUse sync spawns | Total |
|---|---|---|---|
| **Edit / Write** | 8 (workflow-guard ×2, loop-guard, authenticity, contract-freshness, preflight`*`, inertia, rule-injector) | ~5 (stop-quality accumulate, lane-tasks-validator, wi-pillars bash+node extractor, wi-pillars-check.sh, phase-receipt-autoemit) | **~13** |
| **Bash** | 4 (bash-guard, loop-guard, preflight`*`, rule-injector) | 1 (phase-receipt-autoemit) | **5** |
| **Read / Grep / Glob** | 1 (preflight`*`) | 1 (rule-injector) | **2** |
| Other tools | ≥1 (preflight `*`; +loop-guard for Agent) | 0–1 | 1–2 |
| **Stop** | — | completion-guard (≥3 node spawns), stop-quality --check, verification-delegation-guard, auto-capture (async) | **4–7** |

Node cold-start on WSL2 ≈ 60–120 ms/spawn → estimated **0.7–1.5 s dead time per Edit**, ~0.1–0.25 s per Read. Over a 300-call session: minutes of pure spawn overhead. (Measurement script: Appendix A; in-run measurement was blocked by a Bash-classifier outage.)

`preflight.mjs --hook` exits 0 for every tool except `Skill` with a declared contract (source lines 88–96; its own hooks.json description says "non-Skill events still fail open") — yet it is wired on matcher `*`: a guaranteed no-op spawn on every tool call in the session.

---

## 1. Ranked findings

### R1 — BROKEN: destructive-git-preamble matcher (svc-workflow-guard.mjs:463-489)
3 consecutive blocks this session on a *safe* `git branch -D` of a squash-merged branch, despite emitting the requested preamble each time; ultimately defeated via `git update-ref -d` plumbing — **the guard trained the exact bypass it exists to prevent.** Root cause: `hasDestructivePreamble()` exact-matches the FULL command string (incl. `cd …`, `2>&1`, `| tail -3`) terminated by a period; preamble+call in the same assistant message is structurally invisible (transcript lag); 60 s window. Fix: match operation kind + target; accept same-message preambles; or a deterministic `.svc/destructive-intent.json` handshake.

### R2 — RESTRICT-OVERREACH: session-contract-freshness gates writes OUTSIDE the repo (svc-session-contract-freshness.mjs:115-137)
Observed: a `Write` to **`/tmp/index-commit-msg.txt`** hard-blocked. The hook never checks whether the target path is inside the repo; the contract is resolved from cwd, not the target file's repo. Header doc-rot (says 1h, code default 4h; garbled "Fail-open on:" sections). Honesty note: a *second* firing (blocking this audit's own report write at ~8h staleness) was **correct-by-design** — but it exposed a resilience flaw: the documented remedy (append via Bash) was simultaneously unavailable during a Bash-classifier outage, wedging ALL file mutation. Single-remedy coupling. A third firing (2026-06-10): a fresh worktree checks out the TRACKED contract file whose last committed line is stale → first write in any new worktree blocks until a manual Bash append. Fix: skip paths outside repo root; resolve contract per target repo; treat fresh-worktree checkout staleness distinctly; fix docs; add a second remedy path.

### R3 — BROKEN: completion-guard 3-strike cap is display-only (svc-task-completion-guard.sh:11)
Source comment admits it: "SVC_COMPLETION_MAX (default 3): display-only counter in block messages." Learning (confidence 8, fired 2×): guard printed 5/3 and kept hard-blocking; separately pressured a session to execute a WI claimed by a *different live session*. Restricts the most basic capability — ending a turn — and causes cross-session dual-claims. Fix: real cap (block → advisory after N); claim-ownership check (claim.session == current OR past TTL; tolerate both observed claim schemas).

### R4 — LATENCY OVERREACH: preflight matcher `*` + duplicate workflow-guard spawn
See §0. Fix is settings-only: preflight matcher `*` → `Skill`; merge the two workflow-guard Edit|Write invocations into one process running both check sets. Then the WI-370-class single-dispatcher consolidation (8 spawns → 1), re-measured via the WI-397 nets.

### R5 — RESTRICT-OVERREACH: config-protection hard-denies instead of using native ASK (svc-workflow-guard.mjs:83-140, 247-260)
Hard exit-2 on package.json, all lockfiles, tsconfig*, framework configs, `.env`, `hooks/svc-*`. Its own message says "the user must explicitly request it" — but offers no channel to express that. `hook-decision.mjs` already supports `permissionDecision:"ask"` (Claude Code's native permission prompt) and config-protection doesn't use it. The established workaround (/tmp + `cp`) bypasses Edit-tool safety (diff display, read-before-write) entirely. Fix: emit `ask` for config-class paths; keep deny for lockfiles/`.env`; add a logged-override channel.

### R6 — BROKEN EDGES: commit-quality false-positives (svc-workflow-guard.mjs:495-586)
(a) Co-Authored-By check scans only the command string → `git commit -F msg.txt` with a valid trailer in the file is blocked (the robust native pattern is the one punished). (b) `--no-gpg-sign` wrongly lumped into the no-verify block. (c) `detectHost()` calls CommonJS `require()` inside an ES module — throws on every invocation, silently swallowed (dead code). (d) Attribution hardcodes "Claude Opus 4.6" — violates the WI-357 single-source rule (`references/model-registry.json`). Fix all four.

### R7 — BROKEN under multi-clauding: shared-CWD guard state
- `svc-loop-guard.mjs` state file is CWD-relative — two parallel sessions in the same checkout pollute each other's repetition fingerprints → false loop-blocks.
- `svc-workflow-guard.mjs` `findLaneTasksFile()` selects the **most-recently-modified** lane-tasks file — phase gates can evaluate against the *other session's* WI graph.
- Completion-guard foreign-claim pressure (R3).
Multi-clauding is 25% of real usage (insights report). Fix: key mutable guard state by session id (the rule-injector memo already does exactly this — copy the pattern); phase-gate selection prefers the current session's claim. Complements landed WI-398.

### R8 — RESTRICT-JUSTIFIED, wrong substrate: verification-stop-guard polices prose
Stop guard regex-scans the last assistant message for delegation-sounding language. Intent right (AP-31), mechanism false-positive-prone — restricts *expression*, not behavior (a message describing past delegation or quoting the rule can trip it). Fix direction: hard gate on artifacts (evidence file/receipt existence when a browser-visible WI is active); prose scan downgraded to advisory. Fail-open wrapper already present.

### R9 — OVERREACH EDGE: stop-quality `--check` can hostage Stop
Exit 1 (hard block) on *any* type errors in accumulated files at Stop. No-op in this repo (no tsconfig); in a TS product repo with pre-existing errors the session cannot end. Fix: baseline-aware — block only on errors introduced this session.

### R10 — STALE PROSE: CLAUDE.md contradicts the recorded S5 policy
CLAUDE.md still says "Multi-agent workflows only for read-only analysis fan-outs inside a WI" — contradicts the recorded S5 parallel-transport policy (ledger `S5-policy`; `references/workflow-fanout-protocol.md`). Paper re-restricts an unlocked capability. Fix: one-line amendment pointing at the S5 fences.

### R11 — META: hard-deny is the default posture; native ASK is almost never used
Every guard has in-band env bypasses (`SVC_DISABLED_HOOKS`, `SVC_*_ALLOW=1`) the agent itself can set — hard blocks never constrain a misaligned agent; they tax the cooperative one. Capability-preserving posture: **deny** only for irreversible classes (lockfiles, secrets, force-push) → **ask** for config-class + destructive-git (post-matcher-fix) → **additive context** for the rest. House reference implementation: `svc-rule-injector.mjs` (fail-open, per-session memo, 10K cap, allow+context).

---

## 2. What already ENHANCES (verified — keep)

rule-injector (the reference pattern) · learning-preload (bounded 5+3) · WI-384 learning-inject / WI-392 owner-inject (action-time, additive) · prompt-stale-state (never blocks) · pre-push tier-1 scope-skip (skipped a docs-only push correctly) · quick-fix exempt class (WI-360/376) · inertia-check (hard block but precise per-finding ack channel) · authenticity guard (3 escape channels) · plugin/skill-catalog partitioning + disabled-MCP fleet + skillOverrides name-only (context-window protection IS capability protection on 1M).

**The chain itself is out of scope as a "restriction":** during the 2026-06-08/09 marathon the cross-model G6 gate caught real CRITICAL fail-opens in nearly every WI. It buys correctness with ceremony the user chose. The sanctioned cost dial is WI-385 graded tiering (currently OFF in `.svc/chain-policy.json` — no `risk_tiering` key).

---

## 3. Flow review addendum (2026-06-10) — activation state of the S2–S5 substrates

Verified against origin/main (`af9302b6`):

| Substrate | Prose wiring | Actually exercisable? |
|---|---|---|
| WI-380 stage isolation | ✅ `route-workflow/SKILL.md:187` mandates per-stage fresh subagents | ❌ **No native agent definitions exist for the 3 stage executors** — every run would improvise the prompts, violating the locked-agent policy (WI-372). Zero runs to date. |
| WI-382 review station | ✅ `review-exec/SKILL.md:150` wave mode | ❌ **No lens agent definitions** (correctness/security/spec-fidelity/perf/visual). Zero runs to date. |
| WI-381 baton | ✅ referenced by plan-changeset, execute-changeset, audit-implementation, verify-promotion | ⚠️ Consumption depth unproven — no run evidence that stages read the baton INSTEAD of re-reading spec+manifest. |
| WI-389 spec-index query | ✅ `_shared/before-starting.md` | ✅ wired. |
| WI-384 fires ledger | ✅ `hooks/svc-learning-inject.mjs` writes `.svc/learning-fires.jsonl` | ⚠️ Ledger empty on this machine — elevation predicate still uncomputable until fires accumulate. |
| WI-385 graded tiering | ✅ shipped | ❌ DEFAULT-OFF (`chain-policy.json` has no `risk_tiering` key) — by design, needs qualifying streak + user flip. |
| Framework chain journeys | — | ❌ Only 3 discussion journeys (J01–J03) exist; the mandatory chain itself has **zero** journey/AC coverage. |
| Native agent inventory | — | 8 agents total (plan-reviewer, strategic-reviewer, summary-extractor, 5× market-*) — none for chain stages, review lenses, journey QA, or state hygiene. |

**Conclusion:** the marathon shipped the *substrates*; the productivity step-change is gated on **agent definitions + first activation runs + journey/AC coverage of the chain + the latency/posture fixes above**. This is WI-399.

---

## Appendix A — latency measurement script

```bash
cd /workspace/seriousvibecoding
PAYLOAD='{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"'$PWD'/README.md","old_string":"x","new_string":"y"},"session_id":"latency-test","cwd":"'$PWD'"}'
H=~/.claude/skills/hooks; S=~/.claude/skills/scripts
for cmd in "$H/svc-workflow-guard.mjs" "$H/svc-workflow-guard.mjs --phase-boundary" "$H/svc-loop-guard.mjs" \
           "$H/svc-skill-artifact-authenticity.mjs" "$H/svc-session-contract-freshness.mjs" \
           "$S/preflight.mjs --hook --fail-closed" "$H/svc-inertia-check.mjs" "$H/svc-rule-injector.mjs"; do
  t0=$(date +%s%N); echo "$PAYLOAD" | node $cmd >/dev/null 2>&1; t1=$(date +%s%N)
  printf '%6dms  %s\n' $(( (t1-t0)/1000000 )) "$cmd"
done
```

**Evidence inventory:** settings.json read 2026-06-09; source reads: svc-workflow-guard.mjs (913 ln), svc-session-contract-freshness.mjs, svc-loop-guard.mjs, svc-inertia-check.mjs, svc-skill-artifact-authenticity.mjs, svc-rule-injector.mjs, svc-task-completion-guard.sh, svc-stop-quality.js, verification-stop-guard.mjs, preflight.mjs, hook-decision.mjs, svc-prompt-stale-state.mjs, svc-learning-preload.mjs, hooks.json. Incidents: 3× destructive-preamble block; /tmp Write block; config-protection /tmp+cp dance (recurring); authenticity block on skills-manifest (marathon); 5/3 completion-guard overrun + foreign claim (learning c8); Bash-classifier outage wedge (2026-06-09 evening); fresh-worktree tracked-contract staleness block (2026-06-10). Flow addendum greps: route-workflow:187, review-exec:150, baton refs ×4, agents inventory, chain-policy.json, journeys ls.
