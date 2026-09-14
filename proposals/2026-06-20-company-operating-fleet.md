# Proposal — 2026-06-20 — Company Operating Fleet (autonomous business role-agents + loop)

## Intent

Generalize svc's one proven role-agent pattern (the ad-video fleet: `ad-strategist`
brain + `ad-video-producer` hands, levels up from a metrics ledger — WI-400/401/402)
into a **company operating fleet**: a set of locked business role-agents that run on
an **unattended schedule**, read shared company state, and queue **ranked decisions**
for the owner. Built **in svc** (the agent-leverage framework), operating **on the
separate Example Company repo + its state**.

Owner doctrine honored: svc exists to make the AGENT superhuman (agent leverage, not
a business); ceremony/gates ARE the value; autonomy **proposes**, the owner-approval
queue **disposes**.

## Decisions locked (owner, 2026-06-20)

1. **Topology:** Build in svc; operate on the company repo. Framework stays reusable
   across companies. Company state lives beside/with the target repo; agents + skills
   live here.
2. **First brain:** Chief-of-Staff orchestrator (the loop itself) — fastest path to a
   working unattended decision queue; other brains plug in afterward.
3. **Autonomy:** Fully scheduled / unattended from day one (CronCreate `/schedule`
   daily + weekly cloud runs). Safety rail: unattended runs may only WRITE to the
   decision/approval queue and append to state — never execute anything irreversible
   or outward-facing without an explicit owner approval.

## The insight that makes this small, not big

The business **domain knowledge already exists as svc skills**. The fleet is ~5 *thin*
role-agent brains wielding skills that already ship. New build = brains + loop + ledger
+ decision-queue. Not new finance/marketing/research expertise.

| Role-agent (NEW brain, `.claude/agents/*.md`) | Existing svc skills it wields | Job |
|---|---|---|
| **Chief-of-Staff** (orchestrator) | `route-workflow`, `roadmap-evaluation`, `assess-market-readiness`, `strategic-decision` | Run the cadence; read state; dispatch brains; emit ranked decisions |
| **Financial Analyst** | `manage-finops`, `monetization-architecture`, `pricing-strategy` | Runway/burn, unit economics, pricing, free-tier cliffs, budget-vs-plan |
| **Growth / Marketing Lead** | `marketing-ideas`, `paid-ads`, `launch-strategy`, `content-strategy`, `social-content` + ad fleet | Channel plan, campaigns, content calendar, ad pipeline |
| **Market Intel / Researcher** | `research`, `analyze-competitors`, `refresh-competitors`, `customer-research`, `find-opportunity` | Weekly competitor/market scan, opportunity radar, threat alerts |
| **Product / PM** | `validate-feature`, `write-spec`, `list-work-items`, `roadmap-evaluation` | Backlog grooming, feature validation, what-to-build-next |
| **Engineering** *(exists today)* | plan→exec→review→land chain | Already svc's core — no new work |

## The 4 genuine gaps (the actual build)

1. **Role-agents** — only `ad-*` exist; need ~5 locked, never-self-select agents.
2. **Autonomous loop / operating cadence** — none today. Built on harness primitives:
   `/schedule` (CronCreate) for unattended daily/weekly cloud runs; `/loop`
   (ScheduleWakeup) for in-session. Cadences: **daily standup** (state read + alerts +
   top decisions), **weekly business review** (each brain reports + proposes),
   **monthly board meeting** (strategy reset).
3. **Company-state ledger** — campaigns-ledger idea, business-wide: metrics, runway,
   OKRs, decisions, experiments. One append-friendly source the loop reads and every
   agent writes. Lets agents level up (reuse the `learnings.jsonl` / ExpeL pattern) and
   coordinate. Lives with the company repo.
4. **Decision / approval queue** — `decisions-pending.jsonl`: agents propose, owner
   approves. Surfaced each morning. The safety rail that makes unattended autonomy OK.

## WI cluster (sequential, one per route-workflow run — modeled on WI-400/401/402)

- **WI-403 — Company-state ledger + Chief-of-Staff orchestrator + daily cadence +
  schedule wiring (first unattended vertical slice).** Minimal `company-state` schema +
  reader; the Chief-of-Staff locked agent (reads state -> calls `roadmap-evaluation` /
  `assess-market-readiness` -> writes ranked decisions to `decisions-pending.jsonl`);
  one **daily standup** cadence skill; CronCreate `/schedule` wiring for the daily run;
  the approval-queue surfacing convention + the never-execute-irreversible safety rail.
  Exit = an unattended daily run that produces a ranked decision queue the owner reviews.
- **WI-404 — Financial Analyst brain** (wields `manage-finops` + `monetization-architecture` + `pricing-strategy`; writes runway/economics to state).
- **WI-405 — Market Intel / Researcher brain** (weekly competitor+market scan -> opportunity/threat decisions).
- **WI-406 — Growth / Marketing Lead brain** (channel/campaign/content plan; bridges to the ad fleet).
- **WI-407 — Product / PM brain** (backlog grooming, feature validation, what-next).
- **WI-408 — Weekly business review + monthly board cadences** (multi-brain synthesis runs once >=3 brains exist).

Each brain WI: thin locked agent over existing skills, levels up from the ledger, ends
its run by appending proposals to the decision queue. One per pipeline run; never batch.

## Risks / gates

- **Unattended safety:** scheduled runs are PROPOSE-only; any execute path stays behind
  the owner-approval queue + svc human-checkpoint. Enforce in the orchestrator agent's
  locked contract.
- **Cost:** unattended cloud loops consume usage on a schedule — start daily-only, add
  weekly/monthly after the daily proves valuable (measure-then-promote).
- **State coupling:** company-state lives with the target company repo; agents reference it by
  path. Keep the schema versioned so brains added later don't break it.
- **Cross-company reuse:** keep the fleet parameterized by company-repo path so the same
  svc install can run multiple companies' loops.

## Next

WI-403 is the first vertical slice -> runs through `route-workflow` (write-spec ->
plan-changeset -> review-plan -> execute -> review-exec -> land). On owner's word, kick
off WI-403.

## Triage
accepted_wi: WI-403
reason: Accepted and built as the WI-403..409 cluster (5 role-agent brains + doctrine + WI-409 review remediation) on branch `feat/company-operating-fleet`. WI-403 is the lead WI; the runtime (WI-408) remains backlog pending a real COMPANY_REPO.
