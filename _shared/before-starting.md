# Before Starting — relevance-closure context loading

Every svc skill SHOULD begin its work by checking what the project already knows. The goal is **complete relevant context**: read enough indexed and dependency-linked material to understand the affected surface, then stop. Do not read every project artifact by default, and do not stop at the minimum file list when the loaded artifact points to a dependency, spec, work item, validator, or decision that materially affects the task.

## The context spine

| # | Source | What it answers |
|---|--------|-----------------|
| 1 | `.svc/session-contract.jsonl` | What is the current user intent, skill, WI binding, and execution mode? |
| 2 | `.svc/spec-index.json` | Which specs, work items, journeys, reviews, and sections mention the target surface? |
| 3 | `~/.svc/builder-profile.md` | Who is the builder? Their stack, role, time budget, prior decisions. |
| 4 | `docs/specs/project-state.md` or `FRAMEWORK-STATE.md` | Where in the pipeline are we? What is the active feature or framework surface? |
| 5 | `docs/specs/domain-profile.md` when present | What industry / framework / convention pack applies? What constraints does the domain impose? |
| 6 | Relevant specs, work items, journeys, reviews, validators, and decision logs | What behavior contract, dependencies, acceptance criteria, and known findings govern this change? |

## Relevance-closure rule

A skill MUST resolve a bounded context plan before acting:

1. Start from the session contract, user request, active WI, or explicit artifact path.
2. Query `.svc/spec-index.json` via `scripts/query-spec-index.mjs --wi <WI>` or `--surface <term>` (bounded ≤2K tokens, WI-389 — never raw-load the 692KB index), plus `docs/specs/work-items/INDEX.md`, manifest metadata, or the relevant skill contract to find linked specs, dependencies, validators, and reviews.
3. Read each artifact whose content can change the decision or implementation.
4. Stop when the remaining links are unrelated, historical-only, or duplicate the already-loaded contract.
5. If the needed dependency map or index is missing, create or update that mapping as part of the work instead of guessing.

This is neither "minimum context" nor "read everything." Token control comes from following the dependency graph, not from ignoring related context.

## Expected reads by work type

| Work type | Usually read | Expand when |
|---|---|---|
| Routing | session contract, spec index, work-item index, routing rules | The WI references a proposal, review finding, or dependent WI. |
| Spec or planning | builder/profile context, domain context, current feature spec or WI | Existing journeys, decisions, or related WIs define constraints. |
| Execution | approved plan, active spec, worktree state, relevant validators | Code or tests point to a related contract not already loaded. |
| Validation or audit | artifact under review, source finding, validator, evidence paths | The finding depends on manifest, hook, host, or state-file wiring. |
| Framework work | `FRAMEWORK-STATE.md`, affected skill/hook/script, manifest, relevant validator | Host setup, installed state, or cross-host behavior is part of the claim. |

## How a skill applies the rule

Each SKILL.md should declare a `## Before Starting` section near the top of its prose with one of these forms:

```markdown
## Before Starting

Build a bounded context plan:
- Start from `.svc/session-contract.jsonl`, the active WI, or the explicit user artifact.
- Use `.svc/spec-index.json` / work-item indexes / manifest metadata to find dependencies.
- Read all artifacts that can change this run's decision or implementation.

Skip if: <named condition under which the read is wasted>.
```

If a skill has NO context dependencies (rare; mostly mechanical scripts), it MAY omit the section. Otherwise the section is mandatory for skills authored on or after **2026-04-28**.

## Why this rule exists

Sessions repeatedly burn tokens re-asking questions already answered (builder name, stack, current feature, domain conventions). The 4-source chain is the floor of "things the agent should know before saying anything." Adopting it as a convention closes a token-waste loop that has fired across multiple sessions.

The opposite failure is also real: an agent can read only one obvious file, miss a related spec or dependency, and then skip a mandatory branch. Relevance closure prevents both failures.

The pattern was imported from coreyhaines/marketingskills v1.9.0 and adapted from a 1-file model to svc's 4-source layered model. See WI-135 for full context.

## Validation

Skills authored on or after 2026-04-28 are validated by `test-framework/evals/tier-1/validate-skill-before-starting.sh`. Older skills are exempt (advisory mode) until they receive a substantive edit; at that point the validator becomes blocking for them as well.
