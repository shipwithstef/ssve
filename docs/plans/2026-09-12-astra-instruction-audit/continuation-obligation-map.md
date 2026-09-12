# Read-only continuation map

Baseline: e50a64431955cac787c39161f03a18021386086f. All three source hashes are recorded in inventory.json and remain unchanged. This is a planning aid prepared after the round-2 candidate was frozen; it was not part of that independent review. Source consolidation remains deferred under D3/D7.

## Shared obligations to retain in any later consolidation

| Obligation | Baseline locations |
|---|---|
| Task description and metadata.skill route to the actual skill; canonical JSON is the cross-host state | analyze-domain:300; evaluate-rule:320; sync-work-items:182 |
| Read/update canonical lane graph before UI mirroring; Kimi UI is observation, Codex mirrors only an active step | Same first blocks and their Chaining repetitions |
| Only the parent mirrors UI; no child TaskUpdate; parent rereads durable state after children return | analyze-domain:310; evaluate-rule:330 and 350; sync-work-items:192 |
| Complete current task before leaving, evaluate actual next-task conditions, persist runnable state, load next skill before work | All three continuation blocks in each file |
| Only actual eligible skips have skip reasons; evaluate the subsequent runnable task | All three continuation blocks, subject to canonical task-graph helper restrictions |
| Phase-specific evidence is distinct from a load-skill receipt | analyze-domain:262; evaluate-rule:295; sync-work-items:167 |
| Recovery reads canonical graph, chooses in_progress or first runnable pending, reloads skill, checks load receipt, and prefers graph over checkpoint disagreement | analyze-domain:348; evaluate-rule:384; sync-work-items:240 |

The local prose often says to write graph status directly; the existing helper enforces permitted transitions. Mapping those words does not authorize direct ghost-completion or creating a graph for a standalone invocation.

## Unique behavior outside repeated blocks

| Skill | Unique obligations that a repeated-heading deletion could lose |
|---|---|
| analyze-domain | Preserve audit mode's section-by-section current/stale/outdated report. Discovery-wave concurrency is opt-in, requires the disjoint-write fence and retains validate-feature gating. Serial progressive mode chains to analyze-competitors only after self-verify; standalone mode reports domain summary and next suggestion. Preserve phase receipts and existing self-verify table. |
| evaluate-rule | It is a standalone rule utility, not a product lane. Preserve no-manifest-mutation phase, conditional cross-model/batch evidence, and absence-of-graph reporting contract. Preserve the separate adopt/reject/batch next-action instructions as currently written; their output/deletion implications remain owner proposals, not permission in this audit. Do not change same-context evaluation, age-based reuse or verdict methodology under a continuation edit. |
| sync-work-items | Repo work items remain canonical; sync is outward and issue-number writeback stays local. Preserve six phase receipts and the current self-verify requirements. Progressive mode terminates brownfield-conversion/drift; non-progressive mode reports and routes work items by type. Do not turn the generic runnable-next paragraph into automatic continuation past a terminal lane. No GitHub write is authorized by reading this skill for the audit. |

## Conflicts left explicit

1. First/generic blocks describe UI mirroring without the parent-only qualifier; later blocks forbid child TaskUpdate. Any consolidation must carry the stronger qualifier in the single operative block. It cannot present unrestricted mirroring first and rely on a child reading the parent prompt. D7 owns authority wording.
2. All three lack Before Starting sections. The shared textual rule treats substantive edits as triggering its requirement, while the validator presently uses dates/family coverage. Baseline passes 113/0/0. This does not prove the text conflict harmless. D3 resolves eligibility before a source edit.
3. Generic next-task continuation must remain conditional on the skill's standalone/progressive/terminal behavior. No shared product-runtime contract may silently erase those unique conditions.

No conflicting source text was removed, no phase execution was invented, and no evaluation/issue-sync action was performed.
