# Framework Evolution — 2026-04-25 — Capability-Blocker Auto-Diagnosis

## Method

Post-mortem of WI-108 autonomous-execution attempt 2026-04-25. User asked the agent to "proceed fully autonomously per framework". Agent hit two distinct capability blockers and handled both poorly:

1. **Code-vs-design mismatch** (T4.1 pre-impl scan) — `placesDetailsLookup` already existed; design assumed building it. Agent caught this only after starting T4.1 — not during T2 design-tech.
2. **Expired Base44 auth token** — agent hit HTTP 401, immediately stopped, asked the user to run `base44 login` interactively, without first attempting the documented OAuth refresh-token flow that the Base44 CLI itself uses internally.

Both failures share the same shape: **agent encounters a known recoverable blocker, doesn't recognize it as recoverable, dumps it on the user as an irreducible obstacle.** Builder's quote: "do we need ... something that auto suggest and figure such stuff and not rely on my intelligence?"

## Findings (by priority)

### P0 — Capability-blocker auto-diagnosis pattern is missing

**Evidence:**
- `route-workflow/references/intent-routing.md` has no row for "auth/credential failure", "missing binary", "rate limit hit", "quota exhausted", "schema-vs-design drift"
- `base44-environment/SKILL.md:29-49` documents how to GET an access token, has no "what to do when token is expired" recipe
- No skill or rule wraps the OAuth refresh flow (`POST /oauth/token` with `grant_type=refresh_token`) that the Base44 CLI uses internally — verified in CLI source `~/.nvm/versions/node/v24.13.0/lib/node_modules/base44/dist/cli/index.js:243568` `renewAccessToken`
- `audit-implementation` and `review-gate` check post-implementation correctness; nothing checks pre-execution capability readiness

**Proposed fix — new `capability-preflight` discipline (cross-skill, not a new skill):**

Every skill that touches an external system MUST run a structured capability-preflight check before its first network call. Output is a typed verdict:

```yaml
preflight_checks:
  - resource: base44-api
    check: token-validity
    method: "now < expiresAt in ~/.base44/auth/auth.json"
    on_fail: try-refresh
    refresh: "POST /oauth/token grant_type=refresh_token"
    on_refresh_fail: ask-user-with-exact-command
    user_command: "base44 login"

  - resource: google-cloud-billing
    check: budget-alert-active
    method: "gcloud billing budgets list --billing-account=$ACCT"
    on_fail: ask-user-with-exact-command
    user_command: "gcloud billing budgets create ..."

  - resource: gh-cli
    check: auth-status
    method: "gh auth status"
    on_fail: try-refresh
    refresh: "gh auth refresh"
    on_refresh_fail: ask-user
    user_command: "gh auth login"
```

The verdict is:
- **`ready`** — proceed
- **`recovered`** — auto-fixed (e.g. token refreshed); proceed and log the recovery
- **`blocked-on-user`** — surface a structured "you need to run X command" message (not a vague stop)

### P0 — design-tech needs a "code-scan-before-design" gate

**Evidence:**
- Already filed under previous proposal `proposals/done/2026-04-22-strategic-decision-research-discipline.md` (P-000 local-evidence-discipline, MERGED)
- That proposal targeted `strategic-decision`. The same gap exists in `design-tech` — when a feature-spec implies a backend function, design-tech does not check whether that function (or a near-equivalent) already exists.

**Proposed fix:** add a `pre-design-code-scan` step to `design-tech/SKILL.md`:

```
Phase 0 (NEW, mandatory before architecture options):
  - Glob base44/functions/* / src/components/* for keywords from the feature spec
  - For each candidate match, read the file head + grep for callers
  - If any pre-existing implementation covers ≥30% of the proposed function's
    surface, the architecture options table MUST include "extend X" as an
    explicit option, not just rebuild-from-scratch
```

Same hook as the strategic-decision Phase 1b rewrite — local code is evidence, and not reading it is a contract violation.

### P1 — `base44-environment` skill needs a "Recovery from expired token" section

**Evidence:**
- `base44-environment/SKILL.md:29-49` JWT Bearer subsection — has token-fetch, has expiry policy, no recovery procedure

**Proposed fix:** append section pointing to (or inlining) the `~/.claude/rules/base44-auth-refresh.md` recipe captured today. Same pattern for any other skill that wraps an external system with token-based auth (`mor-vs-stripe`, `dodo-best-practices`, `posthog-integration`).

### P1 — Add `framework-gaps.jsonl` schema for "blocker class"

**Evidence:**
- `.svc/framework-gaps.jsonl` exists (per `route-workflow` initialization protocol) but has no documented schema for the *kind* of gap

**Proposed fix:** standardize blocker categories so analytics over the gap log can spot patterns:

```json
{
  "timestamp": "...",
  "blocker_class": "auth-token-expired" | "schema-drift" | "missing-binary" | "rate-limit" | "quota-exhausted" | "code-vs-design-mismatch" | "platform-api-change",
  "skill_at_fault": "base44-environment",
  "skill_that_caught_it": "execute-changeset",
  "auto_recoverable": true | false,
  "recovery_attempted": true | false,
  "user_action_required": "base44 login",
  "context": "..."
}
```

After 30 days of accumulated logs, `improve-framework` can prioritize the most common `auto_recoverable=true && recovery_attempted=false` gaps (the agent failed to try a known fix).

### P2 — Pre-lane on-demand skill: `capability-preflight`

**Evidence:**
- `route-workflow/SKILL.md` has an "Auto-Invoke On-Demand Skills (Pre-Lane)" table with 6 entries (strategic-decision, plan-capabilities, mine-builder, platform-operating-architect, roadmap-evaluation, assess-market-readiness)
- None of them check that the *external systems the lane will touch* are reachable

**Proposed fix:** add a 7th row:

| Signal | Skill | When | Output |
|---|---|---|---|
| Lane will invoke any of {Base44, GCP, GitHub, Stripe, Dodo, Cloudflare, Linear, OpenAI, Anthropic, Groq} APIs AND no preflight has run in this session | `capability-preflight` | Before lane execution | `ready` / `recovered` / `blocked-on-user` verdict per resource |

The skill is small (~60 LOC); ships a JSON config of known resource preflight recipes; called by `route-workflow` once per session.

## Comparison delta

- `superpowers-tms-fork:verification-before-completion` does post-execution verification — opposite end of the lifecycle. We need PRE-execution.
- `gstack` doesn't have a direct equivalent (per `references/skill-pack-comparison.md`).

## Stale proposal audit

- `proposals/done/2026-04-22-strategic-decision-research-discipline.md` — MERGED (PR #2); should be moved to `proposals/done/` once Phase 1b implementation lands
- This proposal is net-new; no overlap with currently-pending proposals

## Suggested implementation path

1. **Now (immediate):** create `~/.claude/rules/base44-auth-refresh.md` (already done in WI-108 session 2026-04-25)
2. **Next PR:** add "Recovery from expired token" section to `base44-environment/SKILL.md` referencing the rule
3. **PR after:** create `capability-preflight` skill + register in `skills-manifest.json` + add to route-workflow pre-lane table
4. **PR after:** standardize `framework-gaps.jsonl` schema; backfill existing entries
5. **PR after:** add Phase 0 code-scan-before-design to `design-tech/SKILL.md` (parallel to the merged strategic-decision Phase 1b discipline)

Total effort: ~1.5 focused days (rule + skill creation + 3 skill updates + manifest entry).

## User actions required

1. Review this proposal
2. Approve / modify / reject
3. After approval, run `improve-framework` or schedule the implementation PRs

## Why this matters

The user owns this framework precisely so the agent stops dumping mechanical-recoverable problems on them. Every "please run X command" we surface that we could have just run is a tax on the user's time and a signal of framework immaturity. Two such surfaces caught in WI-108 session within 30 minutes of each other suggests this is not an outlier — it's a systemic gap.
