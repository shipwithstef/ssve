# plan-changeset — Adversarial plan review detail

## Adversarial Plan Review

After simulation passes but BEFORE handoff, run a brief adversarial self-check
on the manifest. This catches plan-quality issues that file-level simulation
misses: missing ACs, wrong task ordering, scope reduction, ungrounded assumptions.

Source: ECC blueprint adversarial review gate (MIT, Copyright 2026 Affaan M.),
adapted for svc's spec-first manifest format.

### The Check

Re-read the feature spec's AC list. For each AC, confirm the manifest's
AC-to-task mapping covers it with a task that will actually implement it —
not just reference it.

Then answer these five questions (write answers inline in your response,
not in the manifest):

1. **Missing tasks:** Is there any AC or journey step with no implementing task?
   If yes → add the task before handoff.
2. **Dependency correctness:** Walk the task graph edges. Can every task's
   imports and prerequisites be satisfied by its declared dependencies?
   If no → fix the dependency order.
3. **Scope reduction:** Grep the manifest for banned phrases (see Scope
   Reduction Prohibition). If found → rewrite the task.
4. **Validation strength:** For each task's validation command — will it
   actually catch a failure in what the task builds? A `tsc --noEmit` does
   not validate API behavior. An `npm test` without a test file does not
   validate anything. If weak → strengthen or flag.
5. **First-task viability:** Can an agent execute Task 1 from a clean worktree
   with only the base branch + the spec + the manifest? If Task 1 assumes
   context from the current session that won't exist in a fresh worktree →
   add the prerequisite to Task 1's description.
6. **Pattern-family completeness (for grep/regex ACs):** For each AC whose PASS
   criterion is a grep/regex/pattern match, does the manifest include BOTH a
   narrow match (exact AC wording) AND an adjacent-pattern sweep (variants the
   narrow match misses)? See `references/validation-patterns.md` for common
   pattern families (gradient stops, color tokens, routes, endpoints, flags).
   A manifest with only the narrow match for a pattern-family AC is incomplete
   — it will pass while edge cases leak to prod. If missing → copy the
   adjacent-sweep command from the reference and add it to the validation plan.
7. **Visual-rendering AC tier (for UI ACs):** For each AC whose PASS criterion
   is "X renders / displays / does not show / appears as [visual state]", does
   the manifest include at least one screenshot or track-visuals diff as
   evidence? CSS class presence alone is NOT sufficient for visual-rendering
   ACs. If missing → add a `track-visuals` or screenshot-capture step BEFORE
   the AC is marked met.
8. **Production-derived mock parity (for existing UI MODIFY tasks):** For each
   browser-visible task that modifies an existing component/screen/shared UI,
   does the manifest cite the Production-Derived Mock Parity Ledger and map its
   component usages, current-state evidence, intended final-state evidence,
   states, viewports, specs, and journeys to planned tasks? If missing → route
   back to `design-ui`; generic standalone mocks cannot pass this check.
9. **Provider-fidelity AC tier (for generated/provider-backed ACs):** For each
   AC whose PASS depends on a named provider or generated output, does the
   manifest include provider requested, provider used, fallback policy,
   fallback approval, source evidence, saved-state proof, and final result? If
   missing → add a `PROVIDER_FIDELITY_EVIDENCE.md` step and validator command
   before review.
10. **Persona trace carried into implementation:** For each user/admin-facing
   AC, does the manifest map tasks and tests back to concrete persona IDs/paths
   from the feature spec, journey, UX/UI, or tech design? If the manifest only
   says `customer`, `admin`, `all users`, `PASS`, or `satisfied`, route back to
   the missing upstream artifact before execution.

If all ten pass: proceed to Handoff.
If any fail: fix the manifest, re-check, proceed only when all pass.

This review is a 2-minute self-check, not a sub-agent delegation. The point
is forcing a second read of the manifest from the perspective of "will this
actually work when someone else executes it cold?"

### Decision Logging

After the manifest passes adversarial review and simulation, log the plan summary. The `run_id` comes from the active task graph.

```bash
# Plan structure (mechanical — the manifest is the plan)
node scripts/pipeline-log.mjs append \
  --path .svc/pipeline-decisions.jsonl \
  --run-id "<WI-ID>" \
  --skill plan-changeset \
  --phase "<task-id>" \
  --type mechanical \
  --decision "Manifest: <N> tasks, <N> ACs mapped, <N> parallel groups. Branch: <branch-name>" \
  --reasoning "Simulation: <N> PASS, <N> WARN, <N> FAIL. Adversarial review: all 5 checks passed" \
  --decided-by P0 \
  --overrideable false
```

If any simulation warnings were acknowledged (not fixed), log each as a separate `taste` entry with the rationale for proceeding despite the warning.

