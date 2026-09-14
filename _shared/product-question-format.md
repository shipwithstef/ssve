# Product decisions (shared contract)

Use this contract when a skill encounters an unresolved consequential product decision. Depth follows the decision's consequences; question counts and decorative analysis are not evidence of quality.

## Ground the decision before asking

Read current owner instructions and accepted decisions, the relevant current spec/AC/journeys and personas, and actual implementation evidence. Follow the dependencies that affect the requested behavior. Reuse evidence already loaded while checking its freshness. Code shows what happens; it does not approve what should happen. A stale spec is not automatically authoritative over a newer owner decision, and existing code is not automatically the desired design.

Expose conflicts between intended behavior, observed behavior and owner scope. Investigate missing relevant evidence before concluding there are no decisions. Mark unresolved facts as unknown; do not invent competitor behavior, numeric benchmarks or quota balances. Research only gaps that matter to the decision.

A **consequential decision** materially changes user outcomes, scope, acceptance criteria, compatibility or data handling, significant cost, or a hard-to-reverse commitment. An outcome request does not silently resolve a conflicting storage, compatibility or release policy. Resolve that conflict explicitly before dependent implementation.

## Use judgment proportional to the consequence

For a real decision, present a plain-language choice and recommendation supported by:

- Relevant evidence and conflicts, including current spec and actual code.
- Meaningful alternatives and the reason for the recommendation.
- Persona/user fit and affected journeys, states and accessibility needs.
- Material risk, cost, reversibility and mitigation.
- A measurable success signal appropriate to the outcome.
- Useful innovation: consider a better approach when it improves this user task; explain why to adopt, defer or retain the established solution.

Combine these dimensions in concise prose or a table. Expand only where the decision needs it. There is no fixed heading, question, consideration or competitor count. Verified competitor examples are useful when they change the choice; internal policy conflicts do not require unrelated competitor research. Do not invent novelty to fill a template or replace product-specific UX with a generic pattern list.

## Resolve only what remains unresolved

Carry forward explicit task authorization and clear accepted decisions. Existing AGREE/OVERRIDE history remains valid when its accepted meaning is clear; do not require those literal keywords again. The agent may resolve reversible implementation details within authorized scope, recording the rationale in the existing brief/plan. Consequential owner choices remain owner choices; silence and elapsed time are never approval.

Independent questions may be grouped outside the signed runtime flow. Within product-outcome runs, preserve `references/owner-decision-runtime-v2.md` and `skills/decide/SKILL.md`: use the configured signed decision/delegation boundary, deduplication and mode. This reference does not grant new signing or release authority.

When a consequential decision arises, record its question, evidence, alternatives/recommendation, real resolution and phase in the existing canonical decision artifact or `docs/specs/features/<feature>-questions.md` / `docs/specs/work-items/<WI>-questions.md`. Read that history on resume. Do not create an empty companion when no consequential decision arose. Do not convert an unresolved entry to resolved merely to advance.

## Promotion predicate

Apply the same predicate at review-gate G1, design-ux UX-REVIEWED, write-spec/design-tech BASELINED, and plan-changeset SIMULATED:

1. Relevant acceptance criteria and user/system states have supporting evidence or explicit scoped limitations that do not invalidate the proposed phase.
2. No unresolved consequential decision blocks that phase's dependent work.
3. Every required owner decision has a real resolution under the applicable authority contract.

Missing relevant evidence is not proof of zero decisions: investigate it and surface consequential uncertainty. An absent companion is acceptable only when no consequential decisions arose or their resolutions are preserved in the existing canonical decision artifact. A resolved, fully grounded feature can advance with zero new questions. There is no numeric question floor. Other applicable quality and release checks still apply.

## Examples

An already-authorized local category filter with current ACs and established empty/loading/error/accessibility patterns needs no repeated persistence question. Preserve those states and verify the actual filter path.

A request for cross-device restoration conflicting with an accepted no-account-storage boundary needs a real persistence decision. Surface the conflict, explain storage/fallback/clear semantics and affected ACs, recommend an option, and block dependent implementation until resolved. Do not research unrelated competitors to fill a quota.

Retain a worthwhile deferred innovation in the existing project backlog when useful; do not create another mandatory ledger. Historical question logs remain historical evidence, not a minimum template for future work.
