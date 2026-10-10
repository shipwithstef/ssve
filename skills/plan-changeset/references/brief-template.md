# Brief (bounded planning)

A brief is the plan for a prototype or MVP. It is one page, it is written before any code, and it grows: discoveries are appended to its decision log. It replaces the full changeset for those profiles (`docs/decisions/2026-10-10-bounded-delivery.md`). Save it as `docs/plans/<YYYY-MM-DD>-<name>/brief.md`.

## 0. Words and the first question
The 10 expert terms from analyze-domain. For each term, one line on what it means and one on how it changes what we build. Then the question to settle first, what it decides, and the default being built on. The build does not wait for the owner's answer; a later answer is an amendment in the decision log.

## 1. Done when
The outcome in one or two sentences, then the checks that prove it. Every check is a command that exits 0 on success.

| id | check (command) | what it proves | kind (unit, sim, browser, chaos, judge) |
|---|---|---|---|

The steady state is what must stay true under faults, for example "two players see each other move within 200 ms" or "gold is never duplicated". `scripts/chaos-probe.mjs` holds the build to it.

## 2. Boundaries
- **Owned paths:** one row per worker or stream. Scopes must be disjoint (`scripts/lib/disjoint-scopes.mjs`).
- **Contract:** the frozen interfaces (message shapes, API routes, module exports), kept in a versioned file such as `contract/v1.json`. Only the lead changes the contract, by writing a new version and a decision-log entry.
- **Never touch:** paths and systems that are out of bounds.
- **Irreversible zones:** auth, money, data migrations, deploys and secrets in this build. Touching one restores full review depth (`compile-delivery-graph.mjs` `irreversibleZones`).

## 3. Open questions
Each unknown that could change the build, with how it gets settled.

| id | question | experiment | check that decides it | budget (variants, minutes, $) |
|---|---|---|---|---|

Settle a question with `node scripts/probe-loop.mjs run --spec <spec.json>`: N cheap variants run in parallel against the check, and the lead picks the winner.

## 4. Decision log (append-only)
| when | decision | evidence (check output, probe result, owner answer) | confidence | what changed |
|---|---|---|---|---|

Rules:
- Two failed checks on the same question, or a boundary that has to move, means the brief is revised before more code is written.
- An owner answer that did not come is recorded as an assumption with the default taken. The owner can overturn it later from the cockpit.

## Loop
1. **Skeleton:** a runnable shell, the contract and the check harness, committed within minutes.
2. **Probe:** settle the open questions with probe-loop.
3. **Fill:** fan out by owned paths, committing after each passing check.
4. **Harden:** the chaos pass, and a mutation probe on the tests (`scripts/quality-probes.mjs`).
5. **Gate:** full review only where an irreversible zone was touched, and at release under the production profile.
