# Route-Workflow Prompt Composer

Use this reference when `route-workflow` is invoked by a human as an entry
point or next-step advisor. The output is not just "run skill X"; it is a
ready-to-send prompt that carries enough framework context for the next agent
turn to execute the correct skill with the correct evidence and proof gates.

## Invocation Modes

| Mode | Signal | Behavior |
|---|---|---|
| `human_prompt_composer` | User asks "what next", names `$route-workflow`, gives freeform work intent, or asks which skill/lane to run | Return a complete prompt package. Do not self-dispatch. |
| `internal_continuation` | Stop hook, delivery graph, autorun, or a host platform invokes route-workflow non-interactively | May dispatch or resume according to the existing task graph and host contract only when the latest user prompt still aligns with that WI or explicitly resumes it. If `.svc/active-intent-state.json` suppresses that WI, compose advisory context instead of execution instructions. |
| `explicit_autorun` | User asks to keep going, use `/loop`, use `/goal`, or complete end-to-end | Compose the prompt and include the recommended continuation primitive; still state the task graph and proof gates. |

If the mode is ambiguous, default to `human_prompt_composer`.

## Search Contract

Before composing the prompt, search the framework surface that can affect the
next step:

1. Latest session contract, active WI, claim, and lane task graph.
2. `docs/specs/project-state.md`, work-item index, spec index, and artifacts
   referenced by the active WI or user request.
3. `skills-manifest.json`, `skills/route-workflow/references/lane-model.md`,
   `skills/route-workflow/references/routing-rules.md`, and
   `skills/route-workflow/references/intent-routing.md`.
4. The target skill `SKILL.md` plus any immediate predecessor or gate skill that
   can block it.
5. Concern/risk references named by the lane or detected by the request.

The search is bounded by relevance. Do not bulk-load unrelated specs, but do
not stop at the first obvious skill when the graph points to prerequisite
artifacts, skip rules, validators, or proof gates.

## Prompt Package Shape

Return this structure:

```markdown
**Routing Result**
- Normalized intent:
- Mode: human_prompt_composer | internal_continuation | explicit_autorun
- Repo state read:
- Lane/change type:
- Delivery tier:
- Next skill:
- Why this skill now:

**Prompt To Send**
<copy-paste-ready prompt that names the skill, active WI/artifacts, exact read
set, required sequence, blocking conditions, assumptions, and completion bar>

**Required Sequence**
1. <skill or action> - expected artifact/evidence
2. <next skill or gate> - expected artifact/evidence

**Verification And Evals**
- Commands:
- Runtime/proof artifacts:
- Skip conditions and logged justifications:

**Continuation Primitive**
- Use `/goal` when the next run needs a bounded objective and completion bar.
- Use `/loop` or host autorun only when the graph is already explicit and
  non-blocking continuation is safe.
- Use `dispatch-waves` when multiple WI IDs or independent work items can run
  concurrently.
- Use a normal single-turn prompt when the next step has unresolved ambiguity.

**Closeout Requirements**
- Required receipts/gates:
- Local residue/branch/worktree checks:
- Push or PR expectation:

**Next:** <paste/send the prompt above, or run the named target skill/continuation primitive; exactly one line>
```

## Output Protocol Compatibility

The prompt package still obeys `skills/route-workflow/references/task-graph-protocol.md`:
end with exactly one `**Next:**` line. For `human_prompt_composer`, that line is
the UX trailer for the full package, not a substitute for it. It must name the
target skill or continuation primitive and point back to the copy-paste prompt
above. A response that only says `**Next:** run <skill>` fails this contract.

## Composition Rules

- The prompt must be written for full completion of the routed slice, not for a
  partial analysis stop.
- Internal continuation prompts must not outrank an explicit human correction.
  If the latest user message says the work is unrelated, wrong-session, ignored,
  stopped, or asks "what are you doing", require an explicit same-WI
  `continue WI-XXX` / `resume WI-XXX` before composing execution pressure.
- Include the exact target skill name and the exact reason it is the right next
  skill now.
- Include prerequisite skills when the current skill would fail without them.
- Include eval commands and expected artifacts, not just "run tests".
- Include skip conditions with the evidence needed to justify each skip.
- Include host capability suggestions only when useful: `/goal` for bounded
  long-running work, `/loop` for explicit non-blocking continuation,
  `dispatch-waves` for parallel WI execution, and cross-model review when the
  lane or risk flags require it.
- Include exactly one `**Next:**` trailer that names the immediate next action
  and preserves the prompt package as the source of truth.
- Never hide uncertainty. If the next prompt depends on an unverified artifact,
  tell the downstream agent to read or produce that artifact before mutating.
- Never fabricate platform capabilities. If a continuation primitive is not
  verified for the host/project, say so and give the core-framework fallback.

## Anti-Patterns

| Anti-pattern | Why it fails |
|---|---|
| "Next: run `validate-feature`" | Loses the context that made the route correct and weakens the next model call. |
| Self-dispatching from a human advisory request | The route response has less power than a fresh full prompt and can skip framework context. |
| Omitting evals or closeout | The downstream skill can appear complete while missing proof gates. |
| Suggesting `/loop` without a task graph | Continuation without state creates drift and duplicate work. |
| Reading the whole repo blindly | Wastes context and hides the specific evidence the route depends on. |

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Prompt package is complete | Output contains all sections in "Prompt Package Shape" | |
| 2 | Target skill is grounded | Prompt cites route evidence and the target skill contract | |
| 3 | Sequence is executable | Required Sequence includes blockers, artifacts, and gates | |
| 4 | Continuation primitive justified | `/goal`, `/loop`, `dispatch-waves`, or fallback is selected with a reason | |
| 5 | Verification is explicit | Evals/proof commands and closeout checks are named | |
| 6 | Output protocol reconciled | Exactly one `**Next:**` line exists and points to the full prompt package/target skill | |
