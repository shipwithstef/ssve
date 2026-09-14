---
name: launch-knowledge
version: "1.0"
handles_concerns:
  - terms-of-service-touch
  - privacy-policy-touch
  - acceptable-use-policy
  - gdpr-deletion
  - ccpa-do-not-sell
  - soc2-control-touch
  - hipaa-control-touch
description: >-
  Launch knowledge base for software founders — legal vehicles by jurisdiction (BG/EE/US-DE first), startup credit programs, hosting/platform bundles, first-100-customers distribution playbooks; layers a per-builder founder profile on top. Use when: "should I incorporate", "startup credits", "register a company", "how do I launch". Also: "Stripe Atlas", "Delaware LLC", "first 100 customers", "free runway", "свободна професия". Also: "БУЛСТАТ", "platform alternative". Also: "register freelancer", "$30/mo bundle".
inputs:
  required: []
  optional:
    - { path: "~/.svc/founder-profile.md", artifact: founder-profile }
    - { path: ".svc/capability-registry.json", artifact: capability-registry }
    - { path: "docs/specs/vision.md", artifact: vision }
outputs:
  produces:
    - { path: "docs/specs/launch-vehicle-decision.md", artifact: launch-vehicle-decision }
    - { path: "docs/analysis/credit-stack-plan.md", artifact: credit-stack-plan }
    - { path: "docs/analysis/runway-projection.md", artifact: runway-projection }
    - { path: "docs/analysis/distribution-plan.md", artifact: distribution-plan }
    - { path: "~/.svc/founder-profile.md", artifact: founder-profile }
phases:
  - { id: P1-InvocationReceipt, required_for_completion: true, evidence: "skill_invocation receipt emitted before canonical artifact writes" }
  - { id: P2-ProfileCapabilityAndVisionLoad, required_for_completion: true, evidence: "founder profile, capability registry, and vision availability checked" }
  - { id: P3-KnowledgeBaseAndCompetitorReads, required_for_completion: true, evidence: "launch knowledge index/details read; BG competitor precondition reads handled when applicable" }
  - { id: P4-LaunchVehicleDecisionArtifact, required_for_completion: true, evidence: "docs/specs/launch-vehicle-decision.md produced" }
  - { id: P5-CreditStackPlanArtifact, required_for_completion: true, evidence: "docs/analysis/credit-stack-plan.md produced" }
  - { id: P6-RunwayProjectionArtifact, required_for_completion: true, evidence: "docs/analysis/runway-projection.md produced" }
  - { id: P7-DistributionPlanAndProfileUpdate, required_for_completion: true, evidence: "docs/analysis/distribution-plan.md produced and founder profile update/no-op recorded" }
  - { id: P8-SelfVerifyContinuation, required_for_completion: true, evidence: "self-verify complete and task graph continuation handled" }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🧠 [STRAT] for the launch-vehicle decision; 🌐 [DISC] for any knowledge refresh dispatched via `/research`. See `references/model-routing.md`.

# `launch-knowledge` Skill

## Purpose

Single source of truth for **how a software founder launches** — independent of who they are. Knowledge base covers legal vehicles, startup credit programs, hosting bundles, payment processors, and early-distribution playbooks, with citations and dates on every non-trivial claim.

A thin per-builder overlay at `~/.svc/founder-profile.md` accretes over time and biases recommendations. **Crucial: the skill works GREAT with an empty or missing profile** — it falls back to generic best-practice advice for the 80% case.

**Announce at start:** "I'm using `launch-knowledge` to draft your launch vehicle, credit stack, runway, and distribution plan."

## Step 0: Emit Invocation Receipt (G-4 mandatory)

**BEFORE any artifact write** (launch-vehicle-decision.md, credit-stack-plan.md, runway-projection.md, distribution-plan.md, founder-profile.md updates, or refresh writes to the knowledge base), emit a `skill_invocation` receipt to `.svc/pipeline-decisions.jsonl`. The G-4 hook (`hooks/svc-skill-artifact-authenticity.mjs`) blocks writes to canonical paths without a recent receipt.

```bash
mkdir -p .svc && printf '{"timestamp":"%s","skill":"launch-knowledge","event":"skill_invocation","mode":"<initial|refresh|qa>","topic":"<short-slug>","decision_type":"taste"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .svc/pipeline-decisions.jsonl
```

Required fields: `timestamp` (ISO-8601), `skill: "launch-knowledge"`. Run this ONCE at the top of the invocation; subsequent writes within the 90-min window are covered.

## Process

1. **Read the per-builder profile** — `~/.svc/founder-profile.md` if it exists. If missing or empty, treat all profile-conditional recommendations as "generic" and continue. NEVER hard-fail on missing profile.
2. **Read the project capability registry** — `.svc/capability-registry.json` for revenue model, customer geography, scale targets. If missing, treat geography as "unspecified" and surface that as an explicit assumption in outputs.
3. **Read the knowledge base** — `references/knowledge/launch/INDEX.md` first; descend into `jurisdictions/`, `credit-programs/`, `platforms/`, `distribution/` only as needed for this invocation.
3a. **Read competitor knowledge for BG founders** — when jurisdiction is BG, ALSO read:
   - `references/knowledge/competitors/legalconsult-bg/CAPABILITIES.md` — verified licensed-advocate platform with €125 EOOD pricing + applied-knowledge.md for legal positions on AI risks, freelance contracts, EUR transition
   - `references/knowledge/competitors/b-trust-bg/CAPABILITIES.md` — КЕП (qualified electronic signature) provider; Cloud КЕП at €3-26/year is the modern path; precondition for ALL BG digital filings (TR portal, NAP, БУЛСТАТ, чл. 97а)
   These are NOT optional reads — КЕП is a precondition for incorporation, and LegalConsult is the cheapest verified incorporation route.
4. **Produce the four outputs** (each ≤200 lines, citations inline):
   - `docs/specs/launch-vehicle-decision.md` — recommended legal entity for THIS project + when to revisit (revenue trigger / PII trigger / fundraising trigger)
   - `docs/analysis/credit-stack-plan.md` — ranked credit programs to apply to, eligibility-cut against profile, expected $-value × approval-probability, stackability check
   - `docs/analysis/runway-projection.md` — months of free runway given the chosen stack, broken down by line item with sources
   - `docs/analysis/distribution-plan.md` — first-100-customer playbook for the product type identified
5. **Update the founder profile** — append anything the user volunteered during this conversation (jurisdiction, employment status above/below social-security cap, spouse/co-founder context, programs already applied to, programs rejected and why). Idempotent — never overwrite previously verified facts unless user explicitly corrects them.

## Empty-profile graceful handling (AC-06)

**If `~/.svc/founder-profile.md` does not exist OR is effectively empty (header only, no facts), the skill MUST still produce all four outputs.**

In that mode, every recommendation that would normally be profile-conditional MUST be expressed as a parameterized clause:

> "If you are a BG resident already employed above the max insurable income cap (~4,130 BGN/month, 2026), registering as свободна професия adds €0 net social-security cost — see `references/knowledge/launch/jurisdictions/bg.md`. If you are below the cap or not employed, expect ~€1,600/year fixed contribution. Confirm your employment status to sharpen this recommendation."

### BG-specific load-bearing facts (must surface in output for BG founders, parameterized if profile is empty)

When jurisdiction is or might be BG, the launch-vehicle-decision MUST include:

1. **Three-layer EOOD cost framing** — Layer 1 (legal existence, ~€153 one-time) vs Layer 2 (activity-triggered, €0/mo if dormant) vs Layer 3 (optional risk insurance, €600-900 one-off). Do NOT conflate into single "Year 1" estimate.
2. **КЕП precondition** — Cloud КЕП via B-Trust (€3-26/year) is required for incorporation, NAP, чл. 97а filings. Mobile-app onboarding, no hardware. This is a precondition (Layer 0), not "future friction".
3. **Чл. 97а ЗДДС triggered Day-1** by foreign SaaS suppliers (Vercel/OpenAI/Dodo/etc.) — registration before first such transaction, not at the 100K BGN general VAT threshold.
4. **31.12.2026 EUR-amendment deadline** for founding-act denomination — recommend EUR from day 1 if incorporating in 2026.
5. **Spouse-as-owner pattern** — when builder has employer IP-clause concerns, route to spouse-owned EOOD with marital property contract + IP-transfer civil contract. See `references/knowledge/launch/jurisdictions/bg.md` § "Spouse-as-owner structure".

If founder profile reveals an employer-IP-clause concern (trudov договор with broad IP assignment), the spouse-as-owner pattern becomes load-bearing — flag it explicitly.

Outputs MUST NOT contain placeholder strings like `<TODO: ask user>`, `<jurisdiction>`, or `[FILL IN]`. Generic best-practice covers the 80% case; user-specific sharpening is offered, never demanded. **No errors. No degraded UX.** This is enforced by the tier-1 validator `validate-launch-knowledge-empty-profile-graceful.sh`.

## Profile-biased mode (AC-07)

When `~/.svc/founder-profile.md` contains user-specific facts, the skill bias the four outputs accordingly. Two reference fixtures live at `skills/launch-knowledge/references/fixtures/`:

- `fixture-bg-above-cap-solo.md` — BG resident, employed at >max insurable cap, solo founder. Expected biases: recommend свободна професия (€0 net SS cost), defer EOOD until first €5k MRR, prioritize MS Founders Hub + NVIDIA Inception (no incorporation gate), de-prioritize Stripe Atlas (CFC trap for BG residents).
- `fixture-us-llc-dual-cofounder.md` — US Delaware LLC, two co-founders. Expected biases: skip BG content entirely, default to Stripe Atlas + Mercury, surface AWS Activate Founders ($1k) with NVIDIA Inception escalation path ($100k), flag Vercel Pro per-seat cost (2 cofounders → $40/mo base).

Each fixture produces a measurably different `credit-stack-plan.md` and `launch-vehicle-decision.md` from the empty-profile run.

## Composition with existing skills

| Skill | Relationship | Invocation order |
|---|---|---|
| `mor-vs-stripe` | composes | `launch-knowledge` recommends payment-processor *type* (MoR vs direct); `mor-vs-stripe` runs the deeper trade study after |
| `manage-finops` | downstream | once operating, `manage-finops` takes over for ongoing cost tracking + projections |
| `roadmap-evaluation` | downstream | uses `runway-projection.md` to set milestone budgets |
| `pricing` | composes | `launch-knowledge` says *whether* to charge; `pricing` says *how much* |
| `launch` | composes | `launch-knowledge` sets the launch *vehicle*; `launch` runs the launch *campaign* |
| `cold-email`, `prospect`, `ai-cold-outreach` | composes | `launch-knowledge` identifies distribution *channels*; these skills execute outreach |
| `mine-builder` | composes | `mine-builder` discovers user context; `launch-knowledge` reads the resulting profile |
| `platform-operating-architect` | adjacent | `launch-knowledge` advises on platform *choice*; `platform-operating-architect` runs the operating model on a chosen platform |

See `references/skill-composition.md` for the detailed protocol.

## Knowledge-base navigation

The full knowledge base lives at `references/knowledge/launch/`. Read `INDEX.md` first — it tells you what we know without loading details. Layer 2 is per-domain `INDEX.md` (e.g., `credit-programs/INDEX.md`); Layer 3 is the per-source detail file (e.g., `credit-programs/microsoft-founders-hub.md`). See `references/knowledge-base-protocol.md` for the read-and-refresh rules.

**Refresh discipline:** files under `credit-programs/` and `jurisdictions/` go stale annually. The tier-1 validator `validate-launch-knowledge-freshness.sh` flags any file with mtime >12 months; fixing means dispatching `/research` for that specific source and updating the file.

## Cost-benefit framing

For every recommendation involving money or time, use the parameterized calculators at `references/cost-benefit-calculator.md`:

- "If main employment is above max insurable cap, registering self-employed = €X net cost"
- "If credit program approval rate is Y%, expected value = $value × Y%"
- "Migration to platform X is net-positive if you'll burn ≥$Z/mo of free credits there"
- "Annual cost of incorporation breakeven point at revenue R"

**Never recommend an action with an implicit cost; always surface the math.**

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | All four outputs produced | `ls docs/specs/launch-vehicle-decision.md docs/analysis/{credit-stack-plan,runway-projection,distribution-plan}.md` and confirm each is non-empty | PASS = all 4 exist + non-empty |
| 2 | Citation completeness | Grep each output for inline URLs; confirm every credit program, threshold figure, and pricing claim cites a URL | PASS = no claim without URL |
| 3 | Empty-profile graceful (AC-06) | When `~/.svc/founder-profile.md` is missing, run skill end-to-end; grep outputs for forbidden placeholders (`<TODO`, `[FILL IN]`, `<jurisdiction>`) | PASS = all four outputs produced + zero placeholders |
| 4 | Profile bias (AC-07) | Run against `references/fixtures/fixture-bg-above-cap-solo.md` and `fixture-us-llc-dual-cofounder.md`; diff each result vs the empty-profile run | PASS = `credit-stack-plan.md` differs in ranking or membership for both fixtures |
| 5 | Stackability check | Grep `credit-stack-plan.md` for "stackable" or "stacks with" line per program | PASS = every program in plan has one such line citing `credit-programs/<program>.md` |
| 6 | Knowledge freshness | Run `bash test-framework/evals/tier-1/validate-launch-knowledge-freshness.sh` | PASS = exit 0 |
| 7 | Receipt emitted | `tail -n 50 .svc/pipeline-decisions.jsonl \| grep skill_invocation \| grep launch-knowledge` | PASS = at least one matching entry within last 90 minutes |

If any check FAILs, fix before declaring complete.

## Phase Receipt Contract

When running with `.svc/lane-tasks-<WI>.json`, emit one phase receipt after
each required phase:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-InvocationReceipt --evidence file:.svc/pipeline-decisions.jsonl
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ProfileCapabilityAndVisionLoad --evidence file:.svc/capability-registry.json --evidence file:docs/specs/vision.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-KnowledgeBaseAndCompetitorReads --evidence file:references/knowledge/launch/INDEX.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-LaunchVehicleDecisionArtifact --evidence file:docs/specs/launch-vehicle-decision.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-CreditStackPlanArtifact --evidence file:docs/analysis/credit-stack-plan.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-RunwayProjectionArtifact --evidence file:docs/analysis/runway-projection.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-DistributionPlanAndProfileUpdate --evidence file:docs/analysis/distribution-plan.md --evidence command_output:.svc/launch-knowledge-founder-profile-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/launch-knowledge-self-verify-<WI>.log
```

For missing optional inputs or non-BG contexts, still record the phase with skip
evidence:
- `P2-ProfileCapabilityAndVisionLoad`: record
  `--evidence command_output:.svc/launch-knowledge-empty-profile-<WI>.log` when
  `~/.svc/founder-profile.md` is missing or empty.
- `P3-KnowledgeBaseAndCompetitorReads`: record
  `--evidence command_output:.svc/launch-knowledge-bg-competitor-skip-<WI>.log`
  when BG jurisdiction is not applicable.
- `P7-DistributionPlanAndProfileUpdate`: record a no-op log when the user
  volunteered no new founder-profile facts.

If no task graph exists, write the same phase/evidence list in the final
response so an orchestrator can backfill the receipt.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work

### Standalone mode (no active task graph)

**Next:** if the project lacks any feature spec, route to `validate-feature` for the first user-visible product decision; if the project has feature work in flight, return control to the calling lane (typically `route-workflow`).
