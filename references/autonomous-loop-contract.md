# Autonomous-Loop Contract

**Status:** governance reference, **advisory** in v1. Any svc-authored recurring loop (a routine an agent runs on a cadence — `/loop`, `ScheduleWakeup`, `CronCreate`, or plain cron — rather than a one-shot task) MUST satisfy this contract before it runs unattended. **No mechanical enforcer exists yet:** until a validator/enforcer WI ships, Tier-2 actions (§3) stay human-gated regardless of a `promotion` block — this doc defines the schema an enforcer will check, and the discipline agents follow now.

**Origin:** blended from coreyhaines `marketing-loops` v2.6 (`loop-state.md`, `loop-guardrails.md`, `loop-orchestration.md`) — see `references/knowledge/competitors/coreyhaines-martech/details/new-skills-v2.0-v2.6.md`. What is upstream-sourced vs svc-native is marked per-section and summarized in the **Source-trace table** at the end. WI-479.

## Why this exists

svc's mandatory chain guards **commits**. It has nothing for **recurring external actions**. The company-operating-fleet **defines a weekly cadence that is currently run manually** (owner-run, not auto-scheduled — see `references/company-operating-fleet.md`), and the ad fleet levels up from a campaigns ledger, but neither stores what it already processed, dedupes what it already acted on, cools down per entity, or bounds a future promotion from propose-only to bounded-execute. A churn-watch loop that re-runs after a crash re-emits the same cards; the first fleet loop that touches spend/send has no cap/kill-switch. This contract is that missing machinery.

## 1. Loop-state file (idempotency)

**State root — deterministic selection rule (svc-native):** state and run log are always **colocated** under one root, chosen by loop class:
- **Framework-self loop:** `<framework-repo>/.svc/loops/<loop>.{json,log}`
- **Onboarded product-repo loop:** `<product-repo>/.agents/loops/<loop>.{json,log}` (matches upstream so the addon's own loops interoperate)
- **Company-operating-fleet loop:** `$COMPANY_STATE_DIR/loops/<loop>.{json,log}` — the fleet spans multiple `COMPANY_REPO` values and stores state under the configured `COMPANY_STATE_DIR`; a shared `.svc/loops/` root would collide across companies, so fleet loops MUST use the company-state boundary.

If your scheduler provides durable cursor/dedupe storage you MAY use that instead (svc-native allowance) — the invariant is durable state, never in-memory-only.

**Field names (upstream-sourced):**
```json
{
  "loop": "churn-signal",
  "cursor": "2026-07-13T23:59:59Z",     // watermark — process only items newer than this; advance at end of a successful run
  "handled": ["acct_1042", "acct_1077"], // dedupe keys already acted on
  "cooldowns": { "acct_1042": "2026-07-28T00:00:00Z" }, // per-entity next-eligible; never re-contact inside the window
  "in_flight": ["exp_pricing_v3"],       // open actions/tests — don't start a conflicting one
  "counters": { "acct_1042_attempts": 2 } // attempt counts driving stop conditions
}
```

**Idempotency patterns (upstream-sourced):** watermark, dedupe set, cooldown map, in-flight guard.
**Pruning (svc-native policy):** keep state small; expire `handled`/`cooldown` entries past their window — the exact retention window is per-loop, set by the loop author.
**PII (upstream-sourced + AC):** **no raw PII in the state file, the run log, OR runtime-action receipts** — use internal IDs or hashes; pull the minimum needed; don't hoard.

## 2. Run log + vanity-loop rule (upstream-sourced)

Append one line per run, whether or not it acted — the audit trail AND the vanity-loop detector. Path: colocated with state (§1).

```
2026-07-13T09:00Z  checked=312  acted=2   note="2 accounts newly at-risk, cards staged"
2026-07-14T09:00Z  checked=298  acted=0   note="no action"
```

**Vanity-loop rule:** every run `acted=0` for weeks and nobody misses it → kill it; acts every run → chasing noise, retune the trigger. The chief-of-staff cadence reads these logs as a "loop health" check.

## 3. Two-tier action model (the fence — upstream-sourced tiers)

| Tier | Actions | Rule |
|------|---------|------|
| **Tier 1 — autonomous-safe** | read, analyze, diff, score, **draft**, **stage** | a loop may do these unattended (the **default** — a loop is Tier-1 unless a complete §5 `promotion` block says otherwise) |
| **Tier 2 — gated** | **spend**, shift budget, **send**, **publish**, **delete/suppress**, change live settings | require a human checkpoint by default |

A Tier-2 action runs without a per-action human check **only if** a complete, fail-closed §5 `promotion` block authorizes it. **Cap semantics by class (svc-native, correcting a naive uniform threshold):**
- **Spend / budget-shift:** hard ceiling + **per-run change limit ≤20%** (upstream's 20% rule is spend/budget-specific) + allowlist; judge on revenue/ROAS, never a proxy.
- **Send / publish:** **absolute per-run and per-recipient volume caps** (a 20% rule is meaningless for a single email) + staging-queue default + suppression/unsubscribe checked first + no auto-post where bot-detection/ToS bites.
- **Delete / suppress / change-live:** allowlist + a required reversibility or backup precondition; these lean toward the always-escalate list below.

**Always-escalate (svc-native default membership; loop authors may extend, never shrink):** anything legal/financial/irreversible-to-a-third-party — route to a human regardless of a `promotion` block.

## 4. Compliance (categories upstream-sourced; specific statutory rules are svc-native policy — verify against real counsel, not this digest)

Map each category to the loops it governs. **The digest names the categories (CAN-SPAM/CASL, GDPR/CCPA, FTC, platform ToS); the specific obligations below are svc-native operational policy, NOT sourced legal advice:**
- **CAN-SPAM / CASL** (email/SMS): honor unsubscribes immediately; working unsubscribe; identify sender; lawful basis/consent; scrub suppression every send.
- **GDPR / CCPA** (personal data): lawful basis; EU-marketing consent; honor deletion/opt-out; minimize + don't repurpose.
- **FTC** (review/UGC/referral/social): disclose material connections; testimonials only with permission; no fabricated claims.
- **Platform ToS** (listening/community/scraping): respect rate limits + automation rules; don't scrape/auto-act where prohibited.

When a loop can't confirm consent/permission/ToS-compatibility, its stop condition is **don't act — stage for a human**.

## 5. Promotion block — fail-closed field contract (svc-native)

A loop is **Tier-1 by default**. This is the **field contract a future enforcer WILL validate** — it is NOT machine-enforced today (advisory v1). It may take Tier-2 actions only when its state file carries a **complete** `promotion` block — any missing/empty field means Tier-1 (fail-closed):

```json
"promotion": {
  "authorized_classes": ["send"],          // which Tier-2 action classes; empty/absent ⇒ none
  "authorization_ref": "<authz-artifact>",  // user authorization reference + its scope
  "authorization_scope": "cohort:dunning; company:acme",
  "caps": { "send": { "period": "daily", "limit": 500, "consumed": 12 } },  // per-class; spend adds change_limit_pct ≤20
  "allowlist_ref": "<allowlist-artifact>",  // allowlist identity
  "allowlist_version": "2026-07-14a",       // version, so a stale allowlist is detectable
  "kill_switch": { "action": "<documented halt command>", "tested_at": "2026-07-14T00:00:00Z" },
  "checklist": { "state_present": true, "log_wired": true, "caps_set": true, "allowlist_nonempty": true, "compliance_mapped": true, "kill_switch_tested": true }
}
```

**Prerequisites (all required):** explicit user authorization for the specific class; hard caps (+ ≤20% change-limit for spend only); a versioned allowlist; a kill switch with a real `tested_at`; and a passed pre-launch checklist. Absent any one → Tier-1. *Kill-switch/reversion semantics are svc-native: "halt the loop and revert in-flight Tier-2 actions where reversible" is the target behavior an enforcer/loop implements — the digest establishes only that a kill switch must exist.*

## 6. Runtime-action receipt (svc-native — the auditability hybrid)

Upstream provides run-level logs (an audit trail), but not **per-Tier-2-action receipts carrying authorization, cap, and provider-reconciliation metadata**. **The svc-native hybrid:** every Tier-2 action appends a **runtime-action receipt** line to the run log. This is **NOT a mandatory-chain receipt** — it does NOT live in `refs/notes/svc-receipts`, is NOT commit-keyed, and shares no namespace with chain receipts; it is a per-action runtime record colocated with loop state.

```
2026-07-20T09:00Z  tier2  run_id=<id>  action_id=<id>  action_class=send  authorization_ref=<ref>  allowlist_ref=<ref>  cap_delta=1  cap_after="13/500 daily"  result=ok  rollback_ref=<provider-msg-id>  note="win-back 2/2"
```

**Crash-safety / retry gap (svc-native — a real failure mode the run-log alone doesn't close):** an external send/spend can succeed and then crash **before** `handled`/`cooldowns`/`caps.*.consumed`/the receipt line are written — a naive re-run would double-act AND under-count the cap. Tier-2 actions MUST therefore satisfy BOTH:
1. **Deterministic-or-persisted `action_id`:** the `action_id` is either deterministic from the semantic action (same action ⇒ same id, so a retry reuses it) OR written to `in_flight` **before** the external call. A freshly-generated id per retry defeats provider idempotency and is forbidden.
2. **Reconcile-before-next-Tier-2:** before ANY new Tier-2 action, reconcile every open `in_flight` entry against the provider's record, and update the runtime-action receipt, `handled`, `cooldowns`, AND `caps.*.consumed` **from provider truth** (not from what the loop intended). This closes the "recorded cap under limit while real provider-side volume exceeds it" gap.

A loop that cannot satisfy both (deterministic/persisted id + reconcile) MUST stay Tier-1 — it cannot honestly claim safe bounded execution.

## 7. Orchestration + rollout (upstream-sourced)

Loops compose into four layers: **sensing → diagnostic → action → learning**. Adopt in order: **tracking + a weekly review first, before any acquisition/action loop**; never stand up many loops at once. Cadence rule: **match frequency to how fast the signal actually changes**. Scheduling defers to host primitives (`/loop`, `ScheduleWakeup`, `CronCreate`, cron) — this contract governs state + guardrails, not the scheduler.

**When NOT to loop:** strategy/creative work, unreviewed spend/publish, sparse signals, vanity loops.
**Banned framing (upstream-sourced):** "set it and forget it", "fully autonomous", "10x on autopilot". A loop is a bounded, audited, killable machine — say that.

## Source-trace table

| Claim | Upstream-supported | svc-native adaptation |
|---|---|---|
| Field names (cursor/handled/cooldowns/in_flight/counters) | ✓ | — |
| Run-log format + vanity-loop rule | ✓ | wired to chief-of-staff cadence |
| Tier-1/Tier-2 action lists | ✓ | fail-closed default + per-class cap semantics |
| Caps + allowlist + kill-switch + checklist EXIST | ✓ | the machine-checkable `promotion` schema (§5) |
| ≤20% per-run change limit | ✓ (spend/budget only) | scoped to spend; absolute volume caps for send/publish |
| Compliance CATEGORIES | ✓ | specific statutory obligations = svc policy, not sourced legal advice |
| PII out of state AND logs | ✓ (upstream prohibits both) | svc-native only EXTENDS the prohibition to runtime-action receipts (§6) |
| State-root path | `.agents/loops/` (product) | `.svc/loops/` (framework) + `$COMPANY_STATE_DIR/loops/` (fleet) |
| Runtime-action receipt + prepare/reconcile retry-safety | — | svc-native (the auditability + crash-safety hybrid, §6) |
| Promotion block schema, always-escalate membership, kill/reversion semantics, pruning, scheduler-storage allowance | — | svc-native policy/inference |

## Consumers

- Company-operating-fleet: `chief-of-staff` cadence gains a loop-health check (reads §2 run logs under `$COMPANY_STATE_DIR/loops/`); each propose-only brain that could loop (growth-lead, comms, revops, customer-success, data-collection) points here before any bounded-execute promotion (§5).
- Ad fleet: the campaigns-ledger level-up is a Tier-1 learning loop; any auto-spend promotion goes through §5 + §6.
- `references/company-operating-fleet.md` and the fleet agent definitions link here.
