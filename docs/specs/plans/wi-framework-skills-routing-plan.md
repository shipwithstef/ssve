# WI-FW-SKILLS-ROUTING-01 — Intelligent Skill Routing Plan

**Status:** Proposed

**Work item:** `WI-FW-SKILLS-ROUTING-01`

**Plan authority:** svc framework owner

**Implementation authority:** central `seriousvibecoding` installation, not this consumer checkout

**As of:** 2026-08-25

## 1. Outcome

Build a host-portable skill router that discovers the smallest useful capability set just in time, automatically invokes only high-confidence optional skills, and deterministically enforces critical domain rules.

The target is not “put every skill in every prompt.” It is a four-level disclosure system:

1. keep a tiny invariant routing and governance kernel resident;
2. retrieve compact skill cards for the current intent and repository state;
3. load one selected skill body when work begins;
4. load supporting references only when that skill requires them.

Semantic retrieval is an accelerator for optional capability discovery. It is never the sole mechanism for selecting required workflow skills or enforcing safety, compliance, repository, environment, and domain rules.

## 2. Evidence and design constraints

### 2.1 Local framework evidence

The framework already contains most of the primitives needed for a hybrid design:

- `skills-manifest.json` is the canonical inventory and already distinguishes routing packs and rule injection modes.
- `concerns/REGISTRY.json` maps repository evidence such as paths, diffs, packages, and environments to required rules and skills.
- `hooks/svc-rule-injector.mjs` performs deterministic signal matching and bounded rule packing.
- `hooks/codex/svc-codex-skill-load-enforcer.mjs` proves that skill-load receipts can be enforced for active work.
- `scripts/resolve-skill-hint.mjs` and `scripts/diagnose-capability-blocker.mjs` provide exact and lexical precedents, but their hard-coded vocabularies do not scale to the full catalog.
- WI-365 established catalog budgeting, description dieting, and a router fallback; WI-377 established plugin partitioning. This WI should extend those decisions, not replace native host discovery or reintroduce the full catalog into startup context.

The prior catalog research also identified the main semantic-retrieval hazards: vocabulary mismatch, bridge-tool blindness, silent fallback, and stale embeddings. Those hazards rule out semantic-only routing.

### 2.2 External evidence

- OpenAI Codex skills already use progressive disclosure: startup context contains skill metadata, while the full `SKILL.md` is loaded after selection. Codex may shorten descriptions or omit skills when the catalog exceeds its initial allowance. Descriptions therefore remain part of the product surface, even after a framework router is added. See [Build skills for ChatGPT and Codex](https://developers.openai.com/codex/skills).
- OpenAI recommends lean agent prompts and exposing only relevant tools. Its internal examples report materially lower token use and cost with leaner prompts, but those figures are directional and must be revalidated on svc workloads. See [Latest model guide — favor leaner prompts](https://developers.openai.com/api/docs/guides/latest-model).
- The Agent Skills specification formalizes three-level progressive disclosure and recommends keeping the main skill body below 5,000 tokens with supporting resources loaded on demand. See [Agent Skills specification](https://agentskills.io/specification).
- Anthropic reports the same operational pattern: evaluate metadata first, load the skill body only after activation, and fetch references as needed. It also emphasizes trigger-description evaluation. See [Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills).
- BiasBusters finds that semantic alignment and tool position affect selection. This reinforces deterministic pins for critical capabilities and explicit evaluation of catalog order and description wording. See [BiasBusters, ICLR 2026](https://proceedings.iclr.cc/paper_files/paper/2026/hash/a79875cc0d046ce7ce65f03f3affaa9e-Abstract-Conference.html).
- Recent semantic-tool-discovery results are promising but limited to a small, static benchmark. They justify a shadow experiment, not production acceptance thresholds. See [Semantic Tool Discovery for Agentic AI](https://arxiv.org/abs/2603.20313).

## 3. Scope

### In scope

- a generated, compact routing index derived from canonical framework artifacts;
- deterministic routing pins for explicit requests, active workflow state, repository concerns, and required rules;
- lexical and optional semantic retrieval for non-required skills;
- a measurable per-turn context budget and overflow policy;
- conservative semantic auto-invocation with ambiguity handling;
- content-addressed load receipts for required skills and rules;
- one normalized routing decision consumed by host-specific adapters;
- offline, stale-index, malformed-registry, and unsupported-host behavior;
- evaluation corpora, shadow mode, staged rollout, telemetry, and rollback controls.

### Out of scope

- replacing host-native skill discovery;
- storing the full catalog or all rule bodies in every prompt;
- making embeddings a canonical source of truth;
- an external vector database at the current catalog size;
- unrestricted multi-skill auto-invocation;
- learning directly from raw prompts or silently changing routing policy in production;
- weakening explicit skill invocation, lane prerequisites, or concern-based enforcement;
- implementing framework runtime changes in `hourshub-port`.

## 4. Proposed architecture

```text
user intent + repo state + lane state + planned mutation/diff
                         |
                  routing kernel (D0)
                         |
       +-----------------+------------------+
       |                                    |
deterministic pins                    optional discovery
explicit / active graph /       exact -> lexical -> semantic
concerns / critical rules           -> fusion -> policy
       |                                    |
       +-----------------+------------------+
                         |
             budgeted candidate cards (D1)
                         |
        required load or one approved auto-invoke
                         |
                    skill body (D2)
                         |
              on-demand references (D3)
                         |
       mutation gate checks content-hash receipts
```

### 4.1 Disclosure levels

| Level | Contents | Load rule |
|---|---|---|
| D0 — kernel | invariant routing contract, explicit invocation syntax, failure semantics, budget counters, enforcement entry point | always resident |
| D1 — cards | compact candidate metadata: name, purpose, trigger summary, invocation policy, risk, dependencies | retrieved per decision |
| D2 — skill | complete selected `SKILL.md` | load after deterministic selection or approved implicit invocation |
| D3 — resources | references, templates, scripts, schemas, examples | load only according to the selected skill |

The router must count injected tokens at every level and attribute them to a decision receipt. Host-reported token counts are preferred; a pinned local tokenizer estimate is acceptable where hosts expose none.

### 4.2 Generated routing index

Add a compiler that reads canonical inputs and emits one versioned, content-addressed index. Canonical inputs remain:

- skill `SKILL.md` frontmatter and descriptions;
- `skills-manifest.json` inclusion, routing-pack, and rule policy data;
- lane/task-graph definitions;
- `concerns/REGISTRY.json` rule and skill bindings;
- approved aliases and positive/negative trigger fixtures.

Do not place framework-only nested metadata in portable Agent Skills frontmatter. Put it in the generated index or an adjacent framework-owned registry.

Minimum index record:

```json
{
  "skill": "design-tech",
  "path": "skills/design-tech/SKILL.md",
  "content_hash": "sha256:...",
  "description": "...",
  "aliases": ["technical design", "architecture"],
  "positive_triggers": ["design the implementation approach"],
  "negative_triggers": ["implement the approved design"],
  "domains": ["software-architecture"],
  "actions": ["design", "compare"],
  "objects": ["architecture", "components", "interfaces"],
  "repo_signals": ["feature spec is UX-REVIEWED"],
  "lane_roles": ["technical-design"],
  "invocation_policy": "implicit-allowed",
  "risk": "medium",
  "requires": ["recall-stack-knowledge"],
  "required_rules": []
}
```

Compiler invariants:

- fail on duplicate names, missing files, invalid policies, broken dependencies, or unresolvable rule identifiers;
- emit a stable schema version and hashes for the index and every source record;
- sort deterministically so diffs are reviewable;
- build lexical artifacts locally and semantic vectors only when a configured provider is available;
- treat vectors as disposable derived data; never accept them without matching the source hash;
- preserve an exact-and-lexical offline index in source control or the release bundle.

### 4.3 Deterministic pins run first

The router resolves these signals before ranking optional candidates:

1. an explicit user-named skill;
2. the active task graph's current skill and mandatory prerequisites;
3. the next legal lane transition;
4. repository-local instructions and declared execution authority;
5. concern-registry matches from paths, content, dependencies, environment, planned files, commands, and diffs;
6. mandatory review, security, privacy, legal, deployment, or mutation gates.

Pinned skills are included even when their semantic score is zero. A conflict among pins is a policy error to surface, not a ranking problem to average away.

### 4.4 Hybrid optional retrieval

For unpinned discovery, use the following pipeline:

1. **Scope filter:** remove skills unavailable in the current host, repo type, lane state, or invocation policy.
2. **Exact resolver:** match canonical names, aliases, commands, and known artifact names.
3. **Lexical retrieval:** rank description, actions, objects, domains, and trigger fixtures using BM25 or an equivalent deterministic scorer.
4. **Semantic retrieval:** optionally rank the same compact fields with embeddings; cache by model, schema, and source hash.
5. **Fusion:** combine lexical and semantic rank using reciprocal-rank fusion rather than incomparable raw scores.
6. **Policy rerank:** boost prerequisites and repo evidence; penalize negative triggers, already-completed phases, excessive cost, conflicts, and risk.
7. **Budget cut:** return only the smallest candidate set that fits D1 limits.

At current catalog scale, use an in-process exact/lexical index and flat vector scan. An external vector service adds operational and privacy cost without a demonstrated need.

The semantic provider must be pluggable. If unavailable, stale, slow, or unauthorized for the data classification, the router continues with exact and lexical retrieval and records degraded mode.

### 4.5 Invocation policies

Every skill must have one policy:

| Policy | Meaning |
|---|---|
| `required` | deterministically loaded when its registered condition matches; cannot be displaced by rank or budget |
| `implicit-allowed` | may be auto-invoked when confidence and margin gates pass |
| `suggest-only` | may be presented as a recommendation but never loaded without confirmation or workflow selection |
| `explicit-only` | loads only when named by the user or mandated by an already-authorized task graph |

Initial auto-invocation policy:

- at most one optional skill per routing decision;
- no auto-invocation if the top two candidates are too close, the intent spans distinct lanes, required context is missing, or the action would materially expand scope;
- no implicit invocation for destructive, external-write, purchasing, communication-sending, legal-signature, credential, or production-deployment capabilities;
- a required skill may load alongside the one optional skill because it is enforcement, not discovery;
- every implicit decision records candidates, component ranks, selected policy, confidence band, budget, and reason code;
- low confidence falls back to `route-workflow`, a compact suggestion, or a user choice depending on whether progress can safely continue.

Do not make one universal numeric similarity threshold the contract. Calibrate thresholds per embedding model and corpus, then gate on both absolute confidence and winner margin. Store qualitative production bands (`high`, `ambiguous`, `none`) behind a versioned policy.

### 4.6 Context budgets

Use these as initial measurable ceilings, to be tuned through evaluation rather than treated as timeless constants:

| Budget | Initial ceiling | Overflow behavior |
|---|---:|---|
| D0 routing and governance kernel | 1,500 tokens | build fails; kernel must be reduced |
| D1 candidate cards | 1,200 tokens and 8 candidates | truncate lowest-ranked optional cards |
| one D2 skill body | 5,000 tokens recommended | flag skill for decomposition; required skill still loads |
| D3 references per decision burst | 8,000 tokens | fetch narrower sections or defer non-required reference |
| svc startup metadata share | at most 25% of the host's native skill allowance | diet descriptions or partition optional packs |

Rules:

- deterministic required material has priority over optional cards;
- budget overflow can remove optional candidates, never a positive critical-rule match;
- deduplicate repeated content by hash and prefer stable pointers after a verified full load;
- summarize conversation history separately from immutable rule bodies so compaction cannot silently erase enforcement;
- report actual and estimated token use by D0–D3 and by skill;
- keep host-native metadata descriptions concise and discriminative because native invocation remains a supported path.

### 4.7 Critical domain-rule enforcement

Extend the rule registry with explicit enforcement metadata:

```yaml
rule: payments-boundary
severity: critical
activation: required-on-signal
enforcement: block-mutation
signals:
  paths: ["src/payments/**"]
  packages: ["stripe"]
  commands: ["deploy", "migrate"]
executable_twin: "scripts/check-payments-boundary.mjs"
waiver:
  authority: "svc-owner"
  expires: true
```

Rule classes:

- **kernel:** tiny invariant safety and routing rules, always present;
- **required-on-signal:** loaded when deterministic repo or action evidence matches;
- **advisory:** retrieved like optional knowledge and allowed to fail open.

Enforcement sequence:

1. inspect declared intent, repository state, planned paths, proposed commands, and available diff;
2. deterministically match rules and required skills;
3. load exact current content and record its hash;
4. run executable twins where defined;
5. before mutation, verify that every required receipt matches the current source hash and scope;
6. deny the mutation if a critical receipt is absent, stale, contradicted, or waived without valid authority;
7. after mutation, rescan the actual diff and run any newly activated checks.

Failure semantics:

- advisory discovery fails open with a diagnostic;
- optional semantic retrieval fails open to exact and lexical routing;
- a confirmed high/critical signal fails closed until its rule is loaded and acknowledged;
- a malformed or stale critical registry blocks governed mutations but does not block read-only diagnosis;
- unsupported hosts must report a degraded guarantee and route mutation through a supported CLI/gate, rather than claiming enforcement they cannot provide.

This separates availability from safety: semantic infrastructure can disappear without making critical protections disappear.

### 4.8 Decision and load receipts

Emit append-only, schema-versioned receipts with:

- decision ID and parent task/run ID;
- timestamp, host adapter, repo identity, branch, and lane state;
- normalized intent fingerprint, never the raw prompt by default;
- deterministic pins and their evidence;
- candidate IDs, component ranks, policy version, confidence band, and reason codes;
- D0–D3 token counts and truncation decisions;
- loaded skill/rule paths and exact content hashes;
- degraded-mode, override, waiver, and enforcement outcomes.

Receipts must redact secrets and avoid storing source snippets or raw user text unless a separately approved debug mode is active. Telemetry is observational: it may propose metadata changes, but production routing policy changes only through reviewed versioned artifacts.

### 4.9 Host integration

Define a normalized router result once:

```json
{
  "required": ["repo-context"],
  "selected": "design-tech",
  "suggestions": ["explore-solutions"],
  "rules": ["central-install-only"],
  "budget": {"d0": 900, "d1": 420, "d2": 3100, "d3": 0},
  "enforcement": "mutation-allowed",
  "receipt": ".svc/receipts/...json"
}
```

Host adapters consume this result according to capability:

- hook-capable hosts inject required material and block governed mutations;
- hosts with native implicit invocation receive the compact eligible set and framework decision metadata;
- weaker hosts call the same router through `route-workflow` or a CLI preflight and must display degraded enforcement;
- all adapters use the same compiler output, policy version, hashes, and evaluation fixtures.

Do not duplicate ranking logic in host-specific hooks.

## 5. Implementation plan

### Wave 0 — Baseline and evaluation corpus

1. Capture current startup tokens, catalog visibility, routing accuracy, false invocations, missed required skills, latency, and end-to-end task outcomes on every supported host.
2. Build a versioned corpus from real WI prompts plus adversarial paraphrases, ambiguous intents, negative triggers, stale-index cases, and critical-rule scenarios.
3. Label each fixture with required pins, acceptable optional skills, forbidden auto-invocations, required rules, and expected fallback.
4. Include catalog-order permutations to expose position bias.

**Exit:** baseline report and reviewed gold corpus exist; no runtime behavior changes.

### Wave 1 — Schema and compiler

1. Define routing-index, policy, receipt, and concern-enforcement schemas.
2. Compile from the manifest, skill metadata, lane definitions, and concern registry.
3. Add deterministic validation, source hashes, dependency checks, and description-budget checks.
4. Generate exact/lexical artifacts and a human-reviewable catalog report.

**Exit:** identical inputs produce byte-stable outputs; invalid references fail CI; no hand-edited derived index is accepted.

### Wave 2 — Deterministic and lexical router

1. Implement explicit-name, alias, task-graph, lane, and concern pins.
2. Add scope filtering, lexical ranking, policy reranking, budget cutting, and reason codes.
3. Add offline operation and normalized host output.
4. Integrate as a suggestion-only CLI and `route-workflow` helper.

**Exit:** all pinned and critical fixtures pass; lexical optional recall meets the provisional evaluation floor; current routing remains authoritative.

### Wave 3 — Semantic shadow mode

1. Add a provider interface, local cache, hash invalidation, batching, timeout, and privacy classification.
2. Run semantic ranking in shadow mode only; fuse ranks but do not alter selected skills.
3. Compare retrieval quality, latency, context savings, and regressions against lexical-only and current routing.
4. Test at least two embedding configurations or document why one is operationally unavailable.

**Exit:** reviewed evidence shows semantic fusion improves representative retrieval without reducing pinned/critical performance; otherwise retain lexical-only routing.

### Wave 4 — Conservative optional auto-invocation

1. Enable `implicit-allowed` only for a small low-risk canary set.
2. Enforce top-one, margin, ambiguity, lane-state, and scope-expansion gates.
3. Record decisions and provide an explicit disable path.
4. Expand skill-by-skill only after trigger precision and task-success evidence passes.

**Exit:** zero forbidden auto-invocations in the gold corpus and canary; no statistically or practically meaningful end-to-end regression.

### Wave 5 — Required-rule receipts and mutation gate

1. Extend the concern registry with severity, enforcement, executable twins, and waivers.
2. Add pre-mutation and post-diff rescans.
3. Verify content-addressed skill/rule receipts and reject stale acknowledgements.
4. Add read-only recovery commands for malformed registries and missing artifacts.

**Exit:** every critical fixture is blocked when its receipt/check is absent and allowed when satisfied; semantic services can be disabled without changing this result.

### Wave 6 — Cross-host rollout and catalog diet

1. Implement thin adapters for the nine supported hosts based on their actual hook and native-skill capabilities.
2. Publish a guarantee matrix: enforceable, advisory-only, or CLI-gated.
3. Remove redundant always-on routing prose only after equivalent behavior is measured.
4. Feed false positives, false negatives, and unused cards into reviewed description and trigger improvements.

**Exit:** every supported host passes its declared contract; startup context reduction and routing quality are proven on representative sessions.

## 6. Expected central implementation surfaces

Final filenames should be confirmed during technical design, but the change is expected to touch:

- `skills-manifest.json` for portable invocation policy and compiler inputs;
- `concerns/REGISTRY.json` for enforcement metadata;
- a versioned routing-index schema and generated artifact;
- a compiler/checker under `scripts/`;
- a shared router library plus CLI entry point;
- the existing rule injector and skill-load enforcers as adapters, not independent routers;
- host manifests for capability declarations;
- evaluation fixtures and benchmark scripts;
- framework documentation for budgets, receipts, overrides, and recovery.

No framework implementation belongs in this consumer worktree. This repository may later receive only an installed release, project-local concern declarations, or validation receipts through the established central-install workflow.

## 7. Verification contract

### 7.1 Routing quality

- explicit skill selection: **100%** correct;
- task-graph and lane-required selection: **100%** correct;
- critical rule/skill activation on labeled signals: **100% recall**;
- forbidden automatic invocations: **0**;
- optional-skill retrieval: initial **Recall@5 ≥ 97%** on the reviewed corpus;
- ambiguity fixtures: **100%** choose an approved fallback rather than an unsafe auto-invocation;
- negative-trigger fixtures: no targeted false invocation.

Recall@5 is a discovery measure, not permission to load five bodies. The runtime still loads at most one optional skill.

### 7.2 Budget and performance

- D0 and D1 remain within their hard ceilings on every supported host;
- median and p95 startup tokens improve against the Wave 0 baseline;
- warm local routing p95 target: **≤150 ms** on the documented reference machine;
- cold semantic timeout cannot delay safe fallback beyond the configured host budget;
- embedding cache invalidates on source, model, or schema change;
- no full catalog or raw embedding payload is injected into the model context.

### 7.3 Enforcement and resilience

- critical matches behave identically with semantic routing on, off, timed out, or corrupt;
- stale skill/rule hashes are rejected before governed mutation;
- post-diff scanning catches rules activated by files not predicted in the plan;
- malformed registry blocks only governed mutation and supplies a recovery diagnostic;
- offline exact/lexical routing remains functional;
- receipt output contains no seeded secrets or raw sensitive prompts;
- unsupported hosts never claim blocking enforcement.

### 7.4 End-to-end value

Measure task success, correction turns, context tokens, latency, false invocations, missed rules, and user overrides. Ship only if the hybrid router is non-inferior on task completion and critical enforcement while materially reducing recurring context cost or improving capability recall.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| semantic false negative hides a required skill | deterministic pins and concern registry bypass semantic rank |
| semantic false positive expands scope | one optional invocation, policy allowlist, confidence and margin gates |
| stale vectors route against old instructions | source-hash cache keys and lexical fallback |
| description edits unpredictably change routing | trigger corpus, order permutations, reviewed generated diffs |
| token budget evicts safety content | required material has priority; critical overflow fails closed |
| router outage blocks all work | read-only remains available; optional discovery falls back offline |
| enforcement differs by host | capability matrix, thin adapters, explicit degraded guarantees |
| telemetry leaks prompts or secrets | fingerprints and reason codes by default; redaction tests |
| self-reinforcing bad routing | telemetry cannot directly update production metadata |
| premature platform complexity | in-process retrieval first; external vector store requires measured need |

## 9. Rollout controls and rollback

Use independent controls so discovery can be rolled back without disabling enforcement:

```text
SVC_SKILL_ROUTER_MODE=off|shadow|suggest|active
SVC_SEMANTIC_ROUTING=off|shadow|active
SVC_REQUIRED_RULE_ENFORCEMENT=observe|block
```

- start with `shadow / shadow / observe`;
- promote deterministic/lexical suggestions before semantic influence;
- promote semantic ranking before auto-invocation;
- promote blocking enforcement per rule class after false-positive review;
- emergency rollback disables optional routing first while leaving deterministic required-rule checks active;
- the last known-good compiled index may be used only when its canonical inputs still match their recorded hashes.

## 10. Definition of done

- [ ] A reviewed architecture decision records the hybrid/deterministic boundary and rejects semantic-only enforcement.
- [ ] Routing-index, policy, receipt, and concern-enforcement schemas are versioned.
- [ ] The compiler is deterministic, content-addressed, and CI-enforced.
- [ ] Explicit, lane, task-graph, repository, and concern pins bypass optional ranking.
- [ ] Exact and lexical routing work offline; semantic routing is optional and observable.
- [ ] Context counters enforce D0–D3 budgets without evicting required rules.
- [ ] Optional auto-invocation is allowlisted, top-one, ambiguity-aware, and reversible.
- [ ] Critical rules require current content-hash receipts and executable checks before mutation.
- [ ] Pre-mutation and post-diff concern scans pass all labeled fixtures.
- [ ] Privacy-safe receipts and dashboards expose misses, false invokes, budget, latency, and degraded mode.
- [ ] All supported hosts pass their declared enforcement level.
- [ ] Evaluation proves 100% explicit/pinned/critical recall, zero forbidden auto-invocations, and no task-success regression.
- [ ] Rollback is exercised with semantic discovery disabled while critical enforcement remains active.
- [ ] Framework docs and central-install release procedures are updated.

## 11. Required next workflow

This plan introduces a derived index/cache, a shared routing service boundary, host adapters, and mutation-gate semantics. Before implementation planning:

1. run `design-tech` to specify component boundaries, schemas, runtime ownership, storage, host adapter contracts, and executable enforcement;
2. run `explore-solutions` to challenge the hybrid retrieval choice against native-only discovery, lexical-only routing, classifier routing, and external vector infrastructure;
3. run `review-security` on receipt privacy, prompt handling, cache integrity, waiver authorization, and fail-closed behavior;
4. run `plan-changeset`, followed by `review-plan`, before dispatching implementation.

The design phase must preserve the principal invariant of this plan: optional capability discovery may be probabilistic; critical domain governance may not be.

## Implementation Notes

**Status:** PARTIALLY-LANDED (Waves 1-2 core) — 2026-08-25, branch feat-fw-skills-routing.

Landed in this changeset: routing-index + decision schemas (schemas/skill-routing-index.schema.json, schemas/skill-router-decision.schema.json), deterministic compiler (scripts/compile-skill-router-index.mjs) with committed byte-stable artifact (references/skill-routing-index.json), shared router library (scripts/lib/skill-router.mjs), CLI (scripts/skill-router.mjs), conservative suggest-only invocation defaults via references/skill-routing-overrides.json, privacy-safe receipts (.svc/skill-router/, gitignored), labeled corpus (test-framework/fixtures/skill-router/corpus.json) + hermetic tier-1 validator (test-framework/evals/tier-1/validate-skill-router.sh).

Still open per plan §5: Wave 0 baseline capture; Wave 3 semantic shadow; Wave 4 auto-invocation canary; Wave 5 mutation-gate rollout (severity/enforcement metadata on concerns REGISTRY); Wave 6 nine-host adapters + catalog diet. These remain governed by this document's exit criteria and must not be re-scoped silently.
