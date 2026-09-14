# Thinking Models for Execution

Structured reasoning models for decision points during svc execution.
These are not abstract philosophy — each model solves a specific class of
decision that agents get wrong by default.

Source: adapted from GSD references/thinking-models-execution.md (MIT, Copyright 2025 TACHES).

Use these when facing a non-trivial decision. Skip them for straightforward
tasks (see "When NOT to Think" at the bottom).

---

## Circle of Concern vs Circle of Control

**The problem it solves:** Agents wander outside the plan's scope because
they notice things that could be improved. Every noticed problem feels like
it should be fixed. This expands the session, burns context, and delays the
actual deliverable.

**The model:** Separate what you CAN control (your current task) from what
you are CONCERNED about (everything else you notice). Only act within the
circle of control.

**In svc terms:**
- **Circle of Control:** The current task in the manifest. The files listed
  in the task's file set. The ACs that map to this task.
- **Circle of Concern:** Code quality in other modules. Missing tests
  elsewhere. Outdated dependencies. UX issues in unrelated screens.

**Decision rule:** If the work is in Circle of Concern but not Circle of
Control, log it as a finding and move on. Do not fix it. Do not spend
tokens investigating it. Do not even estimate the effort.

---

## Forcing Function

**The problem it solves:** Agents defer decisions by writing `// TODO:
decide X later` or creating configuration options for both choices. This
pushes complexity to runtime and makes the code harder to test, deploy,
and reason about.

**The model:** Force the decision now. At build time, you have the spec,
the tech design, and the context to decide. At runtime, you have none of
that. A TODO is a decision debt with compound interest.

**In svc terms:**
- When the spec says "sort by relevance" and you are unsure what
  "relevance" means — resolve it. Read the spec's AC definitions. If
  still ambiguous, ask the user. Do not write `// TODO: define relevance
  scoring`.
- When two approaches are equivalent — pick one. Do not create a config
  toggle. Do not abstract over both. The plan already narrowed the option
  space.
- When a dependency has two modes — pick the one the tech design specifies.
  If the tech design does not specify, pick the simpler one.

**Decision rule:** Every TODO in generated code is a failure of the
planning phase. If you are writing a TODO during execution, something was
missed earlier. Flag it as a loop-back, resolve it, then implement.

---

## First Principles

**The problem it solves:** LLMs are pattern matchers. When they see how
something is done in an adjacent file, they copy that pattern — even when
the adjacent file solves a different problem. This is cargo-culting. The
code "looks right" but does the wrong thing.

**The model:** Before copying a pattern, ask: what problem does this
pattern solve? Is my problem the same? If not, derive the solution from
the requirements, not from existing code.

**In svc terms:**
- The style contract defines which patterns ARE correct to reuse (naming
  conventions, import order, test structure). Follow those.
- Everything else — business logic, data flow, state management, error
  handling — should be derived from the spec and tech design, not from
  what the adjacent service does.
- When the adjacent file uses a complex pattern (pub/sub, event sourcing,
  CQRS), do not adopt it unless the tech design specifies it for your
  component.

**Decision rule:** If the pattern comes from the style contract, follow
it. If it comes from an adjacent file, derive from requirements instead.

---

## Occam's Razor

**The problem it solves:** Agents over-engineer. They add abstraction
layers, create generic solutions for specific problems, introduce patterns
that handle edge cases the spec does not mention. This makes the code
harder to review, harder to test, and harder to change.

**The model:** The simplest implementation that satisfies all stated
requirements is the best implementation. Do not optimize for requirements
that do not exist. Do not generalize for reuse that is not planned.

**In svc terms:**
- If the spec says "list items" and the tech design says "REST endpoint
  returning JSON array," the implementation is a single endpoint that
  queries the database and returns the result. Not a generic list service
  with pagination, filtering, sorting, and caching — unless those are in
  the spec.
- If a function has one caller, it does not need to be generic.
- If a value is used in one place, it does not need to be extracted to
  config.
- If an error has one handler, it does not need a custom error class
  hierarchy.

**Decision rule:** Count the ACs this code must satisfy. Implement exactly
those. If the AC says "returns a list of items," a `SELECT * FROM items`
and `res.json(items)` is correct. Add complexity only when an AC demands it.

---

## Chesterton's Fence

**The problem it solves:** Agents encounter existing code that seems
unnecessary, redundant, or poorly structured. They remove it or refactor
it to "clean up." The existing code was handling an edge case, working
around a library bug, or satisfying a requirement that is not in the spec
they are reading.

**The model:** Before removing or changing existing code, understand why it
was written. If you cannot determine the reason, assume there is one and
leave the code intact.

**In svc terms:**
- Before deleting a function: check if it is called from tests, scripts,
  or dynamic imports that static analysis misses.
- Before removing a `try/catch`: check if the library actually throws
  in production scenarios that the test suite does not cover.
- Before simplifying a conditional: check git blame. The condition may have
  been added to fix a specific bug.
- Before removing a CSS rule: check responsive breakpoints and browser
  compatibility notes.

**Decision rule:** If you are about to delete or change existing code:
1. Check git blame for the commit that introduced it.
2. Read the commit message.
3. Check for related tests that exercise the code path.
4. If none of these explain it, leave it and add a comment: `// Existing
   behavior — purpose unclear. See [commit hash].`

---

## When NOT to Think

These models add value at decision points. They add overhead everywhere
else. Skip structured reasoning when:

- **Following the style contract.** The pattern is defined. Apply it.
- **Implementing a clear AC.** The spec says what to do. Do it.
- **Trivial edits.** Adding an import, fixing a typo, updating a version.
- **The tech design specifies the approach.** The decision was already made
  in an earlier phase. Execute it.
- **The pattern is already established in this codebase.** The first instance
  required a decision. Subsequent instances are repetition.

The test: if you can describe the task in one sentence and the implementation
is obvious from that sentence, just do it. Save thinking for the moments
where two reasonable people would disagree.

---

## Cross-References

- `references/anti-patterns.md` — AP-6 (re-litigating decisions), AP-11 (Chesterton's Fence), AP-12 (cargo-culting)
- `references/verification-patterns.md` — Verification levels prevent false completion
- `DOCTRINE.md` — The entropy argument for why progressive narrowing works
