# Reviewer ladder: review that always runs, labelled for what it is

Status: revised 2026-10-11 after adversarial review (below). The first draft is kept above the review for the record; the **Revised decision** at the end is what gets built.
Context: a framework-arm eval in a fresh project found that no adversarial review could run. `run-external-review.mjs --policy-status` returned `config_invalid` (no `~/.svc/dispatch-policy.json`), there is no availability probe, and the receipt gates accept only a different-family independent reviewer. A user with one model family (Claude only, the common case) can therefore never produce a passing chain, and with no chain policy the framework fails closed to `refuse`.

## Problem, measured
| Fact | Evidence |
|---|---|
| Every paid review needs an owner config file; missing means `config_invalid`, zero provider calls | `review-topology-v2.mjs:146`, `run-external-review.mjs:1865` |
| Availability is a hand-written list (`SVC_DISPATCH_UNAVAILABLE_STATIONS`); nothing probes | `resolve-dispatch.mjs:478-511`, `run-external-review.mjs:1540,1695` |
| The documented Fable→Opus xhigh fallback can never fire: `resolvePolicy()` has no callers and the launch path passes `fallback: null` | `run-external-review.mjs:343-366,1704,2165-2210` |
| Review receipts require `reviewer_evidence.independent === true`, and every family check derives family from the host, so Opus reviewing Sonnet is anthropic=anthropic and rejected | `reviewer-evidence.mjs:112,164-165`, `check-chain-receipts.mjs:1066-1104`, `schemas/receipts/review-{plan,exec}.schema.json` |
| The executor's model is not recorded where a reviewer could be chosen against it | `exec-record.schema.json` `dispatch_model` is free text set by the caller |

## Decision
Three rungs, chosen at the start of each review from a probe, every rung recorded as what it is:

| Rung | Reviewer | Label (`review_route`) | Counts for |
|---|---|---|---|
| 1 | A different family that the probe finds installed and authenticated (codex, agy, grok, cursor-agent) | `cross-family` | everything, as today (unchanged) |
| 2 | Same family, a stronger model than the executor, fresh context, read-only tools: Haiku or Sonnet work reviewed by Opus at high effort | `same-family-stronger` | prototype and MVP only, never an irreversible zone, never release authority |
| 3 | Same family, same top model (Opus work): Opus at the highest effort, fresh context, read-only | `same-family-peer` | prototype and MVP only, same limits as rung 2 |

Rungs 2 and 3 are taken only when the probe shows no rung-1 reviewer. They are never labelled independent: `independent` stays `true` only for rung 1, so every existing gate keeps its meaning.

## What changes
1. **Probe** (`scripts/reviewer-probe.mjs`, new). For each transport the launcher knows: binary on PATH, the existing `capabilityCheck`, and a cheap authenticated call where the CLI has one (otherwise `auth: unproven`). Writes `.svc/reviewer-availability.json` with `probed_at`, per-host `{available, reason}` and the probe's own command lines. Cached for 24 hours; `--refresh` forces it. Evals and route-workflow call it once at start.
2. **Default policy when no owner config exists** (`review-topology-v2.mjs loadReviewerPolicy`). Instead of throwing ENOENT, synthesize a v1 policy from the probe: rung-1 stations for available families, then the rung-2/3 station. It is marked `source: "synthesized"` and can never carry `release_authority`. An owner config, when present, wins unchanged.
3. **Executor model on the exec record.** `execute-changeset` copies the resolved EXEC tuple (`resolve-model.sh EXEC --json`) into `exec-record.dispatch_tuple`. A strength order per family lives in `references/model-registry.json` (`strength_order.anthropic: [haiku, sonnet, opus]`), so "stronger" is a lookup, not a judgement.
4. **Rung-2/3 transport.** The launcher's existing `claude` transport runs the reviewer with the stronger model, `--allowedTools Read,Grep,Glob`, a fresh session, and the same package, prompt and findings schema as rung 1. Its launcher receipt records `review_route`, the executor tuple, the reviewer tuple and the probe file hash.
5. **Gates.** `reviewer_evidence` gains `review_route` (`cross-family` default, so old receipts read unchanged). The checks in `reviewer-evidence.mjs` and `check-chain-receipts.mjs` accept a same-family route only when all hold:
   - the receipt's graph has `delivery_profile` prototype or mvp and `irreversible_zones` empty (re-derived from the diff, as `compile-delivery-graph.mjs irreversibleZones()` does);
   - the bound probe file shows no available rung-1 host at review time;
   - the reviewer model is stronger than (rung 2) or equal to the top of (rung 3) the executor's family order, re-derived from the tuples, not from declared labels;
   - the reviewer ran read-only (tool list in the launcher receipt).
   Anything else falls back to today's rule: cross-family or a recorded owner waiver.
6. **Doc fixes.** Remove the dead Fable→Opus claims from review-plan and review-cross-model, write the missing `references/single-vendor-windows.md` as this ladder, and drop Bash from `agents/plan-reviewer.md` (the synced copy already has none; nothing uses it).

## Every agent slot is configuration, adjustable per decision
The ladder is one case of a general rule: no slot's model, effort, host or tool list lives in code or is fixed in an agent file.
- **Slots:** every place the framework dispatches a model gets a name. That covers STRAT, PLAN, EXEC, review.plan, review.exec, review.audit, the four lens slots, judge, probe-loop worker, research, and every `agents/*.md` role. The `model:` in an agent file becomes only the last-resort default.
- **One resolver** (`resolve-model.sh <slot>` / `resolve-dispatch.mjs`) answers every slot. It never fails because a file is missing; each layer only overrides the one below:
  1. built-in defaults in `references/model-registry.json`;
  2. the owner's `~/.svc/dispatch-policy.json`;
  3. the project's `.svc/slots.json`;
  4. per-work-item decisions in `.svc/slots-<WI>.json`, written by the planner or orchestrator (for example "EXEC on Opus for this auth change", "add a security lens"), each with a reason that is also appended to `pipeline-decisions.jsonl`;
  5. `SVC_SLOT_<NAME>` environment overrides, for a single run.
- **Every answer records where each field came from** (`source: registry | owner | project | decision:<id> | env`). Receipts carry the resolved tuple, so a run is reproducible and auditable.
- **Dispatchers pass the resolved tuple.** The Agent tool's model and effort parameters, the launcher's host and model, and probe-loop's worker model all take the resolved tuple instead of a hard-coded one.
- **Review slots also pass through the ladder.** A decision can raise a review slot (more lenses, a stronger model). It can never lower one below what the gate requires for the profile and zones.

## Threat model
| Threat | Stopped by | Negative test |
|---|---|---|
| A production change reviewed only by the same family | Profile and zone check on the gate | production graph + `same-family-stronger` receipt: refused |
| Auth, money, data, deploy or secrets touched in an MVP | Zones re-derived from the diff, not declared | MVP diff touching `src/auth/*` + rung 2: refused |
| Claiming no other family was available when one was | Probe file is hash-bound in the launcher receipt; a stale or missing probe refuses | probe older than 24 h or showing codex available: refused |
| Labelling a weaker or equal model as stronger | Strength re-derived from tuples and the registry order | Sonnet reviewing Sonnet labelled rung 2: refused |
| A reviewer that edits the code it reviews | Read-only tool list required in the launcher receipt | rung-2 receipt with Bash or Edit: refused |
| Synthesized policy granting release | `source: synthesized` never carries `release_authority` | synthesized policy + release request: refused |
| Old receipts changing meaning | `review_route` defaults to `cross-family` | existing tier-1 receipt fixtures unchanged and green |
| A per-decision override lowering review below the gate's need | The gate checks the reviewer tuple it receives, not the slot file | `slots-<WI>.json` sets review.exec to Haiku on an MVP with Opus executor: the receipt is refused |
| A missing or malformed slot file breaking dispatch | Each layer is optional and validated; a bad layer is skipped with a warning naming it | malformed `.svc/slots.json`: resolution falls back to the owner/registry layers and says so |

## What does not change
Rung-1 cross-family review and its gates; owner configs; the reviewer allowlist; release authority; refuse mode; production and the framework lane, which still need cross-family review or a recorded waiver.

## Rollout
1. Probe and synthesized default policy, with tests (no gate change yet): reviews now run and are labelled.
2. Gate acceptance for rungs 2 and 3, with every threat-model row as a failing-first tier-1 test.
3. A fresh-project Haiku run confirms route-workflow reaches a labelled review receipt with no owner config.

## Adversarial review (2026-10-11)
Reviewer: a fresh-context Opus agent, read-only, against the code named above. Verdict: accept the ladder with changes; reject the slot section as written. Accepted findings, each with its disposition:

| # | Finding | Disposition |
|---|---|---|
| 1 | `delivery_profile` and the graph are agent-writable, so a profile-gated rule can be bypassed by declaring `mvp` | Gates stop trusting the profile at all (see revised decision) |
| 2 | Zones come from planner-declared files; the path regex misses oauth, jwt, rbac, prisma, release workflows | Same: no zone-based relief; zones can only add review |
| 3 | A probe file is forgeable and stale; Cursor is family `multi` | No probe file as evidence: the launcher attempts the other family and its signed failure receipt is the proof |
| 4 | "Stronger model" does not order cleanly; alias tuples fail `model_mismatch`; the executor tuple is declared, not observed | One rung only: the family's pinned top model, effort ≥ high, `server_observed` attestation |
| 5 | No Bash would weaken the reviewer (it must prove findings) | Keep `--tools Read,Grep,Glob,Bash --permission-mode plan`; add the tree-unchanged check the codex host already has |
| 6 | Contradicts review-cross-model's single-vendor doctrine (drain queue) | Keep the drain queue: same-family reviews never authorise promotion |
| 7 | Same-family runs have no round cap, so verdicts can be shopped | Own signed cap of 2 per WI and kind |
| 8 | Receipt schema, launcher version and cache-key changes were missing | Listed in the build steps below |
| 9 | The five slot layers duplicate resolve-dispatch's overlays and are agent-writable above the owner | Slot section withdrawn; reuse existing layers; only fix the missing-file crash |
| 10 | The Agent tool takes aliases only and gives no attestation | Agent-dispatched work is never reviewer evidence; ladder reviews run only through the launcher |
| 11 | Lenses carry no provenance | Lenses stay advisory; one attested launcher pass is the review |
| 12 | Anthropic-only; plan-reviewer is referenced by sync scripts | Generic over the family's top model; drop Bash in plan-reviewer source only |

## Revised decision (what gets built)
1. **No owner file is not an error.** `resolve-dispatch.mjs` falls back to the registry defaults when `~/.svc/dispatch-policy.json` is absent; a present but malformed owner file still fails closed. Owner deny/allow apply after every layer. Per-work-item model decisions use the existing work overlay; per-run overrides use the existing receipt-gated session override. No new layers.
2. **Review always runs.** The launcher tries the configured or available different-family reviewer first. If that attempt ends in a signed, classified unavailability (no station that can be independent, missing binary, authentication, entitlement, quota), it runs the same family's pinned top model at effort ≥ high through its `claude -p`-style transport, in plan mode, with the tree checked unchanged afterwards and the served model attested.
3. **Labelled for what it is.** That receipt carries `review_route: same-family`, never `independent: true`. Same-family runs have their own cap of 2 per work item and kind.
4. **What it authorises.** A same-family review satisfies the chain's review steps so work proceeds. It never authorises promotion (land-changeset, verify-promotion, production): those still need a cross-family review covering the range, or the owner's explicit `same_family_release: accept` in the owner-protected policy, recorded in the receipt. Same-family-reviewed ranges are queued for a cross-family pass when one becomes available.
5. **Tests first**, one per review finding above, before any gate change.
