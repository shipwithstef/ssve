# Framework Proposal — 2026-05-12 — Pre-WI Promotion Compression Gate

**Status:** DRAFT
**Promotion:** mapped to WI-341 in `docs/specs/work-items/PROPOSAL-PROMOTION-LEDGER.md`. Will move to `proposals/done/` only after WI-341 lands the gate that promotes it (bootstrap exception per WI-073 precedent — gate cannot self-promote before it exists).
**Author:** route-workflow (Claude opus-4-7), triggered by review of Codex burst 2026-05-10..12
**Source incidents:** `docs/specs/reviews/codex-recent-wi-review-2026-05-12.md` findings F-1, F-2, F-3, F-4, F-6, F-7, F-11
**Related split proposal:** `proposals/2026-05-12-autonomous-discuss-phase-with-adversarial-review.md`
**deferred_until**: 2026-08-25
**reason**: auto-triage during WI-CHAIN-TIER1-FIXES; proposal stays open pending re-review after chain validation green | re-triaged 2026-06-29: batch backlog-sequenced behind active framework work — flagged for individual triage by 2026-07-29
**blocked_reason**: Beyond the 14-day defer window: imported/backlog evolution proposal awaiting a dedicated triage pass (re-deferred 2026-06-29, not abandoned).

---

## What happened

Codex shipped 11 WIs in 2 days (WI-305..318). After review, 8 of 14 findings traced to **three root causes** that share one underlying structural gap. Codex then resolved most of the findings in PR #120 + follow-up WIs (WI-328..330). The remediation worked — but the same gap will re-fire on the next burst unless we close it.

## Root-cause diagnosis (the "why")

The findings cluster into three meta-patterns, all downstream of a single missing gate:

### Pattern A — Proposal text promoted to WI without compression (F-3, F-1, F-4, F-7)

`capture-idea --from-proposal <path>` exists (capture-idea/SKILL.md:14) but does not require the proposal text to be compressed into an implementation contract before the WI lands in `docs/specs/work-items/`. Result: 7 of 11 WIs had ACs that read "Add X / Define Y" without file paths, validator names, or schemas (F-3). Because no spec existed, plan-changeset never triggered (F-1) even when the work obviously matched its risk signals. Severity got picked subjectively because there was no contract to size against (F-4). Stale capability references (Kimi in WI-310, F-7) survived because no freshness sniff ran.

The compression cost gets paid twice: once at WI promotion (zero leverage if it's just copy-paste), once at planner pickup (with stale context).

### Pattern B — Host-agnostic boundary not enforced at code-write time (F-2, F-9)

`groq_svg_uploaded` landed in a framework-wide regex (`scripts/validate-provider-fidelity-evidence.mjs:20`) because the validator was written against Example Marketplace's WI-233 incident as the primary fixture. The framework has the principle ("This repo IS the framework, not a project built with it" — CLAUDE.md) but no mechanical check that fires when a framework-path file contains a project-specific token. The check exists in human reviewers; it didn't fire because the WI cycle skipped review-gate.

### Pattern C — Implementation surface added at the back, not the front (F-6, F-11)

New evidence families (`feature_validation_closeout`, `provider_fidelity`) shipped gates at G3 (review-gate) and G7 (verify-promotion) but no `concerns/<name>.md` to fire signal-based routing at intent-time. The 4-trigger contract from `rules/concern-routing.md` got 2 of 4 triggers. Similarly, 5 new tier-1 validators auto-discovered into `run-all-evals.sh` without a promotion check — surface-area added with no friction (F-11).

The underlying pattern: when a WI ships a new gate, the gate goes where the WI author was looking (review-gate, because that was the failure scene). It doesn't go where the framework would have noticed earlier (intent-time concerns, pre-dispatch scan).

### The single underlying gap

All three patterns share one root cause: **proposal → WI is a one-step state transition**. There is no checkpoint between "proposal accepted" and "WI promoted-as-actionable" that enforces:

- An implementation contract exists (file paths, validator names, schemas)
- Severity/priority is justified against the repo's WI routing taxonomy
- No project-specific tokens from a project-owned boundary list are about to enter framework code paths
- New evidence families have intent-time + back-end wiring planned together
- Capability references are fresh against named oracles (`scripts/resolve-model.sh`, `references/model-registry.json`, `references/model-routing.md`, or the relevant `references/knowledge/.../CAPABILITIES.md`)
- The change's plan-changeset trigger class has been evaluated

The framework has all the components. The components don't engage because no skill orchestrates them at the WI-promotion moment.

## Proposal — `validate-wi-promotion` compression gate

Extend `capture-idea --from-proposal` with a mandatory compression gate that runs between proposal acceptance and WI landing. Prefer an extension to the existing mode over a new top-level skill; create a separate `validate-wi-promotion` helper script only if the logic becomes large enough to warrant extraction.

The gate produces a `promotion-receipt` artifact and either approves the WI as actionable, binds it to the proposal as non-actionable, or refuses promotion.

### Mandatory checks at promotion time

| # | Check | Source rule | Refuse-on-fail |
|---|-------|-------------|----------------|
| 1 | Every implementation AC names ≥1 concrete artifact (file path, validator name, schema location) OR the WI is explicitly `proposal-bound` with unresolved scope questions | F-3 root | yes |
| 2 | Severity/priority rating has a one-line rationale against the repo WI routing taxonomy; if the taxonomy remains `rules/github-projects.md`, call out that it is priority-derived, not a full WI severity schema | F-4 root | warn |
| 3 | Framework-path references are scanned against a project-owned forbidden-token config, not hardcoded platform words. Platform names such as Base44 are allowed unless the project config marks them project-specific for that repo. | F-2 root + `rules/concern-routing.md` host-agnostic principle | yes |
| 4 | If WI introduces a new evidence family, a matching `concerns/<name>.md` is planned in the same change OR the receipt records why an existing concern covers it | F-6 root | yes |
| 5 | If WI adds a tier-1 validator, the gate enforces the existing `promotion_signal` contract from `rules/tier-1-promotion.md`; it does not create a parallel policy | F-11 root | yes |
| 6 | Any harness/model references are validated against `scripts/resolve-model.sh`, `references/model-registry.json`, and `references/model-routing.md`; domain capability references cite the relevant `references/knowledge/domains/<domain>/CAPABILITIES.md`; framework capability references cite `references/knowledge/svc/CAPABILITIES.md` | F-7 root | warn |
| 7 | `rules/plan-changeset-trigger.md` risk-class is declared on the WI (`risk: contract-change \| hot-path \| refactor \| additive \| docs`) and downstream skill picks the correct lane | F-1 root | yes |

### Trigger points

The same compression discipline should fire at TWO trigger points, not one. This is the same multi-trigger pattern `rules/concern-routing.md` already established for concerns ("scanned and matched against the active change set at four points"). T1 is predictive (author writes a proposal that DESCRIBES future WI shape); T2 is validative (the actual WI is being promoted, real artifacts now exist).

| # | Trigger | Mode | Failure semantics |
|---|---------|------|---------------------|
| 1 | **Proposal authorship** — any skill or human writing a file under `proposals/*.md` with body length above the stub threshold | self-verify / warn | Emits a checklist with PASS / WARN per check. Failures are visible warnings, NOT a hard block. The author is expected to fix before opening review. Cheap to run; mechanical regex + file-path checks against the proposal text. |
| 2 | **WI promotion** — `capture-idea --from-proposal` promoting a proposal to an actionable WI in `docs/specs/work-items/` | gate / refuse-on-fail | Hard gate per the WI-promotion check table. Refusals produce a `decision: refused` or `decision: bound-to-proposal` promotion receipt. |

**Why two triggers and not just one:**

Author-time (T1) is cheap but soft. If T1 is the ONLY check, authors who skip it (or whose tooling doesn't fire it) shift cost to reviewers. If T2 (promotion gate) is the ONLY check, the cost-twice problem this proposal is trying to solve recurs: authors produce sloppy proposals, reviewers eat the cleanup. With both, authors get cheap self-correction and reviewers get a hard fallback.

This proposal's own draft was an empirical case for T1: it shipped with 7 findings from cross-family review that T1's mechanical checks would have caught (vague oracles, no bootstrap exception, ambiguous tier-1 wording, fuzzy host-agnostic token list, etc.). The author (Claude) ran in single-pass extrude mode; T1 would have flagged 5-6 of those before reviewer (Codex) had to.

#### T1: author-time check mapping (NOT identical to T2)

The 7 T2 checks are validation against existing WI fields (receipt decision, proposal-bound state, plan-changeset class declared ON THE WI). At author time those fields don't exist yet — the proposal is describing INTENT that will later become WI fields. T1 maps each T2 validation check to a T1 predictive check on the proposal body:

| T2 (WI-promotion) check | T1 (author-time) equivalent | Author-time signal |
|---|---|---|
| Every AC names ≥1 concrete artifact | `planned_artifacts` — proposal body names ≥1 file path, validator script, schema location, or config path per accepted findings | regex for `scripts/*`, `references/schemas/*`, `.svc/*`, `<skill>/SKILL.md`, etc. in the proposal text |
| Severity/priority justified against taxonomy | `candidate_severity` — proposal Route section states an intended severity + one-line rationale referencing `rules/github-projects.md` | regex for "Severity = HIGH/MEDIUM/LOW" + presence of rationale clause |
| No project-specific tokens in framework paths | `forbidden_token_config` — proposal does NOT propose pasting project-specific tokens into framework code; if it must reference such tokens, it names the project-local config that owns them | scan proposal body against the same project-owned forbidden-token config; flag direct mentions in proposed framework code blocks |
| New evidence family → matching `concerns/<name>.md` | `concerns_intent` — proposal explicitly states what `concerns/*.md` will accompany the new evidence family OR cites an existing concern that covers it | regex for `concerns/...md` references in the proposal body when "evidence family" or "delivery graph" appears |
| New tier-1 validator → `promotion_signal` from `rules/tier-1-promotion.md` | `tier1_promotion_claims` — for every proposed tier-1 validator, the proposal body has a named `validator_path`, `failure_class`, `promotion_signal` clause | regex match for the 5 fields from `rules/tier-1-promotion.md` near each proposed validator |
| Harness/model references validated against named oracles | `capability_oracles` — proposal cites at least one oracle (`scripts/resolve-model.sh`, `references/model-registry.json`, `references/model-routing.md`, `references/knowledge/<domain>/CAPABILITIES.md`, `references/knowledge/svc/CAPABILITIES.md`) for any harness/model claim | regex for the oracle paths near "Kimi", "MiMo", "Claude", "Opus", "Sonnet", "Haiku", "Codex", etc. mentions |
| Plan-changeset risk-class declared on WI | `candidate_risk_class` — proposal Route section declares the intended `risk: contract-change \| hot-path \| refactor \| additive \| docs` class per `rules/plan-changeset-trigger.md` | regex for "Plan-changeset class:" in the Route section |

T1 PASS/WARN output uses these author-time field names so the author sees what's missing in proposal-shape terms, not WI-shape terms.

#### T1 integration surface (broader than route-workflow alone)

Codex finding #3 was correct: proposals are written by many surfaces, not just route-workflow. T1 must engage at all of them:

- **Standalone CLI:** `node scripts/lint-proposal-authorship.mjs <proposal-path>` — runs against any single file. Authoring humans run it directly.
- **Skill self-verify integration:** any skill whose contract includes writing or extending a proposal file declares a `proposal_authorship_self_verify: true` flag in its frontmatter. Skills currently in scope: `evolve-framework`, `improve-framework`, `route-workflow`, `capture-idea`, `audit-session-execution` (when it files proposal-class findings), `discuss-phase` (when its artifact is a proposal-class output). Each of these adds a Self-Verify row that invokes T1 against the file it just wrote.
- **Post-write proposal scanner (advisory only):** a tier-2 `validate-proposal-authorship-coverage.sh` periodically scans `proposals/*.md` for files that have no `.svc/proposal-lints/<slug>.md` companion newer than the proposal's last-modified timestamp. Emits a backlog of un-linted proposals. Not a pre-commit hook (Codex finding #3 explicitly called out manual edits should not be force-blocked).
- **NOT a git pre-commit hook** — that would force every manual edit through the lint and break the explicit opt-in stance.

#### T1 implementation surface (concrete defaults)

- Script path: `scripts/lint-proposal-authorship.mjs`
- Sidecar output path: `.svc/proposal-lints/<slug>.md` (Codex finding #5 — moved out of `proposals/` to avoid confusion with real proposals). Output is transient and gitignored alongside the rest of `.svc/`. A durable variant lands at `docs/specs/reviews/proposal-lints/<slug>.md` when the author wants the lint preserved as a review artifact.
- Stub threshold (Codex finding #6): default **40 body lines** (excludes frontmatter and trailing whitespace). Override via `SVC_PROPOSAL_LINT_STUB_THRESHOLD` env var or `--stub-threshold <N>` CLI flag. 40 lines is the empirical knee — proposals below that are typically promotion stubs or "noted, will draft later" placeholders; above that, real architectural content lives and benefits from the lint.
- Output schema: JSON or markdown checklist, one row per author-time check from the mapping table above. Each row carries `{check, status: PASS|WARN, evidence: <quoted proposal line or "missing">, t2_equivalent: <WI-promotion check name>}`.

**T2 implementation surface:** as already specified above (extension of `capture-idea --from-proposal`).

### Promotion-receipt artifact

Stored at `.svc/promotion-receipts/WI-<n>.json` with schema at `references/schemas/promotion-receipt.schema.json`. Receipts are durable repo artifacts, not local scratch files.

```json
{
  "schema_version": 1,
  "wi_id": "WI-318",
  "promoted_at": "2026-05-12T03:00:00Z",
  "enforced_after": "2026-05-12",
  "grandfathered": false,
  "bootstrap": false,
  "source_proposal": "proposals/2026-04-14-blocking-discovery-halt-protocol.md",
  "checks": {
    "concrete_contract": "pass | warn | fail",
    "severity_taxonomy": { "rated": "high", "justification": "..." },
    "host_agnostic": {
      "result": "pass | flagged",
      "config": ".svc/forbidden-tokens.json | project-local equivalent",
      "tokens": []
    },
    "concerns_wired": ["concerns/blocking-discovery.md"],
    "tier1_promotion_note": "n/a | filled",
    "capability_freshness": {
      "result": "pass | stale",
      "oracles": ["scripts/resolve-model.sh", "references/model-registry.json", "references/knowledge/svc/CAPABILITIES.md"]
    },
    "plan_changeset_class": "contract-change",
    "lane": "framework"
  },
  "decision": "accepted | refused | bound-to-proposal",
  "reviewer": "validate-wi-promotion@svc"
}
```

### Three exit states

- **accepted** — WI lands in `docs/specs/work-items/` as actionable
- **bound-to-proposal** — WI lands with `Status: proposal-bound` flag (visible only in explicit proposal-bound/all views, not default actionable backlog); cannot be dispatched by route-workflow until the missing artifact contract is filled in. This is the right state for items like WI-318 where scope is genuinely undecided.
- **refused** — WI does not land; promotion-receipt records refusal reason. Author fixes and re-runs.

### `proposal-bound` consumer contract

Adding a new WI state is part of the feature, not a documentation detail. The implementation must update every consumer that currently treats "not done" as "actionable":

- `list-work-items/scripts/list_work_items.mjs` — exclude `proposal-bound` from the default open/actionable list; add an explicit `--proposal-bound` or `--all` view.
- `route-workflow` dispatch — refuse to start a lane from a `proposal-bound` WI and route back to proposal compression/specification instead.
- `capture-idea --from-proposal` emission — write `Status: proposal-bound` only when the receipt decision is `bound-to-proposal`; otherwise actionable WIs require `decision: accepted`.
- `.svc/lane-tasks-<WI>.json` generation — do not generate lane tasks for `proposal-bound` items.
- `sync-work-items` / GitHub mirror, if invoked — mirror `proposal-bound` as non-actionable/backlog-hold, not as ready work.
- `docs/specs/work-items/INDEX.md` — show the status explicitly so humans can find it without mixing it into the executable backlog.
- Tier-1 validator — fixture proves `proposal-bound` is visible in all/proposal-bound mode and absent from actionable mode.

### Where the gate sits

`capture-idea/SKILL.md` Section 7 ("From-Proposal Mode") already handles `--from-proposal <path>`. Extend that mode and its helper scripts before writing the WI file:

- `capture-idea/SKILL.md` — document the compression gate in Section 7.
- `capture-idea/references/from-proposal.md` — add the receipt grammar, `proposal-bound` semantics, and bootstrap exception rules.
- `capture-idea/scripts/parse-proposal.mjs` / `capture-idea/scripts/emit-wis.mjs` — add receipt emission and refusal handling where appropriate.
- `test-framework/evals/tier-1/validate-capture-idea-from-proposal.sh` — add replay assertions.
- `test-framework/evals/tier-1/validate-wi-promotion-receipts.sh` — validate receipt presence/schema for post-cutoff actionable WIs.

The check runs in the parent session — no subagent needed; the work is mechanical (structured parse + file path checks + rule lookup + project-token config).

For bulk Codex bursts (Promote framework proposals to work items, like commit `fa58c83`), the same gate runs per-WI; refusals are aggregated into one report so the burst can be re-run with fixes.

## Why this remains one compression-gate proposal

The autonomous discuss-phase material that originally lived here was split into `proposals/2026-05-12-autonomous-discuss-phase-with-adversarial-review.md` because it has a different blast radius — it changes a `human_checkpoint` semantic across every consumer of `discuss-phase`, which is independent of the WI-promotion contract this proposal closes. The remaining remediation for F-1, F-2, F-3, F-4, F-6, F-7, and F-11 still belongs in one compression gate because:

- F-3, F-1, F-4, F-7 share the same root (no compression at promotion).
- F-2 and F-9 share the same root (no host-agnostic check at code-write).
- F-6 and F-11 share the same root (new surface added without intent-time wiring).
- All three sub-roots converge on: **no checkpoint between proposal-accept and WI-promote.**

Seven separate proposals for the seven findings would either fragment the fix or end up cross-referencing each other into a single de facto proposal. The composite gate is cheaper to maintain and easier to evaluate at the framework level.

The proposal does NOT replace `plan-changeset`, `review-gate`, `concerns/`, or `rules/tier-1-promotion.md`. It is the missing pre-gate that ensures those existing components engage at the right moment.

## What this does NOT prevent

Honest scope:

- It does not prevent shape-opinion mistakes (F-8, F-9, F-12, F-14 cluster — these were judgment calls, not procedural failures).
- It does not catch issues that only surface after the WI starts implementation (those are the existing plan-changeset / audit-implementation / review-gate jobs).
- It does not prevent the "single mandatory ledger as choke point" pattern by itself. That remains a judgment/gray-area issue for `discuss-phase`, `review-plan`, or a future autonomous-discussion proposal.

## Acceptance Criteria

- [ ] Extend `capture-idea --from-proposal` with the 7-check compression gate above (Trigger 2); do not add a new top-level skill unless implementation size forces extraction.
- [ ] Add `scripts/lint-proposal-authorship.mjs` (Trigger 1) running the **7 author-time predictive checks** from the T1 mapping table (planned_artifacts, candidate_severity, forbidden_token_config, concerns_intent, tier1_promotion_claims, capability_oracles, candidate_risk_class) — NOT the literal T2 validation checks. Warn-only mode. Sidecar output at `.svc/proposal-lints/<slug>.md` (NOT `proposals/<slug>.lint.md` — that path was deliberately moved out of `proposals/` to avoid being mistaken for a real proposal). Durable variant at `docs/specs/reviews/proposal-lints/<slug>.md` when the author opts in.
- [ ] Default stub threshold = **40 body lines** (excluding frontmatter), override via `SVC_PROPOSAL_LINT_STUB_THRESHOLD` env or `--stub-threshold` CLI flag.
- [ ] T1 integration surface MUST cover all proposal-authoring entry points, not just route-workflow: (a) standalone CLI `node scripts/lint-proposal-authorship.mjs <path>`, (b) Self-Verify rows in `evolve-framework`, `improve-framework`, `route-workflow`, `capture-idea`, `audit-session-execution`, `discuss-phase`, (c) tier-2 backlog scanner `validate-proposal-authorship-coverage.sh` that surfaces un-linted proposals. NOT a git pre-commit hook.
- [ ] Add `.svc/promotion-receipts/` directory and `references/schemas/promotion-receipt.schema.json`.
- [ ] Receipt schema supports `schema_version`, `enforced_after`, `grandfathered`, and `bootstrap` so existing backlog is not forced through retroactive fake receipts.
- [ ] Add project-local forbidden-token config support, for example `.svc/forbidden-tokens.json`, and prove framework platform words such as Base44 are allowed unless configured as forbidden by the consuming project.
- [ ] Add `proposal-bound` status to WI frontmatter/metadata and update all consumers listed in the `proposal-bound` consumer contract.
- [ ] Add tier-1 validator `validate-wi-promotion-receipts.sh` that checks every post-cutoff actionable WI has a matching receipt with `decision: accepted`.
- [ ] Add a replay fixture using WI-318 pre-fix state and a replay fixture for a bad bulk Codex promotion burst; prove the gate would have produced `bound-to-proposal` or `refused` instead of actionable WIs.
- [ ] Cross-link: `rules/plan-changeset-trigger.md`, `rules/concern-routing.md`, `rules/tier-1-promotion.md`, `rules/github-projects.md` or successor WI severity taxonomy, `scripts/resolve-model.sh`, `references/model-registry.json`, `references/model-routing.md`, and relevant `references/knowledge/.../CAPABILITIES.md` files.

## Self-Verify

| # | Check | Result |
|---|-------|--------|
| 1 | Proposal cites specific findings + file:line evidence | PASS (F-1..F-11 with paths) |
| 2 | Root cause is named, not just symptoms | PASS (single underlying gap) |
| 3 | Solution is one composite gate, not 7 fragmented fixes or a bundled discuss-phase rewrite | PASS |
| 4 | Does not duplicate existing rules/skills; extends or composes | PASS (no overlap with plan-changeset, concern-routing, tier-1-promotion) |
| 5 | Honest about what it does NOT solve | PASS (F-5, F-8, F-9, F-12, F-14 listed as out of scope) |
| 6 | Has a concrete acceptance contract (skill extension, schema, validators, fixtures, consumers) | PASS |

## Route

If accepted: file as a bootstrap WI with an explicit bootstrap receipt, because the first WI that builds this gate cannot go through a gate that does not exist yet. This follows the WI-073 precedent in `capture-idea/SKILL.md` and `docs/specs/work-items/WI-073.md`. Plan-changeset class = `contract-change` (extends `capture-idea --from-proposal`, adds receipt schema, status semantics, and validators). Lane = `framework`. Severity = HIGH (closes a structural gap that already caused 14 findings in one burst, not blocking shipped behavior).

If rejected: archive to `proposals/done/` with rationale, log decision in `.svc/pipeline-decisions.jsonl`.
