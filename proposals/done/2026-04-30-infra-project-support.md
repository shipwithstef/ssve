# Proposal: Infra Project Support + The Knowledge Spine

**Date:** 2026-04-30
**Author:** orchestrator (Claude Opus 4.7)
**Status:** DRAFT — awaiting builder approval
**Scope:** Framework evolution. Two coupled changes: (1) infra-class repos become first-class svc citizens, (2) the Knowledge Spine — a single retrieval architecture that makes svc amplify what it knows over time instead of rediscovering it. The two are coupled because infra is the forcing function: a stack with 30+ providers and 200+ resource types breaks any framework that doesn't have predictive, just-in-time recall. Solving infra forces us to fix knowledge for ALL lanes.
**Supersedes:** none. Complements `2026-04-21-evolution.md` (lane model maturity) and `2026-04-19-evolution.md` (knowledge architecture) — this proposal makes the knowledge layer load-bearing.

---

## 1. Problem (one paragraph)

svc routes app/product work cleanly through `write-spec → design-ux → design-ui → design-tech → plan-changeset → execute-changeset → review-gate → test-journeys → audit-implementation → verify-promotion`. Two compounding failures bite us today: **(a)** infra repos (Terraform, Pulumi, Kubernetes/Helm, Ansible, CI/CD, IAM, observability, DB migrations, FinOps) get force-fit into product lanes — wrong gates, no blast-radius review, no cost gate, `terraform plan` not recognized as the natural manifest. **(b)** Across ALL lanes, the framework rediscovers the same facts every session because knowledge isn't retrieved predictively — skills read whole spec files when they need one section, re-research provider versions / IAM patterns / Helm conventions / RLS quirks they already proved out three sessions ago, and learnings written to `framework-learnings.jsonl` aren't surfaced when the next relevant skill runs. **(b) is the deeper problem.** Fine-tuning a model freezes its knowledge; we need the opposite — a retrieval architecture where every session deposits structured knowledge that the next session retrieves automatically without being asked. Infra is the forcing function because the surface area is too wide for any frozen model: stack-profile + provider catalogue + IAM patterns + cost models + SLO contracts × every cloud × every change. If we solve retrieval for infra, we solve it for everything.

## 2. Goals / Non-Goals

**Goals**
- **Knowledge Spine first.** Build the retrieval architecture (§4) that makes "knowing what you need to know" deterministic — predictive recall, just-in-time depth, gap → research auto-loop, learnings feedback. Benefits ALL lanes immediately, not just infra.
- **Infra lanes second, on top of the spine.** Add 5 infra lanes (`infra-greenfield`, `infra-feature`, `infra-migration`, `infra-incident`, `infra-cost-optimization`) that reuse the existing phase model.
- **Reuse-first.** 3 net-new skills only where no existing primitive can be extended; everything else as templates / modes / annexes of existing skills.
- **Zero behavior change** for existing 7 lanes — the spine is opt-in via skill frontmatter declarations until populated.

**Non-goals**
- Fine-tuning a model. The point is amplification through retrieval, not weight-baking.
- Building Terraform / k8s / Pulumi providers or IaC engines. svc orchestrates them.
- Per-cloud (AWS/GCP/Azure) skill explosion. One stack-profile per project covers it.
- Replacing `track-visuals` for app projects — `track-topology-diff` is additive.

## 3. The Knowledge Spine — One Retrieval Architecture for All Lanes

**Extension principle (load-bearing):** every framework capability that exists today is preserved and EXTENDED. Nothing is removed, deprecated, replaced, or behavior-changed for existing work. The Spine layers new retrieval capabilities ON TOP of the existing 7 lanes, 47 skills, and existing knowledge tree — it does not fork them. Same applies to individual skills: where this proposal "extends" a skill (`plan-capabilities`, `design-ux`, `design-ui`, `test-journeys`, `execute-changeset`, `verify-promotion`, `review-security`, `write-spec`, `design-tech`), the extension is a NEW MODE, NEW TEMPLATE, or NEW ANNEX — never a rewrite. The default invocation of every skill behaves exactly as today.

**Why this beats fine-tuning:** a fine-tuned model is a frozen snapshot of yesterday's knowledge. The Spine is a living retrieval architecture: every skill run deposits structured knowledge, every subsequent skill run retrieves it predictively. Knowledge compounds. The framework gets smarter at the project as the project ages, without retraining anything.

The Spine is **five existing svc primitives wired into one retrieval pipeline**, plus three thin additions that make retrieval predictive instead of reactive. No new storage system, no vector DB, no embeddings service — just disciplined use of files, frontmatter, and hooks svc already has.

### 3.1 The five primitives (already exist — wired together by this proposal)

| Primitive | What it stores | Layer |
|---|---|---|
| `references/knowledge/domains/<domain>/{INDEX,CAPABILITIES,details/}` | External-source facts (Base44, Capacitor, Terraform, AWS IAM, …) at progressive depth | **Layer 1: world knowledge** |
| `docs/specs/{features,journeys,decisions}/**/*.md` | Project contracts (specs, ACs, DECISION.md) | **Layer 2: project intent** |
| `docs/learnings/learnings.jsonl` + `references/framework-learnings.jsonl` | Dated, confidence-scored facts learned from real failures and successes | **Layer 3: experiential** |
| `.svc/pipeline-decisions.jsonl` + `.svc/lane-tasks-<WI>.json` + receipts | Per-WI mechanical/taste/user decisions with rationale and outcomes | **Layer 4: episodic** |
| `~/.svc/builder-profile.md` + `docs/specs/domain-profile.md` + `docs/specs/stack-profile.md` (NEW) | Stable identity: who builds, in what industry, on what stack | **Layer 5: identity** |

These already exist (or follow the same pattern as existing files). No new schema. The Spine simply makes them queryable as one indexed surface.

### 3.2 The three additions (the only retrieval-layer work this proposal commits to build)

**A. Predictive recall via skill frontmatter.** Every skill declares `requires_topics[]` and `produces_topics[]` in YAML frontmatter:

```yaml
name: design-tech
requires_topics: [stack.iac-tool, stack.state-backend, domain.compliance, learnings.recent-architectural]
produces_topics: [decision.architecture, plan.module-list]
recall_depth: layer-2  # CAPABILITIES.md by default; details/ on demand
```

Before the skill runs, the framework's `recall-stack-knowledge` gate (the one net-new skill, §6.1) reads the frontmatter, queries the Spine across all five layers for matching topics, and injects the minimal slice into the skill's context. **The skill never asks for knowledge — it declares need and the harness fulfills it.** This is the "knowing what you need to know" mechanism.

**B. The spec-index — `.svc/spec-index.json`.** A `PostToolUse` hook on `Edit|Write` against `docs/specs/**/*.md` extracts each section's headings + tags into a JSON index:
```json
{
  "docs/specs/features/auth.md#rate-limit-rules": {
    "tags": ["surface:auth", "persona:operator", "lane:bugfix"],
    "topics": ["security.rate-limit", "iam.token-scope"],
    "last_modified": "2026-04-29T12:00:00Z",
    "byte_range": [4821, 6402]
  },
  ...
}
```
Skills query the index by tag/topic and `Read` only the byte range they need. Solves spec-reading bloat for ALL lanes — directly fixes the rant. Implementation: ~150 lines of Node, reuses the existing PostToolUse hook plumbing (no new hook event, no host-API drift risk per `rules/host-capability-research.md`).

**C. Gap → research auto-loop.** When `recall-stack-knowledge` returns 0 hits for a topic in `requires_topics[]`, two things happen automatically:
1. Append a `knowledge-gap` entry to `.svc/knowledge-recall.jsonl` with `{skill, topic, lane, WI}`.
2. Spawn a `research` skill task at the head of the lane-tasks graph **before** the requesting skill runs, scoped to that exact topic, output deposited at the appropriate Spine layer.

The next session opens with the gap closed. **Rediscovery becomes a measurable, auto-healing defect class.** Tier-1 validator `validate-no-rediscovery.sh` flags any `(skill, topic)` pair recalled >3 times in 24h as a candidate for promotion to `_shared/` or pinned context.

### 3.3 Just-in-time depth selection

`recall_depth` in skill frontmatter selects how deep into the Spine the gate fetches:

| Depth | Reads | Token budget (typical) |
|---|---|---|
| `layer-1` | INDEX.md only — does this domain exist? | ~200 tokens |
| `layer-2` | + CAPABILITIES.md per matching domain | ~2K tokens |
| `layer-3` | + relevant `details/<topic>.md` files | ~5–10K tokens |
| `escalate` | + recent learnings + relevant decisions log entries | ~15K tokens |

Default is `layer-2`. Skills escalate explicitly when they need more (e.g., `design-tech` for a complex stack escalates to `layer-3`; `quick-fix` stays at `layer-1`). Prevents over-fetching without forcing under-fetching. Mirrors the existing `references/context-budget.md` discipline.

### 3.4 Why this is better than fine-tuning

| Property | Fine-tune | Knowledge Spine |
|---|---|---|
| **Recency** | Frozen at training cutoff | Updated by every session |
| **Specificity to this project** | Requires custom dataset + retrain | Built-in via Layers 2/4/5 |
| **Auditability** | Opaque weights | Every retrieval logged to `.jsonl` |
| **Reversibility** | Retrain to undo | `git revert` |
| **Cost per update** | Hours + GPU + dataset curation | Append a learning, ~30 seconds |
| **Cross-project reuse** | One model per project | Layer 1 + Layer 3 portable across projects |
| **Self-healing** | Manual | Gap → research auto-loop |
| **Transparency to the user** | Black box | Files the user can read, edit, prune |

Fine-tuning bakes yesterday's knowledge into a model. The Spine builds a substrate where today's knowledge is retrieved at the right layer, at the right depth, at the right moment — and tomorrow's knowledge slots in without retraining.

### 3.5 Spine ↔ infra lanes coupling

The infra lanes consume the Spine intensively:
- `recall-stack-knowledge` is the phase-0 gate of every infra lane.
- `stack-profile.md` (Layer 5) is the load-bearing identity doc — every infra skill reads it via the gate.
- `references/knowledge/domains/{terraform,kubernetes,aws-infra,…}/` (Layer 1) holds stack-specific CAPABILITIES.
- `infra-incident` lane closes by writing a postmortem learning (Layer 3) → the next infra session's recall surfaces it.
- `track-topology-diff` snapshots feed back into Layer 4 (episodic) so blast-radius classification can compare against historical baselines.

Infra forces the Spine to work because no frozen model can hold the full provider × cloud × IAM × cost surface. Once the Spine works for infra, app lanes inherit it for free.

## 4. Lane Additions

| New lane | Purpose | Trigger signals |
|---|---|---|
| `infra-greenfield` | New infra repo from scratch (terraform init, k8s cluster bootstrap, CI/CD scaffolding) | Empty repo + `*.tf` / `Chart.yaml` / `pulumi.yaml` / `.github/workflows/` planned |
| `infra-feature` | Add resource / module / pipeline stage to existing infra repo | Existing infra repo + capacity/feature ask |
| `infra-migration` | **Replace** an existing system/tool with another: CAST AI replacing cluster autoscaler, GHES → GHEC, Jenkins → GH Actions, CloudFormation → Terraform, AWS → GCP, Datadog → New Relic, Heroku → Render, single-region → multi-region | Two-system signal: "from X to Y", "replace X with Y", "migrate", "cutover", "decommission" |
| `infra-incident` | Production incident requiring infra change (rollback, IAM tighten, scale up, hotfix) | Pager / incident ID / explicit "production down" / drift causing outage |
| `infra-cost-optimization` | FinOps-driven change (rightsizing, reserved capacity, dead resource cleanup) | Cost report / budget alert / explicit FinOps request |

The existing `drift` lane handles **infra drift reconciliation** with the substitutions below — no new lane needed for drift.

**`infra-migration` lane has extra phases** the feature lane doesn't cover, inserted between phases 5 (tech design) and 7 (plan synthesis):
- **5a — Source assessment.** Inventory current system: resources, configs, secrets, RBAC, integrations, traffic, dependencies. Output: `docs/specs/migrations/<slug>/source-state.md`. Reuses `audit-coverage` skill against the source system.
- **5b — Target design.** What the new system looks like, mapped 1:1 against source-state. Output: `docs/specs/migrations/<slug>/target-state.md` + `mapping.md` (resource-by-resource).
- **5c — Cutover plan.** Phased cutover (typically dual-run → shadow → percentage rollout → flip → decommission), each phase with rollback procedure. Output: `docs/specs/migrations/<slug>/cutover-plan.md`. Reuses `design-runbook` template (cutover IS a runbook).
- **Post-cutover: decommission phase** (after phase 18 drift-watch). Removes source system, archives final state. Output: `decommission-receipt.md`. Required to close the WI — prevents zombie infra.

## 5. Phase-by-Phase Skill Map

Infra has its **own native phase model** — the phase shape is mostly aligned with app lanes (capture → spec → design → plan → execute → verify) but with infra-specific positions and ordering. The phase numbers below are the canonical infra phases; mapping back to the closest app-phase analogue is shown for orientation only.

**`infra-migration` lane inserts four extra phases** that other infra lanes skip: phases **5a (source assessment)**, **5b (target design)**, **5c (cutover plan)** between phases 5 and 6, plus a final **decommission phase** after phase 18. Defined in §4 and traced in §16 worked examples. Migration sub-phases are skipped for non-migration infra lanes via the `references/skip-conditions.json` registry.

| # | Infra phase | Skill | Closest app analogue | Why it differs |
|---|---|---|---|---|
| 0 | Pre-lane recall | `recall-stack-knowledge` (NEW) + `plan-capabilities` | pre-lane `plan-capabilities` | Anti-rediscovery gate. The only NEW skill in pre-lane. |
| 1 | Capture & SLO framing | `capture-idea` / `validate-feature` (existing) | capture | Reuses existing skills; "personas" populated from infra template |
| 2 | Spec | `write-spec` + `templates/infra-feature.md` (NEW template, existing skill) | write-spec | Template-only change; spec sections become SLO/RTO/RPO/blast-radius/cost-envelope/IAM-scope |
| 3 | Topology design | `design-ux` + `templates/infra-topology.md` (NEW template, existing skill) | design-ux | Reuses design-ux's template-driven output mechanism |
| 4 | Runbook design | `design-ui` + `templates/infra-runbook.md` (NEW template, existing skill) | design-ui | Reuses design-ui's deliverable convention; output IS the on-call runbook |
| 5 | Tech & module design | `design-tech` + `references/infra-tech-design.md` (NEW annex, existing skill) | design-tech | Annex-only; provider/module/state-backend choices |
| 6 | IAM & policy review | `review-security` with policy packs from `domains/<stack>/policy/` (existing skill) | — | **Pulled forward** from post-execute. Reuses review-security; new rule packs not new skill |
| 7 | Plan synthesis | `plan-changeset` (existing skill) | plan-changeset | Consumes `terraform plan` / `helm diff` as manifest input — no skill change, just input format |
| 8 | Blast-radius classification | `plan-blast-radius` (NEW) | — | **The only new gate skill.** SEV-1/2 force `human_checkpoint: true`. |
| 9 | Cost-impact gate | `review-security --mode=cost-impact` (existing skill, NEW mode) | — | Reuses review-security plumbing with cost.yaml policy pack instead of inventing review-cost-impact |
| 10 | Plan review | `review-plan` (existing skill) | review-plan | Same skill; fan-out includes findings from phases 6/8/9 |
| 11 | Dry-run apply | `execute-changeset --infra` (existing skill, NEW mode flag) | — | Mode flag forces dry-run + attaches `dry_run_artifact_path` to receipt |
| 12 | Apply | `execute-changeset` (existing skill) | execute-changeset | Same skill; real apply gated on phase-11 receipt |
| 13 | Post-apply state verification | `verify-promotion --infra` (existing skill, NEW mode flag) | verify-promotion | Mode flag accepts `terraform state list` / `kubectl get` as verification artifact |
| 14 | Smoke & SLO probe | `review-gate` (existing skill) | review-gate | Universal Verification Principle: post-apply smoke + SLO check |
| 15 | Topology snapshot | `track-topology-diff` (NEW) | track-visuals | Net-new because structural JSON-diff is a different domain than image-diff |
| 16 | Chaos / failure-mode tests | `test-journeys` + `templates/chaos.feature.md` (NEW template, existing skill) | test-journeys | Reuses BDD `.feature.md` machinery; chaos = different given/when/then vocabulary |
| 17 | Audit | `audit-implementation` (existing skill) | audit-implementation | Same skill; audits against infra spec sections |
| 18 | Drift watch (continuous) | existing `drift` lane + `/schedule` + `manage-learnings` writeback | — | Zero new skills. Schedules existing drift lane; findings flow into `manage-learnings` so the next session's `recall-stack-knowledge` surfaces them |

**Key differences from app phases:**
- **Three new phase positions** with no app analogue: blast-radius (8), cost-impact (9), continuous drift watch (18).
- **Security review pulled forward** to phase 6 (design-time) instead of post-execute.
- **Execute split into dry-run gate + real apply** (phases 11/12) — app lanes treat execute as one step.
- **Chaos testing runs post-apply** (phase 16), not pre-merge — you can't chaos-test a plan.
- **Continuous drift watch** is ongoing, not one-shot per WI.

## 6. New Skills — Minimum Viable Set (3)

**Reuse-first principle:** any infra capability that can be expressed as a template, annex, or mode of an existing skill MUST be done that way. Only three capabilities have no existing svc primitive to extend, and earn their own SKILL.md.

### 6.1 `recall-stack-knowledge` (pre-lane gate — REQUIRED net-new)
- **Why net-new:** no existing skill enforces "load only the relevant knowledge slice and refuse to proceed without it". Closest existing primitive (`_shared/before-starting.md`) is advisory, not gating.
- **What it does:** reads `docs/specs/stack-profile.md`, returns minimal `references/knowledge/domains/<stack>/{CAPABILITIES.md,details/<topic>.md}` slices the caller needs by tag.
- **Reuses:** the `references/knowledge/` Layer 1/2/3 protocol verbatim — no new knowledge schema; the existing `manage-learnings` skill for postmortem writeback; the existing `.svc/*.jsonl` append-only pattern (mirrors `pipeline-decisions.jsonl`) for the `knowledge-recall.jsonl` log.
- **Self-verify:** if recall returns 0 hits AND topic is in stack-profile's declared surface, FAIL with "knowledge gap — invoke `research`". Refuses to proceed without artifact. This is the **anti-rediscovery gate**.

### 6.2 `plan-blast-radius` (gate between plan-changeset and review-plan — REQUIRED net-new)
- **Why net-new:** `plan-changeset` produces the task graph; `review-plan` reviews it. Neither classifies destruction risk by SEV tier with a hard human-checkpoint gate. Inlining into either skill would conflate roles. (This is the only gate-class skill among the 3 net-new — `recall-stack-knowledge` is a recall gate, `track-topology-diff` is a snapshot tool.)
- **What it does:** reads `terraform plan` JSON / `helm diff`, classifies SEV-1 (destructive) / SEV-2 (stateful in-place) / SEV-3 (stateless in-place) / SEV-4 (additive). SEV-1/2 force `human_checkpoint: true`.
- **Reuses:** the existing `human_checkpoint` frontmatter field; the existing receipt schema (adds `sev_tier` field, no schema migration needed); `review-plan`'s fan-out mechanism downstream.

### 6.3 `track-topology-diff` (post-apply snapshot — REQUIRED net-new)
- **Why net-new:** `track-visuals` is image-diffing (Playwright screenshots). Topology diffing is structural JSON-graph diffing — different tooling, different output format. Reuse would require gutting `track-visuals`.
- **What it does:** snapshots `terraform state list` / `kubectl get all -A -o json`; structural diff against previous baseline.
- **Reuses:** the `track-visuals` baseline-vs-current convention (same directory layout under `docs/specs/topology-snapshots/`); the same hook timing as `track-visuals` (post-apply / post-execute).

## 7. Capabilities Delivered as Templates / Annexes / Modes (NO new skill files)

| Capability the rant implied we needed | Existing skill it extends | How |
|---|---|---|
| Topology design (resource graph, trust boundaries) | `design-ux` | New template `design-ux/templates/infra-topology.md`. design-ux already supports template-driven output. |
| Operator runbook design | `design-ui` | New template `design-ui/templates/infra-runbook.md`. design-ui's deliverable convention is reused — output IS the runbook. |
| Chaos / failure-mode tests | `test-journeys` | New template `test-journeys/templates/chaos.feature.md`. test-journeys already produces `.feature.md` BDD files; chaos is just a different given/when/then vocabulary. |
| FinOps cost gate | `review-security` | New mode `review-security --mode=cost-impact` with rules from `references/knowledge/domains/<stack>/policy/cost.yaml`. Same review-skill plumbing, different rule set. Avoids inventing `review-cost-impact` as a parallel skill. |
| Policy-as-code (OPA/Checkov/tfsec/kube-score) | `review-security` | Same review-security skill, additional rule packs under `references/knowledge/domains/<stack>/policy/`. Standard policy gates ARE security gates. |
| Infra spec sections (SLO/RTO/RPO/blast-radius/cost-envelope/IAM-scope) | `write-spec` | New template `write-spec/templates/infra-feature.md`. |
| Provider/module/state-backend/secrets choices | `design-tech` | New annex `design-tech/references/infra-tech-design.md`. |
| Dry-run-first apply contract | `execute-changeset` | New mode flag `execute-changeset --infra` (dry-run mandatory; receipt gains `dry_run_artifact_path`). No new skill. |
| Post-apply state-graph match | `verify-promotion` | New mode flag `verify-promotion --infra` (accepts `terraform state list` / `kubectl get` as the verification artifact). |
| Continuous drift watch | `drift` lane (existing) + `manage-learnings` | Schedule via existing `/schedule` skill; drift lane writes findings via `manage-learnings` so recurring drifts surface as learnings, not WIs. |
| Incident postmortem feedback into knowledge | `manage-learnings` (existing) | `infra-incident` lane closes with a mandatory `manage-learnings` write into `references/knowledge/domains/<stack>/incidents/` — same class doesn't recur because the next session's `recall-stack-knowledge` surfaces it. |
| State-lock & environment guard | `scripts/worktree.sh` (existing) | Extend `worktree.sh guard` to read a `.svc/worktree-env.json` declaring the bound env (`dev`/`staging`/`prod`); refuses execute-changeset apply if mismatch. Reuses the existing worktree-isolation model. |
| Secret-redaction in receipts | Existing `PostToolUse` hook plumbing | Add a redaction pass to the existing receipt-write hook. No new hook event. |
| Provider/module version pinning enforcement | Tier-1 validator pattern | New `test-framework/evals/tier-1/validate-infra-version-pins.sh` mirroring existing tier-1 validators. |
| Plan-apply freshness (refuse stale plans) | `execute-changeset` preflight | Read receipt timestamp from prior `plan-changeset` step; refuse if older than threshold from stack-profile. Uses existing receipt schema. |
| Cost regression baseline | `.svc/` append-only log | New `.svc/cost-baseline.jsonl` mirroring `pipeline-decisions.jsonl` shape. Reuses log-tail tooling already wired for the other `.jsonl` files. |
| Cross-stack dependency awareness | `.svc/lane-tasks-<WI>.json` blocker mechanism | Existing blocker field is reused to express "module B blocks until module A applied". No new graph format. |
| Idempotency assertion per skill | SKILL.md frontmatter (existing) | New optional field `idempotent: true|false|once-only` already fits the frontmatter contract; tier-1 validator enforces it's declared. |
| **Infra capability inventory** | `plan-capabilities` (existing skill, NEW mode) | New mode flag `plan-capabilities --mode=infra` with infra-specific inventory: IaC tool, cloud(s), k8s flavor, observability, secret manager, CI/CD platform, policy engine, cost tool, chaos tool, migration tool family. Default mode (`--mode=regular`) unchanged. Same skill, same output schema (`docs/specs/capability-plan.md`), additional sections gated by mode. Auto-detected when stack-profile declares `class: infra`. |
| **Mixed-mode inventory** | `plan-capabilities` (existing skill, NEW mode) | New mode flag `plan-capabilities --mode=mixed` for repos with both app + infra surface. Produces a unified plan with both regular and infra inventory sections; lets a single WI inventory both axes. |

## 8. Anti-Rediscovery Artifacts (concrete files the Spine produces)

Subsumed by the Knowledge Spine in §3, listed here as a build checklist of the new on-disk artifacts. All persist to disk so they survive context compaction.

| Artifact | Layer | Producer | Consumer |
|---|---|---|---|
| `docs/specs/stack-profile.md` | L5 identity | `mine-builder` extension (one-time) | `recall-stack-knowledge` gate |
| `.svc/spec-index.json` | L2 project intent (index) | PostToolUse hook on `docs/specs/**/*.md` | every skill that reads specs |
| `.svc/knowledge-recall.jsonl` | observability | `recall-stack-knowledge` gate | `validate-no-rediscovery.sh` tier-1 |
| `references/knowledge/domains/{terraform,kubernetes,aws-infra,…}/` | L1 world | `research` skill (auto-spawned via gap loop) | `recall-stack-knowledge` gate |
| `references/knowledge/domains/<stack>/incidents/<date>-<slug>.md` | L3 experiential | `infra-incident` lane closeout via `manage-learnings` | next infra session's recall |
| `validate-no-rediscovery.sh` | enforcement | tier-1 evals | CI / lint |
| `validate-infra-spec-dimensions.sh` | enforcement | tier-1 evals | enforces FinOps/Security/Scalability sections present in infra specs (§17.4) |
| `validate-infra-version-pins.sh` | enforcement | tier-1 evals | enforces pinned provider/module/chart versions in infra repos (§7) |
| `.svc/cost-baseline.jsonl`, `.svc/security-baseline.jsonl`, `.svc/scalability-baseline.jsonl` | continuous | review gates at phases 9/14/16 | regression detection across the three §17 dimensions |

## 9. Routing & Detection

`route-workflow/references/intent-routing.md` gains rows:

| Phrase signal | Lane |
|---|---|
| "set up terraform", "bootstrap a k8s cluster", "scaffold pulumi", "new infra repo" | `infra-greenfield` |
| "add a module", "scale this", "add a queue", "wire a new pipeline stage" (in infra repo) | `infra-feature` |
| "migrate to CAST AI", "GHES to GHEC", "Jenkins to GH Actions", "Datadog to New Relic", "Heroku to Render", "CloudFormation to Terraform", "AWS to GCP", "from X to Y", "replace X with Y", "cutover", "decommission" | `infra-migration` |
| "production is down", "rollback the deploy", "tighten this IAM now", incident ID | `infra-incident` |
| "we're spending too much", "rightsize", "kill unused", "FinOps" | `infra-cost-optimization` |

Class detection signal (added to `route-workflow/references/routing-rules.md`):
- Top-level `*.tf`, `Chart.yaml`, `pulumi.yaml`, `terragrunt.hcl`, or `infra/` directory → infra-class repo by default
- Mixed (app + `infra/` subtree) → `stack-profile.md` declares which lane the **current change** belongs to; ambiguous → ask once

## 10. Provisioning Changes

Per the WI-137 shared-content-dir meta-rule, no new shared dirs needed. New skill dirs (5) get listed in:
- `skills-manifest.json` → `includedSkills`, `corePackForRouting` (only `recall-stack-knowledge` joins core; the 4 phase-skills are infra-pack)
- `README.md`, `EXTERNAL_ADDONS.md`, `REPO_MODES.md`, `route-workflow/SKILL.md` core-pack section

New knowledge domains (`terraform/`, `kubernetes/`, `aws-infra/`, etc.) require **zero** manifest changes — `references/knowledge/domains/` is already a directory tree, not an enumerated list.

## 11. Migration / Rollout

**Spine first, lanes second** — every phase delivers value to existing app lanes before adding any infra-specific surface.

1. **Phase A — Spine foundation (PR 1):** add `recall-stack-knowledge` skill + `.svc/spec-index.json` PostToolUse hook + `validate-no-rediscovery.sh` tier-1 validator. Add `requires_topics` / `produces_topics` / `recall_depth` to skill frontmatter contract (optional, default behavior unchanged). Recall is **advisory** — gate warns but doesn't block. **Zero new lanes.** Existing 7 lanes immediately benefit from spec-index and predictive recall.
2. **Phase B — Spine activation (PR 2):** add `stack-profile.md` template via `mine-builder` extension. Populate first knowledge domain (`terraform/` or `kubernetes/` per first real infra project). Wire gap → research auto-loop. Recall remains advisory.
3. **Phase C — Infra lanes (PR 3):** add 5 new lane definitions, intent-routing rows, change-type signals. Routes to existing skills with new templates / annexes / mode flags from §7. Still no new skills beyond `recall-stack-knowledge`.
4. **Phase D — Infra-specific gates (PR 4–5):** add `plan-blast-radius` and `track-topology-diff` (the remaining 2 net-new skills). Each PR ships with tier-1 evaluator + stub fixture infra repo for tier-2 behavioral.
5. **Phase E — Recall becomes REQUIRED:** flip the recall gate from advisory to blocking once ≥3 knowledge domains are populated and the gap → research loop has demonstrated auto-healing on at least one real session. Tier-1 validator enforces.

Each phase passes through the framework lane (`framework`) using `plan-changeset` per `rules/plan-changeset-trigger.md` (every phase touches contracts: skills-manifest, lane-model, hook wiring, frontmatter schema).

## 12. Risks

| Risk | Mitigation |
|---|---|
| Skill explosion | Reuse-first principle (§7) caps net-new at 3. Every new capability must justify why no existing primitive fits. |
| Stack-profile becomes stale | Tier-1 validator: warn if `stack-profile.md` older than 90 days OR if declared provider versions don't match repo `*.tf` / `Chart.yaml` / `package.json`. |
| Spec-index hook breaks on hosts without PostToolUse | Hook is best-effort; skills fall back to `Read` if index missing. Per `rules/host-capability-research.md`, Kimi/Codex/Gemini docs verified before wiring. |
| Recall-gate false negative — knowledge exists but recall misses it | Gap → research auto-loop is the safety net: a 0-hit recall spawns research; if research finds the fact already exists in the Spine, it logs the index miss for tier-1 enforcement. The miss itself becomes a learning. |
| Recall-gate false positive — knowledge stale, agent acts on outdated fact | Every Spine entry carries `last_modified` + freshness rule (`references/knowledge-protocol.md`). `rules/learning-preload.md` already mandates state verification before acting on memory; extended to Spine retrievals. |
| Frontmatter `requires_topics` proliferation — every skill declares everything | Tier-1 validator caps `requires_topics[]` at 8 per skill; forces authors to choose. `recall_depth: layer-2` default keeps token budget bounded. |
| Knowledge-domain pages become outdated | Existing `references/knowledge-protocol.md` freshness cadence applies. Infra domains inherit. |
| Cost-gate false-positives block trivial changes | Gate threshold in stack-profile; default 10% of envelope; human-checkpoint bypass. |
| Drift between proposal and implementation | Proposal commits to artifact paths and skill names. Any deviation in PRs updates this file or marks it superseded. |

## 13. Success Criteria

**Knowledge Spine (load-bearing — must hit BEFORE Phase E):**
- **Recall hit-rate ≥80%** — `.svc/knowledge-recall.jsonl` shows ≥80% of `requires_topics` lookups served from the Spine vs `research` skill invocations, measured over a 30-day window after Phase B.
- **Spec-reading token reduction ≥60%** — tier-2 eval: token count for "read section X of feature spec Y" before vs after spec-index.
- **Zero recurring rediscoveries** — `validate-no-rediscovery.sh` reports zero `(skill, topic)` pairs recalled >3 times in 24h after Phase C.
- **Gap → research loop demonstrably closed at least one gap autonomously** — log entry showing `recall MISS → research SPAWNED → knowledge WRITTEN → next session HIT`.

**Infra lanes:**
- An infra repo (e.g., a Terraform monorepo) goes from `capture-idea` to `verify-promotion` end-to-end via `route-workflow` without manual lane override.
- Zero regressions on the existing 7 lanes (existing tier-1 + tier-2 evals stay green throughout all phases).
- At least one real `infra-incident` postmortem flows through `manage-learnings` and gets surfaced in the next infra session's recall.

**Reuse discipline:**
- Net-new skill count ≤3 (the cap committed in §6). Any 4th net-new skill requires a superseding proposal.

## 14. Open Questions

1. Where does Pulumi/CDK code-defined infra fit? It IS code, so `design-tech` covers architecture, but plan/execute still want the synthesized state diff. **Treat as infra-class regardless of language** — the artifact (state) is what matters.
2. Should chaos tests (the `test-journeys` chaos template) block on missing chaos tooling, or warn? **Warn** — many shops don't have chaos infra; shouldn't gate adoption on it. Template emits "MANUAL chaos drill checklist" fallback when no tool detected.
3. Database major-version migrations with backfill (e.g., Postgres 14→16 with logical replication) — fit `infra-migration` or warrant a 6th `infra-data-migration` lane? **Defer until 2nd encounter** — single instance handled by `infra-migration` with manual phase adaptation; pattern-recurrence triggers a follow-up proposal.
4. The `dimensions: [finops, security, scalability]` opt-in tag for app-lane WIs (§15.1) — read from where? **Proposed:** the WI frontmatter in `docs/specs/work-items/<WI>.md`. `route-workflow` reads it and signals downstream skills to apply §17.4 mandatory sections. Tier-1 validator enforces the sections are present when the tag is set.

---

## 15. Guarantee — Software Dev Unchanged, Infra Superior to Default Claude Code

This proposal commits to two simultaneous outcomes:

### 15.1 Software dev: functions as-is (zero regression) — capabilities extended, never lost

**Extension principle:** every existing skill, lane, hook, validator, and convention keeps working exactly as today. New capabilities are layered ON TOP via opt-in mechanisms. Nothing is removed, deprecated, or behavior-changed. Specifically:

- All existing 7 lanes (greenfield, brownfield-conversion, brownfield-feature, bugfix, drift, refactor, framework) keep the same skill chains.
- All existing skill SKILL.md files are unchanged in behavior. New frontmatter fields (`requires_topics`, `produces_topics`, `recall_depth`, `idempotent`) are **optional with default behavior preserved** when absent.
- The Knowledge Spine is **advisory-only through Phase D** for app lanes — it warns, never blocks. Recall becomes mandatory only for `infra-*` lanes in Phase E.
- Existing tier-1 + tier-2 evals stay green throughout all phases (committed as a Success Criterion in §13).
- App lanes get **upside only**: spec-index reduces spec-reading token cost ≥60%; predictive recall surfaces relevant learnings without being asked. No new ceremony.
- A WI that today routes to `brownfield-feature` keeps routing to `brownfield-feature`. A WI that today routes to `bugfix` keeps routing to `bugfix`. The new infra lanes only catch WIs that **today** would have been force-fit into an inappropriate lane or routed manually around svc.
- Cross-cutting dimensions (FinOps/Security/Scalability §17) are **mandatory for `infra-*` lanes only**; they are **opt-in** for sensitive app features (auth, billing, data-export) via a per-WI tag `dimensions: [finops, security, scalability]`. Default app-lane behavior unchanged.

### 15.2 Infra: superior to default Claude Code

A "default Claude Code" session on infra means: agent reads files ad-hoc, runs `terraform plan` or `kubectl apply` when asked, no structured spec, no blast-radius gate, no cost gate, no chaos test, no postmortem feedback, no env guard, no provider-pin enforcement, no recall of prior incidents. svc + this proposal closes every gap:

| Capability | Default Claude Code | svc with this proposal |
|---|---|---|
| Stack-specific knowledge load | Re-derived per session from web search | `recall-stack-knowledge` gate fetches from Spine; gap → research auto-fills |
| Infra spec (SLO/RTO/RPO/blast-radius/cost-envelope/IAM-scope) | Ad-hoc or absent | `write-spec` infra template — mandatory sections |
| Resource topology + trust boundaries | Inline mermaid if asked | `design-ux` infra-topology template — required artifact |
| Operator runbook | Optional, often skipped | `design-ui` infra-runbook template — required artifact |
| IAM / policy review | One-shot prompt | `review-security` with policy packs (OPA/Checkov/tfsec/kube-score), pulled forward to design phase |
| Plan synthesis | `terraform plan` output read directly | Same plan, wrapped in task graph + receipts + freshness gate |
| Blast-radius classification | None — agent guesses risk | `plan-blast-radius` skill: SEV-1/2 force human checkpoint regardless of autorun |
| Cost-impact gate | None | `review-security --mode=cost-impact` with envelope from stack-profile |
| Dry-run-first apply | Optional, by user discipline | `execute-changeset --infra` mode — dry-run mandatory, attached to receipt |
| Post-apply state verification | Optional smoke | `verify-promotion --infra` — state-graph match against plan |
| Chaos / failure-mode tests | Not invoked unless asked | `test-journeys` chaos templates, scheduled or per-WI |
| Topology drift detection | Manual `terraform plan -refresh` | `track-topology-diff` snapshot + diff against baseline |
| Continuous drift watch | None | Existing `drift` lane scheduled via `/schedule`, findings → `manage-learnings` |
| Incident postmortem feedback | Lost when session ends | `infra-incident` lane closes with mandatory `manage-learnings` write to `domains/<stack>/incidents/` — surfaces in next session's recall |
| State-lock / env guard | None — can apply prod from dev branch | Extended `worktree.sh guard` reads `.svc/worktree-env.json`, refuses cross-env apply |
| Secret redaction in logs | None | Existing PostToolUse hook adds redaction pass on receipt write |
| Provider/module version pinning | Inconsistent | Tier-1 validator `validate-infra-version-pins.sh` |
| Plan-apply staleness | None — can apply hour-old plan against drifted state | `execute-changeset` preflight refuses plans older than threshold from stack-profile |
| Cost regression baseline | None | `.svc/cost-baseline.jsonl` — per-WI cost delta tracked over time |
| Cross-stack dependency awareness | Manual | Existing `lane-tasks-<WI>.json` blocker field expresses module-A → module-B order |
| Idempotency assertion | Implicit | Optional frontmatter `idempotent` field, tier-1 enforced |
| Decision auditability | Chat scrollback | `.svc/pipeline-decisions.jsonl` mechanical/taste/user classification per decision |
| Knowledge amplification across sessions | None — model is frozen | Spine grows with every session; gap → research auto-loop closes blind spots |

### 15.3 The asymmetry

Default Claude Code on infra is bounded by the model's training cutoff and the user's prompt discipline. svc + this proposal is bounded by the union of (a) the model's capabilities and (b) every learning, decision, postmortem, and stack fact the project has ever recorded. The first ceiling is fixed; the second compounds. After three months on the same infra repo, svc's recall surface has grown by every incident, every cost overrun, every IAM near-miss, every drift event — none of which the default agent retains. **That is the superiority claim, and it is measurable via §13's Success Criteria.**

---

## 16. Worked Examples — End-to-End Delivery

Two real DevOps deliveries traced through svc + this proposal, phase by phase. These are the auditable answer to "can I actually deliver work with this?".

### 16.1 Worked example A — CAST AI migration on EKS

**Goal:** replace native cluster autoscaler + manual node-pool management with CAST AI's autoscaler + workload optimizer on a production EKS cluster.

**Lane:** `infra-migration`. **Stack-profile declares:** cloud=aws, k8s=eks, iac=terraform, observability=datadog, criticality=tier-1.

| Phase | Skill | Concrete output |
|---|---|---|
| 0 — pre-lane recall | `recall-stack-knowledge` | Pulls `domains/{terraform,kubernetes,aws-eks,castai}/CAPABILITIES.md`. If `castai/` missing → gap → research auto-spawns. |
| 1 — capture | `capture-idea` | "Replace cluster autoscaler with CAST AI; goal: -30% compute cost, no SLO regression" |
| 2 — spec | `write-spec` (infra template) | SLO: p95 pod-schedule latency <30s; RTO: 5min if CAST AI agent fails; cost-envelope: -20% min savings; IAM scope: CAST AI cross-account role; blast-radius: cluster-wide |
| 3 — topology | `design-ux` (infra-topology template) | Mermaid: current CAS → target CAST AI agent + workload optimizer + cross-account IAM trust to CAST AI's AWS account |
| 4 — runbook | `design-ui` (infra-runbook template) | Alert wiring (CAST AI agent down, savings regression), dashboards, manual disable procedure |
| 5 — tech design | `design-tech` (infra annex) | `castai/eks-cluster-templates/aws` Terraform module v7.x pinned, helm chart `castai-agent` v0.x pinned, secret rotation strategy |
| **5a — source assessment** | `audit-coverage` against source | `source-state.md`: 47 nodes across 3 ASGs, current CAS config, current overprovisioning factor 1.4, current $14.2k/mo |
| **5b — target design** | (template) | `target-state.md` + `mapping.md`: ASG-1 → CAST AI node template "general", ASG-2 → "memory-optimized", ASG-3 retained for stateful workloads |
| **5c — cutover plan** | `design-ui` cutover-runbook variant | Phase 1 onboarding (read-only mode, 1 week), Phase 2 single namespace (dev, 3 days soak), Phase 3 staging (1 week soak), Phase 4 prod 10% → 50% → 100% over 2 weeks. Each phase: rollback = pause CAST AI + re-enable CAS. |
| 6 — IAM/policy review | `review-security` (with CAST AI policy pack) | Verifies cross-account role scope, no overly broad perms, no secrets in helm values |
| 7 — plan synthesis | `plan-changeset` | `terraform plan -out=tfplan` for IAM + helm release; task graph generated from resource list |
| 8 — blast-radius | `plan-blast-radius` | SEV-2 (in-place stateful: cluster IAM trust modification) → human checkpoint forced |
| 9 — cost-impact | `review-security --mode=cost-impact` | Infracost: net -$3.8k/mo direct, plus CAST AI subscription. Within envelope ✓ |
| 10 — plan review | `review-plan` | Aggregates findings; flags one HIGH (recommend canary namespace before staging) |
| 11 — dry-run | `execute-changeset --infra --dry-run` | Plan attached to receipt; nothing applied |
| 12 — apply | `execute-changeset` | Per-cutover-phase apply; receipts logged |
| 13 — state verify | `verify-promotion --infra` | `kubectl get pods -A` matches plan; CAST AI agent reporting; cross-account trust verified |
| 14 — smoke/SLO | `review-gate` | Datadog SLO check: p95 schedule latency stays <30s ✓ |
| 15 — topology snapshot | `track-topology-diff` | Snapshot 1: pre-cutover. Snapshot N: post-cutover. Diff archived for blast-radius baselines. |
| 16 — chaos | `test-journeys` (chaos template) | "When CAST AI agent killed, Then native scheduler takes over within 60s and SLO holds" — verified |
| 17 — audit | `audit-implementation` | Confirms all spec sections satisfied: cost target met, SLO held, IAM scoped |
| 18 — drift watch | `drift` lane scheduled via `/schedule` | Weekly drift check on CAST AI config + cluster spec |
| **decommission** | (migration-only) | Old CAS removed, ASG count reduced; `decommission-receipt.md` archived; learning written: "CAST AI on EKS — onboarding-mode soak should be ≥1 week before namespace cutover" |

**What svc does that you can't get from default Claude Code:** the cutover plan is mandatory and reviewable, the SEV-2 blast-radius gate forces human approval at the IAM-trust step, the chaos test runs after cutover (not skipped), and the post-cutover learning surfaces in the next CAST AI session anywhere.

### 16.2 Worked example B — GitHub org-to-org migration

**Goal:** migrate 47 repos from `acme-corp` org to `acme-platform` org with full history, issues, PRs, Actions, secrets, branch protection rules, teams, environments. Cutover window: 1 weekend.

**Lane:** `infra-migration`. **Stack-profile declares:** cloud=github, vcs=github, ci=github-actions, criticality=tier-1 (engineering blocker if broken).

| Phase | Skill | Concrete output |
|---|---|---|
| 0 — recall | `recall-stack-knowledge` | Pulls `domains/{github,gh-cli,gh-migrator,github-actions}/CAPABILITIES.md`; gap → research populates `domains/gh-migrator/` if missing |
| 1 — capture | `capture-idea` | Personas: every developer in 47 repos, security/compliance, build engineers |
| 2 — spec | `write-spec` infra template | SLO: zero broken builds post-cutover; RTO: 4h if cutover fails; cost-envelope: GitHub seats unchanged; IAM: SAML SSO + team mapping; blast-radius: 47 repos × N developers |
| 3 — topology | `design-ux` infra-topology | Source org (teams, repos, secrets, environments) ↔ target org mapping diagram |
| 4 — runbook | `design-ui` runbook | Alert: webhook failures, broken Actions, missing branch protection. Manual procedures for stuck migrations. |
| 5 — tech design | `design-tech` | `gh-migrator` GEI version pinned, mannequin reclamation strategy, GitHub App for inter-org webhook bridging |
| **5a — source assessment** | `audit-coverage` against `acme-corp` | `source-state.md`: 47 repos, 312 branch protection rules, 89 environments, 1,247 Actions secrets, 23 teams, 4 SAML group mappings, 18 webhooks, 9 GitHub Apps |
| **5b — target design** | (template) | `mapping.md`: per-repo target name (some renamed), team mapping table, secret-rotation list (all rotated post-cutover), webhook re-registration list |
| **5c — cutover plan** | `design-ui` cutover-runbook | Phase 1 (Friday 18:00): freeze writes on `acme-corp`. Phase 2: dry-run gh-migrator on 3 pilot repos, validate. Phase 3: full migration in batches of 10. Phase 4: re-attach branch protection + re-create secrets via Actions API. Phase 5: rotate all secrets. Phase 6 (Sunday 18:00): SAML cutover, repoint local clones. Rollback: revert SAML, unfreeze source org. |
| 6 — IAM/policy review | `review-security` | SAML group mappings, secret scopes, branch protection completeness |
| 7 — plan synthesis | `plan-changeset` | Task graph: 47 repos × ~6 sub-steps each, parallelizable in batches |
| 8 — blast-radius | `plan-blast-radius` | SEV-1 (destructive on source org freeze + irreversible mannequin reclamation) → human checkpoint forced at every batch boundary |
| 9 — cost-impact | `review-security --mode=cost-impact` | Seat costs unchanged ✓ |
| 10 — plan review | `review-plan` | Flags HIGH: rotate secrets within 24h post-cutover, not 48h |
| 11 — dry-run | `execute-changeset --infra --dry-run` | gh-migrator with `--ghes-source-url` dry-run on 3 pilot repos |
| 12 — apply | `execute-changeset` | Per-batch apply; receipt per repo (migration log, validation diff) |
| 13 — state verify | `verify-promotion --infra` | Each repo: branch count match, branch protection rule count match, environments count match, Actions workflows present |
| 14 — smoke/SLO | `review-gate` | Trigger one Actions workflow per repo; assert green |
| 15 — topology snapshot | `track-topology-diff` | Source vs target org structural diff; archived |
| 16 — chaos | `test-journeys` chaos | "When developer pushes to old remote URL, Then redirect or clear error" — verified |
| 17 — audit | `audit-implementation` | All 47 repos verified; all 1,247 secrets rotated; all teams mapped |
| 18 — drift watch | `drift` lane scheduled | Weekly check: any repo missing branch protection, any team drift |
| **decommission** | (migration-only) | Source `acme-corp` org archived after 30-day soak; webhooks removed; mannequin reclamation closed; learning written: "gh-migrator: branch protection rules don't migrate — must be re-applied via API; budget +2h for this per 50 repos" |

**What svc does that you can't get from default Claude Code:** the source-state inventory is mandatory and complete (no "we forgot about webhooks"), the SEV-1 blast-radius gate forces a checkpoint at every irreversible step (mannequin reclamation), the per-repo verify-promotion catches partial migrations, and the post-migration learning means the next gh-migrator run anywhere starts from "branch protection doesn't migrate, budget +2h" instead of rediscovering it.

### 16.3 What's NOT delivered by this proposal alone

To be honest about scope:
- **svc orchestrates, does not execute the migration tooling.** You still need `gh-migrator`, CAST AI's CLI, Terraform, kubectl, etc., installed and authenticated. The framework wraps them in receipts + gates + verification, it doesn't replace them.
- **First migration in a new domain pays the knowledge tax once.** The first CAST AI migration spawns research to populate `domains/castai/`. The second migration anywhere reaps the benefit. This is the Spine working as designed.
- **Highly bespoke migrations may need a 6th infra lane.** Database schema migrations with backfill (e.g., Postgres major-version upgrade with logical replication) have their own shape. If they recur, propose an `infra-data-migration` lane in a follow-up. For now, `infra-migration` covers them at the cost of some manual phase adaptation.

---

## 17. Three Cross-Cutting Dimensions — FinOps, Security, Scalability (Baked In, Not Bolted On)

Every infra change MUST be evaluated against three dimensions at every relevant phase. These are not gates that fire once — they are **continuous concerns** woven into the stack-profile, the spec, the design, the plan, and every review. A change that passes blast-radius but degrades any of the three dimensions is **NOT a passing change**.

### 17.1 The three dimensions defined

| Dimension | What it measures | What "passing" means |
|---|---|---|
| **FinOps** | Monthly cost, cost trajectory, cost per unit of business value (per-request, per-tenant, per-feature) | Within stack-profile envelope; no regression vs `.svc/cost-baseline.jsonl`; trajectory bounded |
| **Security** | Attack surface, blast radius if compromised, IAM scope, secret handling, supply chain, compliance posture | OPA/Checkov/tfsec/kube-score policy packs pass; IAM principle-of-least-privilege satisfied; no policy regressions vs `.svc/security-baseline.jsonl` |
| **Scalability** | Capacity headroom, latency under load, failure-mode behavior, multi-AZ/region resilience, cold-start cost | SLO holds at declared peak load; failure modes documented + tested via chaos; no headroom regression vs `.svc/scalability-baseline.jsonl` |

### 17.2 Where each dimension is declared (stack-profile)

`docs/specs/stack-profile.md` gains three mandatory sections:

```yaml
finops:
  monthly_envelope_usd: 18000
  per_unit_target: { metric: "per-1k-requests", usd_max: 0.04 }
  cost_alert_threshold_pct: 10
  baseline_file: .svc/cost-baseline.jsonl
security:
  compliance_frameworks: [SOC2, GDPR]
  policy_packs: [tfsec/aws, checkov/k8s, opa/iam-least-priv]
  secret_manager: aws-secrets-manager
  supply_chain: { signed_images_required: true, sbom_required: true }
  baseline_file: .svc/security-baseline.jsonl
scalability:
  peak_load: { rps: 4500, p95_latency_ms: 250 }
  multi_az: required
  multi_region: { rto_min: 30, rpo_min: 5 }
  capacity_headroom_pct_min: 30
  baseline_file: .svc/scalability-baseline.jsonl
```

The Spine surfaces these as Layer 5 (identity) facts; every infra-aware skill receives them via `recall-stack-knowledge` without asking.

### 17.3 Where each dimension is evaluated (every relevant phase)

| Phase | FinOps check | Security check | Scalability check |
|---|---|---|---|
| 2 — spec | Cost-envelope section mandatory | IAM-scope + threat-model section mandatory | SLO + capacity-headroom + failure-mode section mandatory |
| 3 — topology | Per-resource cost-class tagged | Trust boundaries + data-flow classifications | Failure-domain boundaries (AZ/region) drawn |
| 5 — tech design | Module choice justified vs cost | Module choice justified vs CVE history + provenance | Module choice justified vs known scaling limits |
| 6 — IAM/policy review | (defers to 9) | **Primary security gate** — policy packs run | (defers to 16) |
| 8 — blast-radius | Cost blast (e.g., NAT GW × 3 AZ × 3 envs) flagged | Security blast (IAM trust changes, exposed surfaces) flagged | Scalability blast (capacity reduction during apply) flagged |
| 9 — cost-impact | **Primary FinOps gate** — Infracost + envelope check | Cost-of-security regression (e.g., encryption-at-rest cost) tracked | Cost-of-scale check (over-provisioned waste vs head-room min) |
| 11 — dry-run | Plan delta vs cost baseline | Plan diff scanned for security regressions | Plan diff scanned for capacity regressions |
| 14 — smoke/SLO | Per-request cost emitted to baseline | Runtime IAM probe (no over-permissive role created) | **Primary scalability gate** — SLO under synthetic peak load |
| 16 — chaos | Cost behavior under failure (failover spend) | Security behavior under failure (no IAM degradation) | **Primary resilience gate** — failure-injection vs RTO/RPO |
| 17 — audit | All three baselines updated; deltas signed off | All three baselines updated | All three baselines updated |
| 18 — drift watch | Cost drift alerts | Policy drift alerts | Capacity drift alerts |

**Three dedicated baselines** (`cost-baseline.jsonl`, `security-baseline.jsonl`, `scalability-baseline.jsonl`) all follow the existing `.svc/*.jsonl` append-only pattern. No new storage primitive — same shape as `pipeline-decisions.jsonl`. A regression on any dimension is logged to its baseline and surfaced via `recall-stack-knowledge` to the next session.

### 17.4 Mandatory spec sections (write-spec infra template)

Every infra spec MUST include all three sections. Tier-1 validator `validate-infra-spec-dimensions.sh` enforces presence and non-empty content:

```markdown
## FinOps
**Cost envelope:** $X/mo | **Per-unit target:** $Y per 1k requests
**Expected delta from baseline:** ±$Z
**Justification:** ...

## Security
**Threat model:** STRIDE summary + top 3 risks
**IAM scope:** principal → resource → action matrix (minimum viable)
**Compliance impact:** SOC2/GDPR/HIPAA controls touched
**Supply chain:** signed images? SBOM? pinned versions?

## Scalability
**Peak load contract:** RPS + p95 latency + concurrency
**Capacity headroom:** % minimum at peak
**Failure modes:** AZ loss, region loss, dependency loss → expected behavior
**RTO / RPO:** declared values
```

A spec without these three sections fails the gate. No infra change progresses without all three answered.

### 17.5 Why baked-in beats bolted-on

A bolted-on cost gate fires once, late, and is easy to argue around ("we'll optimize later"). A baked-in dimension is in the spec template, the design template, the runbook, every review, and the audit — there is **no path** to a merged change that didn't answer all three. The user complaint that drove this proposal — rediscovering the same things — applies equally to "remembering to check cost / security / scale". Baking them into every artifact means agents never need to remember; the templates and gates remember for them.

### 17.6 Worked examples §16 evaluated against all three dimensions

- **CAST AI migration:** FinOps primary goal (-30% compute cost target), Security secondary (cross-account IAM trust scope), Scalability secondary (SLO held under autoscaler swap, chaos test on agent failure). All three dimensions show in the spec, the cutover plan, the chaos test, and the post-migration audit. The decommission learning ("CAST AI onboarding-mode soak ≥1 week") is a Scalability fact filed under `domains/castai/` for future runs.
- **GitHub org migration:** Security primary (1,247 secret rotations, branch protection completeness, SAML cutover), FinOps neutral (seat costs unchanged but tracked anyway), Scalability secondary (zero broken builds = capacity-equivalent post-cutover). The "branch protection doesn't migrate" learning is a Security fact filed under `domains/gh-migrator/`.

Every future migration in either domain starts with these dimensions surfaced, not rediscovered.

---

**Next:** awaiting builder approval. If approved, open **WI-SPINE-001** (Phase A — `recall-stack-knowledge` skill + `.svc/spec-index.json` hook + frontmatter contract extension + `validate-no-rediscovery.sh` tier-1 validator) as the first plan-changeset under the `framework` lane. Infra lanes follow once the Spine is active.
