# Rule: research skill MUST dispatch to agy-cli as primary

The `research` skill (post-WI-090) declares an explicit sub-agent fallback chain: **agy-cli is PRIMARY, Claude is FALLBACK.** This rule makes the boundary enforceable.

## What "primary" means concretely

When the orchestrator invokes `/research <topic>` for an analysis-mode task (URL/repo/source extraction), the pre-scope artifact at `docs/specs/research-prescope-<source>.md` MUST set:

```yaml
Primary: agy-cli
Selected for this run: agy-cli — <reason it's the right choice>
```

## Legitimate reasons to fall back to Claude

The pre-scope's `Selected for this run` line is the audit point. Only these reasons make falling back legitimate:

1. **agy-cli is unavailable on this host** — `which agy` returns non-zero, OR config files are missing
2. **agy-cli auth/credit failure** — login expired, quota exhausted (verified by attempting and observing the error)
3. **Explicit env override** — `SVC_RESEARCH_AGENT=claude` was set by the orchestrator before invocation
4. **Mid-run primary failure** — agy-cli was tried, returned non-zero / timed out / produced partial coverage. Pre-scope must record the attempt.

## ILLEGITIMATE reasons (rejected by the gate)

These rationalizations are explicitly forbidden — they fail the reviewer check:

- ❌ "WebSearch is more reliable for dynamic web content"
- ❌ "Want to preserve AGY quota for the user's own work"
- ❌ "Claude is faster for this batch"
- ❌ "Source pages are JavaScript-heavy" (agy-cli has its own browse tools)
- ❌ "I already have the data in context" (you should not — pre-scope happens BEFORE extraction)
- ❌ Any reason that doesn't name a concrete failure of agy-cli FOR THIS RUN

## Why this rule exists

Observed 2026-04-25: an agent invoked `/research` for a Google AI Pro extraction. Gemini Pro subscription was active, agy-cli was installed and authenticated. The agent's pre-scope chose Claude up-front, citing "preserve agy quota for user's own work." The decision burned ~30K parent context tokens (real $ on Claude Max) on a task agy-cli would have done free against the user's already-paid Pro subscription.

The framework's economic model is: **delegate cheap, observable, source-extraction work to subordinate harnesses; reserve parent-orchestrator tokens for synthesis and decisions.** Inverting that defeats the entire purpose of WI-090.

## How to apply

**Before extraction begins:** the orchestrator reads the pre-scope's `Selected for this run` field. If the value is `claude` (or any non-`agy-cli`), the orchestrator looks for one of the four legitimate reasons in the same artifact. If absent, the orchestrator REFUSES the run with output:

```json
{
  "verdict": "refused",
  "reason": "Pre-scope selected sub-agent 'claude' without naming a concrete agy-cli failure mode. Allowed reasons: agy-cli unavailable, auth failure, SVC_RESEARCH_AGENT override, or recorded mid-run primary failure.",
  "fix": "Either re-run with agy-cli (default), or update pre-scope's 'Selected for this run' line to cite a legitimate fallback reason."
}
```

The tier-1 validator `validate-research-prescope-sub-agent.sh` enforces the same check on every pre-scope file in `docs/specs/research-prescope-*.md`.

## Reviewer hook

`review-gate`, `audit-implementation`, and `review-cross-model` should flag any session log containing the pattern *"selected Claude over agy-cli for [research / extraction / source analysis] because..."* without one of the four legitimate reasons. This is a **HIGH-severity finding** per `rules/common/code-review.md`.

## Related

- WI-090 — research skill refactor (introduced the fallback chain)
- `references/framework-learnings.jsonl` entry `research-skill-default-must-be-gemini-cli` (confidence 10)
- `research/references/prescope-template.md` — template enforced by this rule
