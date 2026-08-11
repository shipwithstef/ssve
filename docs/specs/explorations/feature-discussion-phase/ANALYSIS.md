# Analysis: feature-discussion-phase

## Tradeoff Matrix

Legend: `✅` satisfies cleanly, `⚠️` can satisfy with meaningful cost or drift
risk, `❌` materially conflicts with the criterion.

| Criterion (source) | A1 | A2 | B1 | B2 | C1 | C2 | D1 |
|---|---|---|---|---|---|---|---|
| MUST: Trigger only on real ambiguity and keep scope bounded (`DISC-02`, `DISC-03`, `DISC-05`, `DISC-06`) | ✅ Dedicated phase owns trigger and can stop at `not-needed` | ✅ Same trigger model possible | ⚠️ Split artifacts complicate "already settled" checks | ❌ Depends on an existing spec, so zero-state/bounded pre-spec flow is weak | ✅ Structured register can enforce bounded sets | ⚠️ Audit-log reconstruction makes settled-vs-open detection noisy | ❌ Too late; no dedicated early trigger |
| MUST: Evidence-backed alternatives and defaults (`DISC-07`, `DISC-08`, `DISC-09`, `DISC-11`, `DISC-13`) | ✅ One topic workspace can hold ranked options, defaults, and evidence | ✅ Same, but consumers may read fields inconsistently | ⚠️ Rationale is strong, but alternatives and mutable state are split across files | ⚠️ Works once a spec exists, weak before that | ✅ Strong structure for alternatives and evidence | ⚠️ Audit log can record alternatives but is awkward for current best state | ❌ Gate-time comments are poor substitutes for a curated alternative set |
| MUST: Brownfield scouting before recommendation (`DISC-10`) | ✅ Explicit pre-flight in the phase | ✅ Same | ✅ Same | ⚠️ Later placement means scouting happens after more assumptions are already written | ✅ Same | ⚠️ Can log scouting, but not present it as a stable topic record | ❌ Scouting happens too late, after design churn begins |
| MUST: Durable topic artifact with statuses and required fields (`DISC-14`, `DISC-15`, `DISC-16`, `DISC-25`) | ✅ Native fit: one canonical `docs/specs/discussions/<topic>.md` | ⚠️ File exists, but no helper means schema drift risk across hosts | ⚠️ Requires a thin discussion file plus a separate canonical decision file | ❌ Snapshot model makes the feature spec the real source of truth, not the required discussion artifact | ⚠️ Can generate the markdown artifact, but canonical truth lives elsewhere | ❌ `pipeline-decisions.jsonl` is not a topic-scoped workspace | ❌ No durable discussion artifact |
| MUST: Block, defer, and reroute safely (`DISC-17`, `DISC-18`, `DISC-22`, `DISC-23`, `DISC-26`) | ✅ Designed for explicit terminal states and next-step routing | ⚠️ Possible, but duplicated readers increase inconsistent behavior | ⚠️ Possible, but owner/next-step state split from rationale | ⚠️ Deferred and blocked state becomes awkward inside a feature spec | ✅ Strong machine-state handling | ⚠️ Append-only log is weak for live blocked/open state | ❌ Late review can block, but not reroute early with clean summaries |
| MUST: Downstream pre-flight consumption and next-skill routing (`DISC-20`, `DISC-21`) | ✅ One artifact + helper is easy to consume | ⚠️ Every consumer must hand-roll parsing | ⚠️ Consumers must join operational register with decision file | ❌ Downstream phases cannot rely on a spec-existing path in zero-state runs | ✅ Strongest for machines, but adds generation/sync overhead | ⚠️ Query helper becomes a hidden subsystem | ❌ No stable pre-flight contract |
| MUST: Contradiction enforcement in `review-gate` (`DISC-24`) | ✅ Clear single artifact to compare against | ⚠️ Enforcement exists, but schema ambiguity weakens confidence | ⚠️ Review must decide whether discussion file or decision file is authoritative | ⚠️ Revision-log supersession becomes tangled with normal spec edits | ✅ Strong machine compare, weaker human review ergonomics | ⚠️ Hard to identify current settled decision from append-only history | ❌ Review becomes the first place decisions are made, not enforced |
| MUST: Zero-state invocation without a target spec (`DISC-ZERO`) | ✅ Topic can be derived from prompt or framework gap | ✅ Same | ✅ Discussion file can exist without a feature spec | ❌ Cannot start cleanly without first inventing a spec | ✅ Same | ✅ Same in theory, but the rendered "current state" is costly | ⚠️ Can ask questions, but not produce the required artifact cleanly |
| SHOULD: Fit repo doctrine and avoid duplicate truth | ✅ Matches docs-first patterns and uses existing decision log as audit trail | ⚠️ Minimal code now, more drift later | ⚠️ Reuses existing decisions area but creates two canonical-seeming homes | ⚠️ Keeps context near specs but distorts pipeline order | ❌ Most machine-rigorous, but overbuild for a docs-first repo | ❌ Reinterprets an audit log as a mutable workspace | ⚠️ Few new files, but pushes churn into later skills |
| NICE: Future aggregation and analytics across discussions | ⚠️ Achievable with a helper, not native | ❌ Hardest to aggregate safely | ⚠️ Moderate, if both files stay aligned | ❌ Snapshot model is poor for aggregation | ✅ Best option if future reporting becomes primary | ⚠️ History is rich, current state is hard | ❌ Very weak |

## Eliminated

- **A2**: fails the spirit of `DISC-20`, `DISC-21`, and `DISC-24` because each
  downstream skill would need its own parser and interpretation rules. The
  initial savings are small; the long-term contract risk is high.
- **B2**: fails `DISC-ZERO` and weakens `DISC-14` because it makes the feature
  spec the real source of truth for a capability that must exist before a spec
  is guaranteed to exist.
- **C2**: fails `DISC-14` and underperforms on `DISC-15`, `DISC-17`, and
  `DISC-18` because `pipeline-decisions.jsonl` is an audit trail, not a mutable
  topic workspace.
- **D1**: fails `DISC-02`, `DISC-06`, `DISC-20`, `DISC-21`, and `DISC-ZERO`
  because it moves ambiguity handling too late and cannot provide a stable early
  handoff contract.

## Finalists

1. **A1** (baseline, Paradigm A)
   Best overall fit to the current AC set. It is the lightest option that still
   creates one readable canonical artifact, supports zero-state use, and gives
   downstream skills a stable contract.

2. **B1** (decision-record-centric, Paradigm B)
   Attractive because the repo already has `docs/specs/decisions/`, but it
   forces an awkward split between operational state and rationale. It is viable
   only if svc deliberately accepts two tightly coupled artifacts per topic.

3. **C1** (machine-first registry, Paradigm C)
   Strongest on determinism and future aggregation. It remains viable, but the
   generator/sync burden is hard to justify for a docs-first framework feature.

## Key differentiator

The decision turns on one question:

**Is the extra machine rigor of a canonical structured registry worth paying
for now, given that the current repo culture and review flow are built around
human-readable markdown as the first-class artifact?**

Repo evidence says no. The existing pattern is markdown artifact plus thin
helper, not generated views over canonical structured state.

## Runner-up value

**C1** is the clear runner-up. If svc later needs machine-level aggregation
across many concurrent discussion topics, cross-repo reporting, or automated
bulk contradiction checks, C1 becomes more attractive than A1 because the data
already has a canonical schema.
