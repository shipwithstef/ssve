### Phase 2c — Hybrid Innovation (for every BLEND and IMPROVE item)

Blending is not transplanting. For every item marked BLEND, IMPROVE, or
HYBRID in the comparison table, ask these questions BEFORE writing the
blend plan:

1. **What would a 10/10 version look like that NEITHER source has?**
   The source solves the problem one way. svc has different machinery
   (progressive narrowing, 7 gates, spec-first, builder profiles, knowledge
   system). Can svc's existing architecture make this pattern fundamentally
   better?

2. **Can we combine insights from MULTIPLE sources?**
   Check the blend registry — has another source addressed a related problem?
   Example: gstack has Review Army specialists + superpowers has two-stage
   review ordering → svc can run specialists in two stages (spec compliance
   first, code quality second) — a hybrid neither source has.

3. **What's the failure mode of a naive transplant?**
   Taking a pattern designed for a different architecture often produces a
   weaker version. gstack's Review Army was designed for /review (pre-landing).
   Transplanting it into svc's audit-implementation (post-execution, spec-aware)
   means the specialists can cross-reference ACs — which gstack's can't.
   That's an improvement. But if you transplant without leveraging the
   architectural difference, you get a copy that's worse than the original.

4. **Does this blend item make an existing svc strength STRONGER?**
   The best blends amplify what svc already does well. Adding failure triage
   to execute-changeset amplifies TDD (already strong). Adding a health
   dashboard would not amplify anything (svc doesn't do monitoring).

**Output:** For each BLEND/IMPROVE/HYBRID item, add a "Hybrid opportunity"
note in the blend plan describing what the hybrid creates that neither
source has alone. If no hybrid is possible (pure transplant is the right
move), say so explicitly.

### Phase 2b — Rethink past blends (mode 4, or always in audit mode)

For each pattern previously taken from this source (read from blend registry):

1. **Read the current svc implementation** of the blended pattern
2. **Read the original source** to remember what was taken
3. **Assess the adaptation quality:**
   - Did we take the right parts? Or did we miss the key insight?
   - Did we over-adapt and lose the original value?
   - Did we UNDER-adapt — just transplant without leveraging svc's architecture?
   - Is the svc version now BETTER than the source? If not, why not?
   - Could we create a hybrid that's better than both? (combine with another
     source, leverage svc machinery like gates/specs/knowledge system)
   - Has svc evolved since the blend in a way that makes the adaptation
     awkward or redundant?
   - Has the source itself evolved the pattern in a better direction?
4. **Check skipped patterns:** Review `patterns_skipped` in the registry.
   Were any skip decisions wrong in hindsight? Has svc's growth created a
   need that a previously-skipped pattern would now address?

Build a rethink table:

| Blended pattern | svc skill | Verdict | Action |
|----------------|-----------|---------|--------|
| P0 founder persona | route-workflow | Adaptation is solid, working well | KEEP |
| /cso security audit | review-security | We took the checklist but missed the verification loop | IMPROVE: add active verification |
| /learn memory | manage-learnings | svc's quality gate is better than original | KEEP (svc improved on source) |
| /ship PR workflow | land-changeset | Redundant since we added our own version bump logic | SIMPLIFY: remove source-derived parts |

| Skipped pattern | Original reason | Reassessment | Action |
|----------------|-----------------|--------------|--------|
| /freeze scope guard | "land-changeset covers this" | Still true | KEEP SKIP |
| /retro weekly review | "not relevant" | Now that we have manage-learnings, a retro could feed it | RECONSIDER |
