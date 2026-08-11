# Problem Brief: feature-discussion-phase

## Problem statement

svc has a confirmed framework gap around gray-area handling. Today the pipeline
can validate a feature and then move into spec, UX, tech design, and planning,
but it does not have a first-class way to stop on bounded, high-impact
ambiguity that is not primarily business validation and not yet implementation.

The required capability must detect when that ambiguity is real, research it,
record the result in a durable topic-scoped artifact, and make downstream
skills inherit the settled decisions instead of re-litigating them.

## Upstream context

- Vision principles: no `docs/specs/vision.md` exists in this repo, so product
  direction is inferred from repo doctrine: file-backed continuity, explicit
  routing, small helpers over subsystems, and cross-host replayability.
- Persona constraints: no `docs/specs/personas/` exists, so the active
  consumers are system personas from the journeys: router/orchestrator,
  maintainer/builder, and direct invoker.
- Key ACs:
  - `DISC-02`, `DISC-03`, `DISC-05`, `DISC-06`: discussion must trigger only
    when needed and stay bounded.
  - `DISC-08`, `DISC-10`, `DISC-11`, `DISC-13`: hard choices need ranked
    alternatives plus evidence and brownfield scouting.
  - `DISC-14` through `DISC-19`, `DISC-25`: one durable topic artifact plus
    decision-log provenance.
  - `DISC-20` through `DISC-24`, `DISC-26`: downstream routing and enforcement
    must consume the result deterministically.
  - `DISC-ZERO`: the capability must work even without an existing target spec.
- Journey complexity:
  - J01 requires a clean proceed path with bounded scope and durable handoff.
  - J02 requires deterministic block/reroute behavior and contradiction
    enforcement.
  - J03 requires zero-state bootstrap from prompt or framework gap.

## Repo evidence used in this exploration

- `docs/specs/features/feature-discussion-phase.md`
- `docs/specs/journeys/J01-discussion-proceed.feature.md`
- `docs/specs/journeys/J02-discussion-block-or-reroute.feature.md`
- `docs/specs/journeys/J03-discussion-zero-state.feature.md`
- `docs/specs/decisions/README.md`
- `docs/specs/decisions/discussion-phase.md`
- `README.md` and `DOCTRINE.md` references to `.svc/pipeline-decisions.jsonl`
- `route-workflow/SKILL.md`
- `scripts/pipeline-log.mjs`

## Success criteria

### Must

- Meet the detection and bounded-scope contract in `DISC-02`, `DISC-03`,
  `DISC-05`, and `DISC-06`.
- Support evidence-backed alternatives and reversibility-aware defaults from
  `DISC-07`, `DISC-08`, `DISC-09`, `DISC-11`, and `DISC-13`.
- Perform brownfield scouting before recommendations per `DISC-10`.
- Write a topic-scoped durable artifact at
  `docs/specs/discussions/<topic>.md` with statuses and downstream mappings per
  `DISC-14`, `DISC-15`, `DISC-16`, and `DISC-25`.
- Support block, defer, and reroute semantics per `DISC-17`, `DISC-18`,
  `DISC-22`, `DISC-23`, and `DISC-26`.
- Let downstream skills and routing consume the result deterministically per
  `DISC-20` and `DISC-21`.
- Allow `review-gate` to fail contradictions per `DISC-24`.
- Work without a pre-existing feature spec per `DISC-ZERO`.

### Should

- Match the repo's markdown-first, human-readable artifact conventions.
- Avoid introducing a second workflow engine or a new long-lived state store.
- Reuse existing decision-log infrastructure instead of inventing a parallel
  audit trail.
- Keep cross-host behavior easy to explain and replay.

### Nice

- Make future aggregation and reporting across many discussion topics easy.
- Minimize repeated parsing logic across downstream skills.
- Keep the artifact simple enough to inspect in plain diffs during reviews.

## Baseline approach (from tech design)

The current baselined design adds a first-class `discuss-phase` skill as an
optional interstitial phase after `validate-feature` and before `write-spec`,
with limited re-entry from later phases. It writes
`docs/specs/discussions/<topic>.md`, appends material decisions to
`.svc/pipeline-decisions.jsonl`, uses a small Node helper to validate and
summarize the artifact, and adds pre-flight consumption plus contradiction
checks in downstream skills and `review-gate`.

## Assumptions to challenge

1. A dedicated skill is necessary, rather than extending existing decision or
   review artifacts.
2. The canonical home for gray-area resolution must be
   `docs/specs/discussions/`, not `docs/specs/decisions/` or the feature spec.
3. A helper script is justified; pure markdown conventions are not strong
   enough for routing and review enforcement.
4. Early interstitial placement is better than later arbitration during design
   or review.
5. The repo benefits more from topic-scoped human-readable discussion records
   than from a machine-first registry.

## Constraints

- No matching bootstrap template exists under `references/bootstraps/`.
- This is svc-on-svc work, so the artifact contract and routing semantics will
  become doctrine if accepted.
- The repo is docs-first and already treats `pipeline-decisions.jsonl` as an
  append-only audit trail, not a workspace.
- The design explicitly forbids new third-party orchestration, scoring, or
  state-machine dependencies.
- The first-demo requirement is local-only, zero-credential, zero-network.
