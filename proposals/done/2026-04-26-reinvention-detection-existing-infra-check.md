# Framework Evolution — 2026-04-26 — Reinvention Detection: catch "recommending new infra when project already has it" — via persistent inventory, NOT runtime grep

## The triggering example (concrete)

In example-marketplace session 2026-04-26 the agent authored `docs/ops/wi-110-cron-setup.md` recommending cron-job.org as the "5-minute path" for scheduling `refreshPaidOwnerLiveInfo` nightly. The recommendation was wrong: Example Marketplace already had:

1. `workers/auto-reopen-cron.js` — deployed Cloudflare Worker on `*/3 * * * *` trigger
2. `workers/wrangler.toml` with cron triggers configured
3. `base44/functions/jobRunner/entry.ts` — central job-router with `CRON_SECRET` auth pattern
4. Four existing scheduled jobs reachable via that pattern (samplePointDecay, generateDailyPlaybookDraft, updateCommunityGoalProgress, dodoVerifySubscriptionStatus)
5. `.svc/capability-registry.json` declaring `"edge": ["cloudflare-worker"]` in tech_stack
6. The `base44-environment` skill itself documents the exact CRON_SECRET pattern

The right recommendation was: extend the existing worker. ~15 LOC. Zero new accounts.

User caught the mistake by asking "how come you don't know this project has cronjobs already?"

## Original (rejected) approach

A first draft of this proposal recommended a **runtime hook** that greps the entire codebase whenever the agent's output mentions an external alternative (cron-job.org, Algolia, Auth0, etc.). User rejected that approach with the right argument:

> "Grepping the entire codebase is exactly the thing I don't know — there should be a 1-time activity that extracts this even from higher level like feature spec, given repo is aligned after drilldown but for certain after never look there again. Make sure newer items add such infra deps to the same file. This way no tokens spent except 1 time during onboarding or after onboarding if needed for cases where onboarding is run again."

This is structurally correct. We already use this pattern for **builder profile** (mined once → read forever) and **domain profile** (analyzed once → read forever). Infrastructure inventory should follow the same shape.

## The generic anti-pattern (refined framing)

**Reinvention: recommending new infrastructure / external service / pattern when the project already has an equivalent one deployed.**

Mirror image of inertia detection (proposal 2026-04-25 / #32). Both have the same root cause: failure to read project state before recommending. They form a context-checking gate pair:

| Anti-pattern | Description | Trigger |
|---|---|---|
| Inertia (#32) | Extending bad-foundation code without flagging migration | About to write code that extends a deprecated pattern |
| **Reinvention (this)** | Recommending new infra when existing equivalent works | About to recommend a NEW external service / pattern |

Sub-patterns of reinvention:

| Sub-pattern | Real-world example | Cost |
|---|---|---|
| Recommending external scheduler when worker/cron exists | This session: cron-job.org instead of `workers/` extension | New service, new auth, scattered config |
| Recommending Auth0/Clerk when auth already wired | "Add auth provider" when `base44.auth.me()` is the codebase pattern | Months of double-auth maintenance |
| Recommending Algolia when Postgres FTS exists | Adding Algolia when project has `tsvector` columns | $/mo + sync pipeline + drift |
| Recommending GA4 when PostHog is wired | Double instrumentation, conflicting attribution |
| Recommending Stripe Billing when Dodo MoR is the platform | Re-architecting payment flow, doubled MoR fees |
| Recommending Jest when Vitest is established | Two test runners to maintain |
| Recommending React Query when SWR is the project's hook | Two cache layers, hook conflicts |
| Recommending separate logging when Cloudflare/Datadog ships logs | Three log destinations, no single source |

## What the agent should do (NEW design — inventory-first, not grep-first)

The agent should be able to answer "does this project already have <capability>?" by reading ONE small file, not by grepping the codebase at runtime.

### The single source of truth

Extend `.svc/capability-registry.json` schema with an `infrastructure_inventory` section that is written ONCE during onboarding and APPENDED-TO during spec authoring:

```json
{
  "schema_version": 2,
  "tech_stack": { ... },
  "infrastructure_inventory": {
    "scheduled_jobs": {
      "discovered_at": "2026-04-26",
      "platform": "cloudflare-worker + base44-jobRunner",
      "entry_points": [
        {
          "name": "auto_reopen",
          "schedule": "*/3 * * * *",
          "trigger_file": "workers/auto-reopen-cron.js",
          "handler": "base44/functions/jobRunner (job=auto_reopen)",
          "auth": "X-Cron-Secret"
        },
        { "name": "sample_point_decay", "schedule": "0 4 * * *", "trigger_file": "...", "handler": "base44/functions/samplePointDecay" },
        { "name": "generate_daily_playbook", "schedule": "0 6 * * *", "trigger_file": "...", "handler": "base44/functions/generateDailyPlaybookDraft" }
      ],
      "extension_pattern": "Add cron line to workers/wrangler.toml + branch on event.cron in workers/auto-reopen-cron.js + add job branch to jobRunner/entry.ts"
    },
    "search": { "platform": "postgres-tsvector", "entry_points": [...], "extension_pattern": "..." },
    "auth": { "platform": "base44-sdk + firebase-phone-otp", "entry_points": [...] },
    "payments": { "platform": "dodo-payments-mor", "entry_points": [...] },
    "analytics": { "platform": "posthog", "entry_points": [...] },
    "logging": { "platform": "console + base44-builtin", "entry_points": [...] },
    "queue": { "platform": "none", "entry_points": [], "extension_pattern": "n/a — add to inventory if introduced" },
    "edge": { "platform": "cloudflare-worker", "entry_points": [...] }
  }
}
```

Each category includes:
- `platform` — what's actually wired (or "none")
- `entry_points` — concrete files / endpoints / triggers with enough detail for an agent to extend
- `extension_pattern` — one-line "how to add a new <X>" instruction

The agent NEVER greps for this at runtime. It reads `.svc/capability-registry.json` once at session start.

### How the inventory gets populated (3 entry points, all bounded)

| When | Who | What |
|---|---|---|
| **First-time onboarding** | `onboard-repo` skill (existing) | Final phase greps once for known infra patterns, populates `infrastructure_inventory` |
| **Greenfield session start** | `plan-capabilities` skill (existing) | Initial scan as part of capability planning |
| **New infra introduced via spec** | `write-spec` skill (existing) | Mandatory append: when a new feature spec introduces a new cron / queue / external service / new dependency category, write-spec MUST add it to `infrastructure_inventory` AS PART OF THE SPEC ARTIFACT — same way the spec writes ACs |
| **User-triggered refresh** | `/svc reinventory` (or `route-workflow` argument `--refresh-inventory`) | One-shot rerun of the onboarding-time grep, regenerates inventory |

After onboarding, runtime cost is ZERO — the file is the truth. Adding new infra during spec work updates the file. The only re-grep happens on explicit user trigger ("rerun onboarding").

### How the inventory gets read (also 3 points, all cheap)

| When | Who | What it does |
|---|---|---|
| **Session start** | `route-workflow` (existing) | Reads `infrastructure_inventory.tech_stack` summary into routing context (~200 tokens) |
| **Pre-recommendation** | `design-tech` + `plan-changeset` (existing) | Before generating any "should we use X?" block, scans inventory for that capability category. If `platform != "none"`, the design MUST address: extend-existing | new-justified-because-Y | drop |
| **Post-implementation** | `audit-implementation` (existing) | If diff introduces a new infra dep (new external SDK, new external URL pattern, new manifest entry), FAIL with "spec did not append to infrastructure_inventory — forced reinvention slipped through" |

Three reads, no grep. The cost is ~200 tokens per session for the read + structured assertion in design docs.

## Proposed changes (existing skills, NO new skills needed)

### F-A. P0 — Extend capability-registry.json schema (v2)

`schema_version: 1 → 2`. Add `infrastructure_inventory` section with the structure above.

Migration: any v1 registry can be auto-upgraded to v2 with empty inventory; first session that runs `plan-capabilities` populates it.

### F-B. P0 — Update `plan-capabilities` skill

Add Step 7: "Populate infrastructure_inventory."

This is the ONLY skill that ever greps the codebase for infra signals (during onboarding or refresh — bounded, finite, one-time).

Categories to scan: `scheduled_jobs / queue / search / auth / payments / analytics / logging / edge / cdn / observability`. For each, run the bounded probes documented in `references/infra-probes.json` (a new ref file with grep patterns + file globs per category).

### F-C. P0 — Update `onboard-repo` skill

After existing onboarding phases, invoke `plan-capabilities --infrastructure-only` to populate `infrastructure_inventory` for the brownfield repo.

This is the "1-time activity during onboarding" the user described.

### F-D. P0 — Update `write-spec` skill

Add gate G0.5 (between G0 scope review and Step 0 task graph setup): "Infra Dependency Check."

If the spec text mentions any of the inventory categories AND the change introduces a new entry point, the spec MUST include a "## Infrastructure Inventory Update" section with the JSON patch to apply to `capability-registry.json.infrastructure_inventory`.

Without this section, write-spec self-verify FAILS the spec.

This guarantees the inventory stays current without any future agent ever needing to re-grep.

### F-E. P0 — Update `design-tech` + `plan-changeset` skills

Add mandatory "Reinvention Check" section to both skill outputs:

```markdown
## Reinvention Check
Inventory consulted: `.svc/capability-registry.json#infrastructure_inventory`
Capability category touched: scheduled_jobs
Existing platform: cloudflare-worker + base44-jobRunner
Existing entry points: 4 jobs (auto_reopen, sample_point_decay, ...)
Proposed addition: refresh_live_info nightly
Decision: extend-existing (add to wrangler.toml + jobRunner branch)
Reasoning: existing pattern handles the same auth + scheduling shape; new entry costs ~15 LOC vs new third-party signup
```

If `existing platform == "none"` for the category, the section instead documents WHICH new platform is being introduced and updates `infrastructure_inventory`.

### F-F. P0 — Update `audit-implementation` skill

Add audit check: scan diff for new external dependencies (`package.json` adds, new external URLs in fetch calls, new wrangler.toml entries, new GitHub Actions workflows). Cross-check against `infrastructure_inventory`. Any addition not represented in the inventory FAILS audit with "infra inventory drift — spec did not declare this dependency."

This makes the discipline self-enforcing.

### F-G. P0 — Update `route-workflow` Self-Verify

Add row:

| # | Check | How |
|---|-------|-----|
| 7 | Inventory consulted before recommending external service | If response recommends an external service / pattern, must cite `infrastructure_inventory[<category>].platform` value, AND if `!= "none"` must justify why existing platform is unsuitable. |

### F-H. P1 — `/svc reinventory` command

User-triggered refresh. Reruns `plan-capabilities --infrastructure-only` against the current codebase. Use cases:
- Major refactor that consolidated infra
- Recovered from incident where infra inventory got stale
- After blend-external introduces new patterns

## Where the check fires (3 levels — same shape as #32, but ALL inventory-based, no runtime grep)

| Level | When | Read source | Cost | Catches |
|---|---|---|---|---|
| 1. Plan time | `design-tech` + `plan-changeset` consult inventory | `.svc/capability-registry.json#infrastructure_inventory` | ~200 tokens | 80% — most cases |
| 2. Spec time | `write-spec` G0.5 forces inventory update for new infra | same | 0 tokens (gate, not lookup) | The "new infra slipped in without being declared" cases |
| 3. Audit time | `audit-implementation` cross-checks diff against inventory | same | ~500 tokens | The "how did this leak in" cases |

ZERO runtime grepping outside of explicit `--refresh-inventory` flow. Cost is paid once at onboarding, paid once per spec that introduces new infra, then read at constant cost forever.

## Symmetry with proposal #32 (inertia detection)

Same shape. Both proposals:
- Capture state ONCE in a registry file (`deprecated-foundations.json` for #32; `infrastructure_inventory` here)
- READ at plan time (design-tech / plan-changeset)
- ENFORCE at spec time (write-spec gate)
- AUDIT at land time (audit-implementation)

Together they form the "context-checking gate pair." Could share a single `svc-context-check.mjs` hook process if desired, but each proposal can also land independently.

## Effort estimate

| # | Item | Hours |
|---|---|---|
| F-A | capability-registry.json schema v2 + migration | 1 |
| F-B | `plan-capabilities` populates infrastructure_inventory | 2 |
| F-C | `onboard-repo` invokes plan-capabilities at end | 0.5 |
| F-D | `write-spec` G0.5 gate (mandatory inventory update for new infra) | 1.5 |
| F-E | `design-tech` + `plan-changeset` Reinvention Check section | 1.5 |
| F-F | `audit-implementation` diff-vs-inventory drift check | 1.5 |
| F-G | `route-workflow` Self-Verify row | 0.25 |
| F-H | `/svc reinventory` command | 0.75 |
| References | `references/infra-probes.json` (10 categories × ~5 patterns each) | 1 |
| **Total** | | **~10 hours** |

Slightly more than v1 because spec-time gate (F-D) and audit-time check (F-F) are non-trivial. But runtime cost is dramatically lower — paid once, read forever.

## Replay test

Replay the WI-110 cron session through the new skills:

1. Agent opens session → `route-workflow` reads `infrastructure_inventory.scheduled_jobs.platform = "cloudflare-worker + base44-jobRunner"` and surfaces it in routing context
2. Agent considers cron setup → `design-tech` produces "Reinvention Check" section, sees `platform != "none"`, MUST address extend-existing
3. Spec authored → `write-spec` G0.5 gate verifies `infrastructure_inventory.scheduled_jobs.entry_points` was appended with the new `refresh_live_info` row
4. Implementation lands → `audit-implementation` confirms `wrangler.toml` change matches inventory entry; passes
5. Net effect: agent recommends "extend existing worker" path, no cron-job.org suggestion ever generated

Confirms the reinvention path is structurally blocked, with all costs paid at onboarding/spec time, not at every recommendation.

## User actions required

1. Review this proposal
2. Approve / modify / reject
3. After approval: implement F-A + F-B + F-G first (cheapest, highest leverage, ~3.25h) — establishes the inventory + read path
4. F-C / F-D / F-E / F-F / F-H land separately or bundled

## Note on this being one of multiple framework proposals this week

| Date | PR | Topic |
|---|---|---|
| 2026-04-25 | #26 | Verification gates (DEPLOYED-UNVERIFIED status) |
| 2026-04-25 | #27 | 12 operational findings |
| 2026-04-25 | #28 | Deterministic quality hooks (12 bypass closures) |
| 2026-04-25 | #32 | Inertia detection (deprecated foundations registry) |
| **2026-04-26** | **TBD** | **Reinvention detection (this — inventory-first)** |

#32 and this together are the context-checking gate pair. Filed standalone for review independence; could be folded if convenient.

## Why this design over the v1 (runtime grep) draft

| Dimension | v1 (runtime grep) | v2 (this — inventory-first) |
|---|---|---|
| Token cost per session | ~3-5K (grep + scan) | ~200 (read JSON section) |
| Cost when no recommendation triggers | Zero | Zero |
| Cost when 5 recommendations trigger | 5× grep cost | Still ~200 (cached JSON) |
| Bootstrapping cost | Zero (lazy) | One-time at onboarding |
| Self-healing if codebase changes | Yes (always re-greps) | Requires `/svc reinventory` OR write-spec G0.5 keeps it current via spec-driven appends |
| User cognitive cost | "Did the hook see the right files?" — opaque | Single inventory file readable by user any time |
| Cross-session consistency | Re-greps every session, may differ | Shared persistent state, deterministic |
| Onboarding-once principle | Violates | Aligned (mirrors builder-profile, domain-profile) |

User's instinct was correct. v2 is structurally cheaper and more aligned with how svc already handles persistent state.

---

## Resolution

**Closed:** 2026-04-27 (housekeeping — should have moved at merge time)
**Shipped via:** PR #42 (commit 5f3a16a) "Reinvention detection — inventory-first (mirror of #32 inertia)"
**Followup learning:** commit 9644ca5 — reinvention-detection applies to proposal phases too, not just external infra
