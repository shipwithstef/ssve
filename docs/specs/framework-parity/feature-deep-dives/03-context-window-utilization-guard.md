# Deep-dive #3: Context-Window Utilization Guard (scorecard rows #17/#63/#80)

**Source:** GSD `bin/lib/context-utilization.cjs` + `gsd-context-monitor.js` (PostToolUse hook). v1.40.0 raised thresholds from 35%/25% to 60%/70% (warn / critical).
**Decision required:** adopt OR skip.

## What the feature is

Pure-math classifier mapping `(tokensUsed / contextWindow)` ratio to `HEALTHY (<60%)` / `WARNING (60-70%)` / `CRITICAL (>70%)` states. Paired with a PostToolUse hook (`gsd-context-monitor.js`) that injects advisory system messages into the agent's context when the threshold crosses. Goal: prevent reasoning degradation from filling the context window past the empirically-known degradation point.

## svc current state

- `hooks/svc-pre-compact-snapshot.mjs` — adjacent: snapshots state pre-compact, but does NOT track utilization or warn proactively
- `references/context-budget.md` — exists; documents context degradation tiers (Tier 1: 0-30K, Tier 2: 30-100K, Tier 3: 100-180K, Tier 4: >180K) but is reference docs, NOT enforced
- `route-workflow/SKILL.md` references context budget in passing but no live monitoring
- No svc artifact reads token counts and warns in-context

## 10 improvement scenarios

### Scenario 1: Long session crosses 60% utilization mid-skill

**Today (svc):** No warning. Agent continues. Quality silently degrades. Eventually compaction kicks in or the session crashes "Prompt is too long."
**With guard:** PostToolUse fires after each tool call, classifies utilization, injects "WARNING: 64% context used. Consider checkpoint or compaction" into the next turn.
**Improvement:** Agent gets advance notice; can self-checkpoint (write progress to `.svc/lane-tasks-<WI>.json`), summarize current state, or invoke compaction proactively.
**Verdict: POSITIVE.**

### Scenario 2: Reasoning quality degrades silently between 60-70%

**Today (svc):** No warning. Agent makes architectural decisions with degraded reasoning. User catches the bad decision in review (or doesn't).
**With guard:** WARNING state surfaces in every PostToolUse output. Skills with `requires_high_reasoning: true` frontmatter could refuse to dispatch in WARNING state.
**Improvement:** Empirical degradation point becomes visible to the workflow.
**Verdict: POSITIVE.**

### Scenario 3: Critical state >70% — past the empirical reasoning collapse

**Today (svc):** Compaction may or may not fire depending on host; sometimes the host's compaction is broken (Claude Code's autocompact has known bugs). Agent thrashes.
**With guard:** CRITICAL injects "STOP: 73% context used. Compact NOW or write a handoff note and exit." Forces explicit action vs silent degradation.
**Improvement:** Catches the degradation cliff before crashes.
**Verdict: POSITIVE.**

### Scenario 4: Short session (always under 30% utilization)

**Today (svc):** No warning needed. Agent works fine.
**With guard:** PostToolUse fires, classifies HEALTHY, injects nothing. Zero added friction.
**Improvement:** Zero (no-op for the happy path).
**Verdict: POSITIVE (no-op).**

### Scenario 5: Multi-host — Claude has 200K, Codex has 400K, Kimi has 262K, MiMo has 1M

**Today (svc):** No utilization tracking on any host.
**With guard:** Per-host context-window value comes from `references/model-registry.json` (already exists with `contextWindow` per model). The classifier divides actual tokens by the model's window. Per-host correctness.
**Improvement:** Same code, host-agnostic correctness.
**Verdict: POSITIVE.**

### Scenario 6: Token count not reliably available across hosts

**Today (svc):** N/A.
**With guard:** Each host exposes token counts differently. Claude: PostToolUse payload may include `usage`. Codex: separate accounting. Kimi: TBD. Gemini: TBD. The hook needs a per-host token-extraction strategy with fallback to "unknown" (skip warning rather than warn-with-bad-math).
**Risk:** Without reliable token counts the guard either warns at wrong thresholds (false positives that erode trust) OR fails silent (no value).
**Mitigation:** v1 ships Claude-only (where the count is reliable), v2 expands as token-extraction strategies are confirmed per host. Document the per-host status explicitly.
**Verdict: POSITIVE only after per-host token-extraction strategies are validated.** v1 = Claude-only.

### Scenario 7: Background subprocess doesn't have parent context

**Today (svc):** N/A.
**With guard:** `dispatch-worker.sh` spawns a subprocess with its own fresh context. The subprocess's context is bounded by the model it uses. Parent monitoring of the subprocess is N/A (the subprocess has its own session). Each subprocess's PostToolUse fires its own classifier on its own context.
**Improvement:** Per-subprocess monitoring, no cross-talk.
**Verdict: POSITIVE.**

### Scenario 8: Skill author wants to skip the warning (e.g. for a known-large research skill)

**Today (svc):** N/A.
**With guard:** Skill frontmatter could declare `context_warning: muted` for skills that are inherently large-context (e.g. `research --mode analysis` which intentionally loads many files). Hook respects the frontmatter.
**Improvement:** Targeted suppression for legitimate exceptions.
**Verdict: POSITIVE.**

### Scenario 9: Hook itself is expensive — runs on every PostToolUse

**Today (svc):** N/A.
**With guard:** Pure math (one division, one comparison). <1ms per call. Zero blocking impact.
**Improvement:** Negligible cost.
**Verdict: POSITIVE.**

### Scenario 10: Warning gets ignored by the agent (just text in context)

**Today (svc):** N/A.
**With guard:** Warning is advisory. Agent may ignore it. BUT the warning is also LOGGED to `.svc/context-utilization.jsonl` (gitignored), so post-mortem can correlate degraded decisions with high-utilization sessions. Empirical evidence drives future hard-gating decisions.
**Improvement:** Even when ignored, the warning produces telemetry that drives the next iteration of the gate.
**Verdict: POSITIVE.**

### Scenario count: **10 POSITIVE (with mitigation: v1 Claude-only)**

## Blast radius

| Touched | Type | Regression risk | Mitigation |
|---|---|---|---|
| `scripts/lib/context-utilization.mjs` (new) | helper | — | new file; pure math, easy to unit-test |
| `hooks/svc-context-utilization-monitor.mjs` (new) | hook | — | new file; PostToolUse, advisory-only (never blocks) |
| `scripts/wire-hooks.mjs` (Claude wirer — same correction as deep-dive #1; the file is `wire-hooks.mjs`, NOT `wire-claude-hooks.mjs`. Codex round-2 caught this typo here too.) | wire script | LOW: declare new hook on `PostToolUse` | per-host integration test |
| `wire-codex-hooks.mjs`, `wire-gemini-hooks.mjs`, `wire-kimi-hooks.mjs`, `wire-opencode-hooks.mjs` | wire scripts | DEFER: token extraction TBD per host; v1 ships Claude-only | document per-host status in the hook |
| `hooks/hooks.json` | manifest | LOW: list new hook | extend lint |
| `references/model-registry.json` | registry | NONE: already has `contextWindow` per model | no change |
| `.svc/context-utilization.jsonl` | gitignored runtime | LOW: telemetry output | add to `.gitignore` |
| `references/context-budget.md` | docs | LOW: cite the new gate as the live enforcement of the documented thresholds | edit |
| Skill frontmatter (optional `context_warning: muted`) | skill schema | LOW: optional opt-out, no required change | document in `_shared/` |
| `test-framework/evals/tier-1/validate-context-utilization-classifier.sh` (new) | tier-1 validator | — | new file; tests the pure-math classifier with N×{ratio→state} cases + the muted-skill exemption |

**Net regression risk:** ZERO. Pure-math classifier + advisory-only hook can't break anything. Telemetry log is gitignored so it doesn't pollute commits.

**Out of scope for v1:** non-Claude hosts (token extraction TBD). Flag for v2.

## Decision

**ADOPT.** All 10 scenarios are positive. Blast radius = zero-regression. Pure-math classifier is trivially testable. Closes a real reasoning-degradation cliff that svc currently has no defense against. v1 Claude-only is fast to ship; v2 expands per-host as token-extraction strategies are validated.

## Implementation handoff

Next PR: implement `scripts/lib/context-utilization.mjs` (pure math) + `hooks/svc-context-utilization-monitor.mjs` (PostToolUse advisory) + Claude-only wire-up. Pipeline: `plan-changeset` → `review-plan` (codex) → `execute-changeset` → `review-cross-model` (codex) → `land-changeset`. Update scorecard rows #17/#63/#80 verdict to ✅ on land, with v2 follow-up tracked in row #80 specifically.
